# Mastra Multi-Tier Agent Architecture Upgrade Plan

**Date**: 2025-10-20
**Status**: Planning Phase
**Codebase**: Indexed and Analyzed via Code Graph Context

---

## Executive Summary

This plan addresses the architectural gaps in the current Mastra agent system, specifically the **loose coupling between agents and workflows**. While the system implements a solid 3-tier hierarchy (Orchestrator → Managers → Specialists), agents and workflows are connected only through runtime tool calls rather than explicit, declarative relationships.

### Key Issues Identified

1. ❌ **No Declarative Agent-Workflow Bindings**: Workflows don't explicitly declare required agents
2. ❌ **Tool-Based Coordination Only**: Agent relationships exist only through `delegateToManager` tool calls
3. ❌ **No Agent Registry Pattern**: Manual agent discovery instead of centralized registry
4. ❌ **Missing Workflow-Agent Contracts**: No validation that required agents are available before workflow execution
5. ❌ **Limited Agent Pooling**: Cannot scale agents dynamically based on workload
6. ❌ **No Sub-Agent Patterns**: Specialists can't have their own sub-specialists
7. ❌ **Implicit Dependencies**: Agent dependencies are buried in code, not visible in config

---

## Current Architecture Analysis

### ✅ What's Working Well

**3-Tier Hierarchy** (Production-Ready)

```
Tier 1: Primary Orchestrator (1 agent)
  └─ Claude Sonnet 4.5
  └─ Tools: delegateToManager, checkTaskStatus, createCoordinatedWorkflow

Tier 2: Managers (3 agents)
  ├─ Portal Manager (portal discovery & monitoring)
  ├─ Proposal Manager (GPT-5 - proposal generation)
  └─ Research Manager (market & competitive analysis)

Tier 3: Specialists (7 agents)
  ├─ Portal Scanner, Portal Monitor
  ├─ Content Generator (GPT-5), Compliance Checker
  ├─ Document Processor (95%+ accuracy)
  └─ Market Analyst, Historical Analyzer
```

**Coordination Mechanisms**

- 7 core coordination tools (`delegateToManager`, `requestSpecialist`, etc.)
- Shared memory system with credential sanitization
- Cross-agent messaging
- Task status tracking (pending → running → completed)

**Multi-Model Strategy**

- GPT-5: Creative tasks (proposals, content)
- Claude Sonnet 4.5: Analytical/coordination
- Claude Opus 4.1: Maximum reasoning
- GPT-4.1 Nano: Security guardrails

**5 Active Workflows**

1. Master Orchestration (end-to-end pipeline)
2. RFP Discovery (parallel portal scanning)
3. Document Processing (multi-format parsing)
4. Bonfire Authentication (2FA with state caching)
5. Proposal PDF Assembly (final formatting)

### ❌ What's Missing

**Agent-Workflow Integration** (`src/mastra/index.ts:49-82`)

```typescript
// Current: Flat lists with no relationships
export const mastra = new Mastra({
  agents: {
    primaryOrchestrator,
    portalManager,
    proposalManager,
    // ... no relationship metadata
  },
  workflows: {
    masterOrchestration,
    rfpDiscovery,
    // ... no agent requirements declared
  },
});
```

**Workflow Structure** (`src/mastra/workflows/master-orchestration-workflow.ts:1-30`)

```typescript
// Current: No agent bindings
export const masterOrchestrationWorkflow = createWorkflow({
  // Missing:
  // - requiredAgents: []
  // - agentRoles: {}
  // - agentPools: {}
  // - dependencies: []
});
```

---

## Proposed Architecture Enhancements

### 1. Agent Registry Pattern

**Create**: `src/mastra/registry/agent-registry.ts`

```typescript
import { Agent } from '@mastra/core/agent';

export interface AgentMetadata {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  role: 'orchestrator' | 'manager' | 'specialist';
  capabilities: string[];
  requiredBy?: string[]; // workflow IDs
  manages?: string[]; // agent IDs (for managers)
  reportsTo?: string; // parent agent ID
  scaling?: {
    min: number;
    max: number;
    strategy: 'fixed' | 'auto' | 'demand';
  };
  health?: {
    status: 'active' | 'idle' | 'busy' | 'failed';
    lastSeen?: Date;
    taskCount?: number;
  };
}

export class AgentRegistry {
  private agents = new Map<string, { agent: Agent; metadata: AgentMetadata }>();

  register(agentId: string, agent: Agent, metadata: AgentMetadata) {
    this.agents.set(agentId, { agent, metadata });
  }

  getAgent(agentId: string): Agent | undefined {
    return this.agents.get(agentId)?.agent;
  }

  getMetadata(agentId: string): AgentMetadata | undefined {
    return this.agents.get(agentId)?.metadata;
  }

  getAgentsByTier(tier: 1 | 2 | 3): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.tier === tier)
      .map(({ agent }) => agent);
  }

  getAgentsByRole(role: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.role === role)
      .map(({ agent }) => agent);
  }

  getManagedAgents(managerId: string): Agent[] {
    const manager = this.agents.get(managerId);
    if (!manager?.metadata.manages) return [];

    return manager.metadata.manages
      .map(id => this.agents.get(id)?.agent)
      .filter(Boolean) as Agent[];
  }

  getWorkflowAgents(workflowId: string): Agent[] {
    return Array.from(this.agents.values())
      .filter(({ metadata }) => metadata.requiredBy?.includes(workflowId))
      .map(({ agent }) => agent);
  }

  validateWorkflowAgents(
    workflowId: string,
    requiredAgents: string[]
  ): {
    valid: boolean;
    missing: string[];
  } {
    const missing = requiredAgents.filter(id => !this.agents.has(id));
    return { valid: missing.length === 0, missing };
  }
}

export const agentRegistry = new AgentRegistry();
```

