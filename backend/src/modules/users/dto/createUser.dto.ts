import { requireEnum, requireString } from '../../../core/validation/validators.js';

const ROLES = ['admin', 'reviewer', 'operator'] as const;

export type CreateUserDTO = {
  email: string;
  displayName: string;
  role: (typeof ROLES)[number];
};

export const parseCreateUserDTO = (body: unknown): CreateUserDTO => {
  const b = body as Record<string, unknown>;
  return {
    email: requireString(b.email, 'email'),
    displayName: requireString(b.displayName, 'displayName'),
    role: requireEnum(b.role, ROLES, 'role'),
  };
};

