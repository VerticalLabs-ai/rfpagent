# RFP Agent MCP Server Setup

## ✅ Successfully Configured

The RFP Agent MCP server is now running and connected to Claude Code, bypassing the `mastra dev` bundler issues.

## What Was Done

### 1. Diagnosed `pnpm run mastra:dev` Issues

**Problems Found:**
- ❌ Global `mastra` CLI couldn't find `@mastra/core` (version mismatch)
- ❌ `pdf-parse` using `createRequire` conflicted with bundler
- ❌ Mastra bundler doesn't respect `externals` config for AI SDK packages
- ❌ `@ai-sdk/anthropic` and `@ai-sdk/openai` are pure ESM (no default exports)

**Fixes Applied:**
- ✅ Installed `mastra` locally as dev dependency
- ✅ Updated `@mastra/core` from 0.20.2 to 0.21.1
- ✅ Refactored `pdf-parse` to use dynamic `import()` instead of `createRequire`
- ✅ Added comprehensive `externals` to bundler config (though not fully respected)

### 2. Created Standalone MCP Server

**File:** `scripts/start-mcp-server.ts`

This script:
- Bypasses `mastra dev` and its bundler
- Imports the mastra configuration directly
- Starts the RFP MCP server with stdio transport
- Exposes all agents, workflows, and tools via MCP protocol

### 3. Registered with Claude Code

```bash
claude mcp add rfp-agent tsx /Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/scripts/start-mcp-server.ts
```

## Available MCP Tools

The following tools are now available in Claude Code:

### Coordination Tools
- `delegateToManager` - Delegate tasks to manager agents
- `checkTaskStatus` - Check status of delegated tasks
- `requestSpecialist` - Request specialist agent assistance
- `sendAgentMessage` - Send messages between agents
- `getAgentMessages` - Retrieve agent messages
- `createCoordinatedWorkflow` - Create multi-agent workflows
- `updateWorkflowProgress` - Update workflow progress

### Agents (via `ask_<agent>` tools)
- `primaryOrchestrator` - Main coordination agent
- `portalManager` - RFP portal management
- `proposalManager` - Proposal generation
- `researchManager` - Research coordination
- `portalScanner` - Portal scanning
- `portalMonitor` - Portal monitoring
- `contentGenerator` - Content generation
- `complianceChecker` - Compliance verification
- `documentProcessor` - Document processing
- `marketAnalyst` - Market analysis
- `historicalAnalyzer` - Historical data analysis

### Workflows (via `run_<workflow>` tools)
- `masterOrchestration` - Master orchestration workflow
- `documentProcessing` - Document processing workflow
- `rfpDiscovery` - RFP discovery workflow
- `bonfireAuth` - BonfireHub authentication workflow
- `proposalPDFAssembly` - Proposal PDF assembly workflow

## Verification

Check MCP server status:
```bash
claude mcp list
```

You should see:
```
rfp-agent: tsx /Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/scripts/start-mcp-server.ts - ✓ Connected
```

## Testing Tools in Mastra Cloud

Now that the MCP server is running locally, you can test if tools are showing up in Mastra Cloud:

1. The tools are registered locally via MCP
2. Mastra Cloud visibility depends on whether you're using the cloud dashboard
3. For local-only testing, use the MCP tools directly in Claude Code

## Known Issues

### Database Connection Warnings
You may see warnings like:
```
❌ Failed to retrieve relevant context: DrizzleQueryError: ... role "rfpuser" does not exist
```

**Impact:** These are non-fatal. The MCP server still functions for tool calls. The warnings are from server initialization trying to access PostgreSQL for memory persistence.

**Solution (Optional):** Set up PostgreSQL if you need persistent memory features:
```bash
# See main README for database setup instructions
```

## Troubleshooting

### MCP Server Not Connecting

1. **Check the script path is absolute:**
   ```bash
   ls -la /Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/scripts/start-mcp-server.ts
   ```

2. **Test manually:**
   ```bash
   pnpm tsx scripts/start-mcp-server.ts
   ```
   Should output: `✅ RFP Agent MCP Server is running via stdio`

3. **Restart Claude Code:**
   Sometimes MCP servers need a restart to reconnect

### Tools Not Showing Up

1. **Check MCP server status:**
   ```bash
   claude mcp list
   ```

2. **Check MCP logs:**
   Look for errors in Claude Code's output panel

3. **Verify mastra configuration:**
   Ensure `src/mastra/mcp/server.ts` exports tools correctly

## Files Modified

- `src/mastra/utils/pdf-processor.ts` - Dynamic import for pdf-parse
- `src/mastra/index.ts` - Bundler externals configuration
- `scripts/start-mcp-server.ts` - New standalone MCP server entry point
- `package.json` - Added `mastra` dev dependency
- Updated `@mastra/core` to 0.21.1

## Next Steps

### For Testing Tools in Mastra Cloud

The tools should now be visible to:
1. **Local Claude Code** - Already working ✅
2. **Mastra Cloud Dashboard** - May require deployment or cloud registration

To check Mastra Cloud visibility:
1. Visit your Mastra Cloud dashboard
2. Look for the RFP Agent tools
3. If not visible, they may need to be deployed (not just running locally)

### For Production Deployment

Consider:
1. Deploy MCP server to cloud environment
2. Set up PostgreSQL for persistent memory
3. Configure environment variables for production
4. Set up monitoring and logging

## Summary

✅ **Working:** MCP server running locally via stdio
✅ **Working:** All tools exposed to Claude Code
⚠️ **Partial:** Database features require PostgreSQL setup
❓ **Unknown:** Mastra Cloud dashboard visibility (depends on their platform)

The key achievement is that you can now test your RFP Agent tools directly in Claude Code without needing `mastra dev` to work.
