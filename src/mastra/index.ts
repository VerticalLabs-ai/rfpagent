import { Mastra } from '@mastra/core/mastra';

// Orchestrator Agent
import { primaryOrchestrator } from './agents/primary-orchestrator';

// Manager Agents
import { portalManager } from './agents/portal-manager';
import { proposalManager } from './agents/proposal-manager';
import { researchManager } from './agents/research-manager';

// Specialist Agents
import { complianceChecker } from './agents/compliance-checker';
import { contentGenerator } from './agents/content-generator';
import { documentProcessor } from './agents/document-processor';
import { historicalAnalyzer } from './agents/historical-analyzer';
import { marketAnalyst } from './agents/market-analyst';
import { portalMonitor } from './agents/portal-monitor';
import { portalScanner } from './agents/portal-scanner';

// Legacy mappings for backward compatibility
import { rfpAnalysisAgent } from './agents/rfp-analysis-agent';
import { rfpDiscoveryAgent } from './agents/rfp-discovery-agent';
import { rfpSubmissionAgent } from './agents/rfp-submission-agent';

// Workflows
import { bonfireAuthWorkflow } from './workflows/bonfire-auth-workflow';
import { documentProcessingWorkflow } from './workflows/document-processing-workflow';
import { masterOrchestrationWorkflow } from './workflows/master-orchestration-workflow';
import { proposalGenerationWorkflow } from './workflows/proposal-generation-workflow';
import { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';

// Mastra configuration with complete 3-tier agent system and workflows
export const mastra = new Mastra({
  // 3-Tier Agent System Configuration
  agents: {
    // Tier 1: Orchestrator (1 agent)
    primaryOrchestrator,

    // Tier 2: Managers (3 agents)
    portalManager,
    proposalManager,
    researchManager,

    // Tier 3: Specialists (7 agents)
    portalScanner,
    portalMonitor,
    contentGenerator,
    complianceChecker,
    documentProcessor,
    marketAnalyst,
    historicalAnalyzer,

    // Legacy agents for backward compatibility
    rfpDiscoveryAgent,
    rfpAnalysisAgent,
    rfpSubmissionAgent,
  },
  // Workflow Configuration
  workflows: {
    documentProcessing: documentProcessingWorkflow,
    rfpDiscovery: rfpDiscoveryWorkflow,
    proposalGeneration: proposalGenerationWorkflow,
    bonfireAuth: bonfireAuthWorkflow,
    masterOrchestration: masterOrchestrationWorkflow,
  },
});
