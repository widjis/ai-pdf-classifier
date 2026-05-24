import type { Request, Response } from 'express';
import { ApiError } from '../../../core/http/apiError.js';
import { requireEnum, requireInt, requireString, requireUuid } from '../../../core/validation/validators.js';
import { parseCreateBatchDTO } from '../dto/createBatch.dto.js';
import { parseUpdateDocumentFieldsDTO } from '../dto/updateDocumentFields.dto.js';
import { batchesService } from '../service/batches.service.js';

const EXPORT_ORDER_BY = ['created_at', 'filename'] as const;
const EXPORT_NUMBERING_MODE = ['global', 'per_category'] as const;

export const batchesController = {
  queueMetrics: async (_req: Request, res: Response) => {
    res.json(await batchesService.getQueueMetrics());
  },
  list: async (_req: Request, res: Response) => {
    res.json(await batchesService.list());
  },
  create: async (req: Request, res: Response) => {
    const dto = parseCreateBatchDTO(req.body);
    const created = await batchesService.create(dto);
    res.status(201).json(created);
  },
  get: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    res.json(await batchesService.getById(id));
  },
  start: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    res.json(await batchesService.start(id));
  },
  listDocuments: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    res.json(await batchesService.listDocuments(id));
  },
  getDocument: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    res.json(await batchesService.getDocumentDetails({ batchId, batchDocumentId }));
  },
  downloadDocumentFile: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    const file = await batchesService.getDocumentFile({ batchId, batchDocumentId });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.fileName)}"`);
    res.sendFile(file.filePath, { acceptRanges: true });
  },
  updateDocumentCategory: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    const category = requireString((req.body as Record<string, unknown>).category, 'category');
    res.json(await batchesService.updateDocumentCategory({ batchId, batchDocumentId, category }));
  },
  updateDocumentFields: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    const dto = parseUpdateDocumentFieldsDTO(req.body);
    res.json(await batchesService.updateDocumentFields({ batchId, batchDocumentId, fields: dto.fields }));
  },
  approveDocument: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    res.json(await batchesService.approveDocument({ batchId, batchDocumentId }));
  },
  bulkApproveDocuments: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const body = req.body as Record<string, unknown>;
    const raw = body.batchDocumentIds;
    if (!Array.isArray(raw)) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'batchDocumentIds must be an array' });
    const batchDocumentIds = raw.map((v) => requireUuid(v, 'batchDocumentIds[]'));
    res.json(await batchesService.bulkApproveDocuments({ batchId, batchDocumentIds }));
  },
  bulkSetCategory: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const body = req.body as Record<string, unknown>;
    const raw = body.batchDocumentIds;
    if (!Array.isArray(raw)) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'batchDocumentIds must be an array' });
    const batchDocumentIds = raw.map((v) => requireUuid(v, 'batchDocumentIds[]'));
    const category = requireString(body.category, 'category');
    res.json(await batchesService.bulkSetCategory({ batchId, batchDocumentIds, category }));
  },
  exportBatch: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const body = (req.body ?? {}) as Record<string, unknown>;
    const startingIndex = typeof body.startingIndex === 'number' ? requireInt(body.startingIndex, 'startingIndex') : 1;
    const orderBy =
      typeof body.orderBy === 'string' && body.orderBy.trim().length > 0 ? requireEnum(body.orderBy, EXPORT_ORDER_BY, 'orderBy') : 'created_at';
    const groupByCategory = typeof body.groupByCategory === 'boolean' ? body.groupByCategory : false;
    const numberingMode =
      typeof body.numberingMode === 'string' && body.numberingMode.trim().length > 0
        ? requireEnum(body.numberingMode, EXPORT_NUMBERING_MODE, 'numberingMode')
        : 'global';

    let startingIndexByCategory: Record<string, number> | undefined;
    if (body.startingIndexByCategory !== undefined) {
      const raw = body.startingIndexByCategory;
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'startingIndexByCategory must be an object' });
      }
      const out: Record<string, number> = {};
      for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (typeof key !== 'string' || key.trim().length === 0) continue;
        if (typeof value !== 'number') throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid startingIndexByCategory for ${key}` });
        out[key] = requireInt(value, `startingIndexByCategory.${key}`);
      }
      startingIndexByCategory = out;
    }

    res.json(
      await batchesService.exportBatch({
        batchId,
        startingIndex,
        orderBy,
        groupByCategory,
        numberingMode,
        startingIndexByCategory,
      }),
    );
  },
  getLatestExport: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    res.json(await batchesService.getLatestExport({ batchId }));
  },
  downloadExportManifest: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const file = await batchesService.getExportManifestFile({ batchId });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.sendFile(file.filePath, { acceptRanges: true });
  },
  downloadExportZip: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const file = await batchesService.getExportZipFile({ batchId });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.sendFile(file.filePath, { acceptRanges: true });
  },
  downloadExportedDocumentFile: async (req: Request, res: Response) => {
    const batchId = requireUuid(req.params.id, 'id');
    const batchDocumentId = requireUuid(req.params.batchDocumentId, 'batchDocumentId');
    const file = await batchesService.getExportedDocumentFile({ batchId, batchDocumentId });
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`);
    res.sendFile(file.filePath, { acceptRanges: true });
  },
  uploadDocuments: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    const files = (req.files ?? []) as Express.Multer.File[];
    if (files.length === 0) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'No files uploaded' });
    }
    const result = await batchesService.uploadDocuments(
      id,
      files.map((f) => ({
        path: f.path,
        originalName: f.originalname,
        mimeType: f.mimetype ?? null,
        sizeBytes: f.size,
      })),
    );
    res.status(201).json(result);
  },
  recentActivity: async (req: Request, res: Response) => {
    const raw = typeof req.query.limit === 'string' ? req.query.limit : undefined;
    const limit = raw ? Number(raw) : 20;
    res.json(await batchesService.recentActivity(Number.isFinite(limit) ? limit : 20));
  },
};
