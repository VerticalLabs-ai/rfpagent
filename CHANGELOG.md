# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

_No changes yet._

## [2025.11.10] - 2025-11-10

### Added
- Introduced a Starlight-powered documentation hub with governance, platform, workflow, operations, quality, reference, and legacy sections under `docs/src/content/docs`. 
- Added automated audit outputs (`docs/governance/repo-audit-report.md`, `docs/governance/cleanup-manifest.json`) and changelog management via `scripts/doc-governance.ts`.
- Provisioned CI/CD workflow `.github/workflows/docs-maintenance.yml` to enforce pnpm-based linting, testing, governance, changelog validation, and Vercel deployments.

### Changed
- Updated `docs/README.md` with governance commands, metadata requirements, and deployment process guidance.
- Configured `package.json` scripts for documentation pipelines and pnpm-based changelog discipline.
- Added Starlight/TypeDoc configuration files (`astro.config.mjs`, `starlight.config.mjs`, `typedoc.json`) and supporting theme styles.
