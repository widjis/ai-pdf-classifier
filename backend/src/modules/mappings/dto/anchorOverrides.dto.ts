import { ApiError } from '../../../core/http/apiError.js';
import { optionalBoolean, requireInt, requireString } from '../../../core/validation/validators.js';

export type UpsertAnchorOverrideDTO = {
  category: string;
  anchorKeywords: string[];
  priority: number;
  isActive: boolean;
};

const parseKeywords = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === 'string')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
};

export const parseUpsertAnchorOverrideDTO = (body: unknown): UpsertAnchorOverrideDTO => {
  const b = body as Record<string, unknown>;
  const category = requireString(b.category, 'category');
  const anchorKeywords = parseKeywords(b.anchorKeywords);
  if (anchorKeywords.length === 0) {
    throw new ApiError({ status: 400, code: 'BAD_REQUEST', message: 'Invalid anchorKeywords' });
  }
  const priorityRaw = b.priority ?? 100;
  const priority = typeof priorityRaw === 'number' ? requireInt(priorityRaw, 'priority') : 100;
  const isActive = optionalBoolean(b.isActive) ?? true;
  return { category, anchorKeywords, priority, isActive };
};
