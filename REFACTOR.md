# Type-Safety Refactor Plan

> Goal: restore `npm run type-check` to green, remove `// @ts-nocheck` shortcuts from the codebase, and give the Philadelphia/SAFLA platform reliable typed contracts front-to-back.

## Guiding Principles

1. **Source-of-truth contracts first.** Define shared types (or Zod schemas) before touching consumers. The UI, services, and tests must import the same contract.
2. **Short, verifiable iterations.** Each workstream ends with a passing type-check and targeted runtime tests (Jest/Playwright/manual smoke) so we don't regress functionality.
3. **Prefer refactor over patching.** Where the code depends on stale fields (e.g., `pipelineId` on work items), either re-introduce the field at the schema level or rework the logic—no blanket casts to `any`.
4. **Document migration notes.** If we deprecate tables, fields, or API shapes, capture it in `/docs/changelog.md` so downstream services stay aligned.

## Workstream Overview

1. **Foundations & Tooling**
   - [ ] Confirm TypeScript baseline: keep `target: "ES2020"`, audit for other compiler flags we need (e.g., `downlevelIteration`).
   - [ ] Restore `lint`, `format`, and `type-check` scripts in `package.json`; wire them into CI (GitHub Actions) for PR validation.
   - [ ] Re-enable Husky/lint-staged for staged files if we want pre-commit enforcement.

2. **Shared Schema & Repository Alignment**
   - [ ] Inventory DB tables/columns used by `BaseRepository`, `storage.ts`, `submissionService`, `workflowCoordinator`, `submissionSpecialists`.
   - [ ] Compare with actual Drizzle schema (`shared/schema.ts`) and database migrations; decide for each missing field whether to add it back or update consumers.
   - [ ] Update `shared/schema.ts` (and migrations) accordingly.
   - [ ] Refactor `BaseRepository` generics so `TTable`, `TSelect`, and `TInsert` resolve to concrete types. Add helper utilities if necessary.
   - [ ] Re-run type-check, fix resulting storage/service errors (explicit interfaces for `metadata`, `proposalData`, etc.).

3. **Front-end Data Contracts**
   - **Dashboard & Sidebar**
     - [ ] Create `DashboardMetrics` interface (or Zod schema) in `client/src/types/api.ts`.
     - [ ] Update `/api/dashboard/metrics` handler (if needed) to satisfy the contract.
     - [ ] Refactor `Sidebar.tsx`, `Dashboard` page to use typed fetch helpers.
   - **Agent Monitoring Suite**
     - [ ] Capture the full JSON emitted by `/api/agent-performance`, `/api/system-health`, `/api/workflows/state`, etc. via logging or API docs.
     - [ ] Define interfaces for each endpoint; consider colocating in `client/src/types/monitoring.ts`.
     - [ ] Refactor `agent-monitoring.tsx` to use typed hooks (React Query generics) and eliminate optional-chaining noise.
     - [ ] Add unit tests for the shape conversions (e.g., transforming `transitionMetrics`).
   - **Company Profiles / Portal Settings / Proposals / Submissions / Scan History / Workflow Management**
     - [ ] For each page, repeat the pattern: capture API payload -> define interface -> update fetch + component -> add targeted tests.
     - [ ] Break into separate PRs to keep code review manageable.

4. **Backend Services & Workers**
   - **Workflow Orchestration Stack**
     - [ ] Audit `workflowCoordinator.ts`, `submissionOrchestrator.ts`, `submissionService.ts`, `submissionMaterialsService.ts` for references to deprecated fields (`pipelineId`, `proposalData`, etc.).
     - [ ] Decide whether those fields should exist (and add them back) or whether the logic should be rewritten around the current data model.
     - [ ] Replace broad `any` usage with discriminated unions or dedicated interfaces (e.g., `WorkflowStatusCounts`).
   - **Submission Specialists**
     - [ ] Introduce types for `WorkItem.inputs`, `DocumentChecklist`, etc. to eliminate `unknown` errors.

