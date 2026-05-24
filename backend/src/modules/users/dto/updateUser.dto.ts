import { optionalBoolean, optionalString, requireEnum, requireString } from '../../../core/validation/validators.js';

const ROLES = ['admin', 'reviewer', 'operator'] as const;

export type UpdateUserDTO = {
  displayName?: string;
  role?: (typeof ROLES)[number];
  isActive?: boolean;
};

export const parseUpdateUserDTO = (body: unknown): UpdateUserDTO => {
  const b = body as Record<string, unknown>;
  const displayNameRaw = optionalString(b.displayName);
  const roleRaw = optionalString(b.role);
  const isActive = optionalBoolean(b.isActive);

  const dto: UpdateUserDTO = {};
  if (displayNameRaw !== undefined) dto.displayName = requireString(displayNameRaw, 'displayName');
  if (roleRaw !== undefined) dto.role = requireEnum(roleRaw, ROLES, 'role');
  if (isActive !== undefined) dto.isActive = isActive;
  return dto;
};

