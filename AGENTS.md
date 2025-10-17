# Repository Guidelines

## Project Structure & Module Organization

- Core TypeScript services live in `server/` with shared models in `shared/`, while the Vite React client sits in `client/src/`.
- Mastra agents, tools, and workflows are under `src/mastra/`; follow existing tiered layout when adding orchestration logic.
- Database schema and migrations are managed via Drizzle in `migrations/`, with seed and helper scripts in `scripts/`.
- Automated tests are organized in `tests/` (Jest) and `tests/pricing/` for workflow-specific coverage; Playwright config lives at the repo root.

## Build, Test, and Development Commands

- `pnpm dev` runs the full stack (backend via `tsx`, frontend via Vite) with live reload.
- `pnpm build` bundles the client and emits a Node-ready server build in `dist/`.
- `pnpm start` launches the production bundle; set requisite env vars before running.
- `pnpm check`, `pnpm type-check`, and `pnpm lint` keep typing and linting healthy; `pnpm format` applies Prettier to server, shared, and client sources.
- Workflow and integration scripts (e.g., `pnpm test-agents`, `pnpm test-proposal`) live in `scripts/`—run them before touching Mastra orchestration.

## Coding Style & Naming Conventions

- TypeScript everywhere; favor `async/await` and early returns for agent flows.
- Prettier enforces two-space indentation and single quotes; ESLint config lives in `eslint.config.js`.
- File names use `kebab-case` (`shared-memory-provider.ts`), classes/interfaces use `PascalCase`, and exported constants use `camelCase`.
- Keep prompts and system instructions alongside their agents (see `src/mastra/agents/*`); document non-obvious logic with brief comments.

## Testing Guidelines

- Unit and integration tests use Jest (`pnpm test`, `pnpm test -- tests/integration/rfp-scraping.test.ts`).
- Maintain high-signal coverage on Mastra workflows and scraping services; add targeted fixtures under `tests/__fixtures__/`.
- Name new tests `<feature>.test.ts` and colocate helper utilities beneath `tests/utils/`.
- For end-to-end scraping checks, rely on the dedicated scripts in `server/scripts/` and record outcomes in PR notes.

## Commit & Pull Request Guidelines

- Write imperative, present-tense commit messages (`Add Bonfire auth fallback`); group related Mastra prompt tweaks with code changes.
- PRs should summarize scope, list verification commands run (`pnpm test-agents`, etc.), and reference tracking tickets.
- Include screenshots or log excerpts for UI or scraping changes; flag migrations, new env vars, or agent prompt updates in a dedicated “Rollout” section.

## Agent & Workflow Notes

- When introducing agents or tools, register them in `src/mastra/index.ts` and document expected context in the agent’s header comment.
- Coordinate with `server/services/` orchestrators for persistence or scheduling hooks; sync any credential requirements with the Browserbase session manager.
  s