### 2. Enhanced Agent Configuration

**Update**: `src/mastra/config/agent-hierarchy.ts` (new file)

```typescript
import { AgentMetadata } from '../registry/agent-registry';

export const agentHierarchyConfig: Record<string, AgentMetadata> = {
  // Tier 1: Orchestrator
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
    ],
    manages: ['portal-manager', 'proposal-manager', 'research-manager'],
    scaling: { min: 1, max: 1, strategy: 'fixed' },
  },

  // Tier 2: Managers
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
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['portal-scanner', 'portal-monitor'],
    requiredBy: ['rfpDiscovery', 'masterOrchestration'],
    scaling: { min: 1, max: 3, strategy: 'demand' },
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
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['content-generator', 'compliance-checker', 'document-processor'],
    requiredBy: ['masterOrchestration', 'proposalPDFAssembly'],
    scaling: { min: 1, max: 5, strategy: 'demand' },
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
    ],
    reportsTo: 'primary-orchestrator',
    manages: ['market-analyst', 'historical-analyzer'],
    requiredBy: ['masterOrchestration'],
    scaling: { min: 1, max: 2, strategy: 'auto' },
  },

  // Tier 3: Specialists
  'portal-scanner': {
    id: 'portal-scanner',
    name: 'Portal Scanner',
    tier: 3,
    role: 'specialist',
    capabilities: ['rfp-discovery', 'parallel-scanning', 'portal-navigation'],
    reportsTo: 'portal-manager',
    requiredBy: ['rfpDiscovery'],
    scaling: { min: 2, max: 10, strategy: 'demand' },
  },

  'portal-monitor': {
    id: 'portal-monitor',
    name: 'Portal Monitor',
    tier: 3,
    role: 'specialist',
    capabilities: ['health-checking', 'scan-scheduling', 'uptime-monitoring'],
    reportsTo: 'portal-manager',
    requiredBy: ['rfpDiscovery'],
    scaling: { min: 1, max: 3, strategy: 'auto' },
  },

  'content-generator': {
    id: 'content-generator',
    name: 'Content Generator',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'proposal-writing',
      'technical-content',
      'executive-summaries',
    ],
    reportsTo: 'proposal-manager',
    requiredBy: ['masterOrchestration', 'proposalPDFAssembly'],
    scaling: { min: 1, max: 8, strategy: 'demand' },
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
    ],
    reportsTo: 'proposal-manager',
    requiredBy: ['masterOrchestration'],
    scaling: { min: 1, max: 4, strategy: 'demand' },
  },

  'document-processor': {
    id: 'document-processor',
    name: 'Document Processor',
    tier: 3,
    role: 'specialist',
    capabilities: ['pdf-parsing', 'text-extraction', 'multi-format-processing'],
    reportsTo: 'proposal-manager',
    requiredBy: ['documentProcessing', 'masterOrchestration'],
    scaling: { min: 1, max: 6, strategy: 'demand' },
  },

  'market-analyst': {
    id: 'market-analyst',
    name: 'Market Analyst',
    tier: 3,
    role: 'specialist',
    capabilities: [
      'market-research',
      'competitive-analysis',
      'trend-identification',
    ],
    reportsTo: 'research-manager',
    requiredBy: ['masterOrchestration'],
    scaling: { min: 1, max: 3, strategy: 'auto' },
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
    ],
    reportsTo: 'research-manager',
    requiredBy: ['masterOrchestration'],
    scaling: { min: 1, max: 2, strategy: 'auto' },
  },
};
```

### 3. Workflow-Agent Binding System

**Create**: `src/mastra/config/workflow-agent-bindings.ts`

