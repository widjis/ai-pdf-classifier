create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  display_name text not null,
  role text not null check (role in ('admin','reviewer','operator')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists mapping_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  version int not null default 1,
  is_active boolean not null default true,
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists user_preferences (
  user_id uuid primary key references app_users(id) on delete cascade,
  default_mapping_profile_id uuid references mapping_profiles(id),
  default_ai_provider text check (default_ai_provider in ('gemini','openai')),
  default_ai_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mapping_rules (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references mapping_profiles(id) on delete cascade,
  match_type text not null check (match_type in ('category','filename_prefix','filename_regex')),
  source text not null,
  target_code text,
  target_prefix text,
  target_folder text not null,
  priority int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_mapping_rules_profile on mapping_rules(profile_id, is_active, match_type, priority);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  original_filename text not null,
  mime_type text,
  size_bytes bigint not null check (size_bytes >= 0),
  sha256 text,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create index if not exists idx_documents_sha256 on documents(sha256);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mapping_profile_id uuid references mapping_profiles(id),
  ai_provider text not null check (ai_provider in ('gemini','openai')),
  ai_model text not null,
  doc_type_handling text not null check (doc_type_handling in ('standard','ocr','scanned')),
  status text not null check (status in ('draft','running','needs_review','completed','failed','canceled')),
  created_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists idx_batches_status_created_at on batches(status, created_at desc);

create table if not exists batch_documents (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  document_id uuid not null references documents(id) on delete restrict,
  status text not null check (status in ('queued','processing','failed','ready_for_review','approved')),
  final_category text,
  final_confidence numeric(5,2) check (final_confidence >= 0 and final_confidence <= 100),
  final_target_code text,
  final_target_prefix text,
  final_target_folder text,
  error_message text,
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (batch_id, document_id)
);

create index if not exists idx_batch_documents_batch on batch_documents(batch_id, status);
create index if not exists idx_batch_documents_doc on batch_documents(document_id);

create table if not exists classification_runs (
  id uuid primary key default gen_random_uuid(),
  batch_document_id uuid not null references batch_documents(id) on delete cascade,
  ai_provider text not null check (ai_provider in ('gemini','openai')),
  ai_model text not null,
  status text not null check (status in ('success','failed')),
  category text,
  confidence numeric(5,2) check (confidence >= 0 and confidence <= 100),
  response_json jsonb,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_classification_runs_bd_created on classification_runs(batch_document_id, created_at desc);

create table if not exists extracted_fields (
  id uuid primary key default gen_random_uuid(),
  classification_run_id uuid not null references classification_runs(id) on delete cascade,
  field_key text not null,
  field_value text,
  confidence numeric(5,2) check (confidence >= 0 and confidence <= 100),
  source text check (source in ('text','ocr','vision','user')),
  created_at timestamptz not null default now()
);

create index if not exists idx_extracted_fields_run on extracted_fields(classification_run_id);

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  status text not null check (status in ('queued','building','ready','failed')),
  output_path text,
  size_bytes bigint check (size_bytes >= 0),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists idx_exports_batch on exports(batch_id, created_at desc);

