create table if not exists mapping_profile_anchor_overrides (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references mapping_profiles(id) on delete cascade,
  category text not null,
  anchor_keywords text[] not null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (profile_id, category)
);

create index if not exists idx_anchor_overrides_profile on mapping_profile_anchor_overrides(profile_id, is_active, priority);
