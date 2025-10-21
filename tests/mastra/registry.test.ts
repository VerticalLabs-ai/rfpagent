import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentRegistry, AgentMetadata } from '../../src/mastra/registry/agent-registry';
import { Agent } from '@mastra/core/agent';

describe('AgentRegistry', () => {
  let registry: AgentRegistry;
  let mockAgent1: Agent;
  let mockAgent2: Agent;
  let mockAgent3: Agent;

  const createMockAgent = (name: string): Agent => {
    return {
      name,
      // Add minimal Agent interface properties
    } as Agent;
  };

  const orchestratorMetadata: AgentMetadata = {
    id: 'test-orchestrator',
    name: 'Test Orchestrator',
    tier: 1,
    role: 'orchestrator',
    capabilities: ['coordination', 'delegation'],
    manages: ['test-manager'],
    scaling: { min: 1, max: 1, strategy: 'fixed' },
  };

  const managerMetadata: AgentMetadata = {
    id: 'test-manager',
    name: 'Test Manager',
    tier: 2,
    role: 'manager',
    capabilities: ['task-management', 'specialist-coordination'],
    reportsTo: 'test-orchestrator',
    manages: ['test-specialist'],
    scaling: { min: 1, max: 3, strategy: 'demand' },
  };

  const specialistMetadata: AgentMetadata = {
    id: 'test-specialist',
    name: 'Test Specialist',
    tier: 3,
    role: 'specialist',
    capabilities: ['data-processing', 'analysis'],
    reportsTo: 'test-manager',
    requiredBy: ['test-workflow'],
    scaling: { min: 2, max: 10, strategy: 'demand' },
  };

  beforeEach(() => {
    registry = new AgentRegistry();
    mockAgent1 = createMockAgent('Test Orchestrator');
    mockAgent2 = createMockAgent('Test Manager');
    mockAgent3 = createMockAgent('Test Specialist');
  });

  describe('register', () => {
    it('should register an agent with metadata', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      expect(registry.getAgent('test-orchestrator')).toBe(mockAgent1);
      expect(registry.getMetadata('test-orchestrator')).toEqual(orchestratorMetadata);
    });

    it('should throw error if agent ID already exists', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      expect(() => {
        registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      }).toThrow("Agent with ID 'test-orchestrator' is already registered");
    });

    it('should throw error if metadata ID does not match agent ID', () => {
      const mismatchedMetadata = { ...orchestratorMetadata, id: 'different-id' };

      expect(() => {
        registry.register('test-orchestrator', mockAgent1, mismatchedMetadata);
      }).toThrow("Metadata ID 'different-id' does not match agent ID 'test-orchestrator'");
    });
  });

  describe('unregister', () => {
    it('should remove an agent from registry', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      const result = registry.unregister('test-orchestrator');

      expect(result).toBe(true);
      expect(registry.getAgent('test-orchestrator')).toBeUndefined();
    });

    it('should return false if agent does not exist', () => {
      const result = registry.unregister('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getAgent', () => {
    it('should return agent instance by ID', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      expect(registry.getAgent('test-orchestrator')).toBe(mockAgent1);
    });

    it('should return undefined for non-existent agent', () => {
      expect(registry.getAgent('non-existent')).toBeUndefined();
    });
  });

  describe('getMetadata', () => {
    it('should return agent metadata by ID', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      expect(registry.getMetadata('test-orchestrator')).toEqual(orchestratorMetadata);
    });

    it('should return undefined for non-existent agent', () => {
      expect(registry.getMetadata('non-existent')).toBeUndefined();
    });
  });

  describe('getAgentIds', () => {
    it('should return all registered agent IDs', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);

      const ids = registry.getAgentIds();

      expect(ids).toHaveLength(2);
      expect(ids).toContain('test-orchestrator');
      expect(ids).toContain('test-manager');
    });

    it('should return empty array when no agents registered', () => {
      expect(registry.getAgentIds()).toEqual([]);
    });
  });

  describe('getAgentsByTier', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return agents at tier 1', () => {
      const tier1 = registry.getAgentsByTier(1);
      expect(tier1).toHaveLength(1);
      expect(tier1[0]).toBe(mockAgent1);
    });

    it('should return agents at tier 2', () => {
      const tier2 = registry.getAgentsByTier(2);
      expect(tier2).toHaveLength(1);
      expect(tier2[0]).toBe(mockAgent2);
    });

    it('should return agents at tier 3', () => {
      const tier3 = registry.getAgentsByTier(3);
      expect(tier3).toHaveLength(1);
      expect(tier3[0]).toBe(mockAgent3);
    });

    it('should return empty array for tier with no agents', () => {
      const tier4 = registry.getAgentsByTier(4);
      expect(tier4).toEqual([]);
    });
  });

  describe('getAgentsByRole', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return orchestrator agents', () => {
      const orchestrators = registry.getAgentsByRole('orchestrator');
      expect(orchestrators).toHaveLength(1);
      expect(orchestrators[0]).toBe(mockAgent1);
    });

    it('should return manager agents', () => {
      const managers = registry.getAgentsByRole('manager');
      expect(managers).toHaveLength(1);
      expect(managers[0]).toBe(mockAgent2);
    });

    it('should return specialist agents', () => {
      const specialists = registry.getAgentsByRole('specialist');
      expect(specialists).toHaveLength(1);
      expect(specialists[0]).toBe(mockAgent3);
    });
  });

  describe('getAgentsByCapability', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return agents with specific capability', () => {
      const agents = registry.getAgentsByCapability('coordination');
      expect(agents).toHaveLength(1);
      expect(agents[0]).toBe(mockAgent1);
    });

    it('should return multiple agents with shared capability', () => {
      const dataProcessors = registry.getAgentsByCapability('data-processing');
      expect(dataProcessors).toHaveLength(1);
      expect(dataProcessors[0]).toBe(mockAgent3);
    });

    it('should return empty array for non-existent capability', () => {
      const agents = registry.getAgentsByCapability('non-existent-capability');
      expect(agents).toEqual([]);
    });
  });

  describe('getManagedAgents', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return agents managed by orchestrator', () => {
      const managed = registry.getManagedAgents('test-orchestrator');
      expect(managed).toHaveLength(1);
      expect(managed[0]).toBe(mockAgent2);
    });

    it('should return agents managed by manager', () => {
      const managed = registry.getManagedAgents('test-manager');
      expect(managed).toHaveLength(1);
      expect(managed[0]).toBe(mockAgent3);
    });

    it('should return empty array for agent with no managed agents', () => {
      const managed = registry.getManagedAgents('test-specialist');
      expect(managed).toEqual([]);
    });

    it('should return empty array for non-existent manager', () => {
      const managed = registry.getManagedAgents('non-existent');
      expect(managed).toEqual([]);
    });
  });

  describe('getWorkflowAgents', () => {
    beforeEach(() => {
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return agents required by workflow', () => {
      const agents = registry.getWorkflowAgents('test-workflow');
      expect(agents).toHaveLength(1);
      expect(agents[0]).toBe(mockAgent3);
    });

    it('should return empty array for workflow with no agents', () => {
      const agents = registry.getWorkflowAgents('non-existent-workflow');
      expect(agents).toEqual([]);
    });
  });

  describe('getParentAgent', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return parent agent for specialist', () => {
      const parent = registry.getParentAgent('test-specialist');
      expect(parent).toBe(mockAgent2);
    });

    it('should return parent agent for manager', () => {
      const parent = registry.getParentAgent('test-manager');
      expect(parent).toBe(mockAgent1);
    });

    it('should return undefined for orchestrator (no parent)', () => {
      const parent = registry.getParentAgent('test-orchestrator');
      expect(parent).toBeUndefined();
    });
  });

  describe('getHierarchyPath', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);
    });

    it('should return hierarchy path from specialist to orchestrator', () => {
      const path = registry.getHierarchyPath('test-specialist');
      expect(path).toEqual(['test-specialist', 'test-manager', 'test-orchestrator']);
    });

    it('should return path with single element for orchestrator', () => {
      const path = registry.getHierarchyPath('test-orchestrator');
      expect(path).toEqual(['test-orchestrator']);
    });

    it('should return path from manager to orchestrator', () => {
      const path = registry.getHierarchyPath('test-manager');
      expect(path).toEqual(['test-manager', 'test-orchestrator']);
    });
  });

  describe('validateWorkflowAgents', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
    });

    it('should validate all required agents are available', () => {
      const result = registry.validateWorkflowAgents('test-workflow', [
        'test-orchestrator',
        'test-manager',
      ]);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.available).toEqual(['test-orchestrator', 'test-manager']);
    });

    it('should detect missing agents', () => {
      const result = registry.validateWorkflowAgents('test-workflow', [
        'test-orchestrator',
        'non-existent-agent',
      ]);

      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(['non-existent-agent']);
      expect(result.available).toEqual(['test-orchestrator']);
    });

    it('should handle empty required agents list', () => {
      const result = registry.validateWorkflowAgents('test-workflow', []);

      expect(result.valid).toBe(true);
      expect(result.missing).toEqual([]);
      expect(result.available).toEqual([]);
    });
  });

  describe('updateHealth', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
    });

    it('should update agent health status', () => {
      registry.updateHealth('test-orchestrator', {
        status: 'busy',
        taskCount: 5,
      });

      const metadata = registry.getMetadata('test-orchestrator');
      expect(metadata?.health?.status).toBe('busy');
      expect(metadata?.health?.taskCount).toBe(5);
      expect(metadata?.health?.lastSeen).toBeInstanceOf(Date);
    });

    it('should throw error for non-existent agent', () => {
      expect(() => {
        registry.updateHealth('non-existent', { status: 'active' });
      }).toThrow("Agent 'non-existent' not found in registry");
    });

    it('should merge health updates', () => {
      registry.updateHealth('test-orchestrator', { status: 'busy', taskCount: 3 });
      registry.updateHealth('test-orchestrator', { status: 'busy', errorCount: 1 });

      const metadata = registry.getMetadata('test-orchestrator');
      expect(metadata?.health?.status).toBe('busy');
      expect(metadata?.health?.taskCount).toBe(3);
      expect(metadata?.health?.errorCount).toBe(1);
    });
  });

  describe('getAgentsByHealthStatus', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);

      registry.updateHealth('test-orchestrator', { status: 'active' });
      registry.updateHealth('test-manager', { status: 'busy' });
    });

    it('should return agents with specific health status', () => {
      const activeAgents = registry.getAgentsByHealthStatus('active');
      expect(activeAgents).toHaveLength(1);
      expect(activeAgents[0]).toBe(mockAgent1);
    });

    it('should return busy agents', () => {
      const busyAgents = registry.getAgentsByHealthStatus('busy');
      expect(busyAgents).toHaveLength(1);
      expect(busyAgents[0]).toBe(mockAgent2);
    });

    it('should return empty array for status with no agents', () => {
      const failedAgents = registry.getAgentsByHealthStatus('failed');
      expect(failedAgents).toEqual([]);
    });
  });

  describe('getStats', () => {
    beforeEach(() => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);

      registry.updateHealth('test-orchestrator', { status: 'active' });
      registry.updateHealth('test-manager', { status: 'busy' });
      registry.updateHealth('test-specialist', { status: 'idle' });
    });

    it('should return registry statistics', () => {
      const stats = registry.getStats();

      expect(stats.totalAgents).toBe(3);
      expect(stats.byTier[1]).toBe(1);
      expect(stats.byTier[2]).toBe(1);
      expect(stats.byTier[3]).toBe(1);
      expect(stats.byRole['orchestrator']).toBe(1);
      expect(stats.byRole['manager']).toBe(1);
      expect(stats.byRole['specialist']).toBe(1);
      expect(stats.byHealthStatus['active']).toBe(1);
      expect(stats.byHealthStatus['busy']).toBe(1);
      expect(stats.byHealthStatus['idle']).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all agents from registry', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAgentIds()).toEqual([]);
    });
  });

  describe('has', () => {
    it('should return true for registered agent', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);

      expect(registry.has('test-orchestrator')).toBe(true);
    });

    it('should return false for non-existent agent', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return correct count of registered agents', () => {
      registry.register('test-orchestrator', mockAgent1, orchestratorMetadata);
      registry.register('test-manager', mockAgent2, managerMetadata);
      registry.register('test-specialist', mockAgent3, specialistMetadata);

      expect(registry.size).toBe(3);
    });
  });
});
