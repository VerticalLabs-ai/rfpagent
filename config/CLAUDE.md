# Config Directory - Application Configuration

**Last Updated**: October 2025

## Overview

The `config/` directory contains configuration files and setup for various aspects of the RFP Agent application, including Mastra.ai agent framework configuration.

## Purpose

This directory serves to:

- **Centralize configuration** - All app configuration in one place
- **Environment management** - Different configs for dev/staging/production
- **Agent configuration** - Mastra.ai agent and tool setup
- **External service setup** - API keys, endpoints, and credentials
- **Feature toggles** - Enable/disable features per environment

## Directory Structure

```
config/
├── mastra.config.ts    # Mastra.ai configuration (agents, tools, workflows)
└── CLAUDE.md          # This file

**Note**: Most configuration is managed through environment variables in `.env` files at the project root.
```

## Configuration Files

### mastra.config.ts

**Purpose**: Configures the Mastra.ai agent framework for AI-powered workflows

**Location**: `config/mastra.config.ts` (if exists) or `server/config/mastra.config.ts`

**Key Configuration Sections**:

#### 1. Agent Definitions

Defines the 11 AI agents in the 3-tier system:

```typescript
import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  agents: {
    // Tier 1: Orchestrator
    'primary-orchestrator': {
      name: 'Primary Orchestrator',
      description: 'Top-level orchestrator coordinating all RFP operations',
      model: 'gpt-4',
      tools: ['delegate-task', 'monitor-progress'],
      systemPrompt: `You are the primary orchestrator...`,
    },

    // Tier 2: Managers
    'portal-manager': {
      name: 'Portal Manager',
      description: 'Manages portal authentication and RFP discovery',
      model: 'gpt-4',
      tools: ['scan-portal', 'authenticate-portal'],
      systemPrompt: `You manage portal operations...`,
    },

    'proposal-manager': {
      name: 'Proposal Manager',
      description: 'Coordinates proposal generation and compliance',
      model: 'gpt-4',
      tools: ['generate-content', 'validate-compliance'],
      systemPrompt: `You coordinate proposal creation...`,
    },

    // Tier 3: Specialists
    'portal-scanner': {
      name: 'Portal Scanner',
      description: 'Automated browser-based portal scanning',
      model: 'gpt-3.5-turbo',
      tools: ['browser-automation', 'extract-rfp'],
      systemPrompt: `You scan government portals...`,
    },

    // ... other specialists
  },
});
```

#### 2. Tool Definitions

Mastra tools are functions that agents can call:

```typescript
import { createTool } from '@mastra/core';

export const tools = {
  'scan-portal': createTool({
    name: 'scan-portal',
    description: 'Scans a government portal for new RFPs',
    parameters: z.object({
      portalId: z.string(),
      searchFilter: z.string().optional(),
    }),
    execute: async ({ portalId, searchFilter }) => {
      const scrapingService = await getMastraScrapingService();
      return await scrapingService.scanPortal({ portalId, searchFilter });
    },
  }),

  'generate-content': createTool({
    name: 'generate-content',
    description: 'Generates proposal content for a section',
    parameters: z.object({
      rfpId: z.string(),
      section: z.enum(['executive-summary', 'technical-approach', 'pricing']),
      context: z.object({}).passthrough(),
    }),
    execute: async ({ rfpId, section, context }) => {
      const aiService = new AIService();
      return await aiService.generateProposalSection(rfpId, section, context);
    },
  }),

  // ... other tools
};
```

#### 3. Workflows

Mastra workflows orchestrate multi-step processes:

