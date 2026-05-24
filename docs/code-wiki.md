# AI PDF Classifier — Code Wiki

## 1. Repository Overview

AI PDF Classifier is a full-stack TypeScript project with:
- A **Vite + React** frontend (mock UI with local data and localStorage-backed settings).
- A **Node.js + Express** backend (modular monolith) with **PostgreSQL** persistence, plus migration/seed tooling.

Key goals (from [project-requirement.md](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/docs/project-requirement.md)) include batch ingestion, AI classification, mapping rules, review/approval, and export. The current implementation focuses on foundational UI scaffolding + backend CRUD for users, preferences, mappings, and batches.

## 2. High-Level Architecture

### 2.1 Runtime Topology

- **Frontend** (browser): Vite dev server serves the React app (default port **3000**).
- **Backend** (node): Express API server (default port **4000**, auto-increments if busy) connects to PostgreSQL.
- **Database**: PostgreSQL schema managed via SQL migrations and seeded demo data.

### 2.2 Data Flow (Typical)

1. UI initiates an action (e.g., list mapping profiles).
2. Frontend uses typed fetch wrapper ([api client](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/lib/api/client.ts)).
3. Backend route → controller → service → repository executes SQL via a pooled connection.
4. Backend returns JSON (or a standardized error payload).

### 2.3 Backend Layering Pattern

Each backend domain module follows the same directory structure:
- `routes/`: Express `Router` + URL bindings
- `controller/`: HTTP boundary (validation/DTO parsing, status codes)
- `service/`: business rules and orchestration
- `repository/`: SQL / persistence operations
- `dto/`: request parsing + runtime validation
- `model/`: TypeScript types for domain objects

Example: [modules/batches](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches)

## 3. Repository Layout

### 3.1 Top-Level

- Frontend source: [src/](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src)
- Backend source: [backend/src/](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src)
- Database assets: [backend/db/](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/db)
- Product docs: [docs/](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/docs)

### 3.2 Entry Points

- Frontend bootstrap: [main.tsx](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/main.tsx)
- Frontend shell/state router: [App.tsx](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/App.tsx)
- Backend entrypoint: [backend server.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/server.ts)
- Backend app composition: [createApp](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/app.ts)

## 4. Frontend (Vite + React)

### 4.1 Navigation Model

