import { ApiError } from '../../../core/http/apiError.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { Batch, BatchDocumentListItem, BatchSummary, RecentActivityItem } from '../model/batch.model.js';
import { batchesRepository } from '../repository/batches.repository.js';
import { aiConfigRepository } from '../../aiConfig/repository/aiConfig.repository.js';
import { decryptSecret } from '../../../core/crypto/secrets.js';
import { env } from '../../../core/config/env.js';

const sha256File = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

const safeUnlink = async (filePath: string): Promise<void> => {
  await fsp.unlink(filePath).catch(() => undefined);
};

const safeRm = async (targetPath: string): Promise<void> => {
  await fsp.rm(targetPath, { recursive: true, force: true }).catch(() => undefined);
};

const safeMoveFile = async (args: { srcPath: string; destPath: string }): Promise<void> => {
  try {
    await fsp.rename(args.srcPath, args.destPath);
    return;
  } catch (err) {
    const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: unknown }).code) : null;
    if (code !== 'EXDEV') throw err;
  }

  await fsp.copyFile(args.srcPath, args.destPath);
  await safeUnlink(args.srcPath);
};

const copyDirRecursive = async (args: { srcDir: string; destDir: string }): Promise<void> => {
  await fsp.mkdir(args.destDir, { recursive: true });
  const entries = await fsp.readdir(args.srcDir, { withFileTypes: true });
  for (const ent of entries) {
    const src = path.join(args.srcDir, ent.name);
    const dest = path.join(args.destDir, ent.name);
    if (ent.isDirectory()) {
      await copyDirRecursive({ srcDir: src, destDir: dest });
      continue;
    }
    if (ent.isFile()) {
      await fsp.copyFile(src, dest);
    }
  }
};

const processingBatches = new Set<string>();

const sanitizePathSegment = (value: string): string => {
  const trimmed = value.trim();
  const replaced = trimmed.replace(/[\/\\]+/g, '_').replace(/[^\w.-]+/g, '_');
  const collapsed = replaced.replace(/_+/g, '_');
  return collapsed.replace(/^_+|_+$/g, '').slice(0, 80) || 'Unknown';
};

const tryExtractRequester = (responseJson: unknown): string | null => {
  if (!responseJson || typeof responseJson !== 'object') return null;
  const fields = (responseJson as Record<string, unknown>).fields;
  if (!fields || typeof fields !== 'object') return null;
  const f = fields as Record<string, unknown>;
  const v = typeof f.requester === 'string' ? f.requester : typeof f.requesterName === 'string' ? f.requesterName : typeof f.personName === 'string' ? f.personName : null;
  return v && v.trim().length > 0 ? v.trim() : null;
};

type ExportOrderBy = 'created_at' | 'filename';
type ExportNumberingMode = 'global' | 'per_category';

const toComparableString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return String(value);
};

const compareStrings = (a: unknown, b: unknown) => toComparableString(a).localeCompare(toComparableString(b), undefined, { sensitivity: 'base' });

const computePadLength = (start: number, count: number) => Math.max(3, String(start + Math.max(0, count - 1)).length);

const buildZipFromDirectory = async (args: { dirPath: string; zipPath: string }): Promise<number> => {
  const require = createRequire(import.meta.url);
  const mod = require('archiver') as { default?: unknown } | ((...args: unknown[]) => unknown);
  const archiverFn = (typeof mod === 'function' ? mod : (mod as { default?: unknown }).default) as unknown as (
    format: 'zip',
    options: { zlib: { level: number } },
  ) => {
    directory: (dir: string, destPath: string | false) => unknown;
    finalize: () => Promise<void>;
    on: (evt: 'error' | 'warning', cb: (err: Error) => void) => void;
    pipe: (stream: NodeJS.WritableStream) => void;
  };

  await fsp.mkdir(path.dirname(args.zipPath), { recursive: true });
  const tmpPath = `${args.zipPath}.tmp`;
  const output = fs.createWriteStream(tmpPath);

  const archive = archiverFn('zip', { zlib: { level: 9 } });
  const done = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    output.on('error', reject);
    archive.on('warning', (err) => {
      reject(err);
    });
    archive.on('error', (err) => {
      reject(err);
    });
  });

  archive.pipe(output);
  archive.directory(args.dirPath, false);
  await archive.finalize();
  await done;

  await fsp.rename(tmpPath, args.zipPath);
  const stat = await fsp.stat(args.zipPath);
  return stat.size;
};

