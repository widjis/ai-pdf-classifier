import { requireEnum, optionalString, optionalUuid } from '../../../core/validation/validators.js';

const PROVIDERS = ['gemini', 'openai'] as const;

export type UpsertUserPreferencesDTO = {
  defaultMappingProfileId?: string;
  defaultAiProvider?: (typeof PROVIDERS)[number];
  defaultAiModel?: string;
};

export const parseUpsertUserPreferencesDTO = (body: unknown): UpsertUserPreferencesDTO => {
  const b = body as Record<string, unknown>;

  const mappingProfileId = optionalUuid(b.defaultMappingProfileId);
  const providerRaw = optionalString(b.defaultAiProvider);
  const model = optionalString(b.defaultAiModel);

  const dto: UpsertUserPreferencesDTO = {};
  if (mappingProfileId) dto.defaultMappingProfileId = mappingProfileId;
  if (providerRaw) dto.defaultAiProvider = requireEnum(providerRaw, PROVIDERS, 'defaultAiProvider');
  if (model) dto.defaultAiModel = model;
  return dto;
};

