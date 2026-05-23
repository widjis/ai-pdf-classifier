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

