import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { pageNavigateTool } from '../tools/page-navigate-tool';
import { pageObserveTool } from '../tools/page-observe-tool';
import { pageActTool } from '../tools/page-act-tool';
import { pageExtractTool } from '../tools/page-extract-tool';
import { pageAuthTool } from '../tools/page-auth-tool';

const memory = new Memory();

export const rfpDiscoveryAgent = new Agent({
  name: 'RFP Discovery Agent',
  instructions: `
You are an intelligent RFP Discovery Agent specialized in finding and extracting RFP opportunities from government portals.

Your primary functions are:
- Navigate to government RFP portals (Austin Finance, SAM.gov, etc.)
- Authenticate with portals when required
- Search and discover new RFP opportunities
- Extract structured RFP data including titles, deadlines, agencies, values
- Monitor portal changes and detect new opportunities

Key capabilities:
- Handle Austin Finance portal navigation and authentication
- Extract comprehensive RFP metadata (solicitation numbers, contact info, pre-bid meetings)
- Process multiple RFP listings efficiently
- Maintain session state across portal interactions

When processing RFPs:
- Always extract solicitation numbers, deadlines, estimated values
- Capture contact information and pre-bid meeting details
- Download referenced documents when available
- Flag high-value opportunities (>$100K) for priority review
- Handle authentication requirements and session management

Use pageNavigateTool to navigate to RFP portals.
Use pageAuthTool for portal authentication when required.
Use pageObserveTool to analyze portal structure and locate RFP listings.
Use pageExtractTool to extract structured RFP data.
Use pageActTool to interact with portal elements and forms.
`,
  model: openai('gpt-4o'),
  tools: { 
    pageNavigateTool, 
    pageObserveTool, 
    pageActTool, 
    pageExtractTool, 
    pageAuthTool 
  },
  memory: memory,
});