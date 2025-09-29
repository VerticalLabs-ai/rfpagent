# Workstream 2 – Storage & Repository Inventory

_Last updated: 2025-09-28_

## BaseRepository
- Depends on each table exporting an `id` primary key column; optional `primaryKey` override exists but default assumes `table.id`.
- `softDelete` branch requires a `deletedAt` column to exist; current schema tables do not uniformly provide it.
- Generic helpers reference `table._.columns` and cast to `Record<string, AnyPgColumn>` which fails under the latest Drizzle types (see `tsc` errors). Needs refactor to the newer `table["$inferSelect"]` helpers or per-table repositories.
- ✅ Updated helper methods resolve columns through typed lookups and remove the unsafe `Record<string, AnyPgColumn>` casts so Drizzle infers the correct result shapes.
- ✅ Primary key inference now taps the internal Drizzle column symbol, defaulting to the concrete `id` column and requiring an explicit override for symbol-less tables.

## server/storage.ts
- Touches nearly every table: `users`, `portals`, `rfps`, `proposals`, `documents`, `submissions`, `submission_pipelines`, `submission_events`, `submission_status_history`, `work_items`, `agent_registry`, `agent_sessions`, `pipeline_orchestration`, `dead_letter_queue`, `phase_state_transitions`, `system_health`, `pipeline_metrics`, `workflow_dependencies`, etc.
- Alignment notes with `shared/schema.ts`:
  - ✅ Notification inserts now use `isRead` (previously `priority`/`read`).
  - ⚠️ Public portal getters exclude credentials (`PublicPortal`); downstream services should stay typed to `PublicPortal` when they do not need secrets.
  - ✅ Added `getSubmissionsByDateRange` and optional `limit` support for `getSubmissionEventsBySubmission`.
  - ⚠️ JSON columns (e.g., portal metadata, proposalData) still rely on loose typing; submission lifecycle data handled below.
  - ✅ Public portal selectors now return `type`, `isActive`, and `monitoringEnabled` to match the expanded schema contract.
  - ✅ Detailed RFP joins now shape `portal` responses as `PublicPortal` via the shared API contract, avoiding accidental credential exposure.

## server/services/submissionService.ts
- Consumes: `submissions`, `proposals`, `portals`, `submission_pipelines`, `submission_events`, `submission_status_history`, `notifications`, `audit_logs`, `agent_memory`.
- Schema alignment status:
  - ✅ Shared `SubmissionPipelineRequest`/`SubmissionPipelineResult` exported from `@shared/schema`.
  - ✅ Service now treats portal lookups as `PublicPortal` when only public fields are needed.
  - ✅ Notification payloads updated to use `isRead`.
  - ✅ Cleanup + metrics rely on the new `getSubmissionsByDateRange` helper.
  - ✅ Lifecycle metadata now typed via `SubmissionLifecycleData`; submission status updates merge JSON payloads instead of overwriting with `any`.
  - ✅ Auto-submit failure paths no longer attempt to write non-existent columns (`error`, `submitToPortal`); data captured inside `submissionData`.
  - ⚠️ Additional pipeline metadata (attachments, browser session traits) still needs dedicated interfaces to eliminate residual `unknown` usage.

## server/services/submissionOrchestrator.ts
- Coordinates submission pipelines across work item phases and stores results/metadata for downstream services.
- ✅ Pipeline phase/status unions now exported from the shared schema with corresponding API helpers (`isSubmissionPhase`, `getResultKeyForPhase`).
- ✅ Orchestrator and storage conversions coerce JSON payloads into typed `SubmissionPipelineMetadata`, `SubmissionPipelineResults`, and structured error data.
- ✅ Submission pipeline result contract now advertises typed phase/status unions and optional receipt metadata for client consumers.
- ✅ Successful completions persist normalized receipt data across submissions/proposals and include structured lifecycle metadata (`completedAt`, `referenceNumber`, `retryCount`).
- ⚠️ Phase execution routines still rely on large `WorkItem` blobs; follow-up typing needed once Stagehand task schemas are defined.

## server/services/workflowCoordinator.ts
- Interacts primarily with `work_items`, `agent_registry`, `agent_sessions`, `submission_pipelines`, `submission_events`, plus higher-level services.
- Assumes `WorkItem.inputs` JSON contains structured fields (`submissionId`, `portalId`, `pipelineId`, etc.) but these shapes are not typed anywhere.
- `WorkItem.metadata` is used for pipeline coordination; requires a shared schema (likely Zod) to avoid `any` once `@ts-nocheck` is removed.
- Uses storage helpers (`createWorkItem`, `assignWorkItem`, `completeWorkItem`, `failWorkItem`) that are implemented, but will need typed DTOs when type-checking is enabled.

## server/services/submissionSpecialists.ts
- Uses `submission`, `proposals`, `documents`, `submission_events`, `agent_memory`, and Stagehand sessions.
- Relies on structured `workItem.inputs` payloads identical to those in `workflowCoordinator` (expects keys like `submissionId`, `pipelineId`, `browserOptions`, etc.). No shared interface exists; everything is `any` under `@ts-nocheck`.
- Writes `submission_events` records with `details` blobs (screenshots, URLs). Schema supports JSON, but agreed contracts should be defined.
- Emits audit/memory records referencing metadata fields absent from the shared types.

## server/services/enhancedProposalService.ts
- Auto-submission workflow now requires configured `portalId` and persists lifecycle metadata through `submissionData`.
- Remaining work: coordinate proposal/submission linking without implicit `submissionId` column on `proposals`.

## Next Steps
- Decide whether to extend `shared/schema.ts` or introduce domain-specific contract modules for submission pipeline payloads (`SubmissionPipelineRequest`, `WorkItemSubmissionInputs`, etc.).
- Update `storage.ts` + consumers to align notification fields and portal credential access.
- Backfill tests around `getSubmissionsByDateRange` and the submission metrics pipeline.
- Refine `BaseRepository` to the new Drizzle generics or migrate callers fully to specialized repositories.
- Capture follow-up repository fixes once additional `@ts-nocheck` files are removed (e.g., workflow coordinator payload typing).