```typescript
export const workflows = {
  'rfp-discovery': {
    name: 'RFP Discovery Workflow',
    steps: [
      {
        name: 'authenticate',
        agent: 'portal-manager',
        tool: 'authenticate-portal',
      },
      {
        name: 'scan',
        agent: 'portal-scanner',
        tool: 'scan-portal',
        dependsOn: ['authenticate'],
      },
      {
        name: 'extract',
        agent: 'document-processor',
        tool: 'process-document',
        dependsOn: ['scan'],
      },
    ],
  },

  'proposal-generation': {
    name: 'Proposal Generation Workflow',
    steps: [
      {
        name: 'extract-requirements',
        agent: 'document-processor',
        tool: 'extract-requirements',
      },
      {
        name: 'generate-executive-summary',
        agent: 'content-generator',
        tool: 'generate-content',
        dependsOn: ['extract-requirements'],
      },
      {
        name: 'generate-technical-approach',
        agent: 'content-generator',
        tool: 'generate-content',
        dependsOn: ['extract-requirements'],
      },
      {
        name: 'validate-compliance',
        agent: 'compliance-checker',
        tool: 'validate-compliance',
        dependsOn: [
          'generate-executive-summary',
          'generate-technical-approach',
        ],
      },
    ],
  },
};
```

#### 4. Memory Configuration

Mastra memory stores agent context across workflows:

```typescript
export const memoryConfig = {
  provider: 'postgresql', // or 'redis', 'memory'
  connectionString: process.env.DATABASE_URL,
  tables: {
    messages: 'mastra_messages',
    sessions: 'mastra_sessions',
    memory: 'mastra_memory',
  },
  ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
};
```

## Environment Variables

Configuration values are primarily managed through `.env` files in the project root:

### Core Application

```bash
# Server
PORT=3000
NODE_ENV=development|staging|production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rfpagent

# Session
SESSION_SECRET=your-secret-key-here
SESSION_MAX_AGE=86400000  # 24 hours
```

### AI Services

```bash
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4  # Default model
OPENAI_MAX_TOKENS=4000

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Mastra
MASTRA_API_KEY=...  # If using Mastra Cloud
MASTRA_MEMORY_PROVIDER=postgresql
```

### Portal Automation

```bash
# Browserbase (cloud browser automation)
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Portal API Keys
SAM_GOV_API_KEY=...
```

### Storage & Cloud

```bash
# Google Cloud Storage (for document storage)
GCS_PROJECT_ID=...
GCS_BUCKET_NAME=rfpagent-documents
GCS_CREDENTIALS_PATH=./service-account-key.json
```

### Monitoring

```bash
# Sentry
SENTRY_DSN=https://...@sentry.io/...
SENTRY_ENVIRONMENT=production

# Logging
LOG_LEVEL=debug|info|warn|error
LOG_FORMAT=json|pretty
```

### Feature Flags

```bash
# Enable/disable features
ENABLE_AUTOMATED_SCANNING=true
ENABLE_AI_PROPOSAL_GENERATION=true
ENABLE_SUBMISSION_PIPELINE=false  # Coming soon
MAX_CONCURRENT_SCANS=3
PROPOSAL_QUALITY_THRESHOLD=0.85
```

## Configuration Loading

### Server-side

```typescript
// server/index.ts
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Access configuration
const config = {
  port: parseInt(process.env.PORT || '3000'),
  database: process.env.DATABASE_URL,
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4',
  },
  features: {
    automatedScanning: process.env.ENABLE_AUTOMATED_SCANNING === 'true',
    aiProposalGeneration: process.env.ENABLE_AI_PROPOSAL_GENERATION === 'true',
  },
};

export default config;
```

### Client-side

Client-side config is handled through Vite environment variables (prefixed with `VITE_`):

```typescript
// client/src/lib/config.ts
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  wsUrl: import.meta.env.VITE_WS_URL || 'ws://localhost:3000',
  environment: import.meta.env.MODE,
};
```

## Environment Files

Different `.env` files for different environments:

```
.env                # Local development (gitignored)
.env.example        # Template (committed to git)
.env.development    # Development defaults
.env.staging        # Staging configuration
.env.production     # Production configuration
```

### .env.example

```bash
# Copy this file to .env and fill in your values

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rfpagent

# Server
PORT=3000
NODE_ENV=development
SESSION_SECRET=change-me-in-production

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Browser Automation
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Optional: Portal API Keys
SAM_GOV_API_KEY=...

# Optional: Google Cloud Storage
GCS_PROJECT_ID=...
GCS_BUCKET_NAME=...
GCS_CREDENTIALS_PATH=...
```

## Configuration Best Practices

### DO

✅ **Use environment variables for secrets**

