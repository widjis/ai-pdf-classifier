import { ApiError } from '../../../core/http/apiError.js';
import { optionalString, requireEnum, requireString } from '../../../core/validation/validators.js';

const METHODS = ['ldap', 'local'] as const;

export type LoginDTO = {
  email: string;
  password: string;
  method: (typeof METHODS)[number];
};

export const parseLoginDTO = (body: unknown): LoginDTO => {
  const b = body as Record<string, unknown>;
  const rawIdentity = requireString(b.email, 'email').trim();
  const identity = (rawIdentity.includes('\\') ? rawIdentity.split('\\').pop() ?? rawIdentity : rawIdentity).toLowerCase();
  const password = requireString(b.password, 'password');
  const methodRaw = optionalString(b.method) ?? 'ldap';
  const method = requireEnum(methodRaw, METHODS, 'method');
  if (method === 'ldap') {
    const looksLikeEmail = identity.includes('@') && identity.length >= 5;
    const looksLikeUsername = /^[a-z0-9._-]{3,}$/i.test(identity);
    if (!looksLikeEmail && !looksLikeUsername) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid email or username' });
    }
  } else {
    if (identity.trim().length < 3) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid username' });
    }
  }
  return { email: identity, password, method };
};