The frontend currently does not use a URL router. It uses a local `currentView` state in [App.tsx](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/App.tsx#L14-L55) to switch between views:
- `dashboard` → [DashboardView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/DashboardView.tsx)
- `files` → [BatchProcessingView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/BatchProcessingView.tsx)
- `newBatch` → [NewBatchView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/NewBatchView.tsx)
- `settings` → [SettingsView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/SettingsView.tsx)
- `review` → [DocumentReviewView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/DocumentReviewView.tsx)

View selection is driven by [Sidebar](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/Sidebar.tsx) and [Header](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/Header.tsx).

### 4.2 Key Types and Local Data

- Shared types: [src/types.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/types.ts)
  - `ViewState`: allowed UI views
  - `DocumentInfo`: UI “document row” shape (mocked)
  - `MappingRule`: simple UI mapping (source → target)
- Mock data: [src/data.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/data.ts)
  - `mockDocuments`: drives “Batch Processing” table and review view
  - `mockMappings`: default prefix mappings for Settings

### 4.3 Settings Persistence (localStorage)

Two views share a settings key to persist defaults:
- Settings write/read: [SettingsView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/SettingsView.tsx#L8-L77)
- New batch reads defaults: [NewBatchView](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components/NewBatchView.tsx#L7-L33)

Key behaviors:
- `SettingsView` stores `defaultMappingPreset`, `aiProvider`, `aiModel`, and `prefixMappings`.
- `NewBatchView` initializes form defaults from the stored values.

### 4.4 Frontend API Client

The API layer is a small typed wrapper around `fetch`:
- Base URL selection: `VITE_API_URL` or fallback `http://localhost:4000` ([getBaseUrl](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/lib/api/client.ts#L3-L7))
- Error mapping: [ApiClientError](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/lib/api/client.ts#L9-L20)
- Current endpoints implemented in client:
  - `GET /api/health` → `api.health()`
  - `GET /api/db/ping` → `api.dbPing()`
  - `GET /api/db/info` → `api.dbInfo()`

The UI views are mostly mocked and do not yet wire into these endpoints.

## 5. Backend (Node + Express + PostgreSQL)

### 5.1 App Composition and Routing

App creation and route mounting happens in [createApp](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/app.ts#L12-L29):
- `/api/health`
- `/api/db`
- `/api/users`
- `/api/user-preferences`
- `/api/mapping-profiles`
- `/api/mapping-rules`
- `/api/batches`

Cross-cutting middleware:
- CORS headers + OPTIONS short-circuit: [corsMiddleware](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/cors.ts)
- 404 + error formatter: [errorMiddleware](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/errorMiddleware.ts)
- Promise-safe controller wrapping: [asyncHandler](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/asyncHandler.ts)

### 5.2 Error Model

Standard error shape returned by backend:

```json
{
  "error": {
    "message": "string",
    "code": "BAD_REQUEST|NOT_FOUND|CONFLICT|INTERNAL_ERROR",
    "details": "optional"
  }
}
```

Implemented via:
- [ApiError](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/apiError.ts)
- [errorMiddleware](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/errorMiddleware.ts#L16-L24)

### 5.3 Environment Configuration

Backend environment variables are loaded from multiple locations (in order) by [env.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/config/env.ts#L8-L17). It attempts to load:
- `backend/.env`, `backend/.env.local`
- `repoRoot/.env`, `repoRoot/.env.local`
- plus additional fallbacks relative to the compiled file location

Backend config surface:
- `PORT` (default `4000`)
- `POSTGRES_URL` (required; can be augmented by `POSTGRES_USERNAME`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`)
- `POSTGRES_SSL`, `POSTGRES_SSL_REJECT_UNAUTHORIZED`

Example env file: [backend/.env.example](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/.env.example)

### 5.4 Database Connection

PostgreSQL access uses a shared pool:
- [pool](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/postgres.ts#L14)
- Example liveness query: [postgres.ping](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/postgres.ts#L16-L20)

### 5.5 Input Validation (DTO Parsing)

Validation is implemented as manual parsers using shared helpers:
- Shared validators: [validators.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/validation/validators.ts)
- DTO examples:
  - Users: [parseCreateUserDTO](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/dto/createUser.dto.ts#L11-L18)
  - Batches: [parseCreateBatchDTO](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches/dto/createBatch.dto.ts#L15-L29)
  - Mapping profiles: [parseCreateMappingProfileDTO](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/dto/mappingProfiles.dto.ts#L18-L31)
  - Mapping rules: [parseCreateMappingRuleDTO](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/dto/mappingRules.dto.ts#L15-L30)
  - User preferences: [parseUpsertUserPreferencesDTO](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/dto/upsertUserPreferences.dto.ts#L11-L23)

## 6. Backend Modules

### 6.1 Health

- Route: `GET /api/health` → [health.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/health/routes/health.routes.ts)
- Controller: [getHealth](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/health/controller/health.controller.ts#L4-L6)
- Service: [healthService.getHealth](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/health/service/health.service.ts#L1-L3)

### 6.2 DB Diagnostics

- Routes: [db.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/db/routes/db.routes.ts)
  - `GET /api/db/ping`
  - `GET /api/db/info`
- Service: [db.service.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/db/service/db.service.ts)
- Repository: [db.repository.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/db/repository/db.repository.ts)

### 6.3 Users

Purpose: minimal internal user registry (no authentication in current code).

- Routes: [users.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/routes/users.routes.ts)
  - `GET /api/users`
  - `POST /api/users`
- Controller: [usersController](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/controller/users.controller.ts)
- Service: [usersService](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/service/users.service.ts)
  - Validates uniqueness of `email` (409 conflict)
- Repository: [usersRepository](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/repository/users.repository.ts)
- Model: [AppUser](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/users/model/user.model.ts)

### 6.4 User Preferences

Purpose: store per-user defaults (mapping profile + AI provider/model).

- Routes: [userPreferences.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/routes/userPreferences.routes.ts)
  - `GET /api/user-preferences/:userId`
  - `PUT /api/user-preferences/:userId`
- Controller: [userPreferencesController](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/controller/userPreferences.controller.ts)
- Service: [userPreferencesService](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/service/userPreferences.service.ts)
  - If no preferences exist yet, `PUT` performs an insert; empty updates are rejected (400).
- Repository: [userPreferencesRepository](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/repository/userPreferences.repository.ts)
- Model: [UserPreferences](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/userPreferences/model/userPreferences.model.ts)

### 6.5 Mappings (Profiles + Rules)

Purpose: define a mapping profile (versioned) plus rules that map classification outputs to target export folders/codes/prefixes.

- Routes:
  - Mapping profiles + nested rules: [mappingProfiles.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/routes/mappingProfiles.routes.ts)
    - `GET /api/mapping-profiles`
    - `POST /api/mapping-profiles`
    - `GET /api/mapping-profiles/:id`
    - `PUT /api/mapping-profiles/:id`
    - `GET /api/mapping-profiles/:id/rules`
    - `POST /api/mapping-profiles/:id/rules`
  - Rule deletion: [mappingRules.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/routes/mappingRules.routes.ts)
    - `DELETE /api/mapping-rules/:id`
- Service: [mappingsService](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/service/mappings.service.ts)
  - Rejects duplicate `(name, version)` on profile creation (409 conflict).
  - Verifies profile existence before listing/creating rules.
- Repositories:
  - Profiles: [mappingProfilesRepository](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/repository/mappingProfiles.repository.ts)
  - Rules: [mappingRulesRepository](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/repository/mappingRules.repository.ts)
- Models: [mapping.model.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/mappings/model/mapping.model.ts)

### 6.6 Batches

Purpose: create/list batches and fetch an aggregated summary (including per-status counts from `batch_documents`).

- Routes: [batches.routes.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches/routes/batches.routes.ts)
  - `GET /api/batches`
  - `POST /api/batches`
  - `GET /api/batches/:id`
- Service: [batchesService.getById](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches/service/batches.service.ts#L19-L24)
  - Returns a `BatchSummary` with `totals`
- Repository: [batchesRepository](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches/repository/batches.repository.ts)
  - `getCounts(batchId)` uses filtered aggregate counts for statuses
- Model: [batch.model.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/modules/batches/model/batch.model.ts)

## 7. Database (PostgreSQL)

### 7.1 Schema Definition

The canonical schema is defined in the initial migration:
- [001_init.sql](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/db/migrations/001_init.sql)

Tables include:
- `schema_migrations`
- `app_users`
- `user_preferences`
- `mapping_profiles`
- `mapping_rules`
- `documents`
- `batches`
- `batch_documents`
- `classification_runs`
- `extracted_fields`
- `exports`

### 7.2 Migration Runner

Migrations are applied by running:
- [migrate.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/migrate.ts)

Key behaviors:
- Ensures `schema_migrations` exists.
- Applies `db/migrations/*.sql` in lexicographic order.
- Splits SQL by semicolon while respecting quoted strings.

### 7.3 Seed Data

Seeds are applied from `db/seeds/*.sql` via:
- [seed.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/seed.ts)

The included seed file:
- [001_seed_standard_ict.sql](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/db/seeds/001_seed_standard_ict.sql)

This seed ensures:
- An `admin@local` user exists.
- A “Standard ICT Mappings” profile exists.
- A set of category mapping rules exists.
- Default user preferences reference the profile and set Gemini defaults.

### 7.4 Quick Verification

- [verify.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/verify.ts) prints counts for users/profiles/rules.

## 8. Dependency Relationships

### 8.1 Frontend Dependencies (Code-Level)

- [App.tsx](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/App.tsx) depends on:
  - View components under [src/components](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/components)
  - Types from [src/types.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/types.ts)
  - Mock data from [src/data.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/data.ts)
- Views depend on:
  - UI-only libraries: `react`, `lucide-react`, Tailwind classes
  - Some shared localStorage key usage between Settings and New Batch
- API client is isolated in [src/lib/api](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/src/lib/api) and can be integrated into views without touching backend code.

### 8.2 Backend Dependencies (Layered)

Typical call graph:

`routes` → `asyncHandler` → `controller` → `dto parsing + validators` → `service` → `repository` → `pool (pg)` → PostgreSQL

Cross-cutting dependencies:
- Controllers and validators may throw [ApiError](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/apiError.ts), which is formatted by [errorMiddleware](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/errorMiddleware.ts).
- Repositories share the Postgres pool from [postgres.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/db/postgres.ts).

## 9. Running the Project

### 9.1 Prerequisites

- Node.js (for frontend and backend)
- PostgreSQL (for backend API, migrations, and seeds)

### 9.2 Install Dependencies

From the repository root:

```bash
npm install
```

This installs root dependencies (frontend toolchain) and uses `npm --prefix backend` for backend scripts.

### 9.3 Configure Environment Variables

Frontend:
- [README.md](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/README.md) references `GEMINI_API_KEY` in `.env.local`.
- The current frontend code does not call Gemini directly; treat this as scaffolding for future AI integration.
- Example: [/.env.example](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/.env.example)

Backend:
- Copy [backend/.env.example](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/.env.example) to `backend/.env` and set `POSTGRES_URL` appropriately.

### 9.4 Initialize Database (Migration + Seed)

From the repository root:

```bash
npm --prefix backend run db:migrate
npm --prefix backend run db:seed
npm --prefix backend run db:verify
```

### 9.5 Run (Dev)

Frontend only:

```bash
npm run dev
```

Backend only:

```bash
npm run dev:backend
```

Frontend + backend concurrently:

```bash
npm run dev:all
```

### 9.6 Lint / Typecheck

```bash
npm run lint
npm run lint:backend
```

## 10. Useful Reference: Current API Surface

Backend routes mounted in [app.ts](file:///Users/widjis/Documents/Projects/ai-pdf-classifier/backend/src/core/http/app.ts) currently expose:

| Area | Method | Path | Notes |
|---|---:|---|---|
| Health | GET | `/api/health` | Liveness |
| DB | GET | `/api/db/ping` | `select 1` |
| DB | GET | `/api/db/info` | database name + current user |
| Users | GET | `/api/users` | list users |
| Users | POST | `/api/users` | create user |
| Preferences | GET | `/api/user-preferences/:userId` | fetch defaults |
| Preferences | PUT | `/api/user-preferences/:userId` | upsert defaults |
| Mapping Profiles | GET | `/api/mapping-profiles` | list |
| Mapping Profiles | POST | `/api/mapping-profiles` | create |
| Mapping Profiles | GET | `/api/mapping-profiles/:id` | get |
| Mapping Profiles | PUT | `/api/mapping-profiles/:id` | update |
| Mapping Rules | GET | `/api/mapping-profiles/:id/rules` | list rules for profile |
| Mapping Rules | POST | `/api/mapping-profiles/:id/rules` | create rule for profile |
| Mapping Rules | DELETE | `/api/mapping-rules/:id` | delete rule |
| Batches | GET | `/api/batches` | list |
| Batches | POST | `/api/batches` | create |
| Batches | GET | `/api/batches/:id` | get summary + totals |

