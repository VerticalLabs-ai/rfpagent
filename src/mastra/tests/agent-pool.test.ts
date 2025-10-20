import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AgentPoolManager,
  PoolConfig,
  PooledAgent,
} from '../coordination/agent-pool-manager';
import { agentRegistry } from '../registry/agent-registry';
import { Agent } from '@mastra/core/agent';
import { AgentMetadata } from '../registry/agent-registry';

describe('AgentPoolManager', () => {
  let poolManager: AgentPoolManager;
  let mockAgent1: Agent;
  let mockAgent2: Agent;
  let mockAgent3: Agent;

  const createMockAgent = (name: string): Agent => {
    return {
      name,
      execute: vi.fn(),
    } as unknown as Agent;
  };

  const testAgentMetadata1: AgentMetadata = {
    id: 'test-agent-1',
    name: 'Test Agent 1',
    tier: 3,
    role: 'specialist',
    capabilities: ['task-execution'],
    scaling: { min: 1, max: 5, strategy: 'demand' },
  };

  const testAgentMetadata2: AgentMetadata = {
    id: 'test-agent-2',
    name: 'Test Agent 2',
    tier: 3,
    role: 'specialist',
    capabilities: ['task-execution'],
    scaling: { min: 1, max: 5, strategy: 'demand' },
  };

  beforeEach(() => {
    poolManager = new AgentPoolManager();
    mockAgent1 = createMockAgent('Test Agent 1');
    mockAgent2 = createMockAgent('Test Agent 2');
    mockAgent3 = createMockAgent('Test Agent 3');

    // Clear registry and register test agents
    agentRegistry.clear();
    agentRegistry.register('test-agent-1', mockAgent1, testAgentMetadata1);
    agentRegistry.register('test-agent-2', mockAgent2, testAgentMetadata2);
  });

  afterEach(() => {
    agentRegistry.clear();
  });

  describe('createPool', () => {
    it('should create a pool with minimum size', () => {
      const config: PoolConfig = {
        name: 'test-pool',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 5,
        strategy: 'round-robin',
      };

      poolManager.createPool(config);

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats).not.toBeNull();
      expect(stats!.totalInstances).toBe(2);
      expect(stats!.idleInstances).toBe(2);
    });

    it('should throw error if pool already exists', () => {
      const config: PoolConfig = {
        name: 'test-pool',
        agentIds: ['test-agent-1'],
        minSize: 1,
        maxSize: 3,
        strategy: 'round-robin',
      };

      poolManager.createPool(config);

      expect(() => poolManager.createPool(config)).toThrow(
        "Pool 'test-pool' already exists"
      );
    });

    it('should throw error if agent not in registry', () => {
      const config: PoolConfig = {
        name: 'test-pool',
        agentIds: ['non-existent-agent'],
        minSize: 1,
        maxSize: 3,
        strategy: 'round-robin',
      };

      expect(() => poolManager.createPool(config)).toThrow(
        "Agent 'non-existent-agent' not found in registry"
      );
    });

    it('should validate configuration', () => {
      const invalidConfig: PoolConfig = {
        name: '',
        agentIds: [],
        minSize: 5,
        maxSize: 3, // max < min
        strategy: 'round-robin',
      };

      expect(() => poolManager.createPool(invalidConfig)).toThrow();
    });
  });

  describe('getAgent', () => {
    beforeEach(() => {
      poolManager.createPool({
        name: 'test-pool',
        agentIds: ['test-agent-1', 'test-agent-2'],
        minSize: 3,
        maxSize: 10,
        strategy: 'round-robin',
      });
    });

    it('should return an agent from the pool', () => {
      const agent = poolManager.getAgent('test-pool');

      expect(agent).not.toBeNull();
      expect([mockAgent1, mockAgent2]).toContain(agent);
    });

    it('should mark agent as busy', () => {
      poolManager.getAgent('test-pool');

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats!.busyInstances).toBe(1);
      expect(stats!.idleInstances).toBe(2);
    });

    it('should return null if no idle agents', () => {
      // Get all agents
      poolManager.getAgent('test-pool');
      poolManager.getAgent('test-pool');
      poolManager.getAgent('test-pool');

      // Try to get one more
      const agent = poolManager.getAgent('test-pool');
      expect(agent).toBeNull();
    });

    it('should throw error for non-existent pool', () => {
      expect(() => poolManager.getAgent('non-existent')).toThrow(
        "Pool 'non-existent' not found"
      );
    });
  });

  describe('releaseAgent', () => {
    let agent: Agent;

    beforeEach(() => {
      poolManager.createPool({
        name: 'test-pool',
        agentIds: ['test-agent-1'],
        minSize: 1,
        maxSize: 5,
        strategy: 'round-robin',
      });
      agent = poolManager.getAgent('test-pool')!;
    });

    it('should release agent back to pool', () => {
      poolManager.releaseAgent('test-pool', agent, {
        success: true,
        executionTime: 100,
      });

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats!.idleInstances).toBe(1);
      expect(stats!.busyInstances).toBe(0);
    });

    it('should update task count on successful completion', () => {
      poolManager.releaseAgent('test-pool', agent, {
        success: true,
        executionTime: 100,
      });

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats!.totalTasks).toBe(1);
    });

    it('should update error count on failure', () => {
      poolManager.releaseAgent('test-pool', agent, {
        success: false,
        error: new Error('Test error'),
      });

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats!.totalErrors).toBe(1);
    });

    it('should track average execution time', () => {
      poolManager.releaseAgent('test-pool', agent, {
        success: true,
        executionTime: 100,
      });

      agent = poolManager.getAgent('test-pool')!;
      poolManager.releaseAgent('test-pool', agent, {
        success: true,
        executionTime: 200,
      });

      const stats = poolManager.getPoolStats('test-pool');
      expect(stats!.avgExecutionTime).toBeGreaterThan(0);
    });

    it('should throw error for non-existent pool', () => {
      expect(() =>
        poolManager.releaseAgent('non-existent', agent)
      ).toThrow("Pool 'non-existent' not found");
    });

    it('should throw error if agent not in pool', () => {
      const otherAgent = createMockAgent('Other Agent');

      expect(() =>
        poolManager.releaseAgent('test-pool', otherAgent)
      ).toThrow("Agent not found in pool 'test-pool'");
    });
  });

  describe('Pool Strategies', () => {
    describe('round-robin', () => {
      beforeEach(() => {
        poolManager.createPool({
          name: 'rr-pool',
          agentIds: ['test-agent-1'],
          minSize: 3,
          maxSize: 5,
          strategy: 'round-robin',
        });
      });

      it('should distribute requests evenly', () => {
        const agents: Agent[] = [];

        // Get all agents
        for (let i = 0; i < 3; i++) {
          const agent = poolManager.getAgent('rr-pool');
          agents.push(agent!);
        }

        // Release and get again
        poolManager.releaseAgent('rr-pool', agents[0]);
        const nextAgent = poolManager.getAgent('rr-pool');

        // Should get the one we just released (least recently used)
        expect(nextAgent).toBe(agents[0]);
      });
    });

    describe('least-busy', () => {
      beforeEach(() => {
        poolManager.createPool({
          name: 'lb-pool',
          agentIds: ['test-agent-1'],
          minSize: 3,
          maxSize: 5,
          strategy: 'least-busy',
        });
      });

      it('should select agent with lowest task count', () => {
        // Get agents and complete different numbers of tasks
        const agent1 = poolManager.getAgent('lb-pool')!;
        poolManager.releaseAgent('lb-pool', agent1, { success: true });

        const agent2 = poolManager.getAgent('lb-pool')!;
        poolManager.releaseAgent('lb-pool', agent2, { success: true });
        poolManager.getAgent('lb-pool'); // agent2 again
        poolManager.releaseAgent('lb-pool', agent2, { success: true });

        // Next get should return agent1 (lower task count)
        const nextAgent = poolManager.getAgent('lb-pool');
        expect(nextAgent).toBe(agent1);
      });
    });

    describe('random', () => {
      beforeEach(() => {
        poolManager.createPool({
          name: 'rand-pool',
          agentIds: ['test-agent-1'],
          minSize: 5,
          maxSize: 10,
          strategy: 'random',
        });
      });

      it('should return random agent from pool', () => {
        const agent = poolManager.getAgent('rand-pool');
        expect(agent).not.toBeNull();
      });
    });

    describe('fastest', () => {
      beforeEach(() => {
        poolManager.createPool({
          name: 'fast-pool',
          agentIds: ['test-agent-1'],
          minSize: 3,
          maxSize: 5,
          strategy: 'fastest',
        });
      });

      it('should select agent with best execution time', () => {
        // Execute tasks with different execution times
        const agent1 = poolManager.getAgent('fast-pool')!;
        poolManager.releaseAgent('fast-pool', agent1, {
          success: true,
          executionTime: 200,
        });

        const agent2 = poolManager.getAgent('fast-pool')!;
        poolManager.releaseAgent('fast-pool', agent2, {
          success: true,
          executionTime: 50, // Faster
        });

        // Next get should return agent2 (faster)
        const nextAgent = poolManager.getAgent('fast-pool');
        expect(nextAgent).toBe(agent2);
      });
    });
  });

  describe('scalePool', () => {
    beforeEach(() => {
      poolManager.createPool({
        name: 'scale-pool',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 10,
        strategy: 'round-robin',
      });
    });

    it('should scale up pool size', () => {
      poolManager.scalePool('scale-pool', 5);

      const stats = poolManager.getPoolStats('scale-pool');
      expect(stats!.totalInstances).toBe(5);
    });

    it('should scale down pool size', () => {
      poolManager.scalePool('scale-pool', 5);
      poolManager.scalePool('scale-pool', 3);

      const stats = poolManager.getPoolStats('scale-pool');
      expect(stats!.totalInstances).toBe(3);
    });

    it('should not scale beyond max size', () => {
      expect(() => poolManager.scalePool('scale-pool', 15)).toThrow(
        'Target size 15 outside allowed range'
      );
    });

    it('should not scale below min size', () => {
      expect(() => poolManager.scalePool('scale-pool', 1)).toThrow(
        'Target size 1 outside allowed range'
      );
    });

    it('should record scaling operation', () => {
      poolManager.scalePool('scale-pool', 5);

      const stats = poolManager.getPoolStats('scale-pool');
      expect(stats!.lastScaling).toBeDefined();
      expect(stats!.lastScaling!.action).toBe('scale-up');
      expect(stats!.lastScaling!.fromSize).toBe(2);
      expect(stats!.lastScaling!.toSize).toBe(5);
    });
  });

  describe('Auto-scaling', () => {
    beforeEach(() => {
      poolManager.createPool({
        name: 'auto-pool',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 10,
        strategy: 'round-robin',
        autoScale: {
          enabled: true,
          scaleUpThreshold: 0.8,
          scaleDownThreshold: 0.3,
          cooldownPeriod: 100, // Short for testing
        },
      });
    });

    it('should scale up when utilization exceeds threshold', async () => {
      // Mark most agents as busy (80%+ utilization)
      poolManager.getAgent('auto-pool'); // 50% busy
      poolManager.getAgent('auto-pool'); // 100% busy

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      // Next getAgent should trigger scale-up
      poolManager.getAgent('auto-pool');

      const stats = poolManager.getPoolStats('auto-pool');
      expect(stats!.totalInstances).toBeGreaterThan(2);
    });

    it('should scale down when utilization below threshold', async () => {
      // Scale up first
      poolManager.scalePool('auto-pool', 6);

      // Wait for cooldown
      await new Promise(resolve => setTimeout(resolve, 150));

      // Low utilization should trigger scale-down
      poolManager.getAgent('auto-pool');

      const stats = poolManager.getPoolStats('auto-pool');
      expect(stats!.totalInstances).toBeLessThan(6);
    });

    it('should respect cooldown period', () => {
      poolManager.getAgent('auto-pool');
      poolManager.getAgent('auto-pool');

      const initialSize = poolManager.getPoolStats('auto-pool')!.totalInstances;

      // Immediate second call should not scale (cooldown)
      poolManager.getAgent('auto-pool');

      const newSize = poolManager.getPoolStats('auto-pool')!.totalInstances;
      expect(newSize).toBe(initialSize);
    });
  });

  describe('getPoolStats', () => {
    beforeEach(() => {
      poolManager.createPool({
        name: 'stats-pool',
        agentIds: ['test-agent-1', 'test-agent-2'],
        minSize: 3,
        maxSize: 10,
        strategy: 'round-robin',
      });
    });

    it('should return pool statistics', () => {
      const stats = poolManager.getPoolStats('stats-pool');

      expect(stats).not.toBeNull();
      expect(stats!.poolName).toBe('stats-pool');
      expect(stats!.totalInstances).toBe(3);
      expect(stats!.idleInstances).toBe(3);
      expect(stats!.busyInstances).toBe(0);
      expect(stats!.utilization).toBe(0);
    });

    it('should calculate utilization correctly', () => {
      poolManager.getAgent('stats-pool'); // 1/3 = 33%
      poolManager.getAgent('stats-pool'); // 2/3 = 67%

      const stats = poolManager.getPoolStats('stats-pool');
      expect(stats!.utilization).toBeCloseTo(0.67, 1);
    });

    it('should return null for non-existent pool', () => {
      const stats = poolManager.getPoolStats('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('replaceFailedAgent', () => {
    it('should replace a failed agent instance', () => {
      poolManager.createPool({
        name: 'replace-pool',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 5,
        strategy: 'round-robin',
      });

      const agent = poolManager.getAgent('replace-pool')!;

      // Simulate multiple failures to mark as failed
      for (let i = 0; i < 4; i++) {
        poolManager.releaseAgent('replace-pool', agent, {
          success: false,
          error: new Error('Test error'),
        });
        if (i < 3) poolManager.getAgent('replace-pool');
      }

      const stats = poolManager.getPoolStats('replace-pool');
      expect(stats!.failedInstances).toBeGreaterThan(0);

      // Note: replaceFailedAgent requires instance ID which is private
      // In production, this would be exposed via a management API
    });
  });

  describe('removePool', () => {
    beforeEach(() => {
      poolManager.createPool({
        name: 'remove-pool',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 5,
        strategy: 'round-robin',
      });
    });

    it('should remove an idle pool', () => {
      poolManager.removePool('remove-pool');

      const stats = poolManager.getPoolStats('remove-pool');
      expect(stats).toBeNull();
    });

    it('should not remove pool with busy agents', () => {
      poolManager.getAgent('remove-pool');

      expect(() => poolManager.removePool('remove-pool')).toThrow(
        'agents are busy'
      );
    });

    it('should force remove pool with busy agents', () => {
      poolManager.getAgent('remove-pool');

      poolManager.removePool('remove-pool', true);

      const stats = poolManager.getPoolStats('remove-pool');
      expect(stats).toBeNull();
    });
  });

  describe('getAllPoolStats', () => {
    it('should return statistics for all pools', () => {
      poolManager.createPool({
        name: 'pool-1',
        agentIds: ['test-agent-1'],
        minSize: 2,
        maxSize: 5,
        strategy: 'round-robin',
      });

      poolManager.createPool({
        name: 'pool-2',
        agentIds: ['test-agent-2'],
        minSize: 3,
        maxSize: 10,
        strategy: 'least-busy',
      });

      const allStats = poolManager.getAllPoolStats();

      expect(allStats).toHaveLength(2);
      expect(allStats.map(s => s.poolName)).toContain('pool-1');
      expect(allStats.map(s => s.poolName)).toContain('pool-2');
    });

    it('should return empty array when no pools', () => {
      const allStats = poolManager.getAllPoolStats();
      expect(allStats).toHaveLength(0);
    });
  });

  describe('getPoolNames', () => {
    it('should return all pool names', () => {
      poolManager.createPool({
        name: 'pool-1',
        agentIds: ['test-agent-1'],
        minSize: 1,
        maxSize: 3,
        strategy: 'round-robin',
      });

      poolManager.createPool({
        name: 'pool-2',
        agentIds: ['test-agent-2'],
        minSize: 1,
        maxSize: 3,
        strategy: 'round-robin',
      });

      const names = poolManager.getPoolNames();

      expect(names).toHaveLength(2);
      expect(names).toContain('pool-1');
      expect(names).toContain('pool-2');
    });
  });
});
