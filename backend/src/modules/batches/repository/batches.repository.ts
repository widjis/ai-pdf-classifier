import { pool } from '../../../core/db/postgres.js';
import type { Batch, BatchDocumentListItem, BatchDocumentStatus, BatchStatus, DocTypeHandling, RecentActivityItem } from '../model/batch.model.js';

const isMissingRelationError = (err: unknown): boolean => {
  return Boolean(err && typeof err === 'object' && 'code' in err && (err as { code?: unknown }).code === '42P01');
};

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

type BatchDocumentProcessingRow = {
  batch_document_id: string;
  document_id: string;
  storage_path: string;
  original_filename: string;
  status: BatchDocumentStatus;
};

type BatchDocumentDetailsRow = {
  batch_document_id: string;
  batch_id: string;
  document_id: string;
  original_filename: string;
  mime_type: string | null;
  size_bytes: string;
  storage_path: string;
  status: BatchDocumentStatus;
  final_category: string | null;
  final_confidence: string | null;
  created_at: string;
  response_json: unknown | null;
};

type CategoryRuleRow = {
  target_folder: string;
  target_prefix: string | null;
  target_code: string | null;
};

type ExportRow = {
  id: string;
  batch_id: string;
  status: 'queued' | 'building' | 'ready' | 'failed';
  output_path: string | null;
  size_bytes: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
};

