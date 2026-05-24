import { requireString } from '../../../core/validation/validators.js';
import { ApiError } from '../../../core/http/apiError.js';

export type ResetLocalPasswordDTO = {
  newPassword: string;
};

export const parseResetLocalPasswordDTO = (body: unknown): ResetLocalPasswordDTO => {
  const b = body as Record<string, unknown>;
  const newPassword = requireString(b.newPassword, 'newPassword');
  if (newPassword.length < 10) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Password must be at least 10 characters' });
  }
  return { newPassword };
};

