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

