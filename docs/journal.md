2026-05-23

## Feature:
- Backend bootstrap (Express + TypeScript)

## Changes:
- Added /backend service with layered module structure and Postgres connectivity via pg
- Added health endpoints for app and database verification

## Notes:
- Backend loads env from /backend/.env and also falls back to repo root .env/.env.local

2026-05-23

## Feature:
- Local dev orchestration

## Changes:
- Added root npm scripts to run frontend+backend together (dev:all)

2026-05-23

## Feature:
- Database schema (Postgres)

## Changes:
- Added initial SQL migration and seed scripts for users, mapping profiles/rules, documents, batches, classification runs, extracted fields, exports
- Added backend migration/seed/verify scripts

2026-05-23

## Feature:
- Phase 0–1 backend API

## Changes:
- Added standard backend error envelope and CORS middleware
- Added CRUD endpoints for users, user preferences, mapping profiles/rules, and minimal batches
- Added frontend typed API client and dashboard connectivity indicator (health + db ping)
