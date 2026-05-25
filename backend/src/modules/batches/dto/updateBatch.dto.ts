import { optionalString, requireEnum, requireString } from '../../../core/validation/validators.js';
import type { BatchStatus } from '../model/batch.model.js';

const STATUSES: readonly BatchStatus[] = ['draft', 'running', 'needs_review', 'completed', 'failed', 'canceled'];

export type UpdateBatchDTO = {
  name?: string;
  status?: BatchStatus;
};

export const parseUpdateBatchDTO = (body: unknown): UpdateBatchDTO => {
  const b = body as Record<string, unknown>;
  const nameRaw = optionalString(b.name);
  const statusRaw = optionalString(b.status);

  const dto: UpdateBatchDTO = {};
  if (nameRaw) dto.name = requireString(nameRaw, 'name');
  if (statusRaw) dto.status = requireEnum(statusRaw, STATUSES, 'status');
  return dto;
};
