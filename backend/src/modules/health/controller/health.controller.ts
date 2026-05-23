import type { Request, Response } from 'express';
import { healthService } from '../service/health.service.js';

export const healthController = {
  getHealth: (_req: Request, res: Response) => res.json(healthService.getHealth()),
};
