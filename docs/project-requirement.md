# PRD — AI PDF Classifier (MVP/Core)

## 1) Product Summary
AI PDF Classifier is an app for batch processing PDF documents: upload/ingest → AI classification → prefix/code mapping → results review → export (ZIP + metadata).

Current repo status: the UI is still mock (static data). The backend provides health checks + PostgreSQL connectivity, and includes migration/seed scripts for the initial schema.

## 2) Target Scope (MVP/Core)
- Single-tenant, internal, multi-user (no authentication UI for MVP; user rows are used for ownership/defaults).
- Storage: local disk (server filesystem).
- Primary personas: Operator and Admin.
- Outcome focus: repeatable batch processing + exports that can be used operationally.

## 3) Goals & Non-Goals
### Goals
- Process PDF batches with clear statuses (queued/processing/ready/failed).
- Document classification produces:
  - category/label
  - confidence
  - extracted fields (key-value)
  - mapped prefix/code based on mapping rules
- Operators can review and approve before export.
- Export produces:
  - a ZIP containing files renamed according to rules
  - a metadata file (CSV/JSON) for downstream integration
- All configuration (AI provider/model + mapping preset/rules) is persisted and used when creating new batches.

### Non-Goals (MVP)
- Multi-tenancy, RBAC, SSO.
- Multi-step approval workflows, assignments, and collaborative reviewing.
- Heavy OCR pipelines for poor scans (allowed, but not an MVP blocker).
- Full audit logging, enterprise observability, and SLA tooling.

## 4) Personas
### Operator
- Create new batches (upload a folder or multiple PDFs).
- Start classification processing.
- Monitor progress and retry failures.
- Review results (preview + extracted fields).
- Export ZIP to deliver to another system.

### Admin
- Manage mapping profiles, mapping rules (prefix/category/filename rules), and filename normalization rules.
- Configure AI provider/model and prompt/policy (versioned).
- Define extracted fields schema per preset (optional for MVP).

## 5) UX Flow (End-to-End)
### Flow A — Setup (Admin)
1. Open Settings.
2. Choose the default mapping profile.
3. Choose AI provider + model.
4. Manage prefix mappings (source → target).
5. Save.

### Flow B — New Batch (Operator)
1. Open “New Batch”.
2. Enter a batch name + select a mapping profile (default from Settings).
3. Upload multiple PDFs (drag & drop / file picker).
4. Click “Start Processing”.
5. The system creates the batch, stores files on local disk, and creates a classification job per document.

### Flow C — Monitoring (Operator)
1. Open “Files / Batch Processing”.
2. View the document table + status per batch.
3. For failed documents: inspect error → retry.

### Flow D — Review (Operator)
1. Click a “Ready for Review” document.
2. View preview (thumbnail/page 1) + AI result summary.
3. Correct (optional for MVP) or approve.
4. After approval, the document is marked “Approved” (or remains “Ready” but flagged).

### Flow E — Export (Operator)
1. Select a batch.
2. Click “Generate Export”.
3. The system generates a ZIP:
  - files renamed according to rules (prefix mapping + naming template)
  - metadata.csv/json
4. The operator downloads the ZIP.

## 6) Wireframes (Description)
Based on the existing mock frontend components (Dashboard, BatchProcessing, NewBatch, Settings, Review).

### A. Sidebar + Header (Global)
- Sidebar: Dashboard, Files, New Batch, Settings
- Header: page title + contextual CTA (New Batch, Export)

### B. Files / Batch Processing
- Filters: batch selector + status filter
- Table columns: File Name, Category, Mapped Code, Requester, Status, Size, Time, Confidence
- Row actions: Review / Retry / View error
- Batch summary: total files, ready, failed, processing

### C. New Batch
- Input: Batch name
- Select: Mapping profile (default from Settings)
- Select: AI provider/model (read-only from Settings for MVP, or override per batch)
- Upload: drag & drop + file list
- CTA: Start Processing, Cancel

### D. Settings
- Defaults: mapping profile, AI provider, AI model
- Prefix mappings: add/remove
- (Optional MVP) Prompt template editor (advanced)

### E. Review
- Left: document preview (page 1) + basic metadata
- Right: classification results (label, confidence) + extracted fields table
- CTA: Approve, Back, Retry

## 7) Component Tree (Frontend)
### Routes/Views (currently mock)
- App (router state)
  - Sidebar
  - Header
  - DashboardView
  - BatchProcessingView
  - NewBatchView
  - SettingsView
  - DocumentReviewView

### Proposed decomposition (for a complete system)
- views/
  - DashboardPage
  - BatchesPage
  - NewBatchPage
  - SettingsPage
  - DocumentReviewPage
- components/
  - tables/DocumentTable
  - forms/NewBatchForm
  - forms/SettingsForm
  - cards/BatchSummaryCard
  - panels/DocumentPreviewPanel
  - panels/ClassificationResultPanel
  - dialogs/ConfirmDialog
  - toasts/ToastProvider
- lib/
  - api/client (fetch wrapper)
  - storage/settings (localStorage abstraction)
  - validators (zod or custom, depending on repo stack)

