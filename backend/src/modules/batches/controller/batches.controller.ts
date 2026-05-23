import type { Request, Response } from 'express';
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
};

