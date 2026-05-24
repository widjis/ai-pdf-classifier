import type { AuditEvent, AuditEventAction } from '../model/audit.model.js';
import { auditRepository } from '../repository/audit.repository.js';

export const auditService = {
  list: async (limit: number): Promise<AuditEvent[]> => auditRepository.list(limit),

  log: async (args: {
    actorUserId: string | null;
    targetUserId: string | null;
    action: AuditEventAction;
    before?: unknown | null;
    after?: unknown | null;
    ip?: string | null;
    userAgent?: string | null;
  }): Promise<void> => {
    await auditRepository.insert({
      actorUserId: args.actorUserId,
      targetUserId: args.targetUserId,
      action: args.action,
      before: args.before ?? null,
      after: args.after ?? null,
      ip: args.ip ?? null,
      userAgent: args.userAgent ?? null,
    });
  },
};

