import { ConsoleLogger, LogLevel } from '@mastra/core/logger';
import { Mastra } from '@mastra/core/mastra';

// Agent Registry System (Phase 1) - Static imports for Mastra Cloud compatibility
import { agentHierarchyConfig } from './config/agent-hierarchy';
import { featureFlags, logFeatureFlags } from './config/feature-flags';
import { agentRegistry } from './registry/agent-registry';
import { agentPoolManager } from './coordination/agent-pool-manager';
import { workflowAgentBindings } from './config/workflow-agent-bindings';

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
import { rfpMcpServer } from './mcp/server';
import { bonfireAuthWorkflow } from './workflows/bonfire-auth-workflow';
import { documentProcessingWorkflow } from './workflows/document-processing-workflow';
import { masterOrchestrationWorkflow } from './workflows/master-orchestration-workflow';
import { proposalPDFAssemblyWorkflow } from './workflows/proposal-pdf-assembly-workflow';
import { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';

// Tools
import {
  pageActTool,
  pageAuthTool,
  pageExtractTool,
  pageNavigateTool,
  pageObserveTool,
} from './tools';

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
  // Tools Configuration
  tools: {
    pageAct: pageActTool,
    pageAuth: pageAuthTool,
    pageExtract: pageExtractTool,
    pageNavigate: pageNavigateTool,
    pageObserve: pageObserveTool,
  },
  mcpServers: {
    rfp: rfpMcpServer,
  },
  // Bundler Configuration - Minimal externals for Mastra Cloud compatibility
  // Only include runtime dependencies that MUST be external
  bundler: {
    externals: [
      // Browser automation (required at runtime, cannot be bundled)
      '@browserbasehq/stagehand',

      // 1Password SDK (contains WASM binary that cannot be bundled)
      '@1password/sdk',

      // Database (LibSQL not supported in Mastra Cloud serverless environment)
      '@mastra/libsql',
      '@libsql/client',

      // Winston Logger (uses Node.js streams and util.inherits - breaks when bundled)
      'winston',
      'winston-transport',
      'logform',
      'readable-stream',
      'triple-beam',

      // AI SDK packages (complex ESM exports that break when bundled)
      '@ai-sdk/openai',
      '@ai-sdk/anthropic',
      'ai',
      'openai',
    ],
    // Let Mastra Cloud handle all other dependencies
  },
});

// ============================================================================
// INITIALIZATION FUNCTIONS (Deferred for Mastra Cloud Compatibility)
// ============================================================================

/**
 * Initialize Agent Registry System
 * Call this function after mastra instance is created to register agents
 * Separated from module initialization to avoid side effects during Mastra Cloud scanning
 */
export async function initializeAgentRegistry() {
  if (!featureFlags.useAgentRegistry) {
    mastraLogger.debug('Agent Registry is disabled (USE_AGENT_REGISTRY=false)');
    return;
  }

  mastraLogger.info('🔧 Initializing Agent Registry System...');

  // Map of agent instance names to agent instances
  const agentInstances: Record<string, any> = {
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
          mastraLogger.debug(
            `✅ Registered agent: ${agentId} (${metadata.name})`
          );
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
}

/**
 * Initialize Agent Pool Manager
 * Call this function to create agent pools for load balancing
 * Separated from module initialization to avoid side effects during Mastra Cloud scanning
 */
export async function initializeAgentPools() {
  if (!featureFlags.useAgentPools) {
    mastraLogger.debug('Agent Pools are disabled (USE_AGENT_POOLS=false)');
    return;
  }

  mastraLogger.info('🏊 Initializing Agent Pool Manager...');

  // Create pools from workflow bindings
  let poolsCreated = 0;
  for (const binding of Object.values(workflowAgentBindings)) {
    if (!binding.agentPools) continue;

    for (const poolDef of binding.agentPools) {
      try {
        // Find min/max instances from requiredAgents
        const agentConfigs = poolDef.agentIds.map(agentId => {
          const agentReq = binding.requiredAgents.find(
            a => a.agentId === agentId
          );
          return {
            agentId,
            minInstances: agentReq?.minInstances || 1,
            maxInstances: agentReq?.maxInstances || 5,
          };
        });

        // Calculate pool size from agent configurations
        const minSize = Math.max(...agentConfigs.map(c => c.minInstances));
        const maxSize = Math.max(...agentConfigs.map(c => c.maxInstances));

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
        mastraLogger.error(
          `❌ Failed to create pool ${poolDef.poolName}:`,
          error
        );
      }
    }
  }

  const poolStats = agentPoolManager.getAllPoolStats();
  mastraLogger.info(
    `✅ Agent Pools initialized: ${poolsCreated} pools created`,
    {
      pools: poolStats.map(p => ({
        name: p.poolName,
        size: p.totalInstances,
        utilization: `${(p.utilization * 100).toFixed(1)}%`,
      })),
    }
  );
}

/**
 * Initialize complete agent system (registry + pools)
 * Call this once at application startup
 */
export async function initializeAgentSystem() {
  await initializeAgentRegistry();
  await initializeAgentPools();
}

// Export registry and pool manager for external use
export { agentHierarchyConfig } from './config/agent-hierarchy';
export { featureFlags } from './config/feature-flags';
export { workflowAgentBindings } from './config/workflow-agent-bindings';
export { agentPoolManager } from './coordination/agent-pool-manager';
export { agentRegistry } from './registry/agent-registry';

// Export individual workflows for direct use
export { bonfireAuthWorkflow } from './workflows/bonfire-auth-workflow';
export { documentProcessingWorkflow } from './workflows/document-processing-workflow';
export { masterOrchestrationWorkflow } from './workflows/master-orchestration-workflow';
export { proposalPDFAssemblyWorkflow } from './workflows/proposal-pdf-assembly-workflow';
export { rfpDiscoveryWorkflow } from './workflows/rfp-discovery-workflow';

// Export PDF utilities for external use
export {
  assembleProposalPDF,
  fillPDFForm,
  getPDFFormFields,
  mergePDFs,
  parsePDFBuffer,
  parsePDFFile,
} from './utils/pdf-processor';

export type {
  PDFAssemblyOptions,
  PDFFormField,
  PDFParseResult,
  PDFSection,
} from './utils/pdf-processor';
