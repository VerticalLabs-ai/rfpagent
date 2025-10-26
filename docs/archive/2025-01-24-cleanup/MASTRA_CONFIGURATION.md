# Mastra Configuration Guide

## Issue: Tools Not Showing in Mastra Cloud Dashboard

### Root Cause Analysis

Your Mastra tools were not appearing in the cloud dashboard due to **missing root-level configuration**:

1. **Missing `mastra.config.ts`** - Mastra Cloud requires a root-level config file
2. **No Mastra CLI scripts** - Missing package.json scripts for Mastra operations
3. **MCP Server not properly exposed** - Tools defined but not registered with cloud

### What Was Fixed

#### 1. Created Root-Level Configuration

**File: `mastra.config.ts`** (NEW)
```typescript
import { config } from '@mastra/core/config';
import { mastra } from './src/mastra';

export default config({
  name: 'rfp-agent-platform',
  mastra,
});
```

**Why this matters:**
- Mastra Cloud Dashboard looks for `mastra.config.ts` in the project root
- This file exports your mastra instance for cloud discovery
- Without it, tools are invisible to the dashboard

#### 2. Added Mastra Scripts to package.json

```json
{
  "scripts": {
    "mastra:dev": "mastra dev",
    "mastra:build": "mastra build",
    "mastra:deploy": "mastra deploy"
  }
}
```

**Why this matters:**
- `mastra dev` - Runs development server with tool discovery
- `mastra build` - Builds tools for deployment
- `mastra:deploy` - Deploys to Mastra Cloud

### Your Mastra Architecture

#### Tool Structure (Correctly Configured)

**Location: `src/mastra/tools/`**

✅ **Browser Automation Tools:**
- `page-navigate-tool.ts` - Navigate to webpages
- `page-observe-tool.ts` - Observe page elements
- `page-act-tool.ts` - Perform page actions
- `page-extract-tool.ts` - Extract page data
- `page-auth-tool.ts` - Handle authentication

✅ **Coordination Tools:**
- `agent-coordination-tools.ts` - Multi-agent coordination (7 tools)
  - `delegateToManager` - Delegate to Tier 2 managers
  - `checkTaskStatus` - Check task progress
  - `requestSpecialist` - Request Tier 3 specialists
  - `sendAgentMessage` - Inter-agent messaging
  - `getAgentMessages` - Retrieve messages
  - `createCoordinatedWorkflow` - Multi-agent workflows
  - `updateWorkflowProgress` - Workflow tracking

#### Agent Structure (11 Total)

**Tier 1 (Orchestrator):**
- `primary-orchestrator` - Top-level coordinator

**Tier 2 (Managers):**
- `portal-manager` - RFP discovery coordination
- `proposal-manager` - Proposal generation coordination
- `research-manager` - Market research coordination

**Tier 3 (Specialists):**
- `portal-scanner` - Scan RFP portals
- `portal-monitor` - Monitor portal changes
- `content-generator` - Generate proposal content
- `compliance-checker` - Verify compliance
- `document-processor` - Process documents
- `market-analyst` - Market analysis
- `historical-analyzer` - Historical data analysis

#### MCP Server Configuration

**File: `src/mastra/mcp/server.ts`**

The MCP server correctly exposes:
- ✅ All 11 agents
- ✅ All 7 coordination tools
- ✅ 5 workflows

**What was working:**
```typescript
export const rfpMcpServer = new MCPServer({
  id: 'rfp-mcp-server',
  name: 'RFP Agent MCP Server',
  agents: { /* all agents */ },
  tools: { /* coordination tools */ },
  workflows: { /* all workflows */ }
});
```

### How to Deploy to Mastra Cloud

#### Step 1: Verify Configuration
```bash
# Check that mastra.config.ts exists
ls -la mastra.config.ts

# Should show: mastra.config.ts
```

#### Step 2: Install Mastra CLI Globally (if needed)
```bash
npm install -g mastra
```

