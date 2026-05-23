import { pool } from '../../../core/db/postgres.js';
import type { Batch, BatchStatus, DocTypeHandling } from '../model/batch.model.js';

type BatchRow = {
  id: string;
  name: string;
  mapping_profile_id: string | null;
  ai_provider: 'gemini' | 'openai';
  ai_model: string;
  doc_type_handling: DocTypeHandling;
  status: BatchStatus;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

const mapBatch = (r: BatchRow): Batch => ({
  id: r.id,
  name: r.name,
  mappingProfileId: r.mapping_profile_id,
  aiProvider: r.ai_provider,
  aiModel: r.ai_model,
  docTypeHandling: r.doc_type_handling,
  status: r.status,
  createdBy: r.created_by,
  createdAt: r.created_at,
  startedAt: r.started_at,
  completedAt: r.completed_at,
});

export const batchesRepository = {
  list: async (): Promise<Batch[]> => {
    const res = await pool.query<BatchRow>(
      `select id, name, mapping_profile_id, ai_provider, ai_model, doc_type_handling, status, created_by, created_at, started_at, completed_at
       from batches
       order by created_at desc`,
    );
    return res.rows.map(mapBatch);
  },

  getById: async (id: string): Promise<Batch | null> => {
    const res = await pool.query<BatchRow>(
      `select id, name, mapping_profile_id, ai_provider, ai_model, doc_type_handling, status, created_by, created_at, started_at, completed_at
       from batches
       where id = $1`,
      [id],
    );
    const row = res.rows[0];
    return row ? mapBatch(row) : null;
  },

  create: async (args: {
    name: string;
    mappingProfileId?: string;
    aiProvider: 'gemini' | 'openai';
    aiModel: string;
    docTypeHandling: DocTypeHandling;
    createdBy?: string;
  }): Promise<Batch> => {
    const res = await pool.query<BatchRow>(
      `insert into batches (name, mapping_profile_id, ai_provider, ai_model, doc_type_handling, status, created_by)
       values ($1, $2, $3, $4, $5, 'draft', $6)
       returning id, name, mapping_profile_id, ai_provider, ai_model, doc_type_handling, status, created_by, created_at, started_at, completed_at`,
      [args.name, args.mappingProfileId ?? null, args.aiProvider, args.aiModel, args.docTypeHandling, args.createdBy ?? null],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create batch');
    return mapBatch(row);
  },

  getCounts: async (batchId: string) => {
    const res = await pool.query<{
      total: string;
      queued: string;
      processing: string;
      failed: string;
      ready_for_review: string;
      approved: string;
    }>(
      `select
         count(*)::text as total,
         count(*) filter (where status = 'queued')::text as queued,
         count(*) filter (where status = 'processing')::text as processing,
         count(*) filter (where status = 'failed')::text as failed,
         count(*) filter (where status = 'ready_for_review')::text as ready_for_review,
         count(*) filter (where status = 'approved')::text as approved
       from batch_documents
       where batch_id = $1`,
      [batchId],
    );
    const row = res.rows[0];
    return {
      total: Number(row?.total ?? 0),
      queued: Number(row?.queued ?? 0),
      processing: Number(row?.processing ?? 0),
      failed: Number(row?.failed ?? 0),
      readyForReview: Number(row?.ready_for_review ?? 0),
      approved: Number(row?.approved ?? 0),
    };
  },
};

