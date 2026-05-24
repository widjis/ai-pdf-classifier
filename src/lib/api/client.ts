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
  MappingProfile,
  MappingRule,
  RecentActivityItem,
  SetAiProviderKeyInput,
  UploadBatchDocumentsResponse,
  UpdateUserPreferencesInput,
  UserPreferences,
} from './types';

const getBaseUrl = (): string => {
  const fromEnv = import.meta.env.VITE_API_URL as string | undefined;
  if (fromEnv && fromEnv.trim().length > 0) return fromEnv.trim().replace(/\/+$/, '');
  return 'http://localhost:4000';
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
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return handleResponse<T>(res);
};

export const api = {
  health: () => request<HealthResponse>('/api/health'),
  dbPing: () => request<DbPingResponse>('/api/db/ping'),
  dbInfo: () => request<DbInfoResponse>('/api/db/info'),
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
    recentActivity: (limit = 20) => request<RecentActivityItem[]>(`/api/batches/recent-activity?limit=${encodeURIComponent(String(limit))}`),
    uploadDocuments: async (id: string, files: File[]): Promise<UploadBatchDocumentsResponse> => {
      const baseUrl = getBaseUrl();
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