## 8) Responsive Guidelines (Mobile-first)
- Sidebar:
  - Mobile: collapsible drawer
  - Desktop: fixed sidebar
- Table:
  - Mobile: card/list view per document (stacked fields)
  - Desktop: full table
- Review:
  - Mobile: preview on top, results below
  - Desktop: 2-column split
- Touch targets minimum 44x44 px, consistent form spacing.

## 9) Accessibility (WCAG 2.1)
- All interactive elements have labels/aria-labels.
- Text contrast meets AA.
- Keyboard navigation: logical tab order, visible focus.
- Processing status is conveyed by text (not color only).
- Tables have proper headers and are screen-reader friendly.

## 10) Backend Architecture (Modular Monolith)
Backend follows:
- controller: HTTP boundary, no business logic
- service: business logic
- repository: SQL/IO

### Proposed modules (MVP)
- modules/users (minimal user registry for internal use + ownership/defaults; no auth for MVP)
- modules/settings (user defaults persisted in DB)
- modules/mappings (mapping profiles + mapping rules)
- modules/batches (create/list/get batch + metrics)
- modules/documents (upload, list, get, retry, approve)
- modules/classification (run pipeline, status, prompt versions)
- modules/exports (generate zip, download)
- modules/files (serve preview/thumbnail)

## 11) Database Schema (PostgreSQL, MVP)
Note: single-tenant, internal. No authentication UI for MVP, but we keep `app_users` + `user_preferences` for ownership and default configuration.

### 11.1 Tables
#### schema_migrations
- version (text pk)
- applied_at (timestamptz)

#### app_users
- id (uuid pk)
- email (text unique)
- display_name (text)
- role (text: admin|reviewer|operator)
- is_active (bool)
- created_at (timestamptz)

#### user_preferences
- user_id (uuid pk, fk app_users.id)
- default_mapping_profile_id (uuid fk mapping_profiles.id)
- default_ai_provider (text: gemini|openai)
- default_ai_model (text)
- created_at (timestamptz)
- updated_at (timestamptz)

#### mapping_profiles
- id (uuid pk)
- name (text)
- description (text)
- version (int)
- is_active (bool)
- created_by (uuid fk app_users.id)
- created_at (timestamptz)

#### mapping_rules
- id (uuid pk)
- profile_id (uuid fk mapping_profiles.id)
- match_type (text: category|filename_prefix|filename_regex)
- source (text)
- target_code (text, optional)
- target_prefix (text, optional)
- target_folder (text) (export folder name/path)
- priority (int)
- is_active (bool)
- created_at (timestamptz)

#### documents
- id (uuid pk)
- original_filename (text)
- storage_path (text unique) (local path on server)
- size_bytes (bigint)
- mime_type (text, optional)
- sha256 (text, optional)
- created_at (timestamptz)

#### batches
- id (uuid pk)
- name (text)
- mapping_profile_id (uuid fk mapping_profiles.id, optional)
- ai_provider (text: gemini|openai)
- ai_model (text)
- doc_type_handling (text: standard|ocr|scanned)
- status (text: draft|running|needs_review|completed|failed|canceled)
- created_by (uuid fk app_users.id, optional)
- created_at (timestamptz)
- started_at (timestamptz, optional)
- completed_at (timestamptz, optional)

#### batch_documents
- id (uuid pk)
- batch_id (uuid fk batches.id)
- document_id (uuid fk documents.id)
- status (text: queued|processing|failed|ready_for_review|approved)
- final_category (text, optional)
- final_confidence (numeric(5,2), optional)
- final_target_code (text, optional)
- final_target_prefix (text, optional)
- final_target_folder (text, optional)
- error_message (text, optional)
- reviewed_by (uuid fk app_users.id, optional)
- reviewed_at (timestamptz, optional)
- created_at (timestamptz)
- unique(batch_id, document_id)

#### classification_runs
- id (uuid pk)
- batch_document_id (uuid fk batch_documents.id)
- ai_provider (text: gemini|openai)
- ai_model (text)
- status (text: success|failed)
- category (text, optional)
- confidence (numeric(5,2), optional)
- response_json (jsonb, optional)
- error_message (text, optional)
- created_at (timestamptz)

#### extracted_fields
- id (uuid pk)
- classification_run_id (uuid fk classification_runs.id)
- field_key (text)
- field_value (text, optional)
- confidence (numeric(5,2), optional)
- source (text: text|ocr|vision|user, optional)
- created_at (timestamptz)

#### exports
- id (uuid pk)
- batch_id (uuid fk batches.id)
- status (text: queued|building|ready|failed)
- output_path (text, optional) (zip path or export directory path)
- size_bytes (bigint, optional)
- error_message (text, optional)
- created_at (timestamptz)
- completed_at (timestamptz, optional)

### 11.2 Indexes (minimum)
- mapping_rules(profile_id, is_active, match_type, priority)
- documents(sha256) if deduplication is used
- batches(status, created_at)
- batch_documents(batch_id, status)
- classification_runs(batch_document_id, created_at)

## 12) API Endpoints (MVP)
Base: `/api`

