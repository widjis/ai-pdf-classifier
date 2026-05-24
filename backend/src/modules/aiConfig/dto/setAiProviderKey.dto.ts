import { ApiError } from '../../../core/http/apiError.js';
import { requireString } from '../../../core/validation/validators.js';

export type SetAiProviderKeyDTO = {
  apiKey: string;
};

export const parseSetAiProviderKeyDTO = (body: unknown): SetAiProviderKeyDTO => {
  const b = body as Record<string, unknown>;
  const apiKey = requireString(b.apiKey, 'apiKey');
  if (apiKey.length < 10) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid apiKey' });
  }
  return { apiKey };
};