```typescript
export interface WorkflowAgentBinding {
  workflowId: string;
  name: string;
  requiredAgents: {
    agentId: string;
    role: string; // What the agent does in this workflow
    required: boolean;
    minInstances?: number;
    maxInstances?: number;
  }[];
  agentPools?: {
    poolName: string;
    agentIds: string[];
    strategy: 'round-robin' | 'least-busy' | 'random';
  }[];
  dependencies: {
    from: string; // agent ID
    to: string; // agent ID
    type: 'sequential' | 'parallel' | 'conditional';
  }[];
}

export const workflowAgentBindings: Record<string, WorkflowAgentBinding> = {
  masterOrchestration: {
    workflowId: 'masterOrchestration',
    name: 'Master Orchestration Workflow',
    requiredAgents: [
      {
        agentId: 'primary-orchestrator',
        role: 'Coordinates entire workflow execution',
        required: true,
        minInstances: 1,
        maxInstances: 1,
      },
      {
        agentId: 'portal-manager',
        role: 'Discovery phase - RFP portal scanning',
        required: true,
        minInstances: 1,
        maxInstances: 3,
      },
      {
        agentId: 'proposal-manager',
        role: 'Proposal phase - Content generation',
        required: true,
        minInstances: 1,
        maxInstances: 5,
      },
      {
        agentId: 'research-manager',
        role: 'Research phase - Market analysis',
        required: true,
        minInstances: 1,
        maxInstances: 2,
      },
      {
        agentId: 'document-processor',
        role: 'RFP document parsing and extraction',
        required: true,
        minInstances: 1,
        maxInstances: 6,
      },
      {
        agentId: 'content-generator',
        role: 'Proposal content writing',
        required: true,
        minInstances: 1,
        maxInstances: 8,
      },
    ],
    agentPools: [
      {
        poolName: 'proposal-workers',
        agentIds: ['content-generator', 'compliance-checker'],
        strategy: 'least-busy',
      },
      {
        poolName: 'discovery-workers',
        agentIds: ['portal-scanner', 'portal-monitor'],
        strategy: 'round-robin',
      },
    ],
    dependencies: [
      {
        from: 'portal-manager',
        to: 'document-processor',
        type: 'sequential',
      },
      {
        from: 'document-processor',
        to: 'proposal-manager',
        type: 'sequential',
      },
      {
        from: 'proposal-manager',
        to: 'content-generator',
        type: 'parallel',
      },
      {
        from: 'proposal-manager',
        to: 'compliance-checker',
        type: 'parallel',
      },
    ],
  },

  rfpDiscovery: {
    workflowId: 'rfpDiscovery',
    name: 'RFP Discovery Workflow',
    requiredAgents: [
      {
        agentId: 'portal-manager',
        role: 'Orchestrates portal scanning',
        required: true,
        minInstances: 1,
        maxInstances: 3,
      },
      {
        agentId: 'portal-scanner',
        role: 'Scans portals for new RFPs',
        required: true,
        minInstances: 2,
        maxInstances: 10,
      },
      {
        agentId: 'portal-monitor',
        role: 'Monitors portal health',
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
      {
        from: 'portal-manager',
        to: 'portal-scanner',
        type: 'parallel',
      },
      {
        from: 'portal-manager',
        to: 'portal-monitor',
        type: 'parallel',
      },
    ],
  },

  documentProcessing: {
    workflowId: 'documentProcessing',
    name: 'Document Processing Workflow',
    requiredAgents: [
      {
        agentId: 'document-processor',
        role: 'Parses and extracts RFP content',
        required: true,
        minInstances: 1,
        maxInstances: 6,
      },
      {
        agentId: 'compliance-checker',
        role: 'Validates extracted requirements',
        required: false,
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
      {
        from: 'document-processor',
        to: 'compliance-checker',
        type: 'sequential',
      },
    ],
  },

  proposalPDFAssembly: {
    workflowId: 'proposalPDFAssembly',
    name: 'Proposal PDF Assembly Workflow',
    requiredAgents: [
      {
        agentId: 'proposal-manager',
        role: 'Coordinates PDF assembly',
        required: true,
        minInstances: 1,
        maxInstances: 5,
      },
      {
        agentId: 'content-generator',
        role: 'Generates final content sections',
        required: true,
        minInstances: 1,
        maxInstances: 8,
      },
      {
        agentId: 'compliance-checker',
        role: 'Final compliance validation',
        required: true,
        minInstances: 1,
        maxInstances: 4,
      },
    ],
    dependencies: [
      {
        from: 'content-generator',
        to: 'compliance-checker',
        type: 'sequential',
      },
      {
        from: 'compliance-checker',
        to: 'proposal-manager',
        type: 'sequential',
      },
    ],
  },

  bonfireAuth: {
    workflowId: 'bonfireAuth',
    name: 'Bonfire Authentication Workflow',
    requiredAgents: [
      {
        agentId: 'portal-manager',
        role: 'Manages authentication state',
        required: true,
        minInstances: 1,
        maxInstances: 3,
      },
      {
        agentId: 'portal-scanner',
        role: 'Executes authentication flow',
        required: true,
        minInstances: 1,
        maxInstances: 5,
      },
    ],
    dependencies: [
      {
        from: 'portal-manager',
        to: 'portal-scanner',
        type: 'sequential',
      },
    ],
  },
};
```

