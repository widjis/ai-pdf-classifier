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
