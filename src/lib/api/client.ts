import type { ApiErrorResponse } from './types';

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

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let payload: ApiErrorResponse | undefined;
    try {
      payload = (await res.json()) as ApiErrorResponse;
    } catch {}
    throw new ApiClientError({
      status: res.status,
      message: payload?.error?.message ?? `Request failed (${res.status})`,
      code: payload?.error?.code,
      details: payload?.error?.details,
    });
  }

  return (await res.json()) as T;
};

export const api = {
  health: () => request<{ status: 'ok' }>('/api/health'),
  dbPing: () => request<{ ok: boolean }>('/api/db/ping'),
  dbInfo: () => request<{ ok: boolean; db: string; user: string }>('/api/db/info'),
};