### 4. Agent Pool Manager

**Create**: `src/mastra/coordination/agent-pool-manager.ts`

```typescript
import { Agent } from '@mastra/core/agent';
import { agentRegistry } from '../registry/agent-registry';

export interface PooledAgent {
  agent: Agent;
  status: 'idle' | 'busy' | 'failed';
  currentTask?: string;
  taskCount: number;
  lastUsed: Date;
}

export class AgentPoolManager {
  private pools = new Map<string, PooledAgent[]>();

  createPool(poolName: string, agentIds: string[], initialSize: number = 1) {
    const pooledAgents: PooledAgent[] = [];

    for (let i = 0; i < initialSize; i++) {
      for (const agentId of agentIds) {
        const agent = agentRegistry.getAgent(agentId);
        if (agent) {
          pooledAgents.push({
            agent,
            status: 'idle',
            taskCount: 0,
            lastUsed: new Date(),
          });
        }
      }
    }

    this.pools.set(poolName, pooledAgents);
  }

  getAgent(
    poolName: string,
    strategy: 'round-robin' | 'least-busy' | 'random'
  ): Agent | null {
    const pool = this.pools.get(poolName);
    if (!pool || pool.length === 0) return null;

    const idleAgents = pool.filter(pa => pa.status === 'idle');
    if (idleAgents.length === 0) return null;

    let selectedAgent: PooledAgent;

    switch (strategy) {
      case 'least-busy':
        selectedAgent = idleAgents.reduce((prev, curr) =>
          prev.taskCount < curr.taskCount ? prev : curr
        );
        break;

      case 'random':
        selectedAgent =
          idleAgents[Math.floor(Math.random() * idleAgents.length)];
        break;

      case 'round-robin':
      default:
        selectedAgent = idleAgents.sort(
          (a, b) => a.lastUsed.getTime() - b.lastUsed.getTime()
        )[0];
        break;
    }

    selectedAgent.status = 'busy';
    selectedAgent.taskCount++;
    selectedAgent.lastUsed = new Date();

    return selectedAgent.agent;
  }

  releaseAgent(poolName: string, agent: Agent) {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const pooledAgent = pool.find(pa => pa.agent === agent);
    if (pooledAgent) {
      pooledAgent.status = 'idle';
      pooledAgent.currentTask = undefined;
    }
  }

  scalePool(poolName: string, targetSize: number) {
    const pool = this.pools.get(poolName);
    if (!pool) return;

    const currentSize = pool.length;
    if (currentSize === targetSize) return;

    if (targetSize > currentSize) {
      // Scale up - clone existing agents
      const agentsToAdd = targetSize - currentSize;
      for (let i = 0; i < agentsToAdd; i++) {
        const template = pool[i % pool.length];
        pool.push({
          ...template,
          status: 'idle',
          taskCount: 0,
          lastUsed: new Date(),
        });
      }
    } else {
      // Scale down - remove idle agents
      const idleAgents = pool.filter(pa => pa.status === 'idle');
      const agentsToRemove = currentSize - targetSize;
      for (let i = 0; i < agentsToRemove && i < idleAgents.length; i++) {
        const index = pool.indexOf(idleAgents[i]);
        if (index !== -1) pool.splice(index, 1);
      }
    }
  }

  getPoolStatus(poolName: string) {
    const pool = this.pools.get(poolName);
    if (!pool) return null;

    return {
      poolName,
      totalAgents: pool.length,
      idleAgents: pool.filter(pa => pa.status === 'idle').length,
      busyAgents: pool.filter(pa => pa.status === 'busy').length,
      failedAgents: pool.filter(pa => pa.status === 'failed').length,
      totalTasks: pool.reduce((sum, pa) => sum + pa.taskCount, 0),
    };
  }
}

export const agentPoolManager = new AgentPoolManager();
```

### 5. Workflow Validator

**Create**: `src/mastra/validation/workflow-validator.ts`

