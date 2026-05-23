import type { Request, Response } from 'express';
import { requireUuid } from '../../../core/validation/validators.js';
import { parseCreateMappingRuleDTO } from '../dto/mappingRules.dto.js';
import { mappingsService } from '../service/mappings.service.js';

export const mappingRulesController = {
  listByProfile: async (req: Request, res: Response) => {
    const profileId = requireUuid(req.params.id, 'id');
    res.json(await mappingsService.listRules(profileId));
  },
  createForProfile: async (req: Request, res: Response) => {
    const profileId = requireUuid(req.params.id, 'id');
    const dto = parseCreateMappingRuleDTO(req.body);
    const created = await mappingsService.createRule({
      profileId,
      matchType: dto.matchType,
      source: dto.source,
      targetFolder: dto.targetFolder,
      targetCode: dto.targetCode,
      targetPrefix: dto.targetPrefix,
      priority: dto.priority,
      isActive: dto.isActive ?? true,
    });
    res.status(201).json(created);
  },
  delete: async (req: Request, res: Response) => {
    const id = requireUuid(req.params.id, 'id');
    await mappingsService.deleteRule(id);
    res.status(204).end();
  },
};

