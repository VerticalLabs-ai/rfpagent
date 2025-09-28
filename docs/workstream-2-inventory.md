# Workstream 2 – Storage & Repository Inventory

_Last updated: 2025-09-28_

## BaseRepository
- Depends on each table exporting an `id` primary key column; optional `primaryKey` override exists but default assumes `table.id`.
- `softDelete` branch requires a `deletedAt` column to exist; current schema tables do not uniformly provide it.
- Generic helpers reference `table._.columns` and cast to `Record<string, AnyPgColumn>` which fails under the latest Drizzle types (see `tsc` errors). Needs refactor to the newer `table["$inferSelect"]` helpers or per-table repositories.

## server/storage.ts
- Touches nearly every table: `users`, `portals`, `rfps`, `proposals`, `documents`, `submissions`, `submission_pipelines`, `submission_events`, `submission_status_history`, `work_items`, `agent_registry`, `agent_sessions`, `pipeline_orchestration`, `dead_letter_queue`, `phase_state_transitions`, `system_health`, `pipeline_metrics`, `workflow_dependencies`, etc.
- Alignment notes with `shared/schema.ts`:
  - ✅ Notification inserts now use `isRead` (previously `priority`/`read`).
  - ⚠️ Public portal getters exclude credentials (`PublicPortal`); downstream services should stay typed to `PublicPortal` when they do not need secrets.
  - ✅ Added `getSubmissionsByDateRange` and optional `limit` support for `getSubmissionEventsBySubmission`.
  - ⚠️ JSON columns (`metadata`, `submissionData`, `proposalData`) are still untyped across services.

## server/services/submissionService.ts
- Consumes: `submissions`, `proposals`, `portals`, `submission_pipelines`, `submission_events`, `submission_status_history`, `notifications`, `audit_logs`, `agent_memory`.
- Schema alignment status:
  - ✅ Shared `SubmissionPipelineRequest`/`SubmissionPipelineResult` exported from `@shared/schema`.
  - ✅ Service now treats portal lookups as `PublicPortal` when only public fields are needed.
  - ✅ Notification payloads updated to use `isRead`.
  - ✅ Cleanup + metrics rely on the new `getSubmissionsByDateRange` helper.
  - ⚠️ `submissionData`/`metadata` remain loosely typed; consider exporting structured interfaces for pipeline state.

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

## Next Steps
- Decide whether to extend `shared/schema.ts` or introduce domain-specific contract modules for submission pipeline payloads (`SubmissionPipelineRequest`, `WorkItemSubmissionInputs`, etc.).
- Update `storage.ts` + consumers to align notification fields and portal credential access.
- Backfill tests around `getSubmissionsByDateRange` and the submission metrics pipeline.
- Refine `BaseRepository` to the new Drizzle generics or migrate callers fully to specialized repositories.
