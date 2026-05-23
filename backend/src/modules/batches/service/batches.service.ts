import { ApiError } from '../../../core/http/apiError.js';
import type { Batch, BatchSummary } from '../model/batch.model.js';
import { batchesRepository } from '../repository/batches.repository.js';

export const batchesService = {
  list: async (): Promise<Batch[]> => batchesRepository.list(),

  create: async (args: {
    name: string;
    mappingProfileId?: string;
    aiProvider: 'gemini' | 'openai';
    aiModel: string;
    docTypeHandling: 'standard' | 'ocr' | 'scanned';
    createdBy?: string;
  }): Promise<Batch> => {
    return batchesRepository.create(args);
  },

  getById: async (id: string): Promise<BatchSummary> => {
    const batch = await batchesRepository.getById(id);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    const totals = await batchesRepository.getCounts(id);
    return { ...batch, totals };
  },
};

