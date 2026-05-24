import type {
  ApiErrorResponse,
  AiConfigStatusResponse,
  AiConfigTestResponse,
  AiProvider,
  AppUser,
  Batch,
  BatchDocumentListItem,
  BatchSummary,
  CreateMappingProfileInput,
  CreateBatchInput,
  CreateMappingRuleInput,
  DbInfoResponse,
  DbPingResponse,
  HealthResponse,
  AnchorOverride,
  LoginResponse,
  MappingProfile,
  MappingRule,
  MeResponse,
  RecentActivityItem,
  SetAiProviderKeyInput,
  UpsertAnchorOverrideInput,
  UploadBatchDocumentsResponse,
  UpdateUserPreferencesInput,
  UserPreferences,
  BatchDocumentDetails,
  BulkActionResponse,
  ExportInfo,
  QueueMetricsResponse,
} from './types';

const getBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim().replace(/\/+$/, '');
  return 'http://localhost:4000';
};

export const apiBaseUrl = getBaseUrl();

const AUTH_TOKEN_KEY = 'ai-pdf-classifier.authToken';

export const authToken = {
  get: (): string | null => localStorage.getItem(AUTH_TOKEN_KEY),
  set: (token: string) => localStorage.setItem(AUTH_TOKEN_KEY, token),
  clear: () => localStorage.removeItem(AUTH_TOKEN_KEY),
};

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(args: { status: number; message: string; code?: string; details?: unknown }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}

const toClientError = async (res: Response): Promise<ApiClientError> => {
  let payload: ApiErrorResponse | undefined;
  try {
    payload = (await res.json()) as ApiErrorResponse;
  } catch {}
  return new ApiClientError({
    status: res.status,
    message: payload?.error?.message ?? `Request failed (${res.status})`,
    code: payload?.error?.code,
    details: payload?.error?.details,
  });
};

const handleResponse = async <T>(res: Response): Promise<T> => {
  if (!res.ok) throw await toClientError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
};

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const baseUrl = apiBaseUrl;
  const token = authToken.get();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  return handleResponse<T>(res);
};

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  dbPing: () => request<DbPingResponse>('/api/db/ping'),
  dbInfo: () => request<DbInfoResponse>('/api/db/info'),
  auth: {
    login: (body: { email: string; password: string }) =>
      request<LoginResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) }),
    me: () => request<MeResponse>('/api/auth/me'),
  },
  users: {
    list: () => request<AppUser[]>('/api/users'),
  },
  userPreferences: {
    get: (userId: string) => request<UserPreferences>(`/api/user-preferences/${userId}`),
    update: (userId: string, body: UpdateUserPreferencesInput) =>
      request<UserPreferences>(`/api/user-preferences/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
  },
  mappingProfiles: {
    list: () => request<MappingProfile[]>('/api/mapping-profiles'),
    create: (body: CreateMappingProfileInput) =>
      request<MappingProfile>('/api/mapping-profiles', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getRules: (profileId: string) => request<MappingRule[]>(`/api/mapping-profiles/${profileId}/rules`),
    createRule: (profileId: string, body: CreateMappingRuleInput) =>
      request<MappingRule>(`/api/mapping-profiles/${profileId}/rules`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getAnchorOverrides: (profileId: string) => request<AnchorOverride[]>(`/api/mapping-profiles/${profileId}/anchor-overrides`),
    upsertAnchorOverride: (profileId: string, body: UpsertAnchorOverrideInput) =>
      request<AnchorOverride>(`/api/mapping-profiles/${profileId}/anchor-overrides`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    deleteAnchorOverride: (profileId: string, overrideId: string) =>
      request<void>(`/api/mapping-profiles/${profileId}/anchor-overrides/${overrideId}`, {
        method: 'DELETE',
      }),
  },
  mappingRules: {
    delete: (ruleId: string) =>
      request<void>(`/api/mapping-rules/${ruleId}`, {
        method: 'DELETE',
      }),
  },
  aiConfig: {
    status: () => request<AiConfigStatusResponse>('/api/ai-config'),
    testKey: (provider: AiProvider) => request<AiConfigTestResponse>(`/api/ai-config/${provider}/test`, { method: 'POST' }),
    setKey: (provider: AiProvider, body: SetAiProviderKeyInput) =>
      request<{ ok: true }>(`/api/ai-config/${provider}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }),
    clearKey: (provider: AiProvider) =>
      request<{ ok: true }>(`/api/ai-config/${provider}`, {
        method: 'DELETE',
      }),
  },
  batches: {
    list: () => request<Batch[]>('/api/batches'),
    create: (body: CreateBatchInput) =>
      request<Batch>('/api/batches', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    get: (id: string) => request<BatchSummary>(`/api/batches/${id}`),
    start: (id: string) => request<BatchSummary>(`/api/batches/${id}/start`, { method: 'POST' }),
    listDocuments: (id: string) => request<BatchDocumentListItem[]>(`/api/batches/${id}/documents`),
    getDocument: (batchId: string, batchDocumentId: string) =>
      request<BatchDocumentDetails>(`/api/batches/${batchId}/documents/${batchDocumentId}`),
    updateDocumentCategory: (batchId: string, batchDocumentId: string, body: { category: string }) =>
      request<BatchDocumentDetails>(`/api/batches/${batchId}/documents/${batchDocumentId}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    approveDocument: (batchId: string, batchDocumentId: string) =>
      request<BatchDocumentDetails>(`/api/batches/${batchId}/documents/${batchDocumentId}/approve`, { method: 'POST' }),
    bulkApprove: (batchId: string, body: { batchDocumentIds: string[] }) =>
      request<BulkActionResponse>(`/api/batches/${batchId}/documents/bulk-approve`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    bulkSetCategory: (batchId: string, body: { batchDocumentIds: string[]; category: string }) =>
      request<BulkActionResponse>(`/api/batches/${batchId}/documents/bulk-category`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    export: (
      batchId: string,
      body: {
        startingIndex: number;
        orderBy: 'created_at' | 'filename';
        groupByCategory: boolean;
        numberingMode: 'global' | 'per_category';
        startingIndexByCategory?: Record<string, number>;
      },
    ) =>
      request<ExportInfo>(`/api/batches/${batchId}/export`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    getLatestExport: (batchId: string) => request<ExportInfo>(`/api/batches/${batchId}/export`),
    recentActivity: (limit = 20) => request<RecentActivityItem[]>(`/api/batches/recent-activity?limit=${encodeURIComponent(String(limit))}`),
    queueMetrics: () => request<QueueMetricsResponse>('/api/batches/queue-metrics'),
    uploadDocuments: async (id: string, files: File[]): Promise<UploadBatchDocumentsResponse> => {
      const baseUrl = apiBaseUrl;
      const form = new FormData();
      for (const f of files) form.append('files', f, f.name);
      const res = await fetch(`${baseUrl}/api/batches/${id}/documents`, {
        method: 'POST',
        body: form,
      });
      return handleResponse<UploadBatchDocumentsResponse>(res);
    },
  },
};
