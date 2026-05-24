create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_users(id) on delete set null,
  target_user_id uuid references app_users(id) on delete set null,
  action text not null,
  before jsonb,
  after jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_created_at on audit_events(created_at desc);
create index if not exists idx_audit_events_action_created_at on audit_events(action, created_at desc);

