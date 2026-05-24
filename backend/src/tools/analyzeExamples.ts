import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { decryptSecret } from '../core/crypto/secrets.js';
import { aiConfigRepository } from '../modules/aiConfig/repository/aiConfig.repository.js';
import { env } from '../core/config/env.js';

type AnalysisResult = {
  source: {
    pdfPath: string;
    expectedCategory: string;
  };
  output: {
    category: string;
    confidence: number;
    fields: Record<string, string | null>;
    anchors: string[];
  };
  meta: {
    model: string;
    imagePath: string;
    createdAt: string;
  };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const sha1 = async (buf: Buffer) => {
  const crypto = await import('node:crypto');
  return crypto.createHash('sha1').update(buf).digest('hex');
};

const listPdfs = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      out.push(...(await listPdfs(p)));
      continue;
    }
    if (e.isFile() && e.name.toLowerCase().endsWith('.pdf')) out.push(p);
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
};

const renderFirstPagePng = async (pdfPath: string): Promise<Buffer> => {
  const require = createRequire(import.meta.url);
  const pdfjsDistDir = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const standardFontDataUrl = path.join(pdfjsDistDir, 'standard_fonts') + path.sep;
  const wasmUrl = path.join(pdfjsDistDir, 'wasm') + path.sep;

  const bytes = await fs.readFile(pdfPath);
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

const requireOpenAiKey = async (): Promise<string> => {
  const encrypted = await aiConfigRepository.getEncryptedKey('openai');
  if (!encrypted) throw new Error('OpenAI key is not configured in the database (Settings → AI Configuration).');
  return decryptSecret(encrypted);
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
    'Analyze the document image and return JSON with this exact shape:',
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

const callOpenAiVision = async (args: {
  apiKey: string;
  model: string;
  imagePng: Buffer;
  categories: string[];
}): Promise<{ category: string; confidence: number; fields: Record<string, string | null>; anchors: string[] }> => {
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

  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned empty content');

  const parsed = JSON.parse(content) as {
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

const main = async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
  const exampleDir = path.join(repoRoot, 'example');
  const categoriesDirEntries = await fs.readdir(exampleDir, { withFileTypes: true });
  const categories = categoriesDirEntries.filter((e) => e.isDirectory() && !e.name.startsWith('_')).map((e) => e.name);
  categories.sort((a, b) => a.localeCompare(b));
  if (categories.length === 0) throw new Error(`No categories found under ${exampleDir}`);

  const pdfsAll = await listPdfs(exampleDir);
  const rawLimit = process.env.ANALYZE_LIMIT?.trim();
  const rawPerCategory = process.env.ANALYZE_PER_CATEGORY?.trim();
  const limit = rawLimit ? Number(rawLimit) : null;
  const perCategory = rawPerCategory ? Number(rawPerCategory) : null;

  let pdfs = pdfsAll;
  if (perCategory && Number.isFinite(perCategory) && perCategory > 0) {
    const grouped = new Map<string, string[]>();
    for (const p of pdfsAll) {
      const rel = path.relative(exampleDir, p);
      const cat = rel.split(path.sep)[0] ?? '';
      if (!categories.includes(cat)) continue;
      const arr = grouped.get(cat) ?? [];
      if (arr.length < perCategory) arr.push(p);
      grouped.set(cat, arr);
    }
    pdfs = Array.from(grouped.values()).flat();
    pdfs.sort((a, b) => a.localeCompare(b));
  } else if (limit && Number.isFinite(limit) && limit > 0) {
    pdfs = pdfsAll.slice(0, limit);
  }

  if (pdfs.length === 0) throw new Error(`No PDFs found under ${exampleDir}`);

  const apiKey = await requireOpenAiKey();
  const model = 'gpt-4o';

  const artifactsDir = path.join(exampleDir, '_artifacts');
  const resultsDir = path.join(exampleDir, '_analysis');
  await fs.mkdir(artifactsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsPath = path.join(resultsDir, `results_${stamp}.jsonl`);

  let correct = 0;
  let total = 0;

  for (const pdfPath of pdfs) {
    const rel = path.relative(exampleDir, pdfPath);
    const expectedCategory = rel.split(path.sep)[0] ?? '';
    if (!categories.includes(expectedCategory)) continue;

    total += 1;
    const png = await renderFirstPagePng(pdfPath);
    const hash = await sha1(Buffer.from(`${expectedCategory}\n${pdfPath}`));

    const imageDir = path.join(artifactsDir, expectedCategory);
    await fs.mkdir(imageDir, { recursive: true });
    const imagePath = path.join(imageDir, `${hash}_page1.png`);
    await fs.writeFile(imagePath, png);

    const out = await callOpenAiVision({ apiKey, model, imagePng: png, categories });

    if (out.category === expectedCategory) correct += 1;

    const row: AnalysisResult = {
      source: { pdfPath, expectedCategory },
      output: out,
      meta: { model, imagePath, createdAt: new Date().toISOString() },
    };
    await fs.appendFile(resultsPath, `${JSON.stringify(row)}\n`, 'utf8');

    await sleep(250);
  }

  const acc = total > 0 ? (correct / total) * 100 : 0;
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        model,
        total,
        correct,
        accuracyPct: Number(acc.toFixed(2)),
        resultsPath,
        artifactsDir,
        uploadDir: env.uploadDir,
      },
      null,
      2,
    ) + '\n',
  );
};

await main();
