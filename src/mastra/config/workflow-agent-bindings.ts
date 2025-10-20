/**
 * Workflow-Agent Binding Configuration
 *
 * Declares the agents required by each workflow, including:
 * - Required vs optional agents
 * - Minimum/maximum instances needed
 * - Agent pools for load balancing
 * - Agent dependencies and execution order
 *
 * This enables pre-flight validation and dynamic agent allocation
 */

export interface WorkflowAgentBinding {
  /** Workflow identifier */
  workflowId: string;

  /** Human-readable workflow name */
  name: string;

  /** Agents required by this workflow */
  requiredAgents: {
    /** Agent identifier */
    agentId: string;

    /** Role this agent plays in the workflow */
    role: string;

    /** Is this agent required or optional */
    required: boolean;

    /** Minimum instances needed */
    minInstances?: number;

    /** Maximum instances that can be used */
    maxInstances?: number;
  }[];

  /** Agent pools for load balancing (optional) */
  agentPools?: {
    /** Pool name */
    poolName: string;

    /** Agent IDs in this pool */
    agentIds: string[];

    /** Load balancing strategy */
    strategy: 'round-robin' | 'least-busy' | 'random';
  }[];

  /** Agent dependencies and execution order */
  dependencies: {
    /** Source agent ID */
    from: string;

    /** Target agent ID */
    to: string;

    /** Dependency type */
    type: 'sequential' | 'parallel' | 'conditional';
  }[];
}

/**
 * Master Orchestration Workflow
 * Full end-to-end RFP pipeline: discovery → analysis → proposal → submission
 */
export const masterOrchestrationBinding: WorkflowAgentBinding = {
  workflowId: 'masterOrchestration',
  name: 'Master Orchestration Workflow',
  requiredAgents: [
    {
      agentId: 'primary-orchestrator',
      role: 'Coordinates entire workflow execution across all phases',
      required: true,
      minInstances: 1,
      maxInstances: 1,
    },
    {
      agentId: 'portal-manager',
      role: 'Discovery phase - orchestrates RFP portal scanning',
      required: true,
      minInstances: 1,
      maxInstances: 3,
    },
    {
      agentId: 'portal-scanner',
      role: 'Scans portals in parallel to discover RFPs',
      required: true,
      minInstances: 2,
      maxInstances: 10,
    },
    {
      agentId: 'document-processor',
      role: 'Parses and extracts requirements from RFP documents',
      required: true,
      minInstances: 1,
      maxInstances: 6,
    },
    {
      agentId: 'proposal-manager',
      role: 'Proposal phase - orchestrates content generation and compliance',
      required: true,
      minInstances: 1,
      maxInstances: 5,
    },
    {
      agentId: 'content-generator',
      role: 'Generates proposal content sections in parallel',
      required: true,
      minInstances: 1,
      maxInstances: 8,
    },
    {
      agentId: 'compliance-checker',
      role: 'Validates proposal compliance with RFP requirements',
      required: true,
      minInstances: 1,
      maxInstances: 4,
    },
    {
      agentId: 'research-manager',
      role: 'Research phase - coordinates market analysis and competitive intelligence',
      required: false, // Optional for simple proposals
      minInstances: 1,
      maxInstances: 2,
    },
    {
      agentId: 'market-analyst',
      role: 'Conducts market research and competitive analysis',
      required: false,
      minInstances: 1,
      maxInstances: 3,
    },
    {
      agentId: 'historical-analyzer',
      role: 'Analyzes historical bid data to predict win probability',
      required: false,
      minInstances: 1,
      maxInstances: 2,
    },
  ],
  agentPools: [
    {
      poolName: 'proposal-workers',
      agentIds: ['content-generator', 'compliance-checker'],
      strategy: 'least-busy', // Use least busy agent for proposal work
    },
    {
      poolName: 'discovery-workers',
      agentIds: ['portal-scanner'],
      strategy: 'round-robin', // Distribute portal scanning evenly
    },
    {
      poolName: 'research-workers',
      agentIds: ['market-analyst', 'historical-analyzer'],
      strategy: 'least-busy',
    },
  ],
  dependencies: [
    // Discovery → Document Processing (sequential)
    {
      from: 'portal-manager',
      to: 'document-processor',
      type: 'sequential',
    },
    // Document Processing → Proposal Generation (sequential)
    {
      from: 'document-processor',
      to: 'proposal-manager',
      type: 'sequential',
    },
    // Proposal Manager → Content Generation (parallel)
    {
      from: 'proposal-manager',
      to: 'content-generator',
      type: 'parallel',
    },
    // Proposal Manager → Compliance Checking (parallel)
    {
      from: 'proposal-manager',
      to: 'compliance-checker',
      type: 'parallel',
    },
    // Research can run in parallel with discovery
    {
      from: 'primary-orchestrator',
      to: 'research-manager',
      type: 'parallel',
    },
  ],
};

/**
 * RFP Discovery Workflow
 * Discovers new RFPs from multiple portals in parallel
 */
