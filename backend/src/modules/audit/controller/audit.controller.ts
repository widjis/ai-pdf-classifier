import type { Request, Response } from 'express';
import { optionalString } from '../../../core/validation/validators.js';
import { auditService } from '../service/audit.service.js';

export const auditController = {
  list: async (req: Request, res: Response) => {
    const raw = optionalString(req.query.limit);
    const n = raw ? Number(raw) : 100;
    const limit = Number.isFinite(n) ? n : 100;
    res.json(await auditService.list(limit));
  },
};

