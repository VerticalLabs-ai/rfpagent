# Mastra Cloud Deployment Guide

**Last Updated**: October 2025

## Overview

This document explains the RFP Agent platform's configuration for Mastra Cloud deployment and how to avoid common issues like constant redeployments.

**For local MCP server setup**, see [technical/mcp-server-setup.md](technical/mcp-server-setup.md).

## Fixed Issues (2025-10-04)

### 🎯 Key Changes for Deployment Stability

We've made critical changes to ensure stable Mastra Cloud deployments:

#### 1. ✅ Removed Dynamic Imports

**Before:**

```typescript
if (featureFlags.useAgentPools) {
  const { agentPoolManager } = await import(
    './coordination/agent-pool-manager'
  );
  // ... initialization during module load
}
```

**After:**

```typescript
// Static imports at top of file
import { agentPoolManager } from './coordination/agent-pool-manager';
import { workflowAgentBindings } from './config/workflow-agent-bindings';

// Pure module export (no side effects)
export const mastra = new Mastra({
  /* ... */
});

// Deferred initialization function
export async function initializeAgentSystem() {
  if (featureFlags.useAgentPools) {
    // Initialize pools here
  }
}
```

#### 2. ✅ Separated Side Effects from Module Initialization

**Before:**

```typescript
// Side effects during import (causes scanning issues)
if (featureFlags.useAgentRegistry) {
  for (const [agentId, metadata] of Object.entries(agentHierarchyConfig)) {
    agentRegistry.register(agentId, agentInstance, metadata);
  }
}
```

**After:**

```typescript
// Pure export
export const mastra = new Mastra({
  /* static config only */
});

// Explicit initialization function (called at runtime)
export async function initializeAgentRegistry() {
  if (featureFlags.useAgentRegistry) {
    // Register agents here
  }
}
```

#### 3. ✅ Static Service Dependencies in Workflows

**Before:**

```typescript
const scrapePortalStep = createStep({
  execute: async ({ inputData }) => {
    // Dynamic import during execution
    const { incrementalPortalScanService } = await import(
      '../../../server/services/portals/incrementalPortalScanService'
    );
    const result = await incrementalPortalScanService.scanPortal(/*...*/);
  },
});
```

**After:**

```typescript
// Static import at top of file
import { incrementalPortalScanService } from '../../../server/services/portals/incrementalPortalScanService';

const scrapePortalStep = createStep({
  execute: async ({ inputData }) => {
    // Use statically imported service
    const result = await incrementalPortalScanService.scanPortal(/*...*/);
  },
});
```

#### 4. ✅ Minimal Bundler Externals

**Before:**

```typescript
bundler: {
  externals: [
    'playwright', 'playwright-core', '@playwright/test',
    'puppeteer', 'puppeteer-core', 'pdf-parse', 'pdf-lib',
    'mammoth', 'adm-zip', '@mastra/libsql', '@libsql/client',
    'libsql', '@mastra/mcp', 'winston', 'winston-transport',
    'readable-stream', 'inherits', 'duplexify', 'stream-browserify',
    'jszip', '@ai-sdk/anthropic', '@ai-sdk/openai', 'ai',
    '@1password/sdk', '@1password/sdk-core',
  ],
}
```

**After:**

```typescript
bundler: {
  externals: [
    // Only essential runtime dependencies
    '@browserbasehq/stagehand',  // Browser automation
    '@mastra/libsql',             // Database (not supported in serverless)
    '@libsql/client',
  ],
  // Let Mastra Cloud handle everything else
}
```

---

## Mastra Cloud Requirements

### What Mastra Cloud Scans For

When you deploy to Mastra Cloud, the platform scans your repository for:

1. **Agents**: Defined using `new Agent({...})`
2. **Tools**: Defined using `createTool({...})`
3. **Workflows**: Defined using `createWorkflow({...})`
4. **Steps**: Defined using `createStep({...})`

### Critical Rules for Stable Deployments

#### ✅ DO

- Use **static imports** for all agents, tools, workflows, and dependencies
- Keep module exports **pure** (no side effects during import)
- Define all entities **statically resolvable** at build time
- Use explicit `init()` functions for runtime initialization
- Minimize bundler externals to only required runtime dependencies

#### ❌ DON'T

- Use **dynamic imports** (`await import()`) in top-level configuration
- Perform **side effects** during module initialization
- Import external services **inside workflow step execution**
- Add unnecessary dependencies to bundler externals
- Use conditional imports based on feature flags

---

## Project Structure for Mastra Cloud

```
rfpagent/
├── src/
│   └── mastra/
│       ├── agents/           # Agent definitions (new Agent({...}))
│       ├── tools/            # Tool definitions (createTool({...}))
│       ├── workflows/        # Workflow definitions (createWorkflow({...}))
│       ├── mcp/              # MCP server definitions
│       └── index.ts          # Mastra configuration (MUST be pure)
├── mastra.config.ts          # Root config (exports mastra instance)
└── package.json
```

### Key Configuration Files

#### `mastra.config.ts` (Root Level)

