# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands

- `npm run dev` - Start development server (frontend + backend)
- `npm run build` - Build frontend with Vite and bundle backend with esbuild
- `npm start` - Run production server
- `npm run check` - Run TypeScript type checking
- `npm run db:push` - Push database schema changes with Drizzle

### Development Workflow

- Backend server runs on `tsx server/index.ts` in development
- Frontend uses Vite dev server with React 18
- Database migrations are handled via Drizzle Kit with `npm run db:push`

## Architecture Overview

### Monorepo Structure

- `client/` - React frontend with TypeScript and Vite
- `server/` - Express.js backend with TypeScript
- `shared/` - Shared types and database schema (Drizzle ORM)
- `src/mastra/` - AI agent system with Mastra framework

### Database Architecture

- **ORM**: Drizzle ORM with PostgreSQL (Neon Database)
- **Schema**: Located in `shared/schema.ts`
- **Key Entities**: users, portals, rfps, proposals, documents, submissions
- **Features**: JSONB fields for AI-generated content, audit logging, ACL system

### AI Agent System (Mastra Framework)

- **3-Tier Architecture**:
  - Tier 1: Primary Orchestrator (1 agent)
  - Tier 2: Managers - Portal, Proposal, Research (3 agents)
  - Tier 3: Specialists - Scanner, Monitor, Generator, Checker, Processor, Market Analyst, Historical Analyzer (7 agents)
- **Workflows**: Document processing, RFP discovery, proposal generation, Bonfire auth, master orchestration
- **Features**: Parallel execution, suspension/resume for 2FA, human-in-the-loop capabilities

### Key Services Architecture

- **Backend Services** (server/services/):
  - Orchestrators: Analysis, Discovery, Proposal Generation, Submission
  - Specialists: Document parsing, compliance checking, portal monitoring
  - AI Services: OpenAI integration, proposal generation, document intelligence
  - Infrastructure: File downloads, notifications, retry logic, workflow coordination

### Frontend Architecture

- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: TanStack Query for server state
- **Routing**: Wouter for client-side routing
- **File Uploads**: Uppy.js with AWS S3 integration

### Path Aliases

- `@/*` maps to `./client/src/*`
- `@shared/*` maps to `./shared/*`

## Key External Dependencies

### AI & Automation

- **OpenAI**: GPT-5 for document analysis and proposal generation
- **Mastra**: TypeScript AI agent framework with workflow orchestration
- **Puppeteer**: Web scraping for portal automation

### Infrastructure

- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Google Cloud Storage**: Document and file storage
- **SendGrid**: Email notifications

### Development Tools

- **Drizzle ORM**: Type-safe database operations
- **Zod**: Runtime type validation
- **Node-cron**: Job scheduling for automated portal scanning
