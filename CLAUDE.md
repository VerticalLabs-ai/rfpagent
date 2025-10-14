# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Core Commands

- `pnpm dev` - Start development server (frontend + backend)
- `pnpm build` - Build frontend with Vite and bundle backend with esbuild
- `pnpm start` - Run production server
- `pnpm check` - Run TypeScript type checking
- `pnpm db:push` - Push database schema changes with Drizzle

### Development Workflow

- Backend server runs on `tsx server/index.ts` in development
- Frontend uses Vite dev server with React 18
- Database migrations are handled via Drizzle Kit with `pnpm db:push`

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

- **OpenAI**: GPT-5 (released August 2025) - Latest unified model combining reasoning and fast responses
- **Anthropic**: Claude Sonnet 4.5 (released September 2025) - Best coding model with advanced reasoning
- **Mastra**: TypeScript AI agent framework with workflow orchestration (v0.20.1)
- **Puppeteer**: Web scraping for portal automation

### Infrastructure

- **Neon Database**: Serverless PostgreSQL with connection pooling
- **Google Cloud Storage**: Document and file storage
- **SendGrid**: Email notifications

### Development Tools

- **Drizzle ORM**: Type-safe database operations
- **Zod**: Runtime type validation
- **Node-cron**: Job scheduling for automated portal scanning

---

## Documentation Guidelines

### STRICT RULES for Documentation

**⚠️ CRITICAL: All documentation MUST go in `/docs` folder**

1. **NEVER create documentation files in project root**
   - Root is for: `CLAUDE.md`, `README.md`, `package.json`, config files ONLY
   - Everything else goes in `/docs`

2. **Before creating ANY new documentation:**
   - Check `/docs` for related existing documents
   - If related doc exists → UPDATE it, don't create new
   - If truly new topic → discuss folder structure first
   - Follow naming: `kebab-case.md`

3. **Documentation folder structure:**

   ```
   docs/
   ├── README.md              # Documentation index
   ├── technical/             # Architecture, models, agents
   ├── testing/               # Testing guides
   ├── deployment/            # Deployment guides
   ├── guides/                # User guides
   └── archive/               # Outdated docs (don't delete, archive)
   ```

4. **Every documentation file MUST have:**
   - `**Last Updated**: Month Year` at the top
   - Cross-references to related docs
   - Clear purpose statement
   - Table of contents for long docs (>200 lines)

5. **Update, don't duplicate:**
   - Combine related docs instead of creating similar ones
   - Example: All testing info → `docs/testing/testing-guide.md`
   - Example: All deployment info → `docs/deployment/deployment-guide.md`

6. **Archiving old docs:**
   - Move to `/docs/archive/` with date suffix
   - Add deprecation note at top
   - Update references in other docs

### Quick Reference

**Where does my documentation go?**

- AI models, agent architecture → `/docs/technical/`
- Testing procedures, verification → `/docs/testing/`
- Deployment, infrastructure → `/docs/deployment/`
- User guides, tutorials → `/docs/guides/`
- Outdated but useful → `/docs/archive/`

**See `/docs/README.md` for complete documentation index**

---

## AI Model Configuration

**IMPORTANT: Current Real Models (as of October 2025)**

- **GPT-5**: Latest OpenAI model (released August 2025)
  - Model ID: `gpt-5`
  - Announcement: <https://openai.com/index/introducing-gpt-5/>

- **Claude Sonnet 4.5**: Latest Anthropic model (released September 2025)
  - Model ID: `claude-sonnet-4-5`
  - Announcement: <https://www.anthropic.com/news/claude-sonnet-4-5>

**See `/docs/technical/models-reference.md` for complete model documentation**
