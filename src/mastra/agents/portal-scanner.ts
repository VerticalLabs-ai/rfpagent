import { Agent } from '@mastra/core/agent';
import { analyticalModel } from '../models';
import {
  sendAgentMessage,
  updateWorkflowProgress,
} from '../tools/agent-coordination-tools';
import { pageActTool } from '../tools/page-act-tool';
import { pageAuthTool } from '../tools/page-auth-tool';
import { pageExtractTool } from '../tools/page-extract-tool';
import { pageNavigateTool } from '../tools/page-navigate-tool';
import { pageObserveTool } from '../tools/page-observe-tool';
import { sharedMemory } from '../tools/shared-memory-provider';
import { portalScannerInstructions } from '../docs/portal-scanner-instructions';

/**
 * Portal Scanner - Tier 3 Specialist Agent
 * Using: Claude Sonnet 4.5 (optimal for analytical browser automation tasks)
 *
 * Specialized in automated portal scanning and RFP discovery
 */
export const portalScanner = new Agent({
  name: 'Portal Scanner',
  description: 'Automated portal scanning and RFP discovery using browser automation',
  instructions: portalScannerInstructions,
  model: analyticalModel, // Claude Sonnet 4.5 - optimal for analytical browser automation
  tools: {
    // Browser automation tools
    pageNavigateTool,
    pageObserveTool,
    pageActTool,
    pageExtractTool,
    pageAuthTool,
    // Coordination tools
    sendAgentMessage,
    updateWorkflowProgress,
  },
  memory: sharedMemory,
});