export const rfpDiscoveryBinding: WorkflowAgentBinding = {
  workflowId: 'rfpDiscovery',
  name: 'RFP Discovery Workflow',
  requiredAgents: [
    {
      agentId: 'portal-manager',
      role: 'Orchestrates portal scanning and authentication',
      required: true,
      minInstances: 1,
      maxInstances: 3,
    },
    {
      agentId: 'portal-scanner',
      role: 'Scans individual portals for new RFPs',
      required: true,
      minInstances: 2,
      maxInstances: 10,
    },
    {
      agentId: 'portal-monitor',
      role: 'Monitors portal health and schedules scans',
      required: true,
      minInstances: 1,
      maxInstances: 3,
    },
  ],
  agentPools: [
    {
      poolName: 'scanner-pool',
      agentIds: ['portal-scanner'],
      strategy: 'round-robin',
    },
  ],
  dependencies: [
    // Portal Manager → Scanner (parallel for multiple portals)
    {
      from: 'portal-manager',
      to: 'portal-scanner',
      type: 'parallel',
    },
    // Portal Manager → Monitor (parallel)
    {
      from: 'portal-manager',
      to: 'portal-monitor',
      type: 'parallel',
    },
  ],
};

/**
 * Document Processing Workflow
 * Extracts and analyzes RFP documents
 */
export const documentProcessingBinding: WorkflowAgentBinding = {
  workflowId: 'documentProcessing',
  name: 'Document Processing Workflow',
  requiredAgents: [
    {
      agentId: 'document-processor',
      role: 'Parses RFP documents and extracts structured requirements',
      required: true,
      minInstances: 1,
      maxInstances: 6,
    },
    {
      agentId: 'compliance-checker',
      role: 'Validates extracted requirements for completeness',
      required: false, // Optional validation step
      minInstances: 1,
      maxInstances: 4,
    },
  ],
  agentPools: [
    {
      poolName: 'processor-pool',
      agentIds: ['document-processor'],
      strategy: 'least-busy',
    },
  ],
  dependencies: [
    // Document Processing → Compliance Checking (sequential)
    {
      from: 'document-processor',
      to: 'compliance-checker',
      type: 'sequential',
    },
  ],
};

/**
 * Proposal PDF Assembly Workflow
 * Assembles final proposal PDFs with all sections
 */
export const proposalPDFAssemblyBinding: WorkflowAgentBinding = {
  workflowId: 'proposalPDFAssembly',
  name: 'Proposal PDF Assembly Workflow',
  requiredAgents: [
    {
      agentId: 'proposal-manager',
      role: 'Coordinates PDF assembly and quality checks',
      required: true,
      minInstances: 1,
      maxInstances: 5,
    },
    {
      agentId: 'content-generator',
      role: 'Generates final content sections and formatting',
      required: true,
      minInstances: 1,
      maxInstances: 8,
    },
    {
      agentId: 'compliance-checker',
      role: 'Final compliance validation before PDF generation',
      required: true,
      minInstances: 1,
      maxInstances: 4,
    },
  ],
  dependencies: [
    // Content Generation → Compliance Checking (sequential)
    {
      from: 'content-generator',
      to: 'compliance-checker',
      type: 'sequential',
    },
    // Compliance Checking → Proposal Manager (sequential)
    {
      from: 'compliance-checker',
      to: 'proposal-manager',
      type: 'sequential',
    },
  ],
};

/**
 * Bonfire Authentication Workflow
 * Handles complex BonfireHub authentication with 2FA
 */
export const bonfireAuthBinding: WorkflowAgentBinding = {
  workflowId: 'bonfireAuth',
  name: 'Bonfire Authentication Workflow',
  requiredAgents: [
    {
      agentId: 'portal-manager',
      role: 'Manages authentication state and caching',
      required: true,
      minInstances: 1,
      maxInstances: 3,
    },
    {
      agentId: 'portal-scanner',
      role: 'Executes browser automation for authentication flow',
      required: true,
      minInstances: 1,
      maxInstances: 5,
    },
  ],
  dependencies: [
    // Portal Manager → Portal Scanner (sequential)
    {
      from: 'portal-manager',
      to: 'portal-scanner',
      type: 'sequential',
    },
  ],
};

/**
 * All workflow bindings indexed by workflow ID
 */
export const workflowAgentBindings: Record<string, WorkflowAgentBinding> = {
  masterOrchestration: masterOrchestrationBinding,
  rfpDiscovery: rfpDiscoveryBinding,
  documentProcessing: documentProcessingBinding,
  proposalPDFAssembly: proposalPDFAssemblyBinding,
  bonfireAuth: bonfireAuthBinding,
};

/**
 * Get all workflow IDs
 */
export const getWorkflowIds = (): string[] => {
  return Object.keys(workflowAgentBindings);
};

/**
 * Get workflow binding by ID
 */
export const getWorkflowBinding = (
  workflowId: string
): WorkflowAgentBinding | undefined => {
  return workflowAgentBindings[workflowId];
};

/**
 * Get all agents required by a specific workflow
 */
export const getWorkflowRequiredAgents = (workflowId: string): string[] => {
  const binding = workflowAgentBindings[workflowId];
  if (!binding) return [];

  return binding.requiredAgents
    .filter(req => req.required)
    .map(req => req.agentId);
};

/**
 * Get all agents (required + optional) used by a workflow
 */
export const getWorkflowAllAgents = (workflowId: string): string[] => {
  const binding = workflowAgentBindings[workflowId];
  if (!binding) return [];

  return binding.requiredAgents.map(req => req.agentId);
};
