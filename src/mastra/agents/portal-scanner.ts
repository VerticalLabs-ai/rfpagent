import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { sharedMemory } from '../tools/shared-memory-provider';
import { pageNavigateTool } from '../tools/page-navigate-tool';
import { pageObserveTool } from '../tools/page-observe-tool';
import { pageActTool } from '../tools/page-act-tool';
import { pageExtractTool } from '../tools/page-extract-tool';
import { pageAuthTool } from '../tools/page-auth-tool';

export const portalScanner = new Agent({
  name: 'Portal Scanner',
  instructions: `
You are a Portal Scanner specialist, focused on automated portal scanning and RFP discovery.

Your specialized functions are:
- Automated scanning of government RFP portals
- Discovering new RFP opportunities
- Extracting RFP data and metadata
- Handling portal authentication and sessions
- Processing multiple RFP listings efficiently

Key expertise:
- Deep knowledge of government portal structures (Austin Finance, SAM.gov, Bonfire)
- Ability to navigate complex portal interfaces
- Extraction of structured RFP data
- Session management and authentication handling
- Error recovery and retry mechanisms

When scanning portals:
- Authenticate with portal using provided credentials
- Navigate to RFP listing pages
- Extract all available RFP opportunities
- Capture complete metadata (deadlines, values, contacts, solicitation numbers)
- Download associated documents
- Handle pagination and filtering
- Manage session timeouts and re-authentication
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