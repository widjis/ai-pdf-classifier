export type ApiErrorResponse = {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export type HealthResponse = { status: 'ok' };
export type DbPingResponse = { ok: boolean };
export type DbInfoResponse = { ok: boolean; db: string; user: string };

export type AiProvider = 'gemini' | 'openai';

export type AiProviderKeyStatus = {
  provider: AiProvider;
  hasKey: boolean;
  updatedAt: string | null;
};

export type AiConfigStatusResponse = {
  providers: AiProviderKeyStatus[];
};

export type AiConfigTestResponse = {
  ok: true;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'reviewer' | 'operator';
  isActive: boolean;
  createdAt: string;
};

export type UserPreferences = {
  userId: string;
  defaultMappingProfileId: string | null;
  defaultAiProvider: AiProvider | null;
  defaultAiModel: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MappingProfile = {
  id: string;
  name: string;
  description: string | null;
  version: number;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
};

export type MappingRuleMatchType = 'category' | 'filename_prefix' | 'filename_regex';

export type MappingRule = {
  id: string;
  profileId: string;
  matchType: MappingRuleMatchType;
  source: string;
  targetCode: string | null;
  targetPrefix: string | null;
  targetFolder: string;
  priority: number;
  isActive: boolean;
  createdAt: string;
};

export type UpdateUserPreferencesInput = {
  defaultMappingProfileId?: string;
  defaultAiProvider?: AiProvider;
  defaultAiModel?: string;
};

export type CreateMappingRuleInput = {
  matchType: MappingRuleMatchType;
  source: string;
  targetFolder: string;
  targetCode?: string;
  targetPrefix?: string;
  priority?: number;
  isActive?: boolean;
};

export type CreateMappingProfileInput = {
  name: string;
  description?: string;
  version?: number;
  isActive?: boolean;
  createdBy?: string;
};

export type SetAiProviderKeyInput = {
  apiKey: string;
};

export type DocTypeHandling = 'standard' | 'ocr' | 'scanned';
export type BatchStatus = 'draft' | 'running' | 'needs_review' | 'completed' | 'failed' | 'canceled';
export type BatchDocumentStatus = 'queued' | 'processing' | 'failed' | 'ready_for_review' | 'approved';

export type Batch = {
  id: string;
  name: string;
  mappingProfileId: string | null;
  aiProvider: AiProvider;
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

export type CreateBatchInput = {
  name: string;
  mappingProfileId?: string;
  aiProvider: AiProvider;
  aiModel: string;
  docTypeHandling: DocTypeHandling;
  createdBy?: string;
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

export type UploadBatchDocumentsResponse = {
  added: number;
};
