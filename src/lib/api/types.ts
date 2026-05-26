export type ApiErrorResponse = {
  error: {
    message: string;
    code: string;
    details?: unknown;
  };
};

export type HealthResponse = {
  status: 'ok';
  runtime?: {
    platform: 'mac' | 'windows' | 'linux';
    isDocker: boolean;
    nodeEnv: string;
  };
  storage?: {
    uploadDir: { path: string; ok: boolean; error?: string };
    exportDir: { path: string; ok: boolean; error?: string };
    sharedFolder:
      | { configured: false; ok: true }
      | { configured: true; path: string; ok: boolean; error?: string };
  };
};
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

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'reviewer' | 'operator';
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type LoginMethod = 'ldap' | 'local';

export type MeResponse = {
  user: AuthUser;
};

export type AppUser = {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'reviewer' | 'operator';
  isActive: boolean;
  createdAt: string;
};

export type CreateUserInput = {
  email: string;
  displayName: string;
  role: AppUser['role'];
};

export type UpdateUserInput = {
  displayName?: string;
  role?: AppUser['role'];
  isActive?: boolean;
};

export type LdapDirectoryUser = {
  email: string;
  displayName: string;
};

export type ProvisionLdapUserInput = {
  identity: string;
  role: AppUser['role'];
};

export type AuditEventAction = 'users.create' | 'users.update' | 'users.reset_local_password';

export type AuditEvent = {
  id: string;
  actorUserId: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  targetUserId: string | null;
  targetDisplayName: string | null;
  targetEmail: string | null;
  action: AuditEventAction;
  before: unknown | null;
  after: unknown | null;
  ip: string | null;
  userAgent: string | null;
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

export type AnchorOverride = {
  id: string;
  profileId: string;
  category: string;
  anchorKeywords: string[];
  priority: number;
  isActive: boolean;
  createdAt: string;
};

export type UpsertAnchorOverrideInput = {
  category: string;
  anchorKeywords: string[] | string;
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

export type BatchTotals = {
  total: number;
  queued: number;
  processing: number;
  failed: number;
  readyForReview: number;
  approved: number;
};

export type BatchSummary = Batch & {
  totals: BatchTotals;
};

export type CreateBatchInput = {
  name: string;
  mappingProfileId?: string;
  aiProvider: AiProvider;
  aiModel: string;
  docTypeHandling: DocTypeHandling;
  createdBy?: string;
};

export type UpdateBatchInput = {
  name?: string;
  status?: BatchStatus;
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

export type BatchDocumentDetails = {
  batchDocumentId: string;
  batchId: string;
  documentId: string;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  status: BatchDocumentStatus;
  finalCategory: string | null;
  finalConfidence: number | null;
  createdAt: string;
  responseJson: unknown | null;
};

export type BatchDocumentFieldsKey = 'documentNumber' | 'personName' | 'documentDate' | 'organization' | 'notes' | 'requester';

export type UpdateBatchDocumentFieldsInput = {
  fields: Partial<Record<BatchDocumentFieldsKey, string | null>>;
};

export type BulkActionResponse = {
  updated: number;
};

export type ExportStatus = 'queued' | 'building' | 'ready' | 'failed';

export type ExportInfo = {
  id: string;
  batchId: string;
  status: ExportStatus;
  outputPath: string | null;
  sizeBytes: number | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type QueueMetricsResponse = {
  totalDocuments: number;
  queued: number;
  processing: number;
  backlogCount: number;
  backlogRatio: number;
  computeLoadPercent: number;
  updatedAt: string;
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
