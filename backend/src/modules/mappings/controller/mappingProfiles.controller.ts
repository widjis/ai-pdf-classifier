import type { Request, Response } from 'express';
import { requireUuid } from '../../../core/validation/validators.js';
import { parseCreateMappingProfileDTO, parseUpdateMappingProfileDTO } from '../dto/mappingProfiles.dto.js';
import { mappingsService } from '../service/mappings.service.js';

export const mappingProfilesController = {
  list: async (_req: Request, res: Response) => {
    res.json(await mappingsService.listProfiles());
  },
  create: async (req: Request, res: Response) => {
    const dto = parseCreateMappingProfileDTO(req.body);
    const created = await mappingsService.createProfile({
      name: dto.name,
      description: dto.description,
      version: dto.version,
      isActive: dto.isActive ?? true,
      createdBy: dto.createdBy,
    });
    res.status(201).json(created);
  },
  get: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    res.json(await mappingsService.getProfile(id));
  },
  update: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    const dto = parseUpdateMappingProfileDTO(req.body);
    res.json(await mappingsService.updateProfile(id, dto));
  },
};