const getPdfJsOptions = () => {
  const require = createRequire(import.meta.url);
  const pdfjsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = path.join(pdfjsDistDir, 'standard_fonts') + path.sep;
  const wasmUrl = path.join(pdfjsDistDir, 'wasm') + path.sep;
  return { standardFontDataUrl, wasmUrl };
};

const renderFirstPagePng = async (pdfPath: string): Promise<Buffer> => {
  const bytes = await fsp.readFile(pdfPath);
  const { standardFontDataUrl, wasmUrl } = getPdfJsOptions();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl,
    wasmUrl,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext('2d');
  const renderable = page as unknown as {
    render: (params: { canvas: unknown; canvasContext: unknown; viewport: unknown }) => { promise: Promise<unknown> };
  };
  const renderTask = renderable.render({ canvas, canvasContext: ctx, viewport });
  await renderTask.promise;
  return canvas.toBuffer('image/png');
};

const extractFirstPageText = async (pdfPath: string): Promise<string> => {
  const bytes = await fsp.readFile(pdfPath);
  const { standardFontDataUrl, wasmUrl } = getPdfJsOptions();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    standardFontDataUrl,
    wasmUrl,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(1);
  const tc = await (page as unknown as { getTextContent: () => Promise<{ items: Array<{ str?: unknown }> }> }).getTextContent();
  const chunks = tc.items.map((it) => (typeof it.str === 'string' ? it.str : '')).filter((s) => s.trim().length > 0);
  return chunks.join(' ').trim();
};

const buildPrompt = (categories: string[]) => {
  const list = categories.map((c) => `- ${c}`).join('\n');
  const system = [
    'You are a document classification engine.',
    'Classify the document into exactly one category from the allowed list.',
    'Return valid JSON only. No markdown. No extra keys.',
    '',
    'Allowed categories:',
    list,
  ].join('\n');

  const user = [
    'Return JSON with this exact shape:',
    '{',
    '  "category": string,',
    '  "confidence": number,',
    '  "fields": { "documentNumber": string|null, "personName": string|null, "documentDate": string|null, "organization": string|null, "notes": string|null },',
    '  "anchors": string[]',
    '}',
    '',
    'Rules:',
    '- confidence must be 0..100',
    '- category must be one of the allowed categories',
    '- anchors must contain short phrases visible in the document (max 8 items)',
  ].join('\n');

  return { system, user };
};

const normalizeModelOutput = (args: { categories: string[]; content: string }) => {
  const parsed = JSON.parse(args.content) as {
    category?: unknown;
    confidence?: unknown;
    fields?: unknown;
    anchors?: unknown;
  };

  const category = typeof parsed.category === 'string' ? parsed.category : '';
  const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : Number(parsed.confidence);
  const fields = (parsed.fields && typeof parsed.fields === 'object' ? (parsed.fields as Record<string, unknown>) : {}) as Record<
    string,
    unknown
  >;
  const anchors = Array.isArray(parsed.anchors) ? parsed.anchors : [];

  if (!args.categories.includes(category)) throw new Error(`Invalid category returned: ${category || '(empty)'}`);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 100) throw new Error(`Invalid confidence: ${String(parsed.confidence)}`);

  const normFields: Record<string, string | null> = {
    documentNumber: typeof fields.documentNumber === 'string' ? fields.documentNumber : null,
    personName: typeof fields.personName === 'string' ? fields.personName : null,
    documentDate: typeof fields.documentDate === 'string' ? fields.documentDate : null,
    organization: typeof fields.organization === 'string' ? fields.organization : null,
    notes: typeof fields.notes === 'string' ? fields.notes : null,
  };

  const normAnchors = anchors
    .filter((a): a is string => typeof a === 'string')
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .slice(0, 8);

  return { category, confidence, fields: normFields, anchors: normAnchors };
};

const callOpenAiVision = async (args: { apiKey: string; model: string; imagePng: Buffer; categories: string[] }) => {
  const { system, user } = buildPrompt(args.categories);
  const base64 = args.imagePng.toString('base64');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: [
            { type: 'text', text: user },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`OpenAI call failed (${res.status}): ${msg.slice(0, 400)}`);
  }

  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return { content, raw: payload };
};

