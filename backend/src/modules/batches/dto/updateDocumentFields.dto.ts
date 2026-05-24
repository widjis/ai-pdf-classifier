import { ApiError } from '../../../core/http/apiError.js';

const ALLOWED_FIELDS = ['documentNumber', 'personName', 'documentDate', 'organization', 'notes', 'requester'] as const;

export type UpdateDocumentFieldsDTO = {
  fields: Partial<Record<(typeof ALLOWED_FIELDS)[number], string | null>>;
};

const normalizeValue = (value: unknown): string | null => {
  if (value === null) return null;
  if (value === undefined) return null;
  if (typeof value !== 'string') throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid fields value' });
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 200) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Field value is too long' });
  }
  return trimmed;
};

export const parseUpdateDocumentFieldsDTO = (body: unknown): UpdateDocumentFieldsDTO => {
  const b = body as Record<string, unknown>;
  const rawFields = b.fields;
  if (!rawFields || typeof rawFields !== 'object' || Array.isArray(rawFields)) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'fields must be an object' });
  }

  const fields: UpdateDocumentFieldsDTO['fields'] = {};
  for (const key of ALLOWED_FIELDS) {
    if (!(key in (rawFields as Record<string, unknown>))) continue;
    fields[key] = normalizeValue((rawFields as Record<string, unknown>)[key]);
  }

  return { fields };
};

