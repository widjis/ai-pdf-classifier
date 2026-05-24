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
  const email = requireString(b.email, 'email').toLowerCase();
  const password = requireString(b.password, 'password');
  const methodRaw = optionalString(b.method) ?? 'ldap';
  const method = requireEnum(methodRaw, METHODS, 'method');
  if (method === 'ldap') {
    if (!email.includes('@') || email.length < 5) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid email' });
    }
  } else {
    if (email.trim().length < 3) {
      throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid username' });
    }
  }
  return { email, password, method };
};
