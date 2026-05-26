export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'LDAP_SEARCH_FAILED'
  | 'LDAP_LOOKUP_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: ApiErrorCode;
  public readonly details?: unknown;

  constructor(args: { status: number; code: ApiErrorCode; message: string; details?: unknown }) {
    super(args.message);
    this.status = args.status;
    this.code = args.code;
    this.details = args.details;
  }
}
