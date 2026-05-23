export type BatchStatus = 'draft' | 'running' | 'needs_review' | 'completed' | 'failed' | 'canceled';
export type DocTypeHandling = 'standard' | 'ocr' | 'scanned';

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

