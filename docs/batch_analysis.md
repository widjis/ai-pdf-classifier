# Batch UX — Upload → Classify → Review (Bulk) → Export/Download

This document defines the end-to-end user experience for the Batch flow in PDF.AI, from creating a batch and uploading files through classification, bulk review, and exporting/downloading results.

## Goals
- Reduce “what do I do next?” moments with clear next actions and state-based CTAs.
- Support high-throughput operations: upload many files, review quickly, export reliably.
- Keep auditability: every output can be traced back to an input file and a classification run.
- Make the system safe by default: uncertain results require review; export requires approvals (configurable).

## Key Concepts (Terminology)
- **Batch**: a processing container holding N uploaded documents and the chosen settings (mapping profile + AI provider/model).
- **Batch Document**: one uploaded file within a batch (with status + AI result + review decision).
- **Category**: the final classification label (derived from the mapping profile category rules).
- **Approval**: a human confirmation (or automated policy decision) that a document is correct and exportable.
- **Export**: creating final outputs (renamed PDFs in folder structure and/or ZIP) plus a manifest.

## Status Model (User-Facing)
### Batch status
- `Draft`: created but not started (files may be uploading).
- `Running`: processing is ongoing (some documents queued/processing).
- `Needs Review`: processing done but at least one document needs review/approval (or failed).
- `Completed`: all documents approved and exported successfully.
- `Failed`: batch-level failure (rare; for systemic errors).

### Document status
- `Queued`: waiting to be processed.
- `Processing`: being analyzed.
- `Ready for Review`: AI result is available, awaiting approval.
- `Approved`: confirmed and eligible for export.
- `Failed`: processing error; requires manual attention (re-run or set category manually).

## Core Pages (IA)
- **New Batch (Wizard)**: create + upload + start.
- **Batch Processing (List)**: monitor progress, bulk actions, open review, export.
- **Document Review (Panel/Drawer)**: preview + fields + category edit + approve.
- **Export Results (Dialog)**: numbering rules + output destination + generate.
- **Batch History (Optional phase)**: list past exports, manifest download, audit.

---

# Phase 1 — Create Batch (Wizard)

## UX Flow
1. User clicks **New Batch** from the sidebar (primary entry).
2. User selects:
   - Batch name
   - Mapping profile
   - AI provider/model
3. User uploads files (drag/drop or browse).
4. User clicks **Start Classification**.
5. User is navigated to **Batch Processing** and sees live progress.

## Wireframe Description
- Header: “Create New Batch”
- Form section:
  - Batch Name (required)
  - Mapping Profile (required; prefilled from user preferences)
  - AI Provider + AI Model (required)
- Upload panel:
  - Drag & drop zone
  - File list (name, size, remove)
- Footer CTAs:
  - Cancel
  - Start Classification (disabled until name + profile + files are valid)

## Component Tree (Frontend)
- `NewBatchView`
  - `BatchMetaForm`
    - `TextField` (batchName)
    - `Select` (mappingProfile)
    - `Select` (aiProvider)
    - `Select` (aiModel)
  - `UploadDropzone`
  - `UploadFileList`
  - `WizardFooterActions`

## UX Rules
- Show inline validation (no modal alerts).
- Persist last-used provider/model and mapping profile (user preference).
- If upload fails for some files, show per-file error and allow retry.

## Accessibility
- Dropzone has keyboard alternative: “Browse Files”.
- Validation messages are announced (aria-live polite).
- Buttons have clear labels and disabled state is visible and programmatic.

---

# Phase 2 — Upload & Preflight

## UX Flow
1. User adds files.
2. System performs lightweight preflight:
   - extension/type validation
   - size limits
   - dedup hints (optional)
3. User starts batch.

## Wireframe Description
- File list shows:
  - Original filename
  - Size
  - Upload state (pending/uploading/failed/done)
  - Remove action

## UX Rules
- Upload should be resilient:
  - show progress indicator (aggregate is fine for v1)
  - allow retry for failed uploads
- If a file is not supported, show the reason and keep the rest.

---

# Phase 3 — Processing Monitor (Batch Processing)

## UX Problem Being Solved
Operators need to know:
- “Is it running?”
- “What is completed?”
- “Which ones need attention?”
- “What do I do next?”

## UX Flow
1. User lands on Batch Processing after starting a batch.
2. User sees progress bar and table with statuses.
3. System updates automatically (polling) while running.
4. When processing finishes:
   - If all documents approved (policy-based): batch can be completed/exported.
   - Otherwise: batch moves to Needs Review and the UI highlights next steps.

## Wireframe Description
- Header:
  - Batch name + status chip
  - Progress bar with counts
  - Primary CTA changes based on state:
    - Running: “Review Ready Items (X)” (secondary) + “Refresh” (small)
    - Needs Review: “Review All” (primary)
    - Completed: “Download Results” (primary) + “View Manifest” (secondary)
- Table:
  - Checkbox column (for bulk actions)
  - Filename, size, category, status, confidence
  - Row click opens review
- Bulk toolbar (appears when selection > 0):
  - “Approve Selected”
  - “Set Category…”
  - “Re-run Selected” (optional phase)

## Component Tree
- `BatchProcessingView`
  - `BatchHeader`
    - `BatchSelector`
    - `ProgressBar`
    - `PrimaryActionButton`
  - `BatchTable`
    - `BatchRow` (clickable)
  - `BulkActionBar` (conditional)

## UX Rules
- Clicking a row opens **Document Review** (right drawer).
- “Ready for Review” is not just a green icon; it always implies an available action.
- If a document is `Failed`, row click opens review with error details + retry.

