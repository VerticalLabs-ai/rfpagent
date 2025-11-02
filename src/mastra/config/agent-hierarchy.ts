import { AgentMetadata } from '../registry/agent-registry';

/**
 * Agent Hierarchy Configuration
 *
 * Defines the complete 3-tier multi-agent hierarchy with metadata for each agent:
 * - Tier 1: Primary Orchestrator (1 agent)
 * - Tier 2: Managers (3 agents)
 * - Tier 3: Specialists (7 agents)
 *
 * Each agent includes:
 * - Role and capabilities
 * - Hierarchical relationships (manages, reportsTo)
 * - Workflow associations (requiredBy)
 * - Scaling configuration for pooling
 */
export const agentHierarchyConfig: Record<string, AgentMetadata> = {
  // ============================================================================
  // TIER 1: ORCHESTRATOR
  // ============================================================================

  'primary-orchestrator': {
    id: 'primary-orchestrator',
    name: 'Primary Orchestrator',
    tier: 1,
    role: 'orchestrator',
    capabilities: [
      'intent-analysis',
      'task-delegation',
      'workflow-coordination',
      'progress-monitoring',
      'multi-agent-orchestration',
      'session-management',
      'result-aggregation',
    ],
    manages: ['portal-manager', 'proposal-manager', 'research-manager'],
    scaling: {
      min: 1,
      max: 1,
      strategy: 'fixed', // Always exactly 1 orchestrator
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Top-level orchestrator coordinating all RFP operations',
    },
  },

  // ============================================================================
  // TIER 2: MANAGERS
  // ============================================================================

  'portal-manager': {
    id: 'portal-manager',
    name: 'Portal Manager',
    tier: 2,
    role: 'manager',
    capabilities: [
      'portal-coordination',
      'scan-orchestration',
      'monitoring-management',
      'authentication-handling',
      'parallel-scanning',
      'portal-health-monitoring',
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['portal-scanner', 'portal-monitor'],
    requiredBy: ['rfpDiscovery', 'masterOrchestration', 'bonfireAuth'],
    scaling: {
      min: 1,
      max: 3,
      strategy: 'demand', // Scale based on number of portals
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Manages portal authentication, RFP discovery, and monitoring',
    },
  },

  'proposal-manager': {
    id: 'proposal-manager',
    name: 'Proposal Manager',
    tier: 2,
    role: 'manager',
    capabilities: [
      'proposal-orchestration',
      'content-coordination',
      'compliance-management',
      'document-assembly',
      'quality-assurance',
      'submission-coordination',
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['content-generator', 'compliance-checker', 'document-processor'],
    requiredBy: ['masterOrchestration', 'proposalPDFAssembly'],
    scaling: {
      min: 1,
      max: 5,
      strategy: 'demand', // Scale based on proposal workload
    },
    metadata: {
      model: 'gpt-5',
      description:
        'Orchestrates proposal generation, compliance, and submissions',
    },
  },

  'research-manager': {
    id: 'research-manager',
    name: 'Research Manager',
    tier: 2,
    role: 'manager',
    capabilities: [
      'research-coordination',
      'market-analysis',
      'competitive-intelligence',
      'historical-pattern-recognition',
      'pricing-strategy',
      'win-probability-assessment',
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['market-analyst', 'historical-analyzer'],
    requiredBy: ['masterOrchestration'],
    scaling: {
      min: 1,
      max: 2,
      strategy: 'auto', // Auto-scale based on research complexity
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Coordinates market research, competitive analysis, and historical data',
    },
  },

  // ============================================================================
  // TIER 3: SPECIALISTS
  // ============================================================================

  // --- Portal Discovery Specialists ---

  'portal-scanner': {
    id: 'portal-scanner',
    name: 'Portal Scanner',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'rfp-discovery',
      'parallel-scanning',
      'portal-navigation',
      'browser-automation',
      'incremental-scanning',
    ],
    reportsTo: 'portal-manager',
    requiredBy: ['rfpDiscovery', 'bonfireAuth'],
    scaling: {
      min: 2,
      max: 10,
      strategy: 'demand', // Scale per portal being scanned
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Automated portal scanning and RFP discovery using browser automation',
    },
  },

  'portal-monitor': {
    id: 'portal-monitor',
    name: 'Portal Monitor',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'health-checking',
      'scan-scheduling',
      'uptime-monitoring',
      'change-detection',
      'alert-generation',
    ],
    reportsTo: 'portal-manager',
    requiredBy: ['rfpDiscovery'],
    scaling: {
      min: 1,
      max: 3,
      strategy: 'auto', // Auto-scale based on number of portals
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Portal health monitoring, scan scheduling, and change detection',
    },
  },

  // --- Proposal Generation Specialists ---

  'content-generator': {
    id: 'content-generator',
    name: 'Content Generator',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'proposal-writing',
      'technical-content',
      'executive-summaries',
      'narrative-generation',
      'section-authoring',
    ],
    reportsTo: 'proposal-manager',
    requiredBy: ['masterOrchestration', 'proposalPDFAssembly'],
    scaling: {
      min: 1,
      max: 8,
      strategy: 'demand', // High parallelization for proposal sections
    },
    metadata: {
      model: 'gpt-5',
      description:
        'Creates high-quality proposal narratives, technical content, and summaries',
    },
  },

  'compliance-checker': {
    id: 'compliance-checker',
    name: 'Compliance Checker',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'requirement-validation',
      'regulatory-compliance',
      'quality-assurance',
      'matrix-generation',
      'gap-analysis',
    ],
    reportsTo: 'proposal-manager',
    requiredBy: ['masterOrchestration', 'proposalPDFAssembly'],
    scaling: {
      min: 1,
      max: 4,
      strategy: 'demand', // Scale based on RFP complexity
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Validates proposal compliance with RFP requirements',
    },
  },

  'document-processor': {
    id: 'document-processor',
    name: 'Document Processor',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'pdf-parsing',
      'text-extraction',
      'multi-format-processing',
      'requirement-extraction',
      'document-analysis',
    ],
    reportsTo: 'proposal-manager',
    requiredBy: ['documentProcessing', 'masterOrchestration'],
    scaling: {
      min: 1,
      max: 6,
      strategy: 'demand', // Scale based on document volume
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Parses RFP documents and extracts structured requirements (95%+ accuracy)',
    },
  },

  // --- Research & Analysis Specialists ---

  'market-analyst': {
    id: 'market-analyst',
    name: 'Market Analyst',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'market-research',
      'competitive-analysis',
      'trend-identification',
      'pricing-analysis',
      'market-positioning',
    ],
    reportsTo: 'research-manager',
    requiredBy: ['masterOrchestration'],
    scaling: {
      min: 1,
      max: 3,
      strategy: 'auto', // Moderate scaling for research tasks
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description:
        'Conducts market research, competitive intelligence, and trend analysis',
    },
  },

  'historical-analyzer': {
    id: 'historical-analyzer',
    name: 'Historical Analyzer',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'pattern-recognition',
      'predictive-analysis',
      'historical-data-mining',
      'win-loss-analysis',
      'bid-strategy-optimization',
    ],
    reportsTo: 'research-manager',
    requiredBy: ['masterOrchestration'],
    scaling: {
      min: 1,
      max: 2,
      strategy: 'auto', // Light scaling for historical analysis
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Analyzes past bid performance and predicts win probability',
    },
  },

  // ============================================================================
  // LEGACY AGENTS (Backward Compatibility)
  // ============================================================================

  'rfp-discovery-agent': {
    id: 'rfp-discovery-agent',
    name: 'RFP Discovery Agent (Legacy)',
    tier: 3,
    role: 'specialist',
    capabilities: ['rfp-discovery', 'legacy-workflow'],
    scaling: {
      min: 0,
      max: 1,
      strategy: 'fixed',
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Legacy RFP discovery agent (use portal-scanner instead)',
      deprecated: true,
    },
  },

  'rfp-analysis-agent': {
    id: 'rfp-analysis-agent',
    name: 'RFP Analysis Agent (Legacy)',
    tier: 3,
    role: 'specialist',
    capabilities: ['rfp-analysis', 'legacy-workflow'],
    scaling: {
      min: 0,
      max: 1,
      strategy: 'fixed',
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Legacy RFP analysis agent (use document-processor instead)',
      deprecated: true,
    },
  },

  'rfp-submission-agent': {
    id: 'rfp-submission-agent',
    name: 'RFP Submission Agent (Legacy)',
    tier: 3,
    role: 'specialist',
    capabilities: ['rfp-submission', 'legacy-workflow'],
    scaling: {
      min: 0,
      max: 1,
      strategy: 'fixed',
    },
    metadata: {
      model: 'claude-sonnet-4.5',
      description: 'Legacy RFP submission agent (use proposal-manager instead)',
      deprecated: true,
    },
  },
};

/**
 * Get all non-deprecated agents
 */
export const getActiveAgents = (): Record<string, AgentMetadata> => {
  return Object.fromEntries(
    Object.entries(agentHierarchyConfig).filter(
      ([_, metadata]) => !metadata.metadata?.deprecated
    )
  );
};

/**
 * Get agents by tier
 */
export const getAgentsByTier = (
  tier: 1 | 2 | 3 | 4 | 5
): Record<string, AgentMetadata> => {
  return Object.fromEntries(
    Object.entries(agentHierarchyConfig).filter(
      ([_, metadata]) =>
        metadata.tier === tier && !metadata.metadata?.deprecated
    )
  );
};

/**
 * Get the orchestrator agent
 */
export const getOrchestrator = (): AgentMetadata => {
  return agentHierarchyConfig['primary-orchestrator'];
};

/**
 * Get all manager agents
 */
export const getManagers = (): Record<string, AgentMetadata> => {
  return getAgentsByTier(2);
};

/**
 * Get all specialist agents
 */
export const getSpecialists = (): Record<string, AgentMetadata> => {
  return getAgentsByTier(3);
};
