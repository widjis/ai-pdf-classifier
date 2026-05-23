import { requireEnum, requireString, requireUuid, optionalString, optionalUuid } from '../../../core/validation/validators.js';

const PROVIDERS = ['gemini', 'openai'] as const;
const DOC_TYPES = ['standard', 'ocr', 'scanned'] as const;

export type CreateBatchDTO = {
  name: string;
  mappingProfileId?: string;
  aiProvider: (typeof PROVIDERS)[number];
  aiModel: string;
  docTypeHandling: (typeof DOC_TYPES)[number];
  createdBy?: string;
};

export const parseCreateBatchDTO = (body: unknown): CreateBatchDTO => {
  const b = body as Record<string, unknown>;
  const name = requireString(b.name, 'name');
  const aiProvider = requireEnum(b.aiProvider, PROVIDERS, 'aiProvider');
  const aiModel = requireString(b.aiModel, 'aiModel');
  const docTypeHandling = requireEnum(b.docTypeHandling ?? 'standard', DOC_TYPES, 'docTypeHandling');
  const mappingProfileId = optionalUuid(b.mappingProfileId);
  const createdByRaw = optionalString(b.createdBy);
  const createdBy = createdByRaw ? requireUuid(createdByRaw, 'createdBy') : undefined;

  const dto: CreateBatchDTO = { name, aiProvider, aiModel, docTypeHandling };
  if (mappingProfileId) dto.mappingProfileId = mappingProfileId;
  if (createdBy) dto.createdBy = createdBy;
  return dto;
};

