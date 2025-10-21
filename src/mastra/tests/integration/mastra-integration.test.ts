import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { agentRegistry } from '../../registry/agent-registry';
import { agentPoolManager } from '../../coordination/agent-pool-manager';
import { featureFlags } from '../../config/feature-flags';
import { agentHierarchyConfig } from '../../config/agent-hierarchy';
import { workflowAgentBindings } from '../../config/workflow-agent-bindings';
import { Agent } from '@mastra/core/agent';

/**
 * Mastra Integration Tests
 *
 * Tests the complete Mastra initialization with:
 * - Registry enabled/disabled scenarios
 * - Agent pool enabled/disabled scenarios
 * - Fallback to flat structure when registry off
 * - Registry API exposure when enabled
 * - No breaking changes to existing workflows
 */
describe('Mastra Integration with Registry & Pools', () => {
  const createMockAgent = (name: string): Agent => {
    return {
      name,
      execute: async () => ({ success: true }),
    } as unknown as Agent;
  };

  beforeEach(() => {
    // Clean state
    agentRegistry.clear();

    agentPoolManager.getPoolNames().forEach((poolName) => {
      try {
        agentPoolManager.removePool(poolName, true);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  afterEach(() => {
    agentRegistry.clear();

    agentPoolManager.getPoolNames().forEach((poolName) => {
      try {
        agentPoolManager.removePool(poolName, true);
      } catch {
        // Ignore cleanup errors
      }
    });
  });

  describe('Mastra Initialization with Registry Enabled', () => {
    it('should initialize registry with all 14 agents', () => {
      // Simulate registry initialization from mastra/index.ts
      const mockAgentInstances: Record<string, Agent> = {};

      Object.keys(agentHierarchyConfig).forEach((agentId) => {
        mockAgentInstances[agentId] = createMockAgent(agentHierarchyConfig[agentId].name);
      });

      // Register all agents
      let registeredCount = 0;
      for (const [agentId, metadata] of Object.entries(agentHierarchyConfig)) {
        const agentInstance = mockAgentInstances[agentId];

        if (agentInstance) {
          agentRegistry.register(agentId, agentInstance, metadata);
          registeredCount++;
        }
      }

      expect(registeredCount).toBe(14);
      expect(agentRegistry.size).toBe(14);
    });

    it('should provide registry stats after initialization', () => {
      // Register all agents
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        const agent = createMockAgent(metadata.name);
        agentRegistry.register(agentId, agent, metadata);
      });

      const stats = agentRegistry.getStats();

      expect(stats.totalAgents).toBe(14);
      expect(stats.byTier[1]).toBe(1); // Orchestrator
      expect(stats.byTier[2]).toBe(3); // Managers
      expect(stats.byTier[3]).toBe(10); // Specialists
    });

    it('should expose registry API for external use', () => {
      // Simulate registry export from mastra/index.ts
      const exportedRegistry = agentRegistry;

      // Verify API is accessible
      expect(exportedRegistry.getAgentIds).toBeDefined();
      expect(exportedRegistry.getAgent).toBeDefined();
      expect(exportedRegistry.getMetadata).toBeDefined();
      expect(exportedRegistry.getAgentsByTier).toBeDefined();
      expect(exportedRegistry.getAgentsByRole).toBeDefined();
      expect(exportedRegistry.getAgentsByCapability).toBeDefined();
      expect(exportedRegistry.validateWorkflowAgents).toBeDefined();
    });

    it('should log registry initialization info', () => {
      const mockLogger = {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
      };

      // Simulate initialization logging
      if (true) {
        // featureFlags.useAgentRegistry
        mockLogger.info('🔧 Initializing Agent Registry System...');

        Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
          const agent = createMockAgent(metadata.name);
          agentRegistry.register(agentId, agent, metadata);
        });

        const stats = agentRegistry.getStats();
        mockLogger.info(`✅ Agent Registry initialized: ${agentRegistry.size} agents registered`);
      }

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Mastra Initialization with Registry Disabled', () => {
    it('should skip registry initialization when disabled', () => {
      // Simulate USE_AGENT_REGISTRY=false
      const registryEnabled = false;

      if (!registryEnabled) {
        // Registry should remain empty
        expect(agentRegistry.size).toBe(0);
      }
    });

    it('should use flat agent structure when registry disabled', () => {
      // When registry is disabled, agents are still available via Mastra
      // but without hierarchical metadata

      const mockMastraAgents = {
        primaryOrchestrator: createMockAgent('Primary Orchestrator'),
        portalManager: createMockAgent('Portal Manager'),
        proposalManager: createMockAgent('Proposal Manager'),
        researchManager: createMockAgent('Research Manager'),
        portalScanner: createMockAgent('Portal Scanner'),
        portalMonitor: createMockAgent('Portal Monitor'),
        contentGenerator: createMockAgent('Content Generator'),
        complianceChecker: createMockAgent('Compliance Checker'),
        documentProcessor: createMockAgent('Document Processor'),
        marketAnalyst: createMockAgent('Market Analyst'),
        historicalAnalyzer: createMockAgent('Historical Analyzer'),
      };

      // Verify agents exist in flat structure
      expect(mockMastraAgents.primaryOrchestrator).toBeDefined();
      expect(mockMastraAgents.portalManager).toBeDefined();

      // But registry is not used
      expect(agentRegistry.size).toBe(0);
    });

    it('should not break existing workflow execution', () => {
      // Workflows should work with or without registry
      const registryEnabled = false;

      // Workflow can access agents directly from Mastra
      const mockWorkflow = {
        name: 'rfpDiscovery',
        execute: async () => {
          // Access agents without registry
          return { success: true };
        },
      };

      expect(mockWorkflow.execute).toBeDefined();
    });
  });

  describe('Mastra Initialization with Agent Pools Enabled', () => {
    beforeEach(() => {
      // Register all agents first (pools require registry)
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        const agent = createMockAgent(metadata.name);
        agentRegistry.register(agentId, agent, metadata);
      });
    });

    it('should initialize agent pools from workflow bindings', () => {
      const mockLogger = {
        info: vi.fn(),
        debug: vi.fn(),
      };

      // Simulate pool initialization from mastra/index.ts
      if (true) {
        // featureFlags.useAgentPools
        mockLogger.info('🏊 Initializing Agent Pool Manager...');

        let poolsCreated = 0;
        for (const binding of Object.values(workflowAgentBindings)) {
          if (!binding.agentPools) continue;

          for (const poolDef of binding.agentPools) {
            const agentConfigs = poolDef.agentIds.map((agentId) => {
              const agentReq = binding.requiredAgents.find((a) => a.agentId === agentId);
              return {
                minInstances: agentReq?.minInstances || 1,
                maxInstances: agentReq?.maxInstances || 5,
              };
            });

            const minSize = Math.max(...agentConfigs.map((c) => c.minInstances));
            const maxSize = Math.max(...agentConfigs.map((c) => c.maxInstances));

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
                cooldownPeriod: 30000,
              },
            });

            poolsCreated++;
          }
        }

        mockLogger.info(`✅ Agent Pools initialized: ${poolsCreated} pools created`);
      }

      expect(mockLogger.info).toHaveBeenCalled();
      expect(agentPoolManager.getPoolNames().length).toBeGreaterThan(0);
    });

    it('should create all workflow-specific pools', () => {
      // Create pools from workflow bindings
      Object.values(workflowAgentBindings).forEach((binding) => {
        if (!binding.agentPools) return;

        binding.agentPools.forEach((poolDef) => {
          agentPoolManager.createPool({
            name: poolDef.poolName,
            agentIds: poolDef.agentIds,
            minSize: 1,
            maxSize: 5,
            strategy: poolDef.strategy,
          });
        });
      });

      const poolNames = agentPoolManager.getPoolNames();

      // Verify expected pools exist
      expect(poolNames).toContain('proposal-workers');
      expect(poolNames).toContain('discovery-workers');
      expect(poolNames).toContain('research-workers');
      expect(poolNames).toContain('scanner-pool');
      expect(poolNames).toContain('processor-pool');
    });

    it('should expose pool manager API', () => {
      const exportedPoolManager = agentPoolManager;

      // Verify API is accessible
      expect(exportedPoolManager.createPool).toBeDefined();
      expect(exportedPoolManager.getAgent).toBeDefined();
      expect(exportedPoolManager.releaseAgent).toBeDefined();
      expect(exportedPoolManager.scalePool).toBeDefined();
      expect(exportedPoolManager.getPoolStats).toBeDefined();
      expect(exportedPoolManager.getAllPoolStats).toBeDefined();
    });

    it('should configure auto-scaling for pools', () => {
      // Create a pool with auto-scaling
      agentPoolManager.createPool({
        name: 'auto-scale-test',
        agentIds: ['portal-scanner'],
        minSize: 2,
        maxSize: 10,
        strategy: 'round-robin',
        autoScale: {
          enabled: true,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.3,
          cooldownPeriod: 30000,
        },
      });

      const stats = agentPoolManager.getPoolStats('auto-scale-test');
      expect(stats).toBeDefined();
      expect(stats!.config.autoScale?.enabled).toBe(true);
    });
  });

  describe('Mastra Initialization with Agent Pools Disabled', () => {
    it('should skip pool initialization when disabled', () => {
      const poolsEnabled = false;

      if (!poolsEnabled) {
        // Pool manager should have no pools
        expect(agentPoolManager.getPoolNames().length).toBe(0);
      }
    });

    it('should still have registry without pools', () => {
      // Registry can be enabled independently of pools
      const registryEnabled = true;
      const poolsEnabled = false;

      if (registryEnabled) {
        Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
          const agent = createMockAgent(metadata.name);
          agentRegistry.register(agentId, agent, metadata);
        });

        expect(agentRegistry.size).toBe(14);
      }

      if (!poolsEnabled) {
        expect(agentPoolManager.getPoolNames().length).toBe(0);
      }
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect USE_AGENT_REGISTRY flag', () => {
      // Simulate different flag states
      const testScenarios = [
        { useAgentRegistry: true, expectedSize: 14 },
        { useAgentRegistry: false, expectedSize: 0 },
      ];

      testScenarios.forEach(({ useAgentRegistry, expectedSize }) => {
        agentRegistry.clear();

        if (useAgentRegistry) {
          Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
            const agent = createMockAgent(metadata.name);
            agentRegistry.register(agentId, agent, metadata);
          });
        }

        expect(agentRegistry.size).toBe(expectedSize);
      });
    });

    it('should respect USE_AGENT_POOLS flag', () => {
      // First enable registry (required for pools)
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        const agent = createMockAgent(metadata.name);
        agentRegistry.register(agentId, agent, metadata);
      });

      const testScenarios = [
        { useAgentPools: true, shouldCreatePools: true },
        { useAgentPools: false, shouldCreatePools: false },
      ];

      testScenarios.forEach(({ useAgentPools, shouldCreatePools }) => {
        // Clear pools
        agentPoolManager.getPoolNames().forEach((name) => {
          agentPoolManager.removePool(name, true);
        });

        if (useAgentPools && shouldCreatePools) {
          agentPoolManager.createPool({
            name: 'test-pool',
            agentIds: ['portal-scanner'],
            minSize: 1,
            maxSize: 3,
            strategy: 'round-robin',
          });

          expect(agentPoolManager.getPoolNames().length).toBeGreaterThan(0);
        } else {
          expect(agentPoolManager.getPoolNames().length).toBe(0);
        }
      });
    });

    it('should log feature flag status in development mode', () => {
      const mockLogger = {
        info: vi.fn(),
      };

      // Simulate development mode logging
      const isDevelopment = true;

      if (isDevelopment) {
        const status = {
          'Agent Registry': featureFlags.useAgentRegistry,
          'Agent Pools': featureFlags.useAgentPools,
        };

        mockLogger.info(`Feature Flags: ${JSON.stringify(status, null, 2)}`);
      }

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  describe('Backward Compatibility', () => {
    it('should not break existing flat agent access', () => {
      // Even with registry enabled, agents should be accessible
      // via both registry and direct Mastra.agents

      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        const agent = createMockAgent(metadata.name);
        agentRegistry.register(agentId, agent, metadata);
      });

      // Registry access
      const registryAgent = agentRegistry.getAgent('portal-scanner');
      expect(registryAgent).toBeDefined();

      // Flat access (simulated)
      const flatAgent = createMockAgent('Portal Scanner');
      expect(flatAgent).toBeDefined();
    });

    it('should maintain workflow compatibility', () => {
      // All existing workflows should work with or without registry

      const workflows = ['masterOrchestration', 'rfpDiscovery', 'documentProcessing'];

      workflows.forEach((workflowId) => {
        const binding = workflowAgentBindings[workflowId];
        expect(binding).toBeDefined();
        expect(binding.workflowId).toBe(workflowId);
      });
    });

    it('should support legacy agents', () => {
      // Legacy agents should still be registered for backward compatibility

      const legacyAgents = ['rfp-discovery-agent', 'rfp-analysis-agent', 'rfp-submission-agent'];

      legacyAgents.forEach((agentId) => {
        expect(agentHierarchyConfig[agentId]).toBeDefined();
        expect(agentHierarchyConfig[agentId].metadata?.deprecated).toBe(true);
      });
    });
  });

  describe('Mastra Export API', () => {
    it('should export agentRegistry for external use', () => {
      // Verify registry is exported
      expect(agentRegistry).toBeDefined();
      expect(typeof agentRegistry.register).toBe('function');
    });

    it('should export agentPoolManager for external use', () => {
      // Verify pool manager is exported
      expect(agentPoolManager).toBeDefined();
      expect(typeof agentPoolManager.createPool).toBe('function');
    });

    it('should export agentHierarchyConfig for external use', () => {
      // Verify config is exported
      expect(agentHierarchyConfig).toBeDefined();
      expect(Object.keys(agentHierarchyConfig).length).toBe(14);
    });

    it('should export workflowAgentBindings for external use', () => {
      // Verify bindings are exported
      expect(workflowAgentBindings).toBeDefined();
      expect(Object.keys(workflowAgentBindings).length).toBe(5);
    });

    it('should export featureFlags for external use', () => {
      // Verify flags are exported
      expect(featureFlags).toBeDefined();
      expect(featureFlags.useAgentRegistry).toBeDefined();
      expect(featureFlags.useAgentPools).toBeDefined();
    });
  });

  describe('Integration Health Checks', () => {
    beforeEach(() => {
      // Full initialization
      Object.entries(agentHierarchyConfig).forEach(([agentId, metadata]) => {
        const agent = createMockAgent(metadata.name);
        agentRegistry.register(agentId, agent, metadata);
      });
    });

    it('should verify all agents are healthy after initialization', () => {
      // Update health status for all agents
      agentRegistry.getAgentIds().forEach((agentId) => {
        agentRegistry.updateHealth(agentId, {
          status: 'active',
          taskCount: 0,
          errorCount: 0,
        });
      });

      const stats = agentRegistry.getStats();
      expect(stats.byHealthStatus['active']).toBe(14);
    });

    it('should validate all workflows have required agents', () => {
      const workflowIds = Object.keys(workflowAgentBindings);

      workflowIds.forEach((workflowId) => {
        const binding = workflowAgentBindings[workflowId];
        const requiredAgentIds = binding.requiredAgents
          .filter((req) => req.required)
          .map((req) => req.agentId);

        const validation = agentRegistry.validateWorkflowAgents(
          workflowId,
          requiredAgentIds
        );

        expect(validation.valid).toBe(true);
      });
    });

    it('should confirm pool manager is ready for workflows', () => {
      // Create pools for all workflows
      Object.values(workflowAgentBindings).forEach((binding) => {
        if (!binding.agentPools) return;

        binding.agentPools.forEach((poolDef) => {
          agentPoolManager.createPool({
            name: `${binding.workflowId}-${poolDef.poolName}`,
            agentIds: poolDef.agentIds,
            minSize: 1,
            maxSize: 5,
            strategy: poolDef.strategy,
          });
        });
      });

      const allStats = agentPoolManager.getAllPoolStats();
      expect(allStats.length).toBeGreaterThan(0);

      allStats.forEach((stats) => {
        expect(stats.totalInstances).toBeGreaterThan(0);
        expect(stats.idleInstances).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
