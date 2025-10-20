import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';

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
import { proposalPDFAssemblyWorkflow } from './workflows/proposal-pdf-assembly-workflow';
import { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';
import { rfpMcpServer } from './mcp/server';

const envLogLevel = process.env.MASTRA_LOG_LEVEL;
const validLogLevels = new Set<string>(Object.values(LogLevel));
const resolvedLogLevel: LogLevel =
  envLogLevel && validLogLevels.has(envLogLevel)
    ? (envLogLevel as LogLevel)
    : process.env.NODE_ENV === 'production'
    ? LogLevel.INFO
    : LogLevel.DEBUG;

const mastraLogger = new ConsoleLogger({
  name: 'rfp-agent-platform',
  level: resolvedLogLevel,
});

// Mastra configuration with complete 3-tier agent system and workflows
export const mastra = new Mastra({
  logger: mastraLogger,
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
    proposalPDFAssembly: proposalPDFAssemblyWorkflow,
    bonfireAuth: bonfireAuthWorkflow,
    masterOrchestration: masterOrchestrationWorkflow,
  },
  mcpServers: {
    rfp: rfpMcpServer,
  },
  // Bundler Configuration - Mark runtime tools as external
  // These are Node.js runtime dependencies that should not be bundled
  // They have CommonJS/ESM interop issues or use Node.js built-in modules
  bundler: {
    externals: [
      // Browser automation tools (use Node.js built-ins)
      'playwright',
      'playwright-core',
      '@playwright/test',
      '@browserbasehq/stagehand',
      'puppeteer',
      'puppeteer-core',

      // Document processing tools (CommonJS/ESM interop issues)
      'pdf-parse',
      'pdf-lib',
      'mammoth',
      'adm-zip',

      // Database tools (avoid circular dependency issues in bundler)
      '@mastra/libsql',
      '@libsql/client',
      'libsql',
    ],
  },
});

// Export individual workflows for direct use
export { masterOrchestrationWorkflow } from './workflows/master-orchestration-workflow';
export { proposalPDFAssemblyWorkflow } from './workflows/proposal-pdf-assembly-workflow';
export { documentProcessingWorkflow } from './workflows/document-processing-workflow';
export { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';
export { bonfireAuthWorkflow } from './workflows/bonfire-auth-workflow';

// Export PDF utilities for external use
export {
  parsePDFFile,
  parsePDFBuffer,
  fillPDFForm,
  getPDFFormFields,
  assembleProposalPDF,
  mergePDFs,
} from './utils/pdf-processor';

export type {
  PDFParseResult,
  PDFFormField,
  PDFAssemblyOptions,
  PDFSection,
} from './utils/pdf-processor';