```typescript
import { agentRegistry } from '../registry/agent-registry';
import {
  workflowAgentBindings,
  WorkflowAgentBinding,
} from '../config/workflow-agent-bindings';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  agentStatus: {
    agentId: string;
    available: boolean;
    instances: number;
    requiredMin: number;
    requiredMax: number;
  }[];
}

export class WorkflowValidator {
  validateWorkflow(workflowId: string): ValidationResult {
    const binding = workflowAgentBindings[workflowId];
    if (!binding) {
      return {
        valid: false,
        errors: [`No binding configuration found for workflow: ${workflowId}`],
        warnings: [],
        agentStatus: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const agentStatus: ValidationResult['agentStatus'] = [];

    // Validate required agents exist
    for (const reqAgent of binding.requiredAgents) {
      const agent = agentRegistry.getAgent(reqAgent.agentId);
      const metadata = agentRegistry.getMetadata(reqAgent.agentId);

      if (!agent && reqAgent.required) {
        errors.push(`Required agent not found: ${reqAgent.agentId}`);
      } else if (!agent && !reqAgent.required) {
        warnings.push(`Optional agent not found: ${reqAgent.agentId}`);
      }

      agentStatus.push({
        agentId: reqAgent.agentId,
        available: !!agent,
        instances: 1, // TODO: Get actual instance count from pool
        requiredMin: reqAgent.minInstances || 1,
        requiredMax: reqAgent.maxInstances || 1,
      });
    }

    // Validate agent pools
    if (binding.agentPools) {
      for (const pool of binding.agentPools) {
        for (const agentId of pool.agentIds) {
          const agent = agentRegistry.getAgent(agentId);
          if (!agent) {
            warnings.push(
              `Agent ${agentId} in pool ${pool.poolName} not found`
            );
          }
        }
      }
    }

    // Validate dependencies
    if (binding.dependencies) {
      for (const dep of binding.dependencies) {
        const fromAgent = agentRegistry.getAgent(dep.from);
        const toAgent = agentRegistry.getAgent(dep.to);

        if (!fromAgent) {
          errors.push(`Dependency source agent not found: ${dep.from}`);
        }
        if (!toAgent) {
          errors.push(`Dependency target agent not found: ${dep.to}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      agentStatus,
    };
  }

  validateAllWorkflows(): Record<string, ValidationResult> {
    const results: Record<string, ValidationResult> = {};

    for (const workflowId of Object.keys(workflowAgentBindings)) {
      results[workflowId] = this.validateWorkflow(workflowId);
    }

    return results;
  }

  getWorkflowHealth(workflowId: string): {
    healthy: boolean;
    readinessScore: number;
    issues: string[];
  } {
    const validation = this.validateWorkflow(workflowId);

    const readinessScore =
      validation.agentStatus.reduce((score, status) => {
        if (!status.available) return score;
        const hasMinInstances = status.instances >= status.requiredMin;
        return score + (hasMinInstances ? 1 : 0.5);
      }, 0) / Math.max(validation.agentStatus.length, 1);

    return {
      healthy: validation.valid && readinessScore >= 0.8,
      readinessScore,
      issues: [...validation.errors, ...validation.warnings],
    };
  }
}

export const workflowValidator = new WorkflowValidator();
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)

**Goal**: Establish registry and configuration system

**Tasks**:

1. Create `AgentRegistry` class (`src/mastra/registry/agent-registry.ts`)
2. Create `agentHierarchyConfig` (`src/mastra/config/agent-hierarchy.ts`)
3. Create `workflowAgentBindings` (`src/mastra/config/workflow-agent-bindings.ts`)
4. Update `src/mastra/index.ts` to register all agents
5. Write unit tests for registry

**Files to Create**:

- `src/mastra/registry/agent-registry.ts`
- `src/mastra/config/agent-hierarchy.ts`
- `src/mastra/config/workflow-agent-bindings.ts`
- `src/mastra/tests/registry.test.ts`

**Files to Modify**:

- `src/mastra/index.ts` - Add registry initialization

**Success Criteria**:

- ✅ All 14 agents registered with metadata
- ✅ All 5 workflows have agent bindings
- ✅ Registry queries work (by tier, role, workflow)
- ✅ Tests pass with 90%+ coverage

---

### Phase 2: Agent Pools (Week 2)

**Goal**: Implement dynamic agent pooling

**Tasks**:

1. Create `AgentPoolManager` class (`src/mastra/coordination/agent-pool-manager.ts`)
2. Implement pool strategies (round-robin, least-busy, random)
3. Add auto-scaling logic based on demand
4. Integrate with existing workflows
5. Add monitoring and metrics

**Files to Create**:

- `src/mastra/coordination/agent-pool-manager.ts`
- `src/mastra/tests/agent-pool.test.ts`

**Files to Modify**:

- `src/mastra/workflows/master-orchestration-workflow.ts`
- `src/mastra/workflows/rfp-discovery-workflow.ts`
- `server/services/orchestrators/proposalGenerationOrchestrator.ts`

**Success Criteria**:

- ✅ Pools can scale 1-10 instances per agent type
- ✅ Load balancing distributes work evenly
- ✅ Failed agents automatically replaced
- ✅ 30%+ improvement in parallel task throughput

---

### Phase 3: Workflow Validation (Week 3)

**Goal**: Add pre-flight workflow validation

**Tasks**:

1. Create `WorkflowValidator` class (`src/mastra/validation/workflow-validator.ts`)
2. Implement validation logic for agent availability
3. Add dependency graph validation
4. Create workflow health scoring
5. Integrate with workflow execution

**Files to Create**:

- `src/mastra/validation/workflow-validator.ts`
- `src/mastra/tests/workflow-validation.test.ts`

**Files to Modify**:

