# RFP Agent Platform - Project Context

## Overview

RFP Agent is an AI-powered platform for government procurement automation. It combines the OpenAgents development framework with Mastra-based RFP workflows.

## Technology Stack

**Primary Language:** TypeScript
**Runtime:** Node.js (Express backend, Vite React frontend)
**Package Manager:** pnpm
**Build Tools:** TypeScript Compiler (tsc), Vite
**Testing:** Jest, Vitest, Playwright
**Linting:** ESLint
**Database:** PostgreSQL (Drizzle ORM)
**AI Framework:** Mastra (agent orchestration)
**Browser Automation:** Browserbase, Stagehand

## Project Structure

```
rfpagent/
├── client/              # React frontend (Vite)
│   └── src/             # Components, pages, hooks
├── server/              # Express backend
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   └── repositories/    # Database access
├── shared/              # Shared types and schemas
│   └── schema.ts        # Drizzle schema definitions
├── src/mastra/          # Mastra AI agents
│   ├── agents/          # RFP domain agents
│   ├── tools/           # Agent tools
│   └── workflows/       # Orchestration workflows
├── migrations/          # Database migrations
├── tests/               # Test suites
└── .opencode/           # OpenAgents development tools
    ├── agent/           # Development agents
    ├── command/         # Slash commands (incl. /rfp-*)
    └── context/         # Domain knowledge
        ├── domain/      # RFP terminology, portals, proposals
        ├── processes/   # RFP discovery, proposal generation
        └── standards/   # Compliance requirements
```

## Dual Agent Systems

### 1. OpenAgents (.opencode/)

Development-focused agents for coding, testing, and documentation:

- `openagent`: Universal coordinator
- `opencoder`: Specialized development
- `system-builder`: Meta-system generation
- **RFP Commands**: `/scan-portals`, `/generate-proposal`, `/check-compliance`, `/rfp-status`

### 2. Mastra (src/mastra/)

RFP domain-specific agents for procurement automation:

- **Tier 1**: Primary Orchestrator
- **Tier 2**: Portal Manager, Proposal Manager, Research Manager
- **Tier 3**: Portal Scanner, Content Generator, Compliance Checker, etc.

## Core Patterns

### Agent Structure Pattern

```markdown
---
description: 'What this agent does'
mode: primary|subagent
tools: [read, edit, bash, etc.]
permissions: [security restrictions]
---

# Agent Name

[Direct instructions for behavior]

**EXECUTE** this [process type] for every [task type]:

**1. [ACTION]** the [subject]:

- [Specific instruction 1]
- [Specific instruction 2]

**RULES:**

- **ALWAYS** [critical requirement]
- **NEVER** [forbidden action]
```

### Command Structure Pattern

```markdown
---
name: command-name
agent: target-agent
---

You are [doing specific task].

**Request:** $ARGUMENTS

**Context Loaded:**
@.opencode/context/core/essential-patterns.md
@[additional context files]

Execute [task] now.
```

### Context Loading Rules

- Commands load context immediately using @ references
- Agents can look up additional context deterministically
- Maximum 4 context files per command (250-450 lines total)
- Keep context files focused (50-150 lines each)

## Security Guidelines

- Agents have restricted permissions by default
- Sensitive operations require explicit approval
- No direct file system modifications without validation
- Build commands limited to safe operations

## Development Workflow

1. **Planning:** Create detailed task plans for complex work
2. **Implementation:** Execute one step at a time with validation
3. **Review:** Code review and security checks
4. **Testing:** Automated testing and build validation
5. **Documentation:** Update docs and context files

## Quality Gates

- TypeScript compilation passes (`pnpm type-check`)
- Code review completed
- Build process succeeds (`pnpm build`)
- Tests pass (`pnpm test`)
- Documentation updated

## RFP Domain Context

When working on RFP-related code, load these context files:

- `@.opencode/context/domain/rfp-terminology.md` - Procurement vocabulary
- `@.opencode/context/domain/portal-types.md` - Government portals
- `@.opencode/context/domain/proposal-structure.md` - Proposal sections
- `@.opencode/context/processes/rfp-discovery.md` - Discovery workflow
- `@.opencode/context/processes/proposal-generation.md` - Proposal generation
- `@.opencode/context/standards/compliance-requirements.md` - FAR/DFARS compliance

## Key Database Tables (shared/schema.ts)

- `rfps`: RFP records with NAICS, PSC, set-aside, status
- `proposals`: Generated proposals with sections
- `portals`: Configured procurement portals
- `scans` / `scanEvents`: Portal scanning history
- `complianceItems`: Compliance validation results

## API Patterns

RFP operations use RESTful endpoints under `/api/`:

- `POST /api/rfps/scan` - Trigger portal scanning
- `POST /api/proposals/generate` - Generate proposal
- `POST /api/proposals/:id/compliance` - Check compliance
- `GET /api/rfps/status` - Pipeline status
