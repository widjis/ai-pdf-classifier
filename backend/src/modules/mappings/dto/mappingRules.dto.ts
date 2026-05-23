import { requireEnum, requireInt, requireString, optionalString } from '../../../core/validation/validators.js';

const MATCH_TYPES = ['category', 'filename_prefix', 'filename_regex'] as const;

export type CreateMappingRuleDTO = {
  matchType: (typeof MATCH_TYPES)[number];
  source: string;
  targetFolder: string;
  targetCode?: string;
  targetPrefix?: string;
  priority: number;
  isActive?: boolean;
};

export const parseCreateMappingRuleDTO = (body: unknown): CreateMappingRuleDTO => {
  const b = body as Record<string, unknown>;
  const matchType = requireEnum(b.matchType, MATCH_TYPES, 'matchType');
  const source = requireString(b.source, 'source');
  const targetFolder = requireString(b.targetFolder, 'targetFolder');
  const targetCode = optionalString(b.targetCode);
  const targetPrefix = optionalString(b.targetPrefix);
  const priority = typeof b.priority === 'number' ? requireInt(b.priority, 'priority') : 100;
  const isActive = typeof b.isActive === 'boolean' ? b.isActive : undefined;

  const dto: CreateMappingRuleDTO = { matchType, source, targetFolder, priority };
  if (targetCode) dto.targetCode = targetCode;
  if (targetPrefix) dto.targetPrefix = targetPrefix;
  if (isActive !== undefined) dto.isActive = isActive;
  return dto;
};

