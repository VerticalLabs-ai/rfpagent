# Changelog
## [Unreleased]
### Added

- Implement SSE for submission materials progress tracking

- Add new testing scripts and enhance RFP component exports

- Implement proposal deletion functionality in ProposalsSection

- Add proposal generation functionality to RFPSidebar and RFPDetails

- Add enhanced and pipeline proposal generation endpoints

- Enhance proposal generation by integrating company profile selection

- Enhance ProposalsSection and RFPDetails for improved proposal handling

- Enhance ProposalsSection with editing and AI improvement features

- Add proposal content normalization and alias handling in ProposalsSection

- Add code quality workflows and refactor submission services

- Type company profiles data flow

- Auto-run database migrations on production startup

- Add automated database migration with drizzle-kit on startup

- Integrate Sentry for error tracking and enhance CI/CD workflows

- Comprehensive system audit improvements

- Enhance company mapping configuration and improve service imports

- Add critical workflow API endpoints and comprehensive documentation

- Connect real-time progress tracking for proposal generation

- Implement circuit breaker pattern for AI service resilience

- Consolidate proposal generation on orchestrator with fast mode

- Integrate PDF processing capabilities and enhance workflows

- Update environment configuration and enhance PDF processing utilities

- Add google-logging-utils dependency to package.json and pnpm-lock.yaml

- Add undici dependency to package.json and pnpm-lock.yaml

- Add SAM.gov API key support and update related configurations

- Phase 1 - Implement Agent Registry System

- Add Vitest for testing framework

- Update project references and documentation

- Configure database for Fly.io production and flexible testing

- Add @1password/sdk and @1password/sdk-core to Mastra dependencies

- Add readable-stream to Mastra dependencies

- Add patch for readable-stream dependency in package.json and pnpm-lock.yaml

- Add multi-portal document download support with manual trigger

- Add BeaconBid portal document download support

- Enhance agent monitoring and remove duplicate RFP modal

- Add proposal outcome tracking and enhance RFP details

- Add activity feed route and enhance manual RFP URL validation

- Implement submissions listing and enhance MCP configuration

- Enhance Playwright tests with PostgreSQL service and AI tracing updates

- Improve RFP Documents dark mode and layout

- Add SAM.gov portal integration - Phase 1 & 2

- Add SAM.gov portal configuration - Phase 3

- Environment configuration and type fixes - Phase 4

- Complete Phase 5 - Service Integration

### Changed

- Improve type safety and error handling in components

- Enhance RFPProcessingProgress component and submission materials service

- Standardize string usage and improve readability in proposal generation scripts

- Standardize code formatting and improve readability in PhiladelphiaDocumentDownloader

- Use drizzle symbols in base repository

- Align submission receipts with lifecycle metadata

- Harden repository layer typing

- Enhance type safety and repository structure

- Enhance discovery workflow options and error handling

- Improve type safety and enhance documentation

- Enhance agent definitions and coordination tools

- Update component structure and styling

- Update ESLint configuration and remove .eslintrc.json

- Enhance type definitions and improve code readability

- Simplify ESLint configuration and enhance AgentMonitoring component

- Remove unused type definitions from rate limiting middleware

- Clean up docker-compose version and reorder imports in Sidebar component

- Improve code structure and enhance memory storage functionality

- Enhance Zod type compatibility in schema definitions

- Update environment configuration and improve database handling

- Update CLAUDE.md for RFP Agent Platform and remove obsolete migrations

- Improve UI component styles and update import order

- Update extraction logic and schema definitions

- Clean up component exports and improve code formatting

- Update Sentry deployment conditions in CI/CD workflow

- Streamline CI/CD workflow by removing obsolete steps and updating permissions

- Remove .env.production file and update .gitignore for Mastra compatibility

- Update WASM handling in build process

- Improve RFPDocuments UI and enhance manual RFP processing logic

- Improve code formatting and readability across components

- Optimize component styles and enhance memory management

- Improve code formatting and enhance error handling

- Enhance dialog component and improve database query efficiency

- Enhance page layouts with scrollable content and update badge styling.

### Fixed

- Enhance submission materials generation and error handling

- Update proposals API handling and improve error management in ProposalsSection

- Improve AI proposal generation to avoid placeholder content

- Add dotenv runtime dependency

- Resolve production bug and improve CI/CD infrastructure

- Migrate generic portal scraping from HTTP to Browserbase

- Improve error handling in pull-to-refresh functionality

- Update state tax rates and historical rates handling

- Add pg as direct dependency for Fly.io deployment

- Add missing jsonwebtoken dependency for auth middleware

- Add missing @ai-sdk/anthropic dependency

- Use auto-detection for Node.js buildpack

