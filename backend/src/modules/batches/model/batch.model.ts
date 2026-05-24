export type BatchStatus = 'draft' | 'running' | 'needs_review' | 'completed' | 'failed' | 'canceled';
export type DocTypeHandling = 'standard' | 'ocr' | 'scanned';
export type BatchDocumentStatus = 'queued' | 'processing' | 'failed' | 'ready_for_review' | 'approved';

export type Batch = {
  id: string;
  name: string;
  mappingProfileId: string | null;
  aiProvider: 'gemini' | 'openai';
  aiModel: string;
  docTypeHandling: DocTypeHandling;
  status: BatchStatus;
  createdBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type BatchSummary = Batch & {
  totals: {
    total: number;
    queued: number;
    processing: number;
    failed: number;
    readyForReview: number;
    approved: number;
  };
};

export type BatchDocumentListItem = {
  batchDocumentId: string;
  documentId: string;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  status: BatchDocumentStatus;
  finalCategory: string | null;
  createdAt: string;
};

export type RecentActivityItem = {
  batchId: string;
  batchName: string;
  batchDocumentId: string;
  documentId: string;
  originalFilename: string;
  sizeBytes: number;
  status: BatchDocumentStatus;
  createdAt: string;
};