const callOpenAiText = async (args: { apiKey: string; model: string; text: string; categories: string[] }) => {
  const { system, user } = buildPrompt(args.categories);
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${args.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: args.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `${user}\n\nDocument text:\n${args.text.slice(0, 12000)}` },
      ],
    }),
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => '');
    throw new Error(`OpenAI call failed (${res.status}): ${msg.slice(0, 400)}`);
  }

  const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');
  return { content, raw: payload };
};

const applyAnchorOverrides = (args: {
  categories: string[];
  category: string;
  confidence: number;
  anchors: string[];
  overrides: Array<{ category: string; anchorKeywords: string[]; priority: number; isActive: boolean }>;
}) => {
  const loweredAnchors = args.anchors.map((a) => a.toLowerCase());
  let best: { category: string; confidence: number; matched: number; priority: number } | null = null;

  for (const o of args.overrides) {
    if (!o.isActive) continue;
    if (!args.categories.includes(o.category)) continue;
    const keywords = o.anchorKeywords.map((k) => k.toLowerCase()).filter((k) => k.length > 0);
    if (keywords.length === 0) continue;
    let matched = 0;
    for (const kw of keywords) {
      if (loweredAnchors.some((a) => a.includes(kw))) matched += 1;
    }
    if (matched === 0) continue;
    const candidate = { category: o.category, confidence: Math.max(args.confidence, 99), matched, priority: o.priority };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.matched > best.matched) {
      best = candidate;
      continue;
    }
    if (candidate.matched === best.matched && candidate.priority < best.priority) {
      best = candidate;
    }
  }

  if (!best) return args;
  return { ...args, category: best.category, confidence: best.confidence };
};

const requireOpenAiKey = async (): Promise<string> => {
  const encrypted = await aiConfigRepository.getEncryptedKey('openai');
  if (!encrypted) throw new Error('OpenAI key is not configured');
  return decryptSecret(encrypted);
};

const decodeProcPath = (raw: string): string =>
  raw
    .replaceAll('\\040', ' ')
    .replaceAll('\\011', '\t')
    .replaceAll('\\012', '\n')
    .replaceAll('\\134', '\\');

const findMountForPath = async (mountPath: string): Promise<{ source: string; fstype: string } | null> => {
  try {
    const raw = await fsp.readFile('/proc/mounts', 'utf8');
    const lines = raw.split('\n').filter((l) => l.trim().length > 0);
    for (const line of lines) {
      const parts = line.split(' ');
      if (parts.length < 3) continue;
      const sourceRaw = parts[0];
      const targetRaw = parts[1];
      const fstype = parts[2];
      if (!sourceRaw || !targetRaw || !fstype) continue;
      const source = decodeProcPath(sourceRaw);
      const target = decodeProcPath(targetRaw);
      if (target === mountPath) return { source, fstype };
    }
    return null;
  } catch {
    return null;
  }
};

