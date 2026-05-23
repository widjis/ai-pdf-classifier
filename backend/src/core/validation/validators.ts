import { ApiError } from '../http/apiError.js';

export const isUuid = (value: string): boolean => {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

export const requireString = (value: unknown, field: string): string => {
  if (typeof value !== 'string') throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  const trimmed = value.trim();
  if (trimmed.length === 0) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  return trimmed;
};

export const optionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

export const requireEnum = <T extends readonly string[]>(value: unknown, allowed: T, field: string): T[number] => {
  const s = requireString(value, field);
  if (!allowed.includes(s)) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  return s as T[number];
};

export const requireUuid = (value: unknown, field: string): string => {
  const s = requireString(value, field);
  if (!isUuid(s)) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  return s;
};

export const optionalUuid = (value: unknown): string | undefined => {
  const s = optionalString(value);
  if (!s) return undefined;
  return isUuid(s) ? s : undefined;
};

export const requireInt = (value: unknown, field: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  }
  if (!Number.isInteger(value)) throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: `Invalid ${field}` });
  return value;
};

export const optionalBoolean = (value: unknown): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;
  return undefined;
};

