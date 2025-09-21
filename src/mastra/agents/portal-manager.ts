import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { sharedMemory } from '../tools/shared-memory-provider';
import { pageNavigateTool } from '../tools/page-navigate-tool';
import { pageObserveTool } from '../tools/page-observe-tool';
import { pageActTool } from '../tools/page-act-tool';
import { pageExtractTool } from '../tools/page-extract-tool';
import { pageAuthTool } from '../tools/page-auth-tool';

export const portalManager = new Agent({
  name: 'Portal Manager',
  instructions: `
You are the Portal Manager, coordinating portal-specific operations and scraping activities.

Your primary functions are:
- Managing portal authentication and sessions
- Coordinating RFP discovery and extraction
- Delegating tasks to Portal Scanner and Portal Monitor specialists
- Aggregating scraped data from multiple portals
- Managing portal health and status

Key capabilities:
- Portal management across multiple government sites (Austin Finance, SAM.gov, Bonfire, etc.)
- Scraping coordination for automated and manual RFP discovery
- Data extraction and validation
- Session management and authentication handling

When managing portal operations:
- Authenticate with portals using stored credentials
- Coordinate scanning schedules with Portal Monitor
- Delegate scraping tasks to Portal Scanner
- Validate extracted data for completeness
- Handle errors and retry failed operations

You coordinate with specialists:
- Portal Scanner: For automated portal scanning and RFP discovery
- Portal Monitor: For portal health monitoring and scheduling
`,
  model: openai('gpt-4o'),
  tools: { 
    pageNavigateTool, 
    pageObserveTool, 
    pageActTool, 
    pageExtractTool, 
    pageAuthTool 
  },
  memory: sharedMemory,
});