const assertSharedFolderAccessible = async (): Promise<void> => {
  if (!env.sharedFolderPath) return;
  const root = env.sharedFolderPath;
  try {
    const stat = await fsp.stat(root);
    if (!stat.isDirectory()) {
      throw new Error('SHARED_FOLDER_PATH is not a directory');
    }
    await fsp.access(root, fs.constants.R_OK | fs.constants.W_OK);

    const requireCifsMount = Boolean(env.cifsSharePath && env.cifsSharePath.trim().length > 0);
    if (requireCifsMount && process.platform === 'linux') {
      const resolved = path.resolve(root);
      const mount = await findMountForPath(resolved);
      if (!mount) {
        throw new Error(`Shared folder is not mounted at ${resolved}`);
      }
      const allowed = new Set(['cifs', 'smbfs']);
      if (!allowed.has(mount.fstype)) {
        throw new Error(`Shared folder is not mounted as CIFS (mount type: ${mount.fstype})`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Shared folder is not accessible';
    throw new ApiError({
      status: 503,
      code: 'STORAGE_UNAVAILABLE',
      message: `Shared folder is not accessible (${root}). ${message}`,
    });
  }
};

export const batchesService = {
  list: async (): Promise<Batch[]> => batchesRepository.list(),

  getQueueMetrics: async () => {
    const counts = await batchesRepository.getGlobalCounts();
    const backlogCount = counts.queued + counts.processing;
    const backlogRatio = counts.total > 0 ? backlogCount / counts.total : 0;
    const computeLoadPercent = Math.max(0, Math.min(100, Math.round(backlogRatio * 100)));

    return {
      totalDocuments: counts.total,
      queued: counts.queued,
      processing: counts.processing,
      backlogCount,
      backlogRatio,
      computeLoadPercent,
      updatedAt: new Date().toISOString(),
    };
  },

  create: async (args: {
    name: string;
    mappingProfileId?: string;
    aiProvider: 'gemini' | 'openai';
    aiModel: string;
    docTypeHandling: 'standard' | 'ocr' | 'scanned';
    createdBy?: string;
  }): Promise<Batch> => {
    await assertSharedFolderAccessible();
    return batchesRepository.create(args);
  },

  updateBatch: async (args: { id: string; name?: string; status?: Batch['status'] }): Promise<Batch> => {
    const existing = await batchesRepository.getById(args.id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (!args.name && !args.status) return existing;
    return batchesRepository.updateBatch({ id: args.id, name: args.name, status: args.status });
  },

  softDeleteBatch: async (args: { id: string; deletedBy: string }): Promise<void> => {
    const ok = await batchesRepository.softDeleteBatch({ id: args.id, deletedBy: args.deletedBy });
    if (!ok) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    await batchesRepository.softDeleteBatchDocumentsByBatchId({ batchId: args.id, deletedBy: args.deletedBy });
  },

  purgeBatch: async (args: { id: string; deletedBy: string }): Promise<void> => {
    const existing = await batchesRepository.getById(args.id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });

    const [docs, exportRoots] = await Promise.all([
      batchesRepository.listBatchDocumentsForPurge(args.id),
      batchesRepository.listExportOutputPathsForBatch(args.id),
    ]);

    await batchesRepository.hardDeleteBatch(args.id);

    for (const d of docs) {
      const deleted = await batchesRepository.deleteDocumentIfOrphan(d.documentId);
      if (deleted) await safeUnlink(d.storagePath);
    }

    const batchUploadDir = path.join(env.uploadDir, args.id);
    await safeRm(batchUploadDir);

    for (const root of exportRoots) {
      await safeRm(root);
      await safeUnlink(`${root}.zip`);
    }
  },

  getById: async (id: string): Promise<BatchSummary> => {
    const batch = await batchesRepository.getById(id);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    const totals = await batchesRepository.getCounts(id);
    return { ...batch, totals };
  },

  start: async (id: string): Promise<BatchSummary> => {
    await assertSharedFolderAccessible();
    const existing = await batchesRepository.getById(id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (existing.status !== 'draft') {
      throw new ApiError({ status: 409, code: 'CONFLICT', message: `Batch is not in draft status (${existing.status})` });
    }
    await batchesRepository.start(id);
    void batchesService.processBatch(id);
    return batchesService.getById(id);
  },

  uploadDocuments: async (
    batchId: string,
    files: Array<{ path: string; originalName: string; mimeType: string | null; sizeBytes: number }>,
  ): Promise<{ added: number }> => {
    await assertSharedFolderAccessible();
    const batch = await batchesRepository.getById(batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (batch.status !== 'draft') {
      throw new ApiError({ status: 409, code: 'CONFLICT', message: `Batch is not in draft status (${batch.status})` });
    }
    if (files.length === 0) return { added: 0 };

    for (const f of files) {
      const sha256 = await sha256File(f.path);
      let storagePath = f.path;

      if (env.sharedFolderPath) {
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const batchFolder = `${sanitizePathSegment(batch.name)}_${batch.id.slice(0, 8)}`;
        const destDir = path.join(env.sharedFolderPath, 'uploads', yyyy, mm, dd, batchFolder);
        await fsp.mkdir(destDir, { recursive: true });

        const destPath = path.join(destDir, path.basename(f.path));
        await safeMoveFile({ srcPath: f.path, destPath });
        storagePath = destPath;
      }

      await batchesRepository.addUploadedDocumentToBatch({
        batchId,
        originalFilename: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        sha256,
        storagePath,
      });
    }

    return { added: files.length };
  },

  listDocuments: async (batchId: string): Promise<BatchDocumentListItem[]> => {
    const batch = await batchesRepository.getById(batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    return batchesRepository.listBatchDocuments(batchId);
  },

  softDeleteDocument: async (args: { batchId: string; batchDocumentId: string; deletedBy: string }): Promise<void> => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    const ok = await batchesRepository.softDeleteBatchDocument({
      batchId: args.batchId,
      batchDocumentId: args.batchDocumentId,
      deletedBy: args.deletedBy,
    });
    if (!ok) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
  },

  purgeDocument: async (args: { batchId: string; batchDocumentId: string; deletedBy: string }): Promise<void> => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });

    const info = await batchesRepository.getBatchDocumentPurgeInfo({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
    if (!info) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });

    const deleted = await batchesRepository.hardDeleteBatchDocument({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
    if (!deleted) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });

    const docDeleted = await batchesRepository.deleteDocumentIfOrphan(info.documentId);
    if (docDeleted) await safeUnlink(info.storagePath);
  },

  getDocumentDetails: async (args: { batchId: string; batchDocumentId: string }) => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    const details = await batchesRepository.getBatchDocumentDetails(args);
    if (!details) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
    return {
      batchDocumentId: details.batchDocumentId,
      batchId: details.batchId,
      documentId: details.documentId,
      originalFilename: details.originalFilename,
      mimeType: details.mimeType,
      sizeBytes: details.sizeBytes,
      status: details.status,
      finalCategory: details.finalCategory,
      finalConfidence: details.finalConfidence,
      createdAt: details.createdAt,
      responseJson: details.responseJson,
    };
  },

  getDocumentFile: async (args: { batchId: string; batchDocumentId: string }) => {
    const details = await batchesRepository.getBatchDocumentDetails(args);
    if (!details) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
    return { filePath: details.storagePath, fileName: details.originalFilename, mimeType: details.mimeType ?? 'application/pdf' };
  },

  updateDocumentCategory: async (args: { batchId: string; batchDocumentId: string; category: string }) => {
    const details = await batchesRepository.getBatchDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
    if (!details) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
    await batchesRepository.updateBatchDocumentCategory({ batchDocumentId: args.batchDocumentId, category: args.category });
    return batchesService.getDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
  },

  updateDocumentFields: async (args: {
    batchId: string;
    batchDocumentId: string;
    fields: Partial<Record<'documentNumber' | 'personName' | 'documentDate' | 'organization' | 'notes' | 'requester', string | null>>;
  }) => {
    const details = await batchesRepository.getBatchDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
    if (!details) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
    const updated = await batchesRepository.updateLatestClassificationRunFields({
      batchDocumentId: args.batchDocumentId,
      fields: args.fields,
    });
    if (!updated) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'No classification run exists for this document yet' });
    return batchesService.getDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
  },

  approveDocument: async (args: { batchId: string; batchDocumentId: string }) => {
    const details = await batchesRepository.getBatchDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
    if (!details) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch document not found' });
    await batchesRepository.approveBatchDocument({ batchDocumentId: args.batchDocumentId });
    return batchesService.getDocumentDetails({ batchId: args.batchId, batchDocumentId: args.batchDocumentId });
  },

  bulkApproveDocuments: async (args: { batchId: string; batchDocumentIds: string[] }) => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (args.batchDocumentIds.length === 0) return { updated: 0 };
    const updated = await batchesRepository.bulkApproveBatchDocuments(args);
    return { updated };
  },

  bulkSetCategory: async (args: { batchId: string; batchDocumentIds: string[]; category: string }) => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (args.batchDocumentIds.length === 0) return { updated: 0 };
    const updated = await batchesRepository.bulkSetBatchDocumentCategory(args);
    return { updated };
  },

  exportBatch: async (args: {
    batchId: string;
    startingIndex: number;
    orderBy: ExportOrderBy;
    groupByCategory: boolean;
    numberingMode: ExportNumberingMode;
    startingIndexByCategory?: Record<string, number>;
  }) => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (!batch.mappingProfileId) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Batch is missing mapping profile' });

    const docs = await batchesRepository.listBatchDocuments(args.batchId);
    const total = docs.length;
    if (total === 0) throw new ApiError({ status: 409, code: 'CONFLICT', message: 'Batch has no documents to export' });

    const notApproved = docs.filter((d) => d.status !== 'approved');
    if (notApproved.length > 0) {
      throw new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: `Export requires all documents to be approved (${total - notApproved.length}/${total} approved)`,
      });
    }

    const startingIndex = Math.max(0, Math.min(999999, args.startingIndex));

    const safeName = sanitizePathSegment(batch.name);
    const outputRoot = path.join(env.exportDir, `${safeName}_${batch.id.slice(0, 8)}`);
    await fsp.mkdir(outputRoot, { recursive: true });

    const exportRow = await batchesRepository.createExport({ batchId: batch.id, outputPath: outputRoot });

    try {
      const approvedRaw = await batchesRepository.listApprovedForExport({ batchId: batch.id });
      const groupByCategory = args.groupByCategory || args.numberingMode === 'per_category';
      const approved = [...approvedRaw].sort((a, b) => {
        if (groupByCategory) {
          const cat = compareStrings(a.finalCategory, b.finalCategory);
          if (cat !== 0) return cat;
        }
        if (args.orderBy === 'filename') return compareStrings(a.originalFilename, b.originalFilename);
        return compareStrings(a.createdAt, b.createdAt);
      });

      const manifest: {
        batchId: string;
        batchName: string;
        createdAt: string;
        outputRoot: string;
        exportConfig: { startingIndex: number; orderBy: ExportOrderBy; groupByCategory: boolean; numberingMode: ExportNumberingMode };
        files: Array<{
          seq: number;
          docNumber: string;
          batchDocumentId: string;
          documentId: string;
          category: string;
          requester: string | null;
          targetFolder: string;
          targetPrefix: string | null;
          targetCode: string | null;
          originalFilename: string;
          exportedRelativePath: string;
          exportedFilename: string;
        }>;
      } = {
        batchId: batch.id,
        batchName: batch.name,
        createdAt: new Date().toISOString(),
        outputRoot,
        exportConfig: {
          startingIndex,
          orderBy: args.orderBy,
          groupByCategory,
          numberingMode: args.numberingMode,
        },
        files: [],
      };

      let totalSize = 0;
      const usedNames = new Set<string>();

      const perCategoryTotals = args.numberingMode === 'per_category'
        ? approved.reduce<Record<string, number>>((acc, d) => {
            acc[d.finalCategory] = (acc[d.finalCategory] ?? 0) + 1;
            return acc;
          }, {})
        : {};

      const perCategoryCounters = new Map<string, number>();
      const globalPad = computePadLength(startingIndex, approved.length);

      for (let i = 0; i < approved.length; i += 1) {
        const doc = approved[i]!;
        const seq = i + 1;

        const rule = await batchesRepository.getCategoryRuleByTargetFolder({ profileId: batch.mappingProfileId, category: doc.finalCategory });
        const targetFolder = rule?.targetFolder ?? doc.finalCategory;
        const targetPrefix = rule?.targetPrefix ?? null;
        const targetCode = rule?.targetCode ?? null;

        const requesterRaw = tryExtractRequester(doc.responseJson);
        const requester = requesterRaw ? sanitizePathSegment(requesterRaw) : null;

        const prefix = targetPrefix ? sanitizePathSegment(targetPrefix) : '';

        let currentNumber: number;
        let padLen: number;
        if (args.numberingMode === 'per_category') {
          const categoryStartRaw = args.startingIndexByCategory?.[doc.finalCategory];
          const categoryStart = typeof categoryStartRaw === 'number' && Number.isFinite(categoryStartRaw) ? categoryStartRaw : startingIndex;
          const cur = perCategoryCounters.get(doc.finalCategory) ?? categoryStart;
          currentNumber = cur;
          perCategoryCounters.set(doc.finalCategory, cur + 1);
          padLen = computePadLength(categoryStart, perCategoryTotals[doc.finalCategory] ?? 1);
        } else {
          currentNumber = startingIndex + i;
          padLen = globalPad;
        }

        const docNumber = String(currentNumber).padStart(padLen, '0');

        const who = requester ?? 'Unknown';
        const base = `${prefix}${docNumber} - ${who}`;
        const fileNameCandidate = `${base}.pdf`;
        const fileName = usedNames.has(fileNameCandidate) ? `${base}_${doc.batchDocumentId.slice(0, 6)}.pdf` : fileNameCandidate;
        usedNames.add(fileName);

        const destDir = path.join(outputRoot, sanitizePathSegment(targetFolder));
        await fsp.mkdir(destDir, { recursive: true });
        const destPath = path.join(destDir, fileName);

        await fsp.copyFile(doc.storagePath, destPath);
        const stat = await fsp.stat(destPath);
        totalSize += stat.size;

        await batchesRepository.updateBatchDocumentTargets({
          batchDocumentId: doc.batchDocumentId,
          targetFolder,
          targetPrefix,
          targetCode,
        });

        const rel = path.relative(outputRoot, destPath);
        manifest.files.push({
          seq,
          docNumber,
          batchDocumentId: doc.batchDocumentId,
          documentId: doc.documentId,
          category: doc.finalCategory,
          requester: requesterRaw,
          targetFolder,
          targetPrefix,
          targetCode,
          originalFilename: doc.originalFilename,
          exportedRelativePath: rel,
          exportedFilename: fileName,
        });
      }

      const manifestPath = path.join(outputRoot, 'manifest.json');
      await fsp.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

      const zipPath = `${outputRoot}.zip`;
      const zipSize = await buildZipFromDirectory({ dirPath: outputRoot, zipPath });

      if (env.sharedFolderPath) {
        const destRoot = path.join(env.sharedFolderPath, 'exports', path.basename(outputRoot));
        await safeRm(destRoot);
        await copyDirRecursive({ srcDir: outputRoot, destDir: destRoot });
      }

      await batchesRepository.setExportResult({
        exportId: exportRow.id,
        status: 'ready',
        outputPath: outputRoot,
        sizeBytes: zipSize,
        errorMessage: null,
      });

      await batchesRepository.setBatchStatus({ batchId: batch.id, status: 'completed', completedAt: 'now' });

      return { ...exportRow, status: 'ready' as const, outputPath: outputRoot, sizeBytes: zipSize };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await batchesRepository.setExportResult({
        exportId: exportRow.id,
        status: 'failed',
        outputPath: exportRow.outputPath,
        sizeBytes: null,
        errorMessage: msg,
      });
      throw new ApiError({ status: 500, code: 'INTERNAL_ERROR', message: 'Export failed', details: { reason: msg } });
    }
  },

  getLatestExport: async (args: { batchId: string }) => {
    const batch = await batchesRepository.getById(args.batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    const latest = await batchesRepository.getLatestExportForBatch(args.batchId);
    if (!latest) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No exports for this batch' });
    return latest;
  },

  getExportManifestFile: async (args: { batchId: string }) => {
    const latest = await batchesRepository.getLatestExportForBatch(args.batchId);
    if (!latest || !latest.outputPath) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No ready export for this batch' });
    const manifestPath = path.join(latest.outputPath, 'manifest.json');
    return { filePath: manifestPath, fileName: `manifest_${args.batchId}.json`, mimeType: 'application/json' };
  },

  getExportZipFile: async (args: { batchId: string }) => {
    const latest = await batchesRepository.getLatestExportForBatch(args.batchId);
    if (!latest || latest.status !== 'ready' || !latest.outputPath) {
      throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No ready export for this batch' });
    }
    const zipPath = `${latest.outputPath}.zip`;
    return { filePath: zipPath, fileName: `export_${args.batchId}.zip`, mimeType: 'application/zip' };
  },

  getExportedDocumentFile: async (args: { batchId: string; batchDocumentId: string }) => {
    const latest = await batchesRepository.getLatestExportForBatch(args.batchId);
    if (!latest || latest.status !== 'ready' || !latest.outputPath) {
      throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'No ready export for this batch' });
    }
    const manifestPath = path.join(latest.outputPath, 'manifest.json');
    const raw = await fsp.readFile(manifestPath, 'utf8').catch(() => null);
    if (!raw) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Export manifest not found' });
    const parsed = JSON.parse(raw) as { files?: Array<{ batchDocumentId?: string; exportedRelativePath?: string; exportedFilename?: string }> };
    const entry = parsed.files?.find((f) => f.batchDocumentId === args.batchDocumentId);
    if (!entry?.exportedRelativePath) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Exported file not found in manifest' });
    const filePath = path.join(latest.outputPath, entry.exportedRelativePath);
    return { filePath, fileName: entry.exportedFilename ?? path.basename(filePath), mimeType: 'application/pdf' };
  },

  recentActivity: async (limit: number): Promise<RecentActivityItem[]> => {
    const bounded = Math.max(1, Math.min(limit, 100));
    return batchesRepository.listRecentActivity(bounded);
  },

  processBatch: async (batchId: string): Promise<void> => {
    if (processingBatches.has(batchId)) return;
    processingBatches.add(batchId);

    try {
      const batch = await batchesRepository.getById(batchId);
      if (!batch) return;
      if (batch.status !== 'running') return;
      if (!batch.mappingProfileId) throw new Error('Batch is missing mappingProfileId');

      const categories = await batchesRepository.listAllowedCategoriesForProfile(batch.mappingProfileId);
      if (categories.length === 0) throw new Error('No categories are configured for this mapping profile');
      const overrides = await batchesRepository.listAnchorOverridesForProfile(batch.mappingProfileId);

      if (batch.aiProvider !== 'openai') throw new Error(`Unsupported provider for processing: ${batch.aiProvider}`);

      const apiKey = await requireOpenAiKey();
      const queued = await batchesRepository.listQueuedForProcessing(batchId);

      const artifactsRoot = path.join(env.uploadDir, batchId, '_artifacts');
      await fsp.mkdir(artifactsRoot, { recursive: true });

      let anyFailed = false;

      for (const item of queued) {
        await batchesRepository.setBatchDocumentStatus(item.batchDocumentId, 'processing');

        try {
          const wantsVision = batch.docTypeHandling !== 'standard';
          let normalized: { category: string; confidence: number; fields: Record<string, string | null>; anchors: string[] };
          let meta: Record<string, unknown> = {};

          if (!wantsVision) {
            const text = await extractFirstPageText(item.storagePath);
            if (text.length >= 60) {
              const res = await callOpenAiText({ apiKey, model: batch.aiModel, text, categories });
              normalized = normalizeModelOutput({ categories, content: res.content });
              meta = { mode: 'text', raw: res.raw };
            } else {
              const png = await renderFirstPagePng(item.storagePath);
              const imagePath = path.join(artifactsRoot, `${item.batchDocumentId}_page1.png`);
              await fsp.writeFile(imagePath, png);
              const res = await callOpenAiVision({ apiKey, model: batch.aiModel, imagePng: png, categories });
              normalized = normalizeModelOutput({ categories, content: res.content });
              meta = { mode: 'vision', raw: res.raw, imagePath };
            }
          } else {
            const png = await renderFirstPagePng(item.storagePath);
            const imagePath = path.join(artifactsRoot, `${item.batchDocumentId}_page1.png`);
            await fsp.writeFile(imagePath, png);
            const res = await callOpenAiVision({ apiKey, model: batch.aiModel, imagePng: png, categories });
            normalized = normalizeModelOutput({ categories, content: res.content });
            meta = { mode: 'vision', raw: res.raw, imagePath };
          }

          const overridden = applyAnchorOverrides({
            categories,
            category: normalized.category,
            confidence: normalized.confidence,
            anchors: normalized.anchors,
            overrides,
          });

          const responseJson = {
            category: overridden.category,
            confidence: overridden.confidence,
            fields: normalized.fields,
            anchors: normalized.anchors,
            meta,
          };

          const analysisPath = path.join(artifactsRoot, `${item.batchDocumentId}_analysis.json`);
          await fsp.writeFile(analysisPath, JSON.stringify(responseJson, null, 2), 'utf8');

          const status = overridden.confidence >= 80 ? 'ready_for_review' : 'failed';
          if (status === 'failed') anyFailed = true;

          await batchesRepository.insertClassificationRun({
            batchDocumentId: item.batchDocumentId,
            aiProvider: 'openai',
            aiModel: batch.aiModel,
            status: status === 'failed' ? 'failed' : 'success',
            category: overridden.category,
            confidence: overridden.confidence,
            responseJson,
            errorMessage: status === 'failed' ? 'Low confidence' : null,
          });

          await batchesRepository.setBatchDocumentResult({
            batchDocumentId: item.batchDocumentId,
            status,
            finalCategory: overridden.category,
            finalConfidence: overridden.confidence,
            errorMessage: status === 'failed' ? 'Low confidence' : null,
          });
        } catch (err) {
          anyFailed = true;
          const message = err instanceof Error ? err.message : String(err);
          await batchesRepository.insertClassificationRun({
            batchDocumentId: item.batchDocumentId,
            aiProvider: 'openai',
            aiModel: batch.aiModel,
            status: 'failed',
            category: null,
            confidence: null,
            responseJson: null,
            errorMessage: message,
          });
          await batchesRepository.setBatchDocumentResult({
            batchDocumentId: item.batchDocumentId,
            status: 'failed',
            finalCategory: null,
            finalConfidence: null,
            errorMessage: message,
          });
        }
      }

      await batchesRepository.setBatchStatus({ batchId, status: anyFailed ? 'needs_review' : 'needs_review', completedAt: 'now' });
    } catch {
      await batchesRepository.setBatchStatus({ batchId, status: 'failed', completedAt: 'now' });
    } finally {
      processingBatches.delete(batchId);
    }
  },
};
