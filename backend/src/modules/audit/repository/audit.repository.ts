import { pool } from '../../../core/db/postgres.js';
import type { AuditEvent, AuditEventAction } from '../model/audit.model.js';

type Row = {
  id: string;
  actor_user_id: string | null;
  actor_display_name: string | null;
  actor_email: string | null;
  target_user_id: string | null;
  target_display_name: string | null;
  target_email: string | null;
  action: string;
  before: unknown | null;
  after: unknown | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

const mapRow = (r: Row): AuditEvent => ({
  id: r.id,
  actorUserId: r.actor_user_id,
  actorDisplayName: r.actor_display_name,
  actorEmail: r.actor_email,
  targetUserId: r.target_user_id,
  targetDisplayName: r.target_display_name,
  targetEmail: r.target_email,
  action: r.action as AuditEventAction,
  before: r.before,
  after: r.after,
  ip: r.ip,
  userAgent: r.user_agent,
  createdAt: r.created_at,
});

export const auditRepository = {
  insert: async (args: {
    actorUserId: string | null;
    targetUserId: string | null;
    action: AuditEventAction;
    before: unknown | null;
    after: unknown | null;
    ip: string | null;
    userAgent: string | null;
  }): Promise<void> => {
    await pool.query(
      'insert into audit_events (actor_user_id, target_user_id, action, before, after, ip, user_agent) values ($1, $2, $3, $4, $5, $6, $7)',
      [args.actorUserId, args.targetUserId, args.action, args.before, args.after, args.ip, args.userAgent],
    );
  },

  list: async (limit: number): Promise<AuditEvent[]> => {
    const bounded = Math.max(1, Math.min(limit, 250));
    const res = await pool.query<Row>(
      `select
         ae.id,
         ae.actor_user_id,
         actor.display_name as actor_display_name,
         actor.email as actor_email,
         ae.target_user_id,
         target.display_name as target_display_name,
         target.email as target_email,
         ae.action,
         ae.before,
         ae.after,
         ae.ip,
         ae.user_agent,
         ae.created_at
       from audit_events ae
       left join app_users actor on actor.id = ae.actor_user_id
       left join app_users target on target.id = ae.target_user_id
       order by ae.created_at desc
       limit $1`,
      [bounded],
    );
    return res.rows.map(mapRow);
  },
};

