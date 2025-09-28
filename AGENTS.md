# Repository Guidelines

## Project Structure & Module Organization
- Primary runtime split between `server/` (Express entry in `server/index.ts`, domain services, cron jobs in `server/jobs/`) and `client/src/` (Vite + React UI components and views).
- Shared data contracts live in `shared/schema.ts`; update Drizzle models here and sync migrations in `migrations/`.
- Agent orchestration and prompt flows sit under `src/mastra/`; use this folder for reusable agent logic.
- CLI utilities and one-off runners are in `scripts/` and `server/scripts/`; prefer extending these instead of adding root-level scripts.
- Jest suites reside in `tests/` with helpers in `tests/setup.ts`; refer to `docs/` for refactoring notes and compliance protocols.

## Build, Test & Development Commands
- `npm run dev` launches the API via `tsx server/index.ts` (frontend served by the same Express instance).
- `npm run build` compiles the Vite client and bundles the server to `dist/`; follow with `npm run start` for production simulation.
- `npm run db:push` applies Drizzle schema changes; always run after editing `shared/schema.ts`.
- `npm run lint`, `npm run format:check`, and `npm run type-check` guard stylistic and type correctness; chain them with `npm run quality` before PRs.
- Agent validation helpers include `npm run test-agents`, `npm run test-proposal`, and `npm run batch-compliance` for end-to-end flows.

## Coding Style & Naming Conventions
- TypeScript everywhere; keep modules ES `module` compatible. Prettier enforces two-space indentation and single quotes; do not hand-format.
- Component files use PascalCase (`ClientDashboard.tsx`); hooks and utilities use camelCase (`useSessionAgent.ts`, `complianceRunner.ts`).
- Align new lint rules with `eslint.config.js`; add `@ts-expect-error` rather than `@ts-nocheck` unless justified.
- Store environment-specific config in `.env.*` and read through centralized helpers in `server/`.

## Testing Guidelines
- Prefer `*.test.ts` or `*.spec.ts` inside `tests/`; mirror folder structure of the code under test.
- Run unit suites with `npm test`; use `npm run test:watch` while iterating and `npm run test:coverage` before merging.
- Integration checks for compliance pipelines live in `server/scripts/`; accompany changes with mock datasets under `attached_assets/` when possible.

## Commit & Pull Request Guidelines
- Follow the observed Conventional Commit pattern (`feat:`, `fix:`, `chore:`); keep summaries under 72 characters and mention related Jira/GitHub IDs in the body.
- Each PR should describe scope, testing evidence, and any data/backfill steps; attach UI screenshots or agent transcript diffs when UX behavior changes.
- Ensure CI steps (lint, tests, type-check) are green locally; note any skipped suites and why.
