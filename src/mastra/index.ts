import { Mastra } from '@mastra/core/mastra';
import { ConsoleLogger, LogLevel } from '@mastra/core/logger';

// Agent Registry System (Phase 1)
import { agentRegistry } from './registry/agent-registry';
import { agentHierarchyConfig } from './config/agent-hierarchy';
import { featureFlags, logFeatureFlags } from './config/feature-flags';

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

// Log feature flags status in development/debug mode
if (featureFlags.isDevelopment || resolvedLogLevel === LogLevel.DEBUG) {
  logFeatureFlags(mastraLogger);
}

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

// ============================================================================
// PHASE 1: Agent Registry Initialization
// ============================================================================

/**
 * Initialize Agent Registry (if enabled via feature flag)
 * Registers all agents with their metadata for hierarchical management
 */
if (featureFlags.useAgentRegistry) {
  mastraLogger.info('🔧 Initializing Agent Registry System...');

  // Map of agent instance names to agent instances
  const agentInstances: Record<string, typeof primaryOrchestrator> = {
    'primary-orchestrator': primaryOrchestrator,
    'portal-manager': portalManager,
    'proposal-manager': proposalManager,
    'research-manager': researchManager,
    'portal-scanner': portalScanner,
    'portal-monitor': portalMonitor,
    'content-generator': contentGenerator,
    'compliance-checker': complianceChecker,
    'document-processor': documentProcessor,
    'market-analyst': marketAnalyst,
    'historical-analyzer': historicalAnalyzer,
    'rfp-discovery-agent': rfpDiscoveryAgent,
    'rfp-analysis-agent': rfpAnalysisAgent,
    'rfp-submission-agent': rfpSubmissionAgent,
  };

  // Register all agents with their metadata
  let registeredCount = 0;
  for (const [agentId, metadata] of Object.entries(agentHierarchyConfig)) {
    const agentInstance = agentInstances[agentId];

    if (agentInstance) {
      try {
        agentRegistry.register(agentId, agentInstance, metadata);
        registeredCount++;

        if (featureFlags.verboseRegistryLogging) {
          mastraLogger.debug(`✅ Registered agent: ${agentId} (${metadata.name})`);
        }
      } catch (error) {
        mastraLogger.error(`❌ Failed to register agent ${agentId}:`, error);
      }
    } else {
      mastraLogger.warn(`⚠️  Agent instance not found for ID: ${agentId}`);
    }
  }

  const stats = agentRegistry.getStats();
  mastraLogger.info(
    `✅ Agent Registry initialized: ${registeredCount} agents registered`,
    stats
  );
} else {
  mastraLogger.debug('Agent Registry is disabled (USE_AGENT_REGISTRY=false)');
}

// ============================================================================
// PHASE 2: Agent Pool Initialization
// ============================================================================

/**
 * Initialize Agent Pools (if enabled via feature flag)
 * Creates agent pools for load balancing and auto-scaling
 */
if (featureFlags.useAgentPools) {
  mastraLogger.info('🏊 Initializing Agent Pool Manager...');

  // Import pool manager and bindings
  const { agentPoolManager } = await import('./coordination/agent-pool-manager');
  const { workflowAgentBindings } = await import('./config/workflow-agent-bindings');

  // Create pools from workflow bindings
  let poolsCreated = 0;
  for (const binding of Object.values(workflowAgentBindings)) {
    if (!binding.agentPools) continue;

    for (const poolDef of binding.agentPools) {
      try {
        // Find min/max instances from requiredAgents
        const agentConfigs = poolDef.agentIds.map((agentId) => {
          const agentReq = binding.requiredAgents.find((a) => a.agentId === agentId);
          return {
            agentId,
            minInstances: agentReq?.minInstances || 1,
            maxInstances: agentReq?.maxInstances || 5,
          };
        });

        // Calculate pool size from agent configurations
        const minSize = Math.max(...agentConfigs.map((c) => c.minInstances));
        const maxSize = Math.max(...agentConfigs.map((c) => c.maxInstances));

        // Create pool with auto-scaling configuration
        agentPoolManager.createPool({
          name: poolDef.poolName,
          agentIds: poolDef.agentIds,
          minSize,
          maxSize,
          strategy: poolDef.strategy,
          autoScale: {
            enabled: true,
            scaleUpThreshold: 0.8,
            scaleDownThreshold: 0.3,
            cooldownPeriod: 30000, // 30 seconds
          },
        });

        poolsCreated++;
        if (featureFlags.verboseRegistryLogging) {
          mastraLogger.debug(
            `✅ Created pool: ${poolDef.poolName} (${poolDef.agentIds.join(', ')})`
          );
        }
      } catch (error) {
        mastraLogger.error(`❌ Failed to create pool ${poolDef.poolName}:`, error);
      }
    }
  }

  const poolStats = agentPoolManager.getAllPoolStats();
  mastraLogger.info(`✅ Agent Pools initialized: ${poolsCreated} pools created`, {
    pools: poolStats.map((p) => ({
      name: p.poolName,
      size: p.totalInstances,
      utilization: `${(p.utilization * 100).toFixed(1)}%`,
    })),
  });
} else {
  mastraLogger.debug('Agent Pools are disabled (USE_AGENT_POOLS=false)');
}

// Export registry and pool manager for external use
export { agentRegistry } from './registry/agent-registry';
export { agentPoolManager } from './coordination/agent-pool-manager';
export { agentHierarchyConfig } from './config/agent-hierarchy';
export { workflowAgentBindings } from './config/workflow-agent-bindings';
export { featureFlags } from './config/feature-flags';

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