#### Step 3: Login to Mastra Cloud
```bash
npx mastra login
# Follow authentication prompts
```

#### Step 4: Build Your Tools
```bash
npm run mastra:build
```

#### Step 5: Deploy to Cloud
```bash
npm run mastra:deploy
```

#### Step 6: Verify in Dashboard
1. Go to Mastra Cloud Dashboard
2. Navigate to your project: `rfp-agent-platform`
3. Check "Tools" section - should now see:
   - 5 page automation tools
   - 7 coordination tools
4. Check "Agents" section - should see all 11 agents
5. Check "Workflows" section - should see 5 workflows

### Environment Configuration

**Required for MCP External Clients:**

Add to `.env`:
```bash
# Optional: External MCP Server URLs
RFP_MCP_RUN_SSE_URL=https://your-mcp-server.com/sse
AMPERSAND_MCP_SSE_URL=https://ampersand-mcp.com/sse
AMPERSAND_API_KEY=your_api_key
AMPERSAND_PROJECT_ID=your_project_id
AMPERSAND_INTEGRATION_NAME=your_integration

# Optional: Smithery Sequential Thinking
SMITHERY_API_KEY=your_smithery_key
```

**Note:** External MCP servers are optional. Local tools will work without them.

### Development Workflow

#### Local Development with Tool Discovery
```bash
npm run mastra:dev
```

This starts:
- Development server
- Tool discovery service
- Hot reload for tool changes

#### Testing Tools Locally
```bash
# Run your existing test scripts
npm run test-agents
npm run test-proposals-api

# Or use Mastra's built-in testing
npx mastra test
```

### Troubleshooting

#### Tools Still Not Showing?

**Check 1: Config File Location**
```bash
# Must be in project root
/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/mastra.config.ts
```

**Check 2: Mastra Instance Export**
```bash
# Verify export in src/mastra/index.ts
grep "export const mastra" src/mastra/index.ts
```

**Check 3: Tool Descriptions**
All tools must have `description` fields for MCP compatibility:
```typescript
createTool({
  id: 'my-tool',
  description: 'Required for MCP server', // ✅ Must be present
  // ...
})
```

**Check 4: Agent Descriptions**
All agents must have `description` fields:
```typescript
new Agent({
  name: "My Agent",
  description: "Required for MCP server", // ✅ Must be present
  // ...
})
```

#### Build Errors?

**Issue:** ESM/CommonJS conflicts with pdf-parse, etc.

**Solution:** Already configured in `src/mastra/index.ts`:
```typescript
bundler: {
  externals: [
    'playwright',
    'pdf-parse',
    'pdf-lib',
    'mammoth',
    'adm-zip',
  ]
}
```

### Verification Checklist

- [x] Root `mastra.config.ts` created
- [x] Mastra scripts added to package.json
- [x] All agents have descriptions
- [x] All tools have descriptions
- [x] MCP server exports agents, tools, workflows
- [x] Main mastra instance exports correctly
- [ ] Deploy to Mastra Cloud
- [ ] Verify tools in dashboard

### Next Steps

1. **Deploy to Cloud:**
   ```bash
   npm run mastra:deploy
   ```

2. **Verify Tools Appear:**
   - Check Mastra Cloud Dashboard
   - Look for "rfp-agent-platform" project
   - Verify 12 tools are listed

3. **Test Tool Execution:**
   - Use dashboard to test individual tools
   - Verify agent coordination works
   - Check workflow execution

4. **Monitor Usage:**
   - Dashboard shows tool usage metrics
   - Agent performance tracking
   - Workflow success rates

### Additional Resources

- [Mastra Documentation](https://mastra.dev/docs)
- [MCP Protocol Spec](https://modelcontextprotocol.io)
- [Tool Development Guide](https://mastra.dev/docs/tools)
- [Agent Coordination Patterns](https://mastra.dev/docs/agents)

---

**Configuration Complete! 🎉**

Your tools should now be discoverable in the Mastra Cloud Dashboard after deployment.
