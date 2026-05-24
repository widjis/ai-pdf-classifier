import { requireEnum, requireString } from '../../../core/validation/validators.js';

const ROLES = ['admin', 'reviewer', 'operator'] as const;

export type ProvisionLdapUserDTO = {
  identity: string;
  role: (typeof ROLES)[number];
};

export const parseProvisionLdapUserDTO = (body: unknown): ProvisionLdapUserDTO => {
  const b = body as Record<string, unknown>;
  return {
    identity: requireString(b.identity, 'identity'),
    role: requireEnum(b.role, ROLES, 'role'),
  };
};

