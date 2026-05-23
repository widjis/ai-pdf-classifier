import type { Request, Response } from 'express';
import { ApiError } from '../../../core/http/apiError.js';
import { requireUuid } from '../../../core/validation/validators.js';
import { parseUpsertUserPreferencesDTO } from '../dto/upsertUserPreferences.dto.js';
import { userPreferencesService } from '../service/userPreferences.service.js';

export const userPreferencesController = {
  get: async (req: Request, res: Response) => {
    const userId = requireUuid(req.params.userId, 'userId');
    const prefs = await userPreferencesService.getByUserId(userId);
    if (!prefs) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Preferences not found' });
    res.json(prefs);
  },
  put: async (req: Request, res: Response) => {
    const userId = requireUuid(req.params.userId, 'userId');
    const dto = parseUpsertUserPreferencesDTO(req.body);
    const updated = await userPreferencesService.upsert(userId, dto);
    res.json(updated);
  },
};