type ExportDocumentRow = {
  batch_document_id: string;
  document_id: string;
  storage_path: string;
  original_filename: string;
  final_category: string;
  created_at: string;
  response_json: unknown | null;
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

  getBatchDocumentDetails: async (args: {
    batchId: string;
    batchDocumentId: string;
  }): Promise<{
    batchDocumentId: string;
    batchId: string;
    documentId: string;
    originalFilename: string;
    mimeType: string | null;
    sizeBytes: number;
    storagePath: string;
    status: BatchDocumentStatus;
    finalCategory: string | null;
    finalConfidence: number | null;
    createdAt: string;
    responseJson: unknown | null;
  } | null> => {
    const res = await pool.query<BatchDocumentDetailsRow>(
      `select
         bd.id as batch_document_id,
         bd.batch_id,
         bd.document_id,
         d.original_filename,
         d.mime_type,
         d.size_bytes::text as size_bytes,
         d.storage_path,
         bd.status,
         bd.final_category,
         bd.final_confidence::text as final_confidence,
         bd.created_at,
         cr.response_json
       from batch_documents bd
       join documents d on d.id = bd.document_id
       left join lateral (
         select response_json
         from classification_runs
         where batch_document_id = bd.id
         order by created_at desc
         limit 1
       ) cr on true
       where bd.batch_id = $1 and bd.id = $2`,
      [args.batchId, args.batchDocumentId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      batchDocumentId: row.batch_document_id,
      batchId: row.batch_id,
      documentId: row.document_id,
      originalFilename: row.original_filename,
      mimeType: row.mime_type,
      sizeBytes: Number(row.size_bytes),
      storagePath: row.storage_path,
      status: row.status,
      finalCategory: row.final_category,
      finalConfidence: row.final_confidence === null ? null : Number(row.final_confidence),
      createdAt: row.created_at,
      responseJson: row.response_json,
    };
  },

  approveBatchDocument: async (args: { batchDocumentId: string }): Promise<void> => {
    await pool.query(
      `update batch_documents
       set status = 'approved',
           reviewed_at = now()
       where id = $1`,
      [args.batchDocumentId],
    );
  },

  updateBatchDocumentCategory: async (args: { batchDocumentId: string; category: string }): Promise<void> => {
    await pool.query(
      `update batch_documents
       set final_category = $2,
           status = 'ready_for_review'
       where id = $1`,
      [args.batchDocumentId, args.category],
    );
  },

  bulkApproveBatchDocuments: async (args: { batchId: string; batchDocumentIds: string[] }): Promise<number> => {
    const res = await pool.query(
      `update batch_documents
       set status = 'approved',
           reviewed_at = now()
       where batch_id = $1
         and id = any($2::uuid[])
         and status in ('ready_for_review','failed')`,
      [args.batchId, args.batchDocumentIds],
    );
    return res.rowCount ?? 0;
  },

  bulkSetBatchDocumentCategory: async (args: { batchId: string; batchDocumentIds: string[]; category: string }): Promise<number> => {
    const res = await pool.query(
      `update batch_documents
       set final_category = $3,
           status = 'ready_for_review'
       where batch_id = $1
         and id = any($2::uuid[])`,
      [args.batchId, args.batchDocumentIds, args.category],
    );
    return res.rowCount ?? 0;
  },

  updateBatchDocumentTargets: async (args: {
    batchDocumentId: string;
    targetFolder: string;
    targetPrefix: string | null;
    targetCode: string | null;
  }): Promise<void> => {
    await pool.query(
      `update batch_documents
       set final_target_folder = $2,
           final_target_prefix = $3,
           final_target_code = $4
       where id = $1`,
      [args.batchDocumentId, args.targetFolder, args.targetPrefix, args.targetCode],
    );
  },

  getCategoryRuleByTargetFolder: async (args: { profileId: string; category: string }): Promise<{
    targetFolder: string;
    targetPrefix: string | null;
    targetCode: string | null;
  } | null> => {
    const res = await pool.query<CategoryRuleRow>(
      `select target_folder, target_prefix, target_code
       from mapping_rules
       where profile_id = $1
         and is_active = true
         and match_type = 'category'
         and target_folder = $2
       order by priority asc, created_at desc
       limit 1`,
      [args.profileId, args.category],
    );
    const row = res.rows[0];
    if (!row) return null;
    return { targetFolder: row.target_folder, targetPrefix: row.target_prefix, targetCode: row.target_code };
  },

  createExport: async (args: { batchId: string; outputPath: string | null }): Promise<{
    id: string;
    batchId: string;
    status: 'queued' | 'building' | 'ready' | 'failed';
    outputPath: string | null;
    sizeBytes: number | null;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  }> => {
    const res = await pool.query<ExportRow>(
      `insert into exports (batch_id, status, output_path)
       values ($1, 'building', $2)
       returning id, batch_id, status, output_path, size_bytes::text as size_bytes, error_message, created_at, completed_at`,
      [args.batchId, args.outputPath],
    );
    const row = res.rows[0];
    if (!row) throw new Error('Failed to create export');
    return {
      id: row.id,
      batchId: row.batch_id,
      status: row.status,
      outputPath: row.output_path,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  },

  setExportResult: async (args: {
    exportId: string;
    status: 'ready' | 'failed';
    outputPath: string | null;
    sizeBytes: number | null;
    errorMessage: string | null;
  }): Promise<void> => {
    await pool.query(
      `update exports
       set status = $2,
           output_path = $3,
           size_bytes = $4,
           error_message = $5,
           completed_at = now()
       where id = $1`,
      [args.exportId, args.status, args.outputPath, args.sizeBytes, args.errorMessage],
    );
  },

  getLatestExportForBatch: async (batchId: string): Promise<{
    id: string;
    batchId: string;
    status: 'queued' | 'building' | 'ready' | 'failed';
    outputPath: string | null;
    sizeBytes: number | null;
    errorMessage: string | null;
    createdAt: string;
    completedAt: string | null;
  } | null> => {
    const res = await pool.query<ExportRow>(
      `select id, batch_id, status, output_path, size_bytes::text as size_bytes, error_message, created_at, completed_at
       from exports
       where batch_id = $1
       order by created_at desc
       limit 1`,
      [batchId],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      batchId: row.batch_id,
      status: row.status,
      outputPath: row.output_path,
      sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
      errorMessage: row.error_message,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    };
  },

  listApprovedForExport: async (args: { batchId: string }): Promise<Array<{
    batchDocumentId: string;
    documentId: string;
    storagePath: string;
    originalFilename: string;
    finalCategory: string;
    createdAt: string;
    responseJson: unknown | null;
  }>> => {
    const res = await pool.query<ExportDocumentRow>(
      `select
         bd.id as batch_document_id,
         bd.document_id,
         d.storage_path,
         d.original_filename,
         bd.final_category,
         bd.created_at,
         cr.response_json
       from batch_documents bd
       join documents d on d.id = bd.document_id
       left join lateral (
         select response_json
         from classification_runs
         where batch_document_id = bd.id
         order by created_at desc
         limit 1
       ) cr on true
       where bd.batch_id = $1
         and bd.status = 'approved'
         and bd.final_category is not null
       order by bd.created_at asc`,
      [args.batchId],
    );
    return res.rows.map((r) => ({
      batchDocumentId: r.batch_document_id,
      documentId: r.document_id,
      storagePath: r.storage_path,
      originalFilename: r.original_filename,
      finalCategory: r.final_category,
      createdAt: r.created_at,
      responseJson: r.response_json,
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

  listQueuedForProcessing: async (batchId: string): Promise<Array<{ batchDocumentId: string; documentId: string; storagePath: string; originalFilename: string }>> => {
    const res = await pool.query<BatchDocumentProcessingRow>(
      `select
         bd.id as batch_document_id,
         bd.document_id,
         d.storage_path,
         d.original_filename,
         bd.status
       from batch_documents bd
       join documents d on d.id = bd.document_id
       where bd.batch_id = $1 and bd.status = 'queued'
       order by bd.created_at asc`,
      [batchId],
    );
    return res.rows.map((r) => ({
      batchDocumentId: r.batch_document_id,
      documentId: r.document_id,
      storagePath: r.storage_path,
      originalFilename: r.original_filename,
    }));
  },

  setBatchDocumentStatus: async (batchDocumentId: string, status: BatchDocumentStatus): Promise<void> => {
    await pool.query(`update batch_documents set status = $2 where id = $1`, [batchDocumentId, status]);
  },

  setBatchDocumentResult: async (args: {
    batchDocumentId: string;
    status: BatchDocumentStatus;
    finalCategory: string | null;
    finalConfidence: number | null;
    errorMessage: string | null;
  }): Promise<void> => {
    await pool.query(
      `update batch_documents
       set status = $2,
           final_category = $3,
           final_confidence = $4,
           error_message = $5
       where id = $1`,
      [args.batchDocumentId, args.status, args.finalCategory, args.finalConfidence, args.errorMessage],
    );
  },

  insertClassificationRun: async (args: {
    batchDocumentId: string;
    aiProvider: 'gemini' | 'openai';
    aiModel: string;
    status: 'success' | 'failed';
    category: string | null;
    confidence: number | null;
    responseJson: unknown | null;
    errorMessage: string | null;
  }): Promise<void> => {
    await pool.query(
      `insert into classification_runs (batch_document_id, ai_provider, ai_model, status, category, confidence, response_json, error_message)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        args.batchDocumentId,
        args.aiProvider,
        args.aiModel,
        args.status,
        args.category,
        args.confidence,
        args.responseJson ? JSON.stringify(args.responseJson) : null,
        args.errorMessage,
      ],
    );
  },

  setBatchStatus: async (args: { batchId: string; status: BatchStatus; completedAt: 'now' | null }): Promise<void> => {
    await pool.query(
      `update batches
       set status = $2,
           completed_at = $3
       where id = $1`,
      [args.batchId, args.status, args.completedAt === 'now' ? new Date().toISOString() : null],
    );
  },

  listAllowedCategoriesForProfile: async (profileId: string): Promise<string[]> => {
    const res = await pool.query<{ target_folder: string }>(
      `select distinct target_folder
       from mapping_rules
       where profile_id = $1
         and is_active = true
         and match_type = 'category'
         and target_folder is not null
         and target_folder <> ''
       order by 1`,
      [profileId],
    );
    return res.rows.map((r) => r.target_folder);
  },

  listAnchorOverridesForProfile: async (
    profileId: string,
  ): Promise<Array<{ category: string; anchorKeywords: string[]; priority: number; isActive: boolean }>> => {
    try {
      const res = await pool.query<{ category: string; anchor_keywords: string[]; priority: number; is_active: boolean }>(
        `select category, anchor_keywords, priority, is_active
         from mapping_profile_anchor_overrides
         where profile_id = $1
         order by priority asc, created_at desc`,
        [profileId],
      );
      return res.rows.map((r) => ({
        category: r.category,
        anchorKeywords: r.anchor_keywords,
        priority: r.priority,
        isActive: r.is_active,
      }));
    } catch (err) {
      if (isMissingRelationError(err)) return [];
      throw err;
    }
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

  getGlobalCounts: async () => {
    const res = await pool.query<{
      total: string;
      queued: string;
      processing: string;
    }>(
      `select
         count(*)::text as total,
         count(*) filter (where status = 'queued')::text as queued,
         count(*) filter (where status = 'processing')::text as processing
       from batch_documents`,
    );
    const row = res.rows[0];
    return {
      total: Number(row?.total ?? 0),
      queued: Number(row?.queued ?? 0),
      processing: Number(row?.processing ?? 0),
    };
  },
};
