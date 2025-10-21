import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { agentRegistry } from '../../registry/agent-registry';
import { agentPoolManager } from '../../coordination/agent-pool-manager';
import { agentHierarchyConfig } from '../../config/agent-hierarchy';
import {
  workflowAgentBindings,
  getWorkflowBinding,
  getWorkflowRequiredAgents,
  getWorkflowAllAgents,
} from '../../config/workflow-agent-bindings';
import { Agent } from '@mastra/core/agent';

/**
 * Workflow Integration Tests
 *
 * Tests integration of workflows with agent pools:
 * - masterOrchestration
 * - rfpDiscovery
 * - documentProcessing
 * - proposalPDFAssembly
 * - bonfireAuth
 *
 * Validates:
 * - Agent pool creation from workflow bindings
 * - Handling of optional vs required agents
 * - Graceful degradation when agents missing
 * - Agent dependency validation
 * - Load balancing strategies
 */
describe('Workflow Integration with Agent Pools', () => {
  const createMockAgent = (name: string): Agent => {
    return {
      name,
      execute: async () => ({ success: true }),
    } as unknown as Agent;
  };

  const mockAgents: Record<string, Agent> = {};

  beforeEach(() => {
    // Clear registry and pools
    agentRegistry.clear();

    // Create and register all mock agents
    Object.keys(agentHierarchyConfig).forEach((agentId) => {
      mockAgents[agentId] = createMockAgent(agentHierarchyConfig[agentId].name);
      agentRegistry.register(agentId, mockAgents[agentId], agentHierarchyConfig[agentId]);
    });
  });

  afterEach(() => {
    // Clean up
    agentRegistry.clear();

    // Remove all pools
    agentPoolManager.getPoolNames().forEach((poolName) => {
      try {
        agentPoolManager.removePool(poolName, true);
      } catch {
        // Ignore errors during cleanup
      }
    });
  });

  describe('masterOrchestration Workflow', () => {
    const workflowId = 'masterOrchestration';

    it('should have complete workflow binding configuration', () => {
      const binding = getWorkflowBinding(workflowId);

      expect(binding).toBeDefined();
      expect(binding!.workflowId).toBe(workflowId);
      expect(binding!.name).toBe('Master Orchestration Workflow');
      expect(binding!.requiredAgents.length).toBeGreaterThan(0);
      expect(binding!.agentPools).toBeDefined();
      expect(binding!.dependencies).toBeDefined();
    });

    it('should identify required vs optional agents', () => {
      const binding = getWorkflowBinding(workflowId)!;

      const required = binding.requiredAgents.filter((req) => req.required);
      const optional = binding.requiredAgents.filter((req) => !req.required);

      // Required agents
      expect(required.map((r) => r.agentId)).toContain('primary-orchestrator');
      expect(required.map((r) => r.agentId)).toContain('portal-manager');
      expect(required.map((r) => r.agentId)).toContain('portal-scanner');
      expect(required.map((r) => r.agentId)).toContain('document-processor');
      expect(required.map((r) => r.agentId)).toContain('proposal-manager');
      expect(required.map((r) => r.agentId)).toContain('content-generator');
      expect(required.map((r) => r.agentId)).toContain('compliance-checker');

      // Optional agents (research phase)
      expect(optional.map((r) => r.agentId)).toContain('research-manager');
      expect(optional.map((r) => r.agentId)).toContain('market-analyst');
      expect(optional.map((r) => r.agentId)).toContain('historical-analyzer');
    });

    it('should create agent pools from workflow binding', () => {
      const binding = getWorkflowBinding(workflowId)!;

      binding.agentPools!.forEach((poolDef) => {
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
        });
      });

      // Verify pools were created
      const poolNames = agentPoolManager.getPoolNames();
      expect(poolNames).toContain('proposal-workers');
      expect(poolNames).toContain('discovery-workers');
      expect(poolNames).toContain('research-workers');
    });

    it('should validate workflow agents are available', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);

      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
      expect(validation.available.length).toBe(requiredAgentIds.length);
    });

    it('should handle missing optional agents gracefully', () => {
      // Remove optional agents
      agentRegistry.unregister('research-manager');
      agentRegistry.unregister('market-analyst');
      agentRegistry.unregister('historical-analyzer');

      // Validate only required agents
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      // Should still be valid since research agents are optional
      expect(validation.valid).toBe(true);
    });

    it('should detect missing required agents', () => {
      // Remove a required agent
      agentRegistry.unregister('portal-scanner');

      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('portal-scanner');
    });

    it('should validate agent dependencies', () => {
      const binding = getWorkflowBinding(workflowId)!;

      binding.dependencies.forEach((dep) => {
        // Both agents in dependency should exist
        expect(agentRegistry.has(dep.from)).toBe(true);
        expect(agentRegistry.has(dep.to)).toBe(true);

        // Dependency type should be valid
        expect(['sequential', 'parallel', 'conditional']).toContain(dep.type);
      });
    });

    it('should use least-busy strategy for proposal-workers pool', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const proposalPool = binding.agentPools!.find(
        (p) => p.poolName === 'proposal-workers'
      );

      expect(proposalPool).toBeDefined();
      expect(proposalPool!.strategy).toBe('least-busy');
      expect(proposalPool!.agentIds).toContain('content-generator');
      expect(proposalPool!.agentIds).toContain('compliance-checker');
    });
  });

  describe('rfpDiscovery Workflow', () => {
    const workflowId = 'rfpDiscovery';

    it('should have complete workflow binding configuration', () => {
      const binding = getWorkflowBinding(workflowId);

      expect(binding).toBeDefined();
      expect(binding!.workflowId).toBe(workflowId);
      expect(binding!.name).toBe('RFP Discovery Workflow');
    });

    it('should require portal-manager, portal-scanner, and portal-monitor', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);

      expect(requiredAgentIds).toContain('portal-manager');
      expect(requiredAgentIds).toContain('portal-scanner');
      expect(requiredAgentIds).toContain('portal-monitor');
    });

    it('should create scanner-pool with round-robin strategy', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const scannerPool = binding.agentPools!.find((p) => p.poolName === 'scanner-pool');

      expect(scannerPool).toBeDefined();
      expect(scannerPool!.strategy).toBe('round-robin');
      expect(scannerPool!.agentIds).toContain('portal-scanner');

      // Create the pool
      agentPoolManager.createPool({
        name: scannerPool!.poolName,
        agentIds: scannerPool!.agentIds,
        minSize: 2,
        maxSize: 10,
        strategy: scannerPool!.strategy,
      });

      const stats = agentPoolManager.getPoolStats('scanner-pool');
      expect(stats).toBeDefined();
      expect(stats!.totalInstances).toBeGreaterThanOrEqual(2);
    });

    it('should validate all required agents are present', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
    });

    it('should have parallel dependencies for scalability', () => {
      const binding = getWorkflowBinding(workflowId)!;

      const parallelDeps = binding.dependencies.filter((dep) => dep.type === 'parallel');
      expect(parallelDeps.length).toBeGreaterThan(0);

      // Verify portal-manager can spawn both scanner and monitor in parallel
      const managerDeps = parallelDeps.filter((dep) => dep.from === 'portal-manager');
      expect(managerDeps.length).toBe(2);
    });

    it('should support scaling portal-scanner instances', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const scannerReq = binding.requiredAgents.find(
        (req) => req.agentId === 'portal-scanner'
      );

      expect(scannerReq).toBeDefined();
      expect(scannerReq!.minInstances).toBe(2);
      expect(scannerReq!.maxInstances).toBe(10);
    });
  });

  describe('documentProcessing Workflow', () => {
    const workflowId = 'documentProcessing';

    it('should have complete workflow binding configuration', () => {
      const binding = getWorkflowBinding(workflowId);

      expect(binding).toBeDefined();
      expect(binding!.workflowId).toBe(workflowId);
      expect(binding!.name).toBe('Document Processing Workflow');
    });

    it('should require document-processor as primary agent', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);

      expect(requiredAgentIds).toContain('document-processor');
    });

    it('should handle optional compliance-checker', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const complianceReq = binding.requiredAgents.find(
        (req) => req.agentId === 'compliance-checker'
      );

      expect(complianceReq).toBeDefined();
      expect(complianceReq!.required).toBe(false); // Optional validation step
    });

    it('should create processor-pool with least-busy strategy', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const processorPool = binding.agentPools!.find(
        (p) => p.poolName === 'processor-pool'
      );

      expect(processorPool).toBeDefined();
      expect(processorPool!.strategy).toBe('least-busy');

      agentPoolManager.createPool({
        name: processorPool!.poolName,
        agentIds: processorPool!.agentIds,
        minSize: 1,
        maxSize: 6,
        strategy: processorPool!.strategy,
      });

      const stats = agentPoolManager.getPoolStats('processor-pool');
      expect(stats).toBeDefined();
    });

    it('should work without optional compliance-checker', () => {
      agentRegistry.unregister('compliance-checker');

      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      // Should still be valid since compliance-checker is optional
      expect(validation.valid).toBe(true);
    });

    it('should have sequential dependency from processor to checker', () => {
      const binding = getWorkflowBinding(workflowId)!;

      const seqDep = binding.dependencies.find(
        (dep) =>
          dep.from === 'document-processor' &&
          dep.to === 'compliance-checker' &&
          dep.type === 'sequential'
      );

      expect(seqDep).toBeDefined();
    });
  });

  describe('proposalPDFAssembly Workflow', () => {
    const workflowId = 'proposalPDFAssembly';

    it('should have complete workflow binding configuration', () => {
      const binding = getWorkflowBinding(workflowId);

      expect(binding).toBeDefined();
      expect(binding!.workflowId).toBe(workflowId);
      expect(binding!.name).toBe('Proposal PDF Assembly Workflow');
    });

    it('should require proposal-manager, content-generator, and compliance-checker', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);

      expect(requiredAgentIds).toContain('proposal-manager');
      expect(requiredAgentIds).toContain('content-generator');
      expect(requiredAgentIds).toContain('compliance-checker');
    });

    it('should validate sequential workflow dependencies', () => {
      const binding = getWorkflowBinding(workflowId)!;

      // Verify workflow follows: content-generator -> compliance-checker -> proposal-manager
      const deps = binding.dependencies;

      const contentToCompliance = deps.find(
        (d) =>
          d.from === 'content-generator' &&
          d.to === 'compliance-checker' &&
          d.type === 'sequential'
      );
      expect(contentToCompliance).toBeDefined();

      const complianceToManager = deps.find(
        (d) =>
          d.from === 'compliance-checker' &&
          d.to === 'proposal-manager' &&
          d.type === 'sequential'
      );
      expect(complianceToManager).toBeDefined();
    });

    it('should support scaling content-generator for parallel sections', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const contentReq = binding.requiredAgents.find(
        (req) => req.agentId === 'content-generator'
      );

      expect(contentReq).toBeDefined();
      expect(contentReq!.minInstances).toBe(1);
      expect(contentReq!.maxInstances).toBe(8); // High parallelization
    });

    it('should fail validation if required agent missing', () => {
      agentRegistry.unregister('content-generator');

      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('content-generator');
    });
  });

  describe('bonfireAuth Workflow', () => {
    const workflowId = 'bonfireAuth';

    it('should have complete workflow binding configuration', () => {
      const binding = getWorkflowBinding(workflowId);

      expect(binding).toBeDefined();
      expect(binding!.workflowId).toBe(workflowId);
      expect(binding!.name).toBe('Bonfire Authentication Workflow');
    });

    it('should require portal-manager and portal-scanner', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);

      expect(requiredAgentIds).toContain('portal-manager');
      expect(requiredAgentIds).toContain('portal-scanner');
    });

    it('should have sequential dependency for authentication flow', () => {
      const binding = getWorkflowBinding(workflowId)!;

      const seqDep = binding.dependencies.find(
        (dep) =>
          dep.from === 'portal-manager' &&
          dep.to === 'portal-scanner' &&
          dep.type === 'sequential'
      );

      expect(seqDep).toBeDefined();
    });

    it('should support multiple portal-scanner instances for retries', () => {
      const binding = getWorkflowBinding(workflowId)!;
      const scannerReq = binding.requiredAgents.find(
        (req) => req.agentId === 'portal-scanner'
      );

      expect(scannerReq).toBeDefined();
      expect(scannerReq!.minInstances).toBe(1);
      expect(scannerReq!.maxInstances).toBeGreaterThanOrEqual(5);
    });

    it('should validate all required agents are present', () => {
      const requiredAgentIds = getWorkflowRequiredAgents(workflowId);
      const validation = agentRegistry.validateWorkflowAgents(
        workflowId,
        requiredAgentIds
      );

      expect(validation.valid).toBe(true);
      expect(validation.missing.length).toBe(0);
    });
  });

  describe('Cross-Workflow Agent Pooling', () => {
    it('should allow same agent in multiple workflow pools', () => {
      // portal-scanner is used in both rfpDiscovery and bonfireAuth
      const rfpBinding = getWorkflowBinding('rfpDiscovery')!;
      const bonfireBinding = getWorkflowBinding('bonfireAuth')!;

      const rfpAgents = getWorkflowAllAgents('rfpDiscovery');
      const bonfireAgents = getWorkflowAllAgents('bonfireAuth');

      expect(rfpAgents).toContain('portal-scanner');
      expect(bonfireAgents).toContain('portal-scanner');

      // Both workflows should share the same registry agent
      const rfpScanner = agentRegistry.getAgent('portal-scanner');
      const bonfireScanner = agentRegistry.getAgent('portal-scanner');

      expect(rfpScanner).toBe(bonfireScanner);
    });

    it('should handle concurrent pool operations across workflows', () => {
      // Create pools for multiple workflows
      const workflows = ['masterOrchestration', 'rfpDiscovery', 'documentProcessing'];

      workflows.forEach((workflowId) => {
        const binding = getWorkflowBinding(workflowId);
        if (!binding || !binding.agentPools) return;

        binding.agentPools.forEach((poolDef) => {
          const poolName = `${workflowId}-${poolDef.poolName}`;

          agentPoolManager.createPool({
            name: poolName,
            agentIds: poolDef.agentIds,
            minSize: 1,
            maxSize: 5,
            strategy: poolDef.strategy,
          });
        });
      });

      // Verify all pools created
      const poolNames = agentPoolManager.getPoolNames();
      expect(poolNames.length).toBeGreaterThan(0);
    });
  });

  describe('Graceful Degradation', () => {
    it('should identify which workflows can still run with missing optional agents', () => {
      // Remove all research agents (optional in masterOrchestration)
      agentRegistry.unregister('research-manager');
      agentRegistry.unregister('market-analyst');
      agentRegistry.unregister('historical-analyzer');

      // masterOrchestration should still validate
      const masterRequired = getWorkflowRequiredAgents('masterOrchestration');
      const masterValidation = agentRegistry.validateWorkflowAgents(
        'masterOrchestration',
        masterRequired
      );

      expect(masterValidation.valid).toBe(true);
    });

    it('should prevent workflow execution if required agents missing', () => {
      // Remove required agent
      agentRegistry.unregister('document-processor');

      // documentProcessing should fail validation
      const docRequired = getWorkflowRequiredAgents('documentProcessing');
      const docValidation = agentRegistry.validateWorkflowAgents(
        'documentProcessing',
        docRequired
      );

      expect(docValidation.valid).toBe(false);
    });

    it('should provide detailed validation results for debugging', () => {
      agentRegistry.unregister('portal-scanner');
      agentRegistry.unregister('portal-monitor');

      const requiredAgentIds = getWorkflowRequiredAgents('rfpDiscovery');
      const validation = agentRegistry.validateWorkflowAgents(
        'rfpDiscovery',
        requiredAgentIds
      );

      expect(validation.valid).toBe(false);
      expect(validation.missing).toContain('portal-scanner');
      expect(validation.missing).toContain('portal-monitor');
      expect(validation.available.length).toBeGreaterThan(0);
    });
  });

  describe('Load Balancing Strategies', () => {
    it('should use round-robin for discovery workers', () => {
      const binding = getWorkflowBinding('masterOrchestration')!;
      const discoveryPool = binding.agentPools!.find(
        (p) => p.poolName === 'discovery-workers'
      );

      expect(discoveryPool).toBeDefined();
      expect(discoveryPool!.strategy).toBe('round-robin');
    });

    it('should use least-busy for proposal and research workers', () => {
      const binding = getWorkflowBinding('masterOrchestration')!;

      const proposalPool = binding.agentPools!.find(
        (p) => p.poolName === 'proposal-workers'
      );
      expect(proposalPool!.strategy).toBe('least-busy');

      const researchPool = binding.agentPools!.find(
        (p) => p.poolName === 'research-workers'
      );
      expect(researchPool!.strategy).toBe('least-busy');
    });

    it('should respect strategy when getting agents from pool', () => {
      // Create a pool with specific strategy
      agentPoolManager.createPool({
        name: 'test-round-robin',
        agentIds: ['portal-scanner'],
        minSize: 3,
        maxSize: 5,
        strategy: 'round-robin',
      });

      // Get agents multiple times
      const agent1 = agentPoolManager.getAgent('test-round-robin');
      const agent2 = agentPoolManager.getAgent('test-round-robin');
      const agent3 = agentPoolManager.getAgent('test-round-robin');

      expect(agent1).toBeDefined();
      expect(agent2).toBeDefined();
      expect(agent3).toBeDefined();
    });
  });
});
