create table if not exists ai_provider_secrets (
  provider text primary key check (provider in ('gemini','openai')),
  api_key_encrypted bytea not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
