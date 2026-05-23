import { requireInt, requireString, optionalBoolean, optionalString } from '../../../core/validation/validators.js';

export type CreateMappingProfileDTO = {
  name: string;
  description?: string;
  version: number;
  isActive?: boolean;
  createdBy?: string;
};

export type UpdateMappingProfileDTO = {
  name?: string;
  description?: string;
  version?: number;
  isActive?: boolean;
};

export const parseCreateMappingProfileDTO = (body: unknown): CreateMappingProfileDTO => {
  const b = body as Record<string, unknown>;
  const name = requireString(b.name, 'name');
  const version = typeof b.version === 'number' ? requireInt(b.version, 'version') : 1;
  const description = optionalString(b.description);
  const isActive = optionalBoolean(b.isActive);
  const createdBy = optionalString(b.createdBy);

  const dto: CreateMappingProfileDTO = { name, version };
  if (description) dto.description = description;
  if (isActive !== undefined) dto.isActive = isActive;
  if (createdBy) dto.createdBy = createdBy;
  return dto;
};

export const parseUpdateMappingProfileDTO = (body: unknown): UpdateMappingProfileDTO => {
  const b = body as Record<string, unknown>;
  const name = optionalString(b.name);
  const description = optionalString(b.description);
  const version = typeof b.version === 'number' ? requireInt(b.version, 'version') : undefined;
  const isActive = optionalBoolean(b.isActive);

  const dto: UpdateMappingProfileDTO = {};
  if (name) dto.name = name;
  if (description !== undefined) dto.description = description;
  if (version !== undefined) dto.version = version;
  if (isActive !== undefined) dto.isActive = isActive;
  return dto;
};