```typescript
import { config } from '@mastra/core/config';
import { mastra } from './src/mastra';

export default config({
  name: 'rfp-agent-platform',
  mastra,
  publicDir: 'public',
});
```

#### `src/mastra/index.ts` (Pure Export)

```typescript
import { Mastra } from '@mastra/core/mastra';
// ALL imports must be static
import { primaryOrchestrator } from './agents/primary-orchestrator';
import { portalManager } from './agents/portal-manager';
import { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';

// Pure export - NO side effects
export const mastra = new Mastra({
  agents: {
    primaryOrchestrator,
    portalManager,
    // ... all agents
  },
  workflows: {
    rfpDiscovery: rfpDiscoveryWorkflow,
    // ... all workflows
  },
  bundler: {
    externals: ['@browserbasehq/stagehand', '@mastra/libsql', '@libsql/client'],
  },
});

// Deferred initialization (called at runtime, not during import)
export async function initializeAgentSystem() {
  // Initialize registries, pools, etc.
}
```

#### Server Initialization (`server/index.ts`)

```typescript
setImmediate(async () => {
  try {
    // Initialize Mastra agent system at runtime
    const { initializeAgentSystem } = await import('../src/mastra/index');
    await initializeAgentSystem();

    // Bootstrap server-side agents
    await agentRegistryService.bootstrapDefaultAgents();
  } catch (error) {
    log('⚠️ Initialization error:', error);
  }
});
```

---

## Deployment Checklist

Before deploying to Mastra Cloud:

- [ ] All agents use `new Agent({...})` syntax
- [ ] All tools use `createTool({...})` syntax
- [ ] All workflows use `createWorkflow({...})` syntax
- [ ] All steps use `createStep({...})` syntax
- [ ] No dynamic imports in `src/mastra/index.ts`
- [ ] No side effects during module initialization
- [ ] All service dependencies are statically imported
- [ ] Bundler externals list is minimal (3 items)
- [ ] `mastra.config.ts` exports pure configuration
- [ ] Runtime initialization is deferred to `initializeAgentSystem()`

---

## Troubleshooting

### Issue: Constant Redeployments

**Symptoms:**

- Mastra Cloud shows "Deploying..." constantly
- Builds trigger on every scan
- Configuration seems to change between deployments

**Solution:**

- Check for dynamic imports in `src/mastra/index.ts`
- Ensure no side effects during module initialization
- Verify all workflow steps use static service imports
- Review bundler externals - should only have 3 items

### Issue: Agents Not Detected

**Symptoms:**

- Agents don't appear in Mastra Cloud dashboard
- 404 errors when calling agent endpoints

**Solution:**

- Ensure agents use `new Agent({...})` syntax
- Check that agents are exported in `mastra` config
- Verify no conditional exports based on feature flags
- Make sure all imports are static and resolvable

### Issue: Build Failures

**Symptoms:**

- "Cannot resolve module" errors
- "Circular dependency" warnings
- Build completes but app doesn't start

**Solution:**

- Review bundler externals - remove unnecessary items
- Check for circular imports in workflow definitions
- Verify all external services are properly imported
- Ensure database connections work in serverless environment

---

## Environment Variables

Mastra Cloud requires these environment variables:

```env
# AI Models
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Browser Automation
BROWSERBASE_API_KEY=...
BROWSERBASE_PROJECT_ID=...

# Database (Note: LibSQL may not work in Mastra Cloud)
DATABASE_URL=postgresql://...

# Optional: Feature Flags
USE_AGENT_REGISTRY=true
USE_AGENT_POOLS=true
MASTRA_LOG_LEVEL=INFO
```

**Important:** LibSQL (`@mastra/libsql`) is not supported in Mastra Cloud's serverless environment. Use PostgreSQL or another supported database.

---

## Testing Locally

Before deploying to Mastra Cloud, test locally:

```bash
# Build Mastra bundle
npm run mastra:build

# Test the built bundle
node .mastra/output/index.mjs

# Verify no side effects during import
node -e "import('./src/mastra/index.ts').then(m => console.log('✅ Pure import'))"

# Check for dynamic imports
grep -r "await import" src/mastra/
```

---

## Continuous Integration

Mastra Cloud automatically deploys when you push to your configured branch (typically `main`).

**Deployment Trigger:**

```bash
git add .
git commit -m "fix: stable mastra cloud configuration"
git push origin main
```

Mastra Cloud will:

1. Clone your repository
2. Scan for agents, tools, workflows, steps
3. Build the application
4. Deploy to serverless environment
5. Expose REST API endpoints

---

## Support

- **Mastra Docs**: <https://docs.mastra.ai>
- **Mastra Cloud**: <https://cloud.mastra.ai>
- **GitHub Issues**: <https://github.com/mastra-ai/mastra/issues>

---

## Summary

The key to stable Mastra Cloud deployments:

1. **Static imports only** - no `await import()` in configuration
2. **Pure module exports** - no side effects during import
3. **Deferred initialization** - use explicit `init()` functions
4. **Minimal externals** - let Mastra Cloud handle dependencies
5. **Statically resolvable** - all entities must be detectable at build time

By following these rules, your Mastra Cloud deployments will be fast, stable, and reliable.
