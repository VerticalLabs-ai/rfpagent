import { MCPServer } from '@mastra/mcp';

import { primaryOrchestrator } from '../agents/primary-orchestrator';
import { portalManager } from '../agents/portal-manager';
import { proposalManager } from '../agents/proposal-manager';
import { researchManager } from '../agents/research-manager';
import { complianceChecker } from '../agents/compliance-checker';
import { contentGenerator } from '../agents/content-generator';
import { documentProcessor } from '../agents/document-processor';
import { historicalAnalyzer } from '../agents/historical-analyzer';
import { marketAnalyst } from '../agents/market-analyst';
import { portalMonitor } from '../agents/portal-monitor';
import { portalScanner } from '../agents/portal-scanner';

import { masterOrchestrationWorkflow } from '../workflows/master-orchestration-workflow';
import { documentProcessingWorkflow } from '../workflows/document-processing-workflow';
import { rfpDiscoveryWorkflow } from '../workflows/rfp-discovery-workflow';
import { bonfireAuthWorkflow } from '../workflows/bonfire-auth-workflow';
import { proposalPDFAssemblyWorkflow } from '../workflows/proposal-pdf-assembly-workflow';

import {
  delegateToManager,
  checkTaskStatus,
  requestSpecialist,
  sendAgentMessage,
  getAgentMessages,
  createCoordinatedWorkflow,
  updateWorkflowProgress,
} from '../tools/agent-coordination-tools';

/**
 * MCP server exposing internal RFP automation primitives to external MCP clients.
 */
export const rfpMcpServer = new MCPServer({
  id: 'rfp-mcp-server',
  name: 'RFP Agent MCP Server',
  version: '1.0.0',
  description:
    'Surface RFP discovery, proposal generation, and coordination workflows via the Model Context Protocol.',
  agents: {
    primaryOrchestrator,
    portalManager,
    proposalManager,
    researchManager,
    portalScanner,
    portalMonitor,
    contentGenerator,
    complianceChecker,
    documentProcessor,
    marketAnalyst,
    historicalAnalyzer,
  },
  workflows: {
    masterOrchestration: masterOrchestrationWorkflow,
    documentProcessing: documentProcessingWorkflow,
    rfpDiscovery: rfpDiscoveryWorkflow,
    bonfireAuth: bonfireAuthWorkflow,
    proposalPDFAssembly: proposalPDFAssemblyWorkflow,
  } as Record<string, any>,
  tools: {
    delegateToManager,
    checkTaskStatus,
    requestSpecialist,
    sendAgentMessage,
    getAgentMessages,
    createCoordinatedWorkflow,
    updateWorkflowProgress,
  },
});
