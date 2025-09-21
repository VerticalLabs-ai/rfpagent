import { Mastra } from '@mastra/core/mastra';

// Orchestrator Agent
import { primaryOrchestrator } from './agents/primary-orchestrator';

// Manager Agents (3)
import { portalManager } from './agents/portal-manager';
import { proposalManager } from './agents/proposal-manager';
import { researchManager } from './agents/research-manager';

// Specialist Agents (7)
import { portalScanner } from './agents/portal-scanner';
import { portalMonitor } from './agents/portal-monitor';
import { contentGenerator } from './agents/content-generator';
import { complianceChecker } from './agents/compliance-checker';
import { documentProcessor } from './agents/document-processor';
import { marketAnalyst } from './agents/market-analyst';
import { historicalAnalyzer } from './agents/historical-analyzer';

// Legacy mappings for backward compatibility
import { rfpDiscoveryAgent } from './agents/rfp-discovery-agent';
import { rfpAnalysisAgent } from './agents/rfp-analysis-agent';
import { rfpSubmissionAgent } from './agents/rfp-submission-agent';

// Mastra configuration with complete 3-tier agent system
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
});