- `src/mastra/workflows/*.ts` - Add validation calls
- `server/routes/workflows.routes.ts` - Expose validation endpoints

**Success Criteria**:

- ✅ Workflows validate before execution
- ✅ Missing agents detected early
- ✅ Health scoring 0.0-1.0 implemented
- ✅ Zero runtime agent-not-found errors

---

### Phase 4: Enhanced Coordination (Week 4)

**Goal**: Upgrade agent coordination patterns

**Tasks**:

1. Enhance `delegateToManager` tool with pool support
2. Add `requestAgentFromPool` coordination tool
3. Implement agent capability matching
4. Add workflow-agent contract enforcement
5. Create agent dependency resolver

**Files to Create**:

- `src/mastra/coordination/capability-matcher.ts`
- `src/mastra/coordination/dependency-resolver.ts`

**Files to Modify**:

- `src/mastra/tools/agent-coordination-tools.ts`
- `src/mastra/agents/primary-orchestrator.ts`
- `src/mastra/agents/portal-manager.ts`
- `src/mastra/agents/proposal-manager.ts`
- `src/mastra/agents/research-manager.ts`

**Success Criteria**:

- ✅ Agents can request specialists from pools
- ✅ Capability-based agent selection working
- ✅ Dependency resolution automatic
- ✅ 40%+ reduction in coordination overhead

---

### Phase 5: Sub-Agent Patterns (Week 5)

**Goal**: Enable specialists to have sub-specialists

**Tasks**:

1. Extend agent hierarchy to support 4+ tiers
2. Add sub-agent spawning capabilities
3. Implement sub-agent lifecycle management
4. Create example sub-specialists (e.g., PDF Parser, Table Extractor under Document Processor)
5. Update registry for multi-tier hierarchy

**Files to Create**:

- `src/mastra/agents/specialists/pdf-parser.ts` (Tier 4 example)
- `src/mastra/agents/specialists/table-extractor.ts` (Tier 4 example)
- `src/mastra/coordination/sub-agent-manager.ts`

**Files to Modify**:

- `src/mastra/config/agent-hierarchy.ts` - Add tier 4
- `src/mastra/registry/agent-registry.ts` - Support N-tier hierarchy
- `src/mastra/agents/document-processor.ts` - Use sub-specialists

**Success Criteria**:

- ✅ 4-tier hierarchy working (Orchestrator → Manager → Specialist → Sub-Specialist)
- ✅ Document Processor delegates to PDF Parser and Table Extractor
- ✅ Sub-agents can be pooled independently
- ✅ No circular dependencies

---

### Phase 6: Monitoring & Observability (Week 6)

**Goal**: Add comprehensive agent-workflow monitoring

**Tasks**:

1. Create agent health dashboard
2. Add workflow execution tracing
3. Implement agent performance metrics
4. Create alerting for failed agents
5. Add workflow readiness checks

**Files to Create**:

- `src/mastra/monitoring/agent-health-monitor.ts`
- `src/mastra/monitoring/workflow-tracer.ts`
- `client/src/pages/AgentDashboard.tsx`
- `server/routes/monitoring.routes.ts`

**Files to Modify**:

- `server/services/agents/agentMonitoringService.ts`
- `client/src/App.tsx` - Add dashboard route

**Success Criteria**:

- ✅ Real-time agent status visible in UI
- ✅ Workflow execution traces captured
- ✅ Failed agent alerts sent
- ✅ Performance bottlenecks identified

---

## Migration Strategy

### Backward Compatibility

**Approach**: Incremental adoption with feature flags

```typescript
// src/mastra/config/feature-flags.ts
export const featureFlags = {
  useAgentRegistry: process.env.USE_AGENT_REGISTRY === 'true',
  useAgentPools: process.env.USE_AGENT_POOLS === 'true',
  useWorkflowValidation: process.env.USE_WORKFLOW_VALIDATION === 'true',
  useEnhancedCoordination: process.env.USE_ENHANCED_COORDINATION === 'true',
};
```

### Rollout Plan

1. **Phase 1-2**: Internal testing with registry and pools
   - Feature flags OFF in production
   - Test in development/staging only

2. **Phase 3-4**: Soft launch with validation
   - Enable validation in production (non-blocking)
   - Log warnings, don't fail workflows

3. **Phase 5-6**: Full rollout
   - Enable all features in production
   - Monitor for issues
   - Rollback plan: Disable feature flags

### Rollback Safety

**Emergency Rollback**:

```bash
# Disable all new features instantly
export USE_AGENT_REGISTRY=false
export USE_AGENT_POOLS=false
export USE_WORKFLOW_VALIDATION=false
export USE_ENHANCED_COORDINATION=false

# Restart services
npm run restart
```

---

## Testing Strategy

### Unit Tests (90%+ Coverage)

**Registry Tests** (`src/mastra/tests/registry.test.ts`)

