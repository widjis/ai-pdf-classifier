import { pool } from '../../../core/db/postgres.js';
import type { Batch, BatchDocumentListItem, BatchDocumentStatus, BatchStatus, DocTypeHandling, RecentActivityItem } from '../model/batch.model.js';

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

type BatchDocumentListRow = {
  batch_document_id: string;
  document_id: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: string;
  status: BatchDocumentStatus;
  final_category: string | null;
  created_at: string;
};

type RecentActivityRow = {
  batch_id: string;
  batch_name: string;
  batch_document_id: string;
  document_id: string;
  original_filename: string;
  size_bytes: string;
  status: BatchDocumentStatus;
  created_at: string;
};

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

  start: async (id: string): Promise<Batch> => {
    const res = await pool.query<BatchRow>(
      `update batches
       set status = 'running',
           started_at = coalesce(started_at, now())
       where id = $1 and status = 'draft'
       returning id, name, mapping_profile_id, ai_provider, ai_model, doc_type_handling, status, created_by, created_at, started_at, completed_at`,
      [id],
    );
    const row = res.rows[0];
    if (row) return mapBatch(row);
    const existing = await batchesRepository.getById(id);
    if (!existing) throw new Error('Batch not found');
    return existing;
  },

  addUploadedDocumentToBatch: async (args: {
    batchId: string;
    originalFilename: string;
    mimeType: string | null;
    sizeBytes: number;
    sha256: string | null;
    storagePath: string;
  }): Promise<{ batchDocumentId: string; documentId: string }> => {
    const client = await pool.connect();
    try {
      await client.query('begin');
      const docRes = await client.query<{ id: string }>(
        `insert into documents (original_filename, mime_type, size_bytes, sha256, storage_path)
         values ($1, $2, $3, $4, $5)
         returning id`,
        [args.originalFilename, args.mimeType, args.sizeBytes, args.sha256, args.storagePath],
      );
      const documentId = docRes.rows[0]?.id;
      if (!documentId) throw new Error('Failed to insert document');

      const bdRes = await client.query<{ id: string }>(
        `insert into batch_documents (batch_id, document_id, status)
         values ($1, $2, 'queued')
         returning id`,
        [args.batchId, documentId],
      );
      const batchDocumentId = bdRes.rows[0]?.id;
      if (!batchDocumentId) throw new Error('Failed to insert batch document');

      await client.query('commit');
      return { batchDocumentId, documentId };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  },

  listBatchDocuments: async (batchId: string): Promise<BatchDocumentListItem[]> => {
    const res = await pool.query<BatchDocumentListRow>(
      `select
         bd.id as batch_document_id,
         bd.document_id,
         d.original_filename,
         d.mime_type,
         d.size_bytes::text as size_bytes,
         bd.status,
         bd.final_category,
         bd.created_at
       from batch_documents bd
       join documents d on d.id = bd.document_id
       where bd.batch_id = $1
       order by bd.created_at desc`,
      [batchId],
    );
    return res.rows.map((r) => ({
      batchDocumentId: r.batch_document_id,
      documentId: r.document_id,
      originalFilename: r.original_filename,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes),
      status: r.status,
      finalCategory: r.final_category,
      createdAt: r.created_at,
    }));
  },

  listRecentActivity: async (limit: number): Promise<RecentActivityItem[]> => {
    const res = await pool.query<RecentActivityRow>(
      `select
         b.id as batch_id,
         b.name as batch_name,
         bd.id as batch_document_id,
         bd.document_id,
         d.original_filename,
         d.size_bytes::text as size_bytes,
         bd.status,
         bd.created_at
       from batch_documents bd
       join documents d on d.id = bd.document_id
       join batches b on b.id = bd.batch_id
       order by bd.created_at desc
       limit $1`,
      [limit],
    );
    return res.rows.map((r) => ({
      batchId: r.batch_id,
      batchName: r.batch_name,
      batchDocumentId: r.batch_document_id,
      documentId: r.document_id,
      originalFilename: r.original_filename,
      sizeBytes: Number(r.size_bytes),
      status: r.status,
      createdAt: r.created_at,
    }));
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
