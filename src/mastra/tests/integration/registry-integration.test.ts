import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { agentRegistry } from '../../registry/agent-registry';
import { agentHierarchyConfig, getActiveAgents, getAgentsByTier } from '../../config/agent-hierarchy';
import { workflowAgentBindings, getWorkflowBinding } from '../../config/workflow-agent-bindings';
import { Agent } from '@mastra/core/agent';

/**
 * Registry Integration Tests
 *
 * Tests the full integration of the agent registry with:
 * - agentHierarchyConfig (14 agents)
 * - workflowAgentBindings (5 workflows)
 * - Agent registry queries
 * - Workflow validation
 * - Feature flag integration
 */
describe('Agent Registry Integration', () => {
  // Mock agent instances for testing
  const createMockAgent = (name: string): Agent => {
    return {
      name,
      execute: async () => ({ success: true }),
    } as unknown as Agent;
  };

  const mockAgents: Record<string, Agent> = {};

  beforeEach(() => {
    // Clear registry before each test
    agentRegistry.clear();

    // Create mock agents for all agent IDs in hierarchy config
    Object.keys(agentHierarchyConfig).forEach((agentId) => {
      mockAgents[agentId] = createMockAgent(agentHierarchyConfig[agentId].name);
    });
  });

  afterEach(() => {
    agentRegistry.clear();
  });

  describe('Registry Initialization from agentHierarchyConfig', () => {
    it('should register all 14 agents from hierarchy config', () => {
      // Register all agents
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });

      // Verify all agents are registered
      expect(agentRegistry.size).toBe(14);

      // Verify each agent is accessible
      Object.keys(agentHierarchyConfig).forEach((agentId) => {
        expect(agentRegistry.has(agentId)).toBe(true);
        expect(agentRegistry.getAgent(agentId)).toBeDefined();
        expect(agentRegistry.getMetadata(agentId)).toBeDefined();
      });
    });

    it('should correctly identify active vs deprecated agents', () => {
      // Register all agents
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });

      const activeAgents = getActiveAgents();
      const activeAgentIds = Object.keys(activeAgents);

      // Should have 11 active agents (14 total - 3 deprecated)
      expect(activeAgentIds.length).toBe(11);

      // Verify deprecated agents are excluded
      expect(activeAgentIds).not.toContain('rfp-discovery-agent');
      expect(activeAgentIds).not.toContain('rfp-analysis-agent');
      expect(activeAgentIds).not.toContain('rfp-submission-agent');

      // Verify active agents are included
      expect(activeAgentIds).toContain('primary-orchestrator');
      expect(activeAgentIds).toContain('portal-manager');
      expect(activeAgentIds).toContain('proposal-manager');
    });

    it('should validate agent metadata integrity', () => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        // Verify metadata ID matches key
        expect(metadata.id).toBe(agentId);

        // Verify required fields
        expect(metadata.name).toBeTruthy();
        expect(metadata.tier).toBeGreaterThanOrEqual(1);
        expect(metadata.tier).toBeLessThanOrEqual(5);
        expect(metadata.role).toBeTruthy();
        expect(Array.isArray(metadata.capabilities)).toBe(true);
        expect(metadata.capabilities.length).toBeGreaterThan(0);

        // Verify scaling configuration
        expect(metadata.scaling).toBeDefined();
        expect(metadata.scaling!.min).toBeGreaterThanOrEqual(0);
        expect(metadata.scaling!.max).toBeGreaterThanOrEqual(metadata.scaling!.min);
        expect(['fixed', 'auto', 'demand']).toContain(metadata.scaling!.strategy);
      });
    });
  });

  describe('Querying Agents by Tier', () => {
    beforeEach(() => {
      // Register all active agents
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should get tier 1 orchestrator (1 agent)', () => {
      const tier1Agents = agentRegistry.getAgentsByTier(1);
      expect(tier1Agents.length).toBe(1);

      const tier1Config = getAgentsByTier(1);
      expect(Object.keys(tier1Config).length).toBe(1);
      expect(Object.keys(tier1Config)[0]).toBe('primary-orchestrator');
    });

    it('should get tier 2 managers (3 agents)', () => {
      const tier2Agents = agentRegistry.getAgentsByTier(2);
      expect(tier2Agents.length).toBe(3);

      const tier2Config = getAgentsByTier(2);
      const tier2Ids = Object.keys(tier2Config);
      expect(tier2Ids).toContain('portal-manager');
      expect(tier2Ids).toContain('proposal-manager');
      expect(tier2Ids).toContain('research-manager');
    });

    it('should get tier 3 specialists (10 agents including deprecated)', () => {
      const tier3Agents = agentRegistry.getAgentsByTier(3);
      expect(tier3Agents.length).toBe(10);

      // Active specialists
      const tier3Config = getAgentsByTier(3);
      const tier3Ids = Object.keys(tier3Config);
      expect(tier3Ids).toContain('portal-scanner');
      expect(tier3Ids).toContain('portal-monitor');
      expect(tier3Ids).toContain('content-generator');
      expect(tier3Ids).toContain('compliance-checker');
      expect(tier3Ids).toContain('document-processor');
      expect(tier3Ids).toContain('market-analyst');
      expect(tier3Ids).toContain('historical-analyzer');
    });
  });

  describe('Querying Agents by Role', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should get orchestrator role (1 agent)', () => {
      const orchestrators = agentRegistry.getAgentsByRole('orchestrator');
      expect(orchestrators.length).toBe(1);
    });

    it('should get manager role (3 agents)', () => {
      const managers = agentRegistry.getAgentsByRole('manager');
      expect(managers.length).toBe(3);
    });

    it('should get specialist role (10 agents)', () => {
      const specialists = agentRegistry.getAgentsByRole('specialist');
      expect(specialists.length).toBe(10);
    });
  });

  describe('Querying Agents by Capability', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should find agents with rfp-discovery capability', () => {
      const agents = agentRegistry.getAgentsByCapability('rfp-discovery');
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should find agents with proposal-writing capability', () => {
      const agents = agentRegistry.getAgentsByCapability('proposal-writing');
      expect(agents.length).toBe(1); // Only content-generator
    });

    it('should find agents with parallel-scanning capability', () => {
      const agents = agentRegistry.getAgentsByCapability('parallel-scanning');
      expect(agents.length).toBeGreaterThan(0);
    });

    it('should return empty array for non-existent capability', () => {
      const agents = agentRegistry.getAgentsByCapability('non-existent-capability');
      expect(agents.length).toBe(0);
    });
  });

  describe('Workflow Agent Validation', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should validate masterOrchestration workflow has all required agents', () => {
      const binding = getWorkflowBinding('masterOrchestration');
      expect(binding).toBeDefined();

      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'masterOrchestration',
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
      expect(validation.available.length).toBe(requiredAgentIds.length);
    });

    it('should validate rfpDiscovery workflow has all required agents', () => {
      const binding = getWorkflowBinding('rfpDiscovery');
      expect(binding).toBeDefined();

      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'rfpDiscovery',
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
    });

    it('should validate documentProcessing workflow', () => {
      const binding = getWorkflowBinding('documentProcessing');
      expect(binding).toBeDefined();

      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'documentProcessing',
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
    });

    it('should validate proposalPDFAssembly workflow', () => {
      const binding = getWorkflowBinding('proposalPDFAssembly');
      expect(binding).toBeDefined();

      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'proposalPDFAssembly',
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
    });

    it('should validate bonfireAuth workflow', () => {
      const binding = getWorkflowBinding('bonfireAuth');
      expect(binding).toBeDefined();

      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'bonfireAuth',
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
    });

    it('should detect missing required agents', () => {
      // Clear registry to simulate missing agents
      agentRegistry.clear();

      const binding = getWorkflowBinding('masterOrchestration');
      const requiredAgentIds = binding!.requiredAgents
        .filter((req) => req.required)
        .map((req) => req.agentId);

      const validation = agentRegistry.validateWorkflowAgents(
        'masterOrchestration',
        requiredAgentIds
      );

      expect(validation.valid).toBe(false);
      expect(validation.missing.length).toBe(requiredAgentIds.length);
      expect(validation.available.length).toBe(0);
    });

    it('should handle optional agents correctly', () => {
      const binding = getWorkflowBinding('masterOrchestration');
      const allAgentIds = binding!.requiredAgents.map((req) => req.agentId);

      // Count optional agents
      const optionalAgents = binding!.requiredAgents.filter((req) => !req.required);
      expect(optionalAgents.length).toBeGreaterThan(0);

      // Verify optional agents include research-manager, market-analyst, historical-analyzer
      const optionalIds = optionalAgents.map((req) => req.agentId);
      expect(optionalIds).toContain('research-manager');
      expect(optionalIds).toContain('market-analyst');
      expect(optionalIds).toContain('historical-analyzer');
    });
  });

  describe('Hierarchical Relationships', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should get agents managed by portal-manager', () => {
      const managed = agentRegistry.getManagedAgents('portal-manager');
      expect(managed.length).toBe(2);

      const managedIds = agentHierarchyConfig['portal-manager'].manages;
      expect(managedIds).toContain('portal-scanner');
      expect(managedIds).toContain('portal-monitor');
    });

    it('should get agents managed by proposal-manager', () => {
      const managed = agentRegistry.getManagedAgents('proposal-manager');
      expect(managed.length).toBe(3);

      const managedIds = agentHierarchyConfig['proposal-manager'].manages;
      expect(managedIds).toContain('content-generator');
      expect(managedIds).toContain('compliance-checker');
      expect(managedIds).toContain('document-processor');
    });

    it('should get parent agent correctly', () => {
      const parent = agentRegistry.getParentAgent('portal-scanner');
      expect(parent).toBeDefined();

      // Verify it's the portal-manager
      const metadata = agentRegistry.getMetadata('portal-scanner');
      expect(metadata!.reportsTo).toBe('portal-manager');
    });

    it('should get complete hierarchy path', () => {
      const path = agentRegistry.getHierarchyPath('portal-scanner');

      // Should be: portal-scanner -> portal-manager -> primary-orchestrator
      expect(path.length).toBe(3);
      expect(path[0]).toBe('portal-scanner');
      expect(path[1]).toBe('portal-manager');
      expect(path[2]).toBe('primary-orchestrator');
    });

    it('should handle orchestrator with no parent', () => {
      const parent = agentRegistry.getParentAgent('primary-orchestrator');
      expect(parent).toBeUndefined();

      const path = agentRegistry.getHierarchyPath('primary-orchestrator');
      expect(path.length).toBe(1);
      expect(path[0]).toBe('primary-orchestrator');
    });
  });

  describe('Registry Statistics', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should provide accurate registry statistics', () => {
      const stats = agentRegistry.getStats();

      expect(stats.totalAgents).toBe(14);
      expect(stats.byTier[1]).toBe(1); // 1 orchestrator
      expect(stats.byTier[2]).toBe(3); // 3 managers
      expect(stats.byTier[3]).toBe(10); // 10 specialists

      expect(stats.byRole['orchestrator']).toBe(1);
      expect(stats.byRole['manager']).toBe(3);
      expect(stats.byRole['specialist']).toBe(10);
    });

    it('should track health status when updated', () => {
      agentRegistry.updateHealth('portal-scanner', {
        status: 'active',
        taskCount: 5,
        errorCount: 0,
      });

      const agents = agentRegistry.getAgentsByHealthStatus('active');
      expect(agents.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow-Specific Agent Queries', () => {
    beforeEach(() => {
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      });
    });

    it('should get all agents for masterOrchestration workflow', () => {
      const agents = agentRegistry.getWorkflowAgents('masterOrchestration');
      expect(agents.length).toBeGreaterThan(0);

      // Verify key agents are included
      const agentIds = Object.keys(agentHierarchyConfig).filter(
        (id) => agentHierarchyConfig[id].requiredBy?.includes('masterOrchestration')
      );

      expect(agentIds).toContain('portal-manager');
      expect(agentIds).toContain('proposal-manager');
      expect(agentIds).toContain('research-manager');
    });

    it('should get all agents for rfpDiscovery workflow', () => {
      const agents = agentRegistry.getWorkflowAgents('rfpDiscovery');
      expect(agents.length).toBeGreaterThan(0);

      const agentIds = Object.keys(agentHierarchyConfig).filter(
        (id) => agentHierarchyConfig[id].requiredBy?.includes('rfpDiscovery')
      );

      expect(agentIds).toContain('portal-manager');
      expect(agentIds).toContain('portal-scanner');
      expect(agentIds).toContain('portal-monitor');
    });
  });

  describe('Feature Flag Integration', () => {
    it('should work correctly when registry is enabled', () => {
      // Simulate USE_AGENT_REGISTRY=true
      const registryEnabled = true;

      if (registryEnabled) {
        Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
          agentRegistry.register(agentId, mockAgents[agentId], metadata);
        });

        expect(agentRegistry.size).toBe(14);
      }
    });

    it('should skip registration when registry is disabled', () => {
      // Simulate USE_AGENT_REGISTRY=false
      const registryEnabled = false;

      if (!registryEnabled) {
        // Registry should remain empty
        expect(agentRegistry.size).toBe(0);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw error on duplicate registration', () => {
      const agentId = 'portal-scanner';
      const metadata = agentHierarchyConfig[agentId];

      agentRegistry.register(agentId, mockAgents[agentId], metadata);

      expect(() => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      }).toThrow("Agent with ID 'portal-scanner' is already registered");
    });

    it('should throw error on ID mismatch', () => {
      const agentId = 'portal-scanner';
      const metadata = {
        ...agentHierarchyConfig[agentId],
        id: 'different-id',
      };

      expect(() => {
        agentRegistry.register(agentId, mockAgents[agentId], metadata);
      }).toThrow("Metadata ID 'different-id' does not match agent ID 'portal-scanner'");
    });

    it('should handle missing agents gracefully', () => {
      const agent = agentRegistry.getAgent('non-existent');
      expect(agent).toBeUndefined();

      const metadata = agentRegistry.getMetadata('non-existent');
      expect(metadata).toBeUndefined();
    });
  });
});
