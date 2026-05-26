import type { Request, Response } from 'express';
import { healthService } from '../service/health.service.js';

export const healthController = {
  getHealth: async (_req: Request, res: Response) => res.json(await healthService.getHealth()),
};
