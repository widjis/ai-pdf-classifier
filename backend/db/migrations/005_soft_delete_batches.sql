alter table batches
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references app_users(id);

alter table batch_documents
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_by uuid references app_users(id);

create index if not exists idx_batches_deleted_at on batches(deleted_at);
create index if not exists idx_batch_documents_deleted_at on batch_documents(deleted_at);
