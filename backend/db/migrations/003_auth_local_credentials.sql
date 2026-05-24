create table if not exists auth_local_credentials (
  user_id uuid primary key references app_users(id) on delete cascade,
  password_hash text not null,
  salt text not null,
  scrypt_params jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