## Accessibility
- Table rows are keyboard focusable; Enter opens review.
- Status badges have text, not color-only.

---

# Phase 4 — Single Document Review (Drawer)

## UX Flow
1. User clicks a row.
2. Drawer opens with:
   - Left: PDF preview (inline)
   - Right: AI result, extracted fields, category selection
3. User can:
   - Approve
   - Change category and save
   - (Optional) Mark as failed / needs escalation

## Wireframe Description
- Drawer header:
  - “Document Review”
  - filename
  - close button
- Body split:
  - Preview pane (iframe/pdf viewer)
  - Analysis pane:
    - Category select
    - Confidence
    - Extracted fields (Requester, Date, etc., if present)
    - Anchors (debug/support)
- Footer actions:
  - Save category
  - Approve

## UX Rules
- Approve is disabled if status is `processing/queued`.
- When category changes:
  - Save updates the list immediately.
  - Optionally sets status back to `Ready for Review` if it was Failed.
- Confidence should not override human decisions; it is a signal only.

## Accessibility
- Drawer traps focus while open.
- Close button has aria-label.
- Preview has fallback: “Download file” link if iframe cannot render.

---

# Phase 5 — Bulk Review (High Throughput)

## Why Bulk Review Exists
- Many batches are “mostly correct”; reviewing one-by-one is slow.

## Bulk Review Modes
### Mode A: Approve Selected
- User selects multiple rows with status `Ready for Review`.
- Click **Approve Selected**.
- System confirms with count and applies the action.

### Mode B: Set Category for Selected
- User selects multiple rows.
- Click **Set Category…**
- Modal: category dropdown + “Apply”
- System updates `finalCategory` for all selected items, then returns them to `Ready for Review` state.

### Mode C (Optional): Auto-approve Policy
- If confidence ≥ threshold and override rules match, auto-approve.
- UI still shows that it was auto-approved and allows manual change before export.

## Bulk Review UX Rules
- Bulk actions should be reversible until export (soft confirmations).
- Prevent obvious mistakes:
  - warn if selection includes `processing/queued`
  - warn if applying category differs from most predicted categories (optional)

---

# Phase 6 — Document Numbering (Configurable)

Document numbering is defined by the system, not extracted from the document content.

## Numbering Definition (v1)
- The operator can configure **starting index** before export.
- If numbering mode is **per category**, the operator can set a **different starting index per category** (only for categories present in the batch).
- Ordering can be configured:
  - by upload time (created_at)
  - by filename
  - optionally group by category first
- Numbering mode can be configured:
  - global (per batch)
  - per category

## Export Filename Pattern (v1)
`{prefix}{documentNumber} - {requester}.pdf`

Where:
- `prefix`: mapping profile `targetPrefix` for the category (optional; empty if not configured)
- `documentNumber`: generated by the selected numbering mode + starting index
- `requester`: extracted requester name if available, otherwise `Unknown`

## Rules
- Number assignment happens at **Export time** to avoid gaps and conflicts.
- Sanitization: replace invalid filesystem chars with `_`, trim length.

---

# Phase 7 — Export / Download Results (Folder Move/Rename)

## UX Flow
1. When all documents are `Approved`, **Export** becomes enabled.
2. User clicks **Export Results**.
3. Export dialog asks:
   - Output destination (server folder path or preset output root)
   - Confirm numbering strategy (per batch sequence; fixed for now)
   - Confirm mapping profile folder rules
4. User clicks **Generate Export**.
5. System:
   - Renames PDFs
   - Moves/copies them into category folders
   - Writes a manifest file
6. UI shows “Export Complete” with:
   - Open folder link (if supported)
   - Download manifest
   - (Optional next phase) Download ZIP

## Wireframe Description
- Export dialog:
  - Summary: “X documents approved”
  - Output path input / preset selector
  - Toggle: Move vs Copy (default Copy for safety)
  - Primary CTA: “Generate Export”
- Post-export:
  - success banner
  - link to manifest and audit details

## Export Deliverables (v1)
- Downloadable ZIP (primary):
  - `<outputRoot>.zip` contains:
    - category folders with renamed PDFs
    - `manifest.json`
- Folder output (server-side staging):
  - `<outputRoot>/...` mirrors the ZIP structure for audit/debug.

## Failure Handling
- If some exports fail:
  - show list of failed items with reasons
  - allow retry export for failed subset
  - do not mark batch “Completed” until fully exported

## Accessibility
- Export is reachable via keyboard and includes clear warnings.
- Progress indicator has text alternative.

---

# Phase 8 — Batch Summary & History (Optional but Recommended)

## UX Flow
- After export, show a summary:
  - counts by category
  - exported path(s)
  - manifest download button
- Provide a Batch History page:
  - list batches
  - view exported artifacts
  - re-download manifest

## Why This Matters
- Operators need to confirm what happened without searching server folders.
- Supports audits and operational support.

---

# Responsive Guidelines
- Desktop (≥ 1024px): split view for review (preview + analysis panel).
- Tablet (≥ 768px): drawer becomes full-width with tabs (Preview / Analysis).
- Mobile: review uses stacked layout, minimal chrome; avoid heavy tables; use card list.

# WCAG 2.1 Notes
- Ensure color contrast for status badges.
- Provide keyboard navigation for:
  - table rows
  - bulk actions
  - drawer open/close
- Provide non-color status labels and icons with accessible text.

# Implementation Notes (Non-UI)
- Polling in Batch Processing should stop when:
  - batch is not running and no documents are queued/processing.
- Store export metadata:
  - export timestamp
  - output root path
  - per-document final exported filename
  - manifest path