### Users (internal, no auth for MVP)
- GET `/users`
- POST `/users`

### User Preferences (Defaults)
- GET `/user-preferences/:userId`
- PUT `/user-preferences/:userId`
  - body: { defaultMappingProfileId, defaultAiProvider, defaultAiModel }

### Mapping Profiles & Rules
- GET `/mapping-profiles`
- POST `/mapping-profiles`
- GET `/mapping-profiles/:id`
- PUT `/mapping-profiles/:id`
- GET `/mapping-profiles/:id/rules`
- POST `/mapping-profiles/:id/rules`
- DELETE `/mapping-rules/:id`

### Batches
- GET `/batches`
- POST `/batches`
  - body: { name, mappingProfileId, aiProvider?, aiModel?, docTypeHandling? }
- GET `/batches/:id`

### Documents & Upload
- POST `/batches/:id/documents` (multipart)
- GET `/batches/:id/documents`
- GET `/documents/:id` (metadata)
- POST `/batches/:batchId/documents/:documentId/retry`
- POST `/batches/:batchId/documents/:documentId/approve`

### Classification (internal)
- POST `/batches/:id/start` (enqueue jobs)
- GET `/batches/:id/progress`

### Files/Preview
- GET `/documents/:id/preview` (image/pdf snippet; minimal MVP: serve the PDF file)

### Exports
- POST `/batches/:id/exports`
- GET `/exports/:id`
- GET `/exports/:id/download` (zip stream)

## 13) Validation (DTO)
Backend must validate inputs:
- CreateUserDTO: email (email), displayName (min 1), role (enum)
- UpsertUserPreferencesDTO: defaultMappingProfileId (uuid), defaultAiProvider (enum), defaultAiModel (min 1)
- CreateMappingProfileDTO: name (min 1), version (int), isActive (bool)
- CreateMappingRuleDTO: matchType (enum), source (min 1), targetFolder (min 1), targetCode/targetPrefix (optional), priority (int)
- CreateBatchDTO: name (min 1), mappingProfileId (uuid), aiProvider (enum), aiModel (min 1), docTypeHandling (enum)
- ApproveDocumentDTO: optional payload to override results (MVP can be empty)

Validation implementation options:
- zod (if added), or
- manual runtime validation (no new dependencies).

## 14) Operational Requirements (MVP)
- Secrets (API key) must live in backend env only, never in the frontend.
- Job processing:
  - MVP: in-process queue (p-limit/worker loop) is acceptable
  - Future: BullMQ/Redis
- Retries: max attempts + simple backoff.
- Error handling: error_message is stored per batch_document.
- Data retention: files and exports are stored on disk; housekeeping is manual for MVP (automate later).

## 15) Phase-by-Phase Implementation Plan
Phases are designed to evolve the mock UI into an end-to-end working system.

### Phase 0 — Baseline & Contracts
Deliverables:
- API contracts & types in frontend (typed fetch client).
- Standard error format from backend.
Acceptance:
- Frontend can call `/api/health` and `/api/db/ping`.

### Phase 1 — Database + Migration Strategy
Deliverables:
- DDL for the MVP schema (tables + indexes).
- Backend repository layer for minimal CRUD (settings, presets, batches, documents).
Acceptance:
- Settings + presets endpoints work and persist in PostgreSQL.

### Phase 2 — Settings & Mappings (Real)
Deliverables:
- Frontend SettingsView connects to backend (GET/PUT).
- Prefix mappings CRUD is real (not only localStorage).
Acceptance:
- Browser refresh retains configuration (DB as source; localStorage cache optional).

### Phase 3 — Batch + Upload (Local Disk)
Deliverables:
- Create batch endpoint + upload multiple PDFs (multipart).
- Store files into per-batch folders on the server.
- Frontend NewBatchView wired: create batch → upload → show progress placeholder.
Acceptance:
- Files are stored on disk, metadata is in DB, real document list renders in the UI.

### Phase 4 — Classification Pipeline (MVP)
Deliverables:
- In-process worker: take queued docs → extract text → call AI → parse result → persist label/confidence/fields.
- Minimal prompt versioning (string constant + stored in classification_runs).
Acceptance:
- Document status transitions: queued → processing → ready_for_review / failed.
- Results display in the Review UI.

### Phase 5 — Review + Approve + Export ZIP
Deliverables:
- Approve document endpoint.
- Export generator: rename files + metadata.csv/json + zip.
- Download export from UI.
Acceptance:
- Operator can approve and download a zip containing renamed files + metadata.

### Phase 6 — Hardening (MVP+)
Deliverables:
- Minimal observability: structured logs + request id.
- Cleaner retry policy + limits.
- Full input validation + basic internal rate limits.
Acceptance:
- System is stable for large batches and failures are handled clearly.

## 16) Definition of Done (MVP)
- End-to-end: Settings → New Batch → Upload → AI classify → Review → Approve → Export ZIP.
- No API keys in the browser.
- All key endpoints have input validation and consistent error format.
- `npm run lint` and `npm run lint:backend` pass (tsc --noEmit).