```typescript
describe('AgentRegistry', () => {
  it('should register agents with metadata');
  it('should query agents by tier');
  it('should query agents by role');
  it('should get managed agents for a manager');
  it('should validate workflow agent requirements');
  it('should detect missing agents');
});
```

**Pool Tests** (`src/mastra/tests/agent-pool.test.ts`)

```typescript
describe('AgentPoolManager', () => {
  it('should create agent pools');
  it('should implement round-robin strategy');
  it('should implement least-busy strategy');
  it('should scale pools up and down');
  it('should handle agent failures');
  it('should track pool status');
});
```

**Validation Tests** (`src/mastra/tests/workflow-validation.test.ts`)

```typescript
describe('WorkflowValidator', () => {
  it('should validate workflow agent bindings');
  it('should detect missing required agents');
  it('should warn about missing optional agents');
  it('should validate agent pools');
  it('should validate dependencies');
  it('should calculate readiness scores');
});
```

### Integration Tests

**Workflow Integration** (`src/mastra/tests/integration/workflow.test.ts`)

```typescript
describe('Workflow-Agent Integration', () => {
  it('should execute master orchestration with agent pools');
  it('should validate agents before workflow execution');
  it('should scale agent pools based on demand');
  it('should handle agent failures gracefully');
  it('should trace workflow execution');
});
```

### Performance Tests

**Benchmarks** (`src/mastra/tests/performance/agent-pool-benchmark.ts`)

- Baseline: Current sequential agent delegation
- Target: 30%+ improvement with pooling
- Metrics: Tasks/second, latency p50/p95/p99

---

## Metrics & Success Criteria

### Key Performance Indicators

| Metric                     | Baseline    | Target       | Measurement        |
| -------------------------- | ----------- | ------------ | ------------------ |
| Agent Discovery Time       | 50-100ms    | <10ms        | Registry lookup    |
| Workflow Validation Time   | N/A         | <50ms        | Pre-flight check   |
| Parallel Task Throughput   | 5 tasks/sec | 7+ tasks/sec | Load test          |
| Agent Pool Utilization     | N/A         | 70-90%       | Pool monitoring    |
| Failed Agent Recovery Time | Manual      | <5 seconds   | Auto-replacement   |
| Workflow Health Score      | N/A         | >0.85        | Validation scoring |

### Observability Metrics

**Agent Health**:

- Active agents count (by tier, role)
- Agent task counts (total, per agent)
- Agent failure rate
- Pool utilization (idle vs busy)

**Workflow Health**:

- Workflows validated successfully
- Workflows failed validation
- Average readiness score
- Dependency resolution time

---

## Risk Mitigation

### High-Risk Areas

1. **Registry Bottleneck**
   - Risk: Single registry becomes performance bottleneck
   - Mitigation: In-memory caching, lazy loading, eventual registry sharding

2. **Pool Exhaustion**
   - Risk: All agents busy, new tasks blocked
   - Mitigation: Auto-scaling with max limits, queue overflow handling

3. **Circular Dependencies**
   - Risk: Agent A depends on B, B depends on A
   - Mitigation: Dependency graph validation, circular detection algorithm

4. **Breaking Changes**
   - Risk: New system breaks existing workflows
   - Mitigation: Feature flags, backward compatibility layer, gradual rollout

### Contingency Plans

**If Registry Performance Degrades**:

- Add Redis-backed distributed registry
- Implement read replicas
- Cache frequently accessed metadata

**If Agent Pools Cause Issues**:

- Disable pooling via feature flag
- Fall back to direct agent instantiation
- Reduce pool sizes

**If Workflows Break**:

- Rollback to previous agent coordination tools
- Disable validation temporarily
- Use legacy workflow paths

---

## Code Examples

### Using the New System

**Before** (Current):

```typescript
// src/mastra/index.ts
export const mastra = new Mastra({
  agents: {
    primaryOrchestrator,
    portalManager,
    // ... flat list
  },
  workflows: {
    masterOrchestration,
    // ... no agent bindings
  },
});
```

**After** (Enhanced):

```typescript
// src/mastra/index.ts
import { agentRegistry } from './registry/agent-registry';
import { agentHierarchyConfig } from './config/agent-hierarchy';
import { workflowAgentBindings } from './config/workflow-agent-bindings';
import { agentPoolManager } from './coordination/agent-pool-manager';
import { workflowValidator } from './validation/workflow-validator';

// Register all agents with metadata
Object.entries(agentHierarchyConfig).forEach(([id, metadata]) => {
  const agent = getAgentById(id); // Helper function
  if (agent) agentRegistry.register(id, agent, metadata);
});

// Create agent pools for high-throughput workflows
agentPoolManager.createPool('proposal-workers', ['content-generator'], 3);
agentPoolManager.createPool('discovery-workers', ['portal-scanner'], 5);

export const mastra = new Mastra({
  agents: {
    // Agents now have metadata and relationships
    primaryOrchestrator,
    portalManager,
    proposalManager,
    // ...
  },
  workflows: {
    // Workflows now have agent bindings
    masterOrchestration,
    rfpDiscovery,
    // ...
  },
  // Add registry and validator
  onWorkflowStart: async (workflowId: string) => {
    const validation = workflowValidator.validateWorkflow(workflowId);
    if (!validation.valid) {
      throw new Error(
        `Workflow ${workflowId} failed validation: ${validation.errors.join(', ')}`
      );
    }
  },
});
```