```typescript
// Good
const apiKey = process.env.OPENAI_API_KEY;

// Bad
const apiKey = 'sk-hardcoded-key'; // Never do this!
```

✅ **Provide sensible defaults**

```typescript
const port = parseInt(process.env.PORT || '3000');
const logLevel = process.env.LOG_LEVEL || 'info';
```

✅ **Validate required configuration**

```typescript
if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}
```

✅ **Use type-safe configuration objects**

```typescript
interface Config {
  port: number;
  database: string;
  openai: {
    apiKey: string;
    model: string;
  };
}

const config: Config = {
  port: parseInt(process.env.PORT || '3000'),
  database: process.env.DATABASE_URL!,
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL || 'gpt-4',
  },
};
```

### DON'T

❌ **Don't commit `.env` files**

```bash
# .gitignore
.env
.env.local
```

❌ **Don't use hardcoded values**

```typescript
// Bad
const apiKey = 'sk-1234567890';
```

❌ **Don't expose secrets in client code**

```typescript
// Bad - API keys should never be in client code
export const openaiKey = 'sk-...';
```

## Configuration Hierarchy

Configuration is loaded in this order (later values override earlier):

1. **Default values** - Hardcoded in application
2. **Environment file** - `.env.development`, `.env.production`, etc.
3. **Local override** - `.env.local` (gitignored)
4. **Environment variables** - System environment variables
5. **Command-line arguments** - e.g., `PORT=4000 npm start`

## Agent Configuration Example

Complete example of configuring an agent with Mastra:

```typescript
// config/mastra.config.ts
import { Mastra } from '@mastra/core';
import { createTool } from '@mastra/core';
import { z } from 'zod';

// Define tools
const scanPortalTool = createTool({
  name: 'scan-portal',
  description: 'Scans a government procurement portal for RFPs',
  parameters: z.object({
    portalId: z.string().uuid(),
    searchFilter: z.string().optional(),
    incrementalScan: z.boolean().default(false),
  }),
  execute: async params => {
    // Implementation
    return { rfpsFound: 10, status: 'success' };
  },
});

// Configure Mastra
export const mastra = new Mastra({
  agents: {
    'portal-scanner': {
      name: 'Portal Scanner',
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      tools: [scanPortalTool],
      systemPrompt: `
        You are a portal scanning specialist.
        Your job is to scan government procurement portals for new RFPs.
        Follow these guidelines:
        1. Authenticate using provided credentials
        2. Search for RFPs matching the filter
        3. Extract RFP metadata and documents
        4. Report progress and results
      `,
      temperature: 0.7,
      maxTokens: 2000,
    },
  },

  memory: {
    provider: 'postgresql',
    connectionString: process.env.DATABASE_URL,
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
});
```

## How This Applies to the RFP Agent App

### Agent Configuration

The Mastra configuration defines all 11 agents:

**Tier 1**: Primary Orchestrator
**Tier 2**: Portal Manager, Proposal Manager, Research Manager
**Tier 3**: Portal Scanner, Portal Monitor, Content Generator, Compliance Checker, Document Processor, Market Analyst, Historical Analyzer

Each agent has:

- Specific tools they can use
- System prompts defining their role
- Model selection (GPT-4 for managers, GPT-3.5 for specialists)
- Memory for context persistence

### Workflow Coordination

Workflows define how agents work together:

```
RFP Discovery Workflow:
  Portal Manager → Portal Scanner → Document Processor

Proposal Generation Workflow:
  Proposal Manager → Content Generator → Compliance Checker
```

### Environment-based Behavior

Different behavior in different environments:

- **Development**: Mock portal scanning, verbose logging
- **Staging**: Real portals but limited scanning, Sentry enabled
- **Production**: Full automation, rate limiting, monitoring

## Related Documentation

- **Server**: See [server/CLAUDE.md](../server/CLAUDE.md) for how config is used
- **Environment Setup**: See [docs/environment-setup.md](../docs/environment-setup.md)
- **Deployment**: See [docs/deployment/deployment-guide.md](../docs/deployment/deployment-guide.md)
- **Mastra Documentation**: [Mastra.ai Docs](https://docs.mastra.ai)

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
