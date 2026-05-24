import { ApiError } from '../../../core/http/apiError.js';
import { requireString } from '../../../core/validation/validators.js';

export type LoginDTO = {
  email: string;
  password: string;
};

export const parseLoginDTO = (body: unknown): LoginDTO => {
  const b = body as Record<string, unknown>;
  const email = requireString(b.email, 'email').toLowerCase();
  const password = requireString(b.password, 'password');
  if (!email.includes('@') || email.length < 5) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid email' });
  }
  return { email, password };
};