- Simplify Docker deployment by removing drizzle-kit from startup

- Remove conflicting [processes] section for Docker deployment

- Disable Docker HEALTHCHECK to use Fly.io health checks only

- Validate critical environment variables on server startup

- Add missing express-rate-limit dependency and fix SAFLA data structures

- Move vite to dependencies for production deployment

- Move Vite plugins to dependencies for production deployment

- Improve database migration with auto-confirmation

- Copy drizzle.config.ts to Docker image for migrations

- Repair failing CI workflows

- Update lint configuration to allow warnings in CI

- Resolve all 12 critical ESLint errors

- Resolve 19 TypeScript errors in frontend pages

- Resolve 4 backend TypeScript errors

- Resolve 7 more TypeScript errors in backend services

- Resolve remaining TypeScript errors in workflowCoordinator

- Apply prettier formatting to logger and correlationId middleware

- Comprehensive fixes for scan failures and SSE issues

- Comprehensive fixes for scan failures and SSE issues

- Remove file-based logging in production to fix Fly.io permissions error

- Correct storage import path in mastraWorkflowEngine

- Prevent duplicate agent registration errors on app restart

- Update cron expression parsing to use new import syntax

- Connect document download to analysis workflow

- Resolve google-logging-utils CommonJS/ESM compatibility issue

- Downgrade undici to v6.22.0 for Mastra Cloud compatibility

- Replace undici with axios for Mastra Cloud compatibility

- Downgrade cheerio to 1.0.0-rc.12 to eliminate undici dependency

- Mark playwright as external in vite config for Mastra Cloud

- Configure Mastra bundler to mark playwright and stagehand as external

- Add document processing packages to Mastra bundler externals

- Resolve circular dependencies and pdf-parse ESM import issues

- Add required descriptions to all Mastra agents for MCP server compatibility

- Sync pnpm lockfile and resolve peer dependency conflicts for Mastra deployment

- Resolve peer dependency issues and update Mastra CLI scripts

- Update dependencies and improve project structure

- Resolve 237 ESLint errors and improve code quality

- Resolve Mastra cloud build issues and add local MCP server

- Address critical code review issues in agent registry

- Add missing agent-pool-manager.ts and fix .gitignore

- Resolve type errors in pool utilities

- Resolve multiple test failures and improve test stability

- Resolve CI/CD pipeline failures

- Make Sentry release steps non-blocking in CI

- Handle mkdir permission errors gracefully in file downloads

- SSE progress display and add GIN index migration script

- Add npm script for GIN indexes and SSE event fixes

- Update zod dependency version and adjust default values in validation middleware

- Resolve Mastra Cloud deployment zod dependency conflict

- Add 1Password SDK to Mastra bundle and simplify post-build script

- Add 1Password SDK WASM file to repository for Mastra Cloud deployment

- Resolve Mastra Cloud deployment failures with prebuild dependency management

- Remove obsolete prebuild script references from package.json

- Resolve Mastra Cloud deployment failures

- Ensure WASM file available for Mastra Cloud bundler via postbuild hook

- Copy WASM to src/mastra directory to ensure Mastra Cloud bundler includes it

- Remove problematic readable-stream patch that broke Mastra Cloud deployment

- Add stream packages to bundler externals to fix inherits error

- Add winston and related stream packages to bundler externals

- Add @1password/sdk to Mastra bundler externals

- Add winston and AI SDK packages to Mastra bundler externals

- Update install_pkgs.sh permissions to executable

- Register tools in Mastra instance for Cloud dashboard visibility

- Resolve Mastra Cloud deployment hang issues

- Enhance static file serving logic in Vite setup

- Resolve frontend serving issues in production

- Use Express 5.x named wildcard syntax (/*splat) for catch-all routes

- Resolve port mismatch between wait-on and server startup

- Add HEAD handler for root and suppress wait-on polling logs

- Correct field mappings for Austin Finance portal scraping

- Resolve AI timeout and Recent Discoveries issues

- Remove legacy agent imports causing build failure

- Update lockfile and remove frozen-lockfile flag for Render deployment

- Revert vite code splitting and add explicit no-frozen-lockfile flag

- Remove undefined moderation processor references

- Update model IDs and enhance workflow configurations

- Enhance error handling and improve code readability in submissions route

- Phase 1 - Fix TC008 modal overlay and TC007 SSE endpoint

- Phase 2 - Add data attributes for TC003 test

- Phase 3.1 - Fix TC002 manual RFP timeout

- Phase 3.2 - Fix TC005 submission pipeline timeout

- Fix TypeScript and linting errors for CI/CD pipeline

- Fix Mastra memory and Zod validation errors

- Auto-fix prettier formatting errors (CI/CD quality gate)