**Workflow Execution** (Enhanced):

```typescript
// src/mastra/workflows/master-orchestration-workflow.ts
import { workflowValidator } from '../validation/workflow-validator';
import { agentPoolManager } from '../coordination/agent-pool-manager';

export const masterOrchestrationWorkflow = createWorkflow({
  name: 'Master Orchestration',

  // Pre-flight validation
  async beforeExecute({ workflowId }) {
    const validation = workflowValidator.validateWorkflow(workflowId);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors}`);
    }
  },

  steps: [
    createStep({
      id: 'discovery-phase',
      async execute({ input }) {
        // Get agents from pool instead of direct reference
        const scanner = agentPoolManager.getAgent(
          'discovery-workers',
          'round-robin'
        );

        try {
          const result = await scanner.execute(input);
          return result;
        } finally {
          // Release agent back to pool
          agentPoolManager.releaseAgent('discovery-workers', scanner);
        }
      },
    }),
    // ... more steps
  ],
});
```

---

## Timeline

**Total Duration**: 6 weeks

| Week | Phase        | Deliverables                        | Status     |
| ---- | ------------ | ----------------------------------- | ---------- |
| 1    | Foundation   | Registry, Config, Tests             | 🟡 Planned |
| 2    | Agent Pools  | Pool Manager, Scaling, Integration  | 🟡 Planned |
| 3    | Validation   | Workflow Validator, Health Scoring  | 🟡 Planned |
| 4    | Coordination | Enhanced Tools, Capability Matching | 🟡 Planned |
| 5    | Sub-Agents   | Tier 4 Support, Sub-Agent Patterns  | 🟡 Planned |
| 6    | Monitoring   | Dashboard, Tracing, Alerting        | 🟡 Planned |

---

## Next Steps

### Immediate Actions (Next 48 Hours)

1. ✅ **Review this plan** with stakeholders
2. ⏭️ **Create GitHub Project** with milestones and issues
3. ⏭️ **Set up feature branches**:
   - `feature/agent-registry`
   - `feature/agent-pools`
   - `feature/workflow-validation`
4. ⏭️ **Start Phase 1**: Agent Registry implementation

### Week 1 Sprint Goals

**Monday-Tuesday**: Registry Foundation

- Implement `AgentRegistry` class
- Create `agentHierarchyConfig`
- Write unit tests

**Wednesday-Thursday**: Workflow Bindings

- Create `workflowAgentBindings`
- Update `src/mastra/index.ts`
- Integration testing

**Friday**: Testing & Documentation

- Achieve 90%+ test coverage
- Write API documentation
- Demo to team

---

## Appendix

### Reference Documentation

**Mastra Core Docs**: <https://docs.mastra.ai>

- Agent API Reference
- Workflow API Reference
- Coordination Patterns

**Related Repositories**:

- `@mastra/core` - Core framework
- `@mastra/mcp` - MCP server integration

### Key Files Reference

**Current Architecture**:

- `src/mastra/index.ts:49-82` - Main Mastra instance
- `src/mastra/agents/primary-orchestrator.ts:47-100` - Orchestrator agent
- `src/mastra/workflows/master-orchestration-workflow.ts:1-30` - Main workflow
- `src/mastra/tools/agent-coordination-tools.ts` - Coordination tools

**New Files** (To Be Created):

- `src/mastra/registry/agent-registry.ts`
- `src/mastra/config/agent-hierarchy.ts`
- `src/mastra/config/workflow-agent-bindings.ts`
- `src/mastra/coordination/agent-pool-manager.ts`
- `src/mastra/validation/workflow-validator.ts`

### Code Graph Context Queries

Useful CGC queries for this project:

```cypher
// Find all agents and their relationships
MATCH (f:File)-[:CONTAINS]->(a:Class)
WHERE f.path CONTAINS '/agents/'
RETURN f.path, a.name

// Find workflow dependencies
MATCH (w:File)-[:IMPORTS]->(m:Module)
WHERE w.path CONTAINS '/workflows/'
RETURN w.path, m.name

// Find coordination tool usage
MATCH (f:File)-[:CONTAINS]->(func:Function)
WHERE func.name CONTAINS 'delegate' OR func.name CONTAINS 'coordinate'
RETURN f.path, func.name, func.line_number
```

---

**Document Version**: 1.0
**Last Updated**: 2025-10-20
**Author**: Claude Code (Sonnet 4.5)
**Status**: Ready for Implementation