- [ ] Ensure `submissionSpecialists` and `submissionService` agree on work item payloads.

5. **Testing & Validation**

- [ ] Expand Jest coverage for API clients (mock fetch responses against the new contracts).
- [ ] Run Playwright smoke covering: create proposal, generate submission materials, monitor workflows.
- [ ] Add regression tests for Philadelphia downloader (simulate ZIP retrieval) to ensure lazy `adm-zip` import still works.

6. **Documentation & Rollout**

- [ ] Maintain a checklist in this `REFACTOR.md` (tick boxes as we finish sub-tasks).
- [ ] Update `docs/` with any schema changes and clarifications for API consumers.
- [ ] Once type-check is green end-to-end, remove all temporary `// @ts-nocheck` comments and enforce type-check in CI.

7. **Portal Capability Abstraction**
   - [ ] Define a `PortalCapabilities` interface that covers authentication method, navigation strategy, document retrieval mode, and submission requirements.
   - [ ] Implement adapters for existing portals (Philadelphia, Houston, etc.) that satisfy the interface and expose selectors, workflows, and quirks.
   - [ ] Persist portal capability metadata in the database; expose CRUD via the portal settings UI and API.
   - [ ] Ensure Stagehand/Mastra agents can query capabilities at runtime to choose the correct automation recipe.

8. **Agent Training & Memory Consolidation**
   - [ ] Catalogue all Stagehand/Mastra task scripts and map each to the portal capability model.
   - [ ] Emit structured success/failure events for each portal step (login, scrape, download, fill, submit) and capture them via `agentMemoryService`.
   - [ ] Update memory schemas to track portal-specific selectors, retries, and error patterns.
   - [ ] Surface agent learning metrics in the monitoring dashboard (e.g., per-portal success rates, retried actions).

9. **SAFLA Integration Hardening**
   - [ ] Audit the SAFLA deployment steps and confirm every service (monitoring, self-improvement, feedback) is wired to live data.
   - [ ] Route agent event streams into SAFLA scoring APIs; persist recommendations and improvement actions.
   - [ ] Feed SAFLA insights back into portal capabilities and agent memory so automation strategies evolve.
   - [ ] Document the feedback loop (data provenance, privacy guarantees, escalation paths for human oversight).

10. **Submission & Pricing Intelligence**

- [ ] Validate that pricing table generation supports portal-specific requirements (line items, NIGP codes, multi-form submissions).
- [ ] Integrate historical bid data, cost models, and competitor intelligence to suggest bid amounts.
- [ ] Ensure SAFLA feedback influences pricing and compliance recommendations over time.
- [ ] Add human-in-the-loop checkpoints where cashier checks, signatures, or certifications are required.

11. **End-to-End Workflow Coverage**

- [ ] Model each RFP workflow as a typed state machine (Discovery → Qualification → Download → Proposal → Submission → Postmortem).
- [ ] Align Stagehand scripts, Mastra workflows, and backend orchestrators to the same state definitions and payload types.
- [ ] Implement fallback/rollback logic and manual override hooks for every state.
- [ ] Add integration tests that simulate a full journey across at least two portals (one URL-based, one download-only).

## Suggested Execution Order

1. Foundations & Tooling (Workstream 1)
2. Shared Schema & Repository Alignment (Workstream 2)
3. Front-end Data Contracts (Workstream 3) tackle in slices, starting with dashboard + agent monitoring.
4. Backend Services & Workers (Workstream 4)
5. Portal Capability Abstraction (Workstream 7)
6. Agent Training & Memory + SAFLA Hardening (Workstreams 8 & 9)
7. Submission & Pricing Intelligence (Workstream 10)
8. End-to-End Workflow Coverage (Workstream 11)
9. Testing & Validation (Workstream 5) runs in parallel to each slice.
10. Documentation & Rollout (Workstream 6) as features land.

## Tracking

Use this file as the canonical checklist. Update sections with additional subtasks, decisions, and links to PRs as we progress. Once all boxes are checked and CI enforces type safety, we can archive the plan.
