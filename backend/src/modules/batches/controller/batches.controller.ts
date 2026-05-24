import type { Request, Response } from 'express';
import { ApiError } from '../../../core/http/apiError.js';
import { requireUuid } from '../../../core/validation/validators.js';
import { parseCreateBatchDTO } from '../dto/createBatch.dto.js';
import { batchesService } from '../service/batches.service.js';

export const batchesController = {
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
