import { ApiError } from '../../../core/http/apiError.js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Batch, BatchDocumentListItem, BatchSummary, RecentActivityItem } from '../model/batch.model.js';
import { batchesRepository } from '../repository/batches.repository.js';

const sha256File = async (filePath: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });

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

  start: async (id: string): Promise<BatchSummary> => {
    const existing = await batchesRepository.getById(id);
    if (!existing) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (existing.status !== 'draft') {
      throw new ApiError({ status: 409, code: 'CONFLICT', message: `Batch is not in draft status (${existing.status})` });
    }
    await batchesRepository.start(id);
    return batchesService.getById(id);
  },

  uploadDocuments: async (
    batchId: string,
    files: Array<{ path: string; originalName: string; mimeType: string | null; sizeBytes: number }>,
  ): Promise<{ added: number }> => {
    const batch = await batchesRepository.getById(batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    if (batch.status !== 'draft') {
      throw new ApiError({ status: 409, code: 'CONFLICT', message: `Batch is not in draft status (${batch.status})` });
    }
    if (files.length === 0) return { added: 0 };

    for (const f of files) {
      const sha256 = await sha256File(f.path);
      await batchesRepository.addUploadedDocumentToBatch({
        batchId,
        originalFilename: f.originalName,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        sha256,
        storagePath: f.path,
      });
    }

    return { added: files.length };
  },

  listDocuments: async (batchId: string): Promise<BatchDocumentListItem[]> => {
    const batch = await batchesRepository.getById(batchId);
    if (!batch) throw new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Batch not found' });
    return batchesRepository.listBatchDocuments(batchId);
  },

  recentActivity: async (limit: number): Promise<RecentActivityItem[]> => {
    const bounded = Math.max(1, Math.min(limit, 100));
    return batchesRepository.listRecentActivity(bounded);
  },
};
