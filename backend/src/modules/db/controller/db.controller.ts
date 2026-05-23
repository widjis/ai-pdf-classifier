import type { Request, Response } from 'express';
import { dbService } from '../service/db.service.js';

export const dbController = {
  ping: async (_req: Request, res: Response) => res.json(await dbService.ping()),
  info: async (_req: Request, res: Response) => res.json(await dbService.getInfo()),
};
