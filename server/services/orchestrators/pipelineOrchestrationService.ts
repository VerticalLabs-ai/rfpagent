/**
 * Pipeline Orchestration Service for cross-pipeline coordination
 * Manages resource allocation, priority queuing, and load balancing across 3-tier agent system
 */

export interface ResourceConstraints {
  maxActiveWorkflows: number;
  maxConcurrentAgents: number;
  maxMemoryMB: number;
  maxCpuPercent: number;
  reservedCapacity: number; // 0-1, percentage to keep available
  maxWorkItemsPerAgent: number;
}

export interface ResourceAllocation {
  workflowId: string;
  allocatedAgents: string[];
  allocatedMemoryMB: number;
  allocatedCpuPercent: number;
  priorityBoost: number;
  timestamp: Date;
}

export interface PipelinePriority {
  level: 1 | 2 | 3 | 4 | 5; // 1=highest, 5=lowest
  factors: {
    deadline?: Date;
    businessValue?: number;
    complexity?: number;
    clientPriority?: number;
    resourceRequirements?: number;
  };
  calculatedScore: number;
  lastUpdated: Date;
}

export interface WorkloadBalance {
  agentId: string;
  tier: 'orchestrator' | 'manager' | 'specialist';
  currentWorkItems: number;
  maxWorkItems: number;
  utilizationPercent: number;
  avgTaskDuration: number;
  successRate: number;
  lastAssignedAt?: Date;
  capabilities: string[];
  health: 'healthy' | 'degraded' | 'unhealthy';
}

export interface PipelineCoordinationContext {
  orchestrationId: string;
  name: string;
  description: string;
  pipelineIds: string[];
  coordinationType:
    | 'sequential'
    | 'parallel'
    | 'conditional'
    | 'priority_based';
  currentStage: number;
  totalStages: number;
  resourceConstraints: ResourceConstraints;
  allocatedResources: ResourceAllocation[];
  dependencies: string[];
  completionCriteria: Record<string, any>;
  status: 'pending' | 'running' | 'suspended' | 'completed' | 'failed';
  metadata: Record<string, any>;
}

export class PipelineOrchestrationService {
  private activeOrchestrations: Map<string, PipelineCoordinationContext> =
    new Map();
  private resourceAllocations: Map<string, ResourceAllocation> = new Map();
  private workloadBalancer: Map<string, WorkloadBalance> = new Map();
  private priorityQueue: Map<number, string[]> = new Map(); // priority level -> workflow IDs
  private globalResourceConstraints!: ResourceConstraints;

  // Interval trackers for cleanup
  private resourceMonitoringInterval: NodeJS.Timeout | null = null;
  private priorityRebalancingInterval: NodeJS.Timeout | null = null;
  private loadBalancingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initializeGlobalResourceConstraints();
    this.initializeWorkloadBalancer();
    this.startResourceMonitoring();
    this.startPriorityRebalancing();
    this.startLoadBalancingOptimization();
  }

  /**
   * Initialize global resource constraints for the system
   */
  private initializeGlobalResourceConstraints(): void {
    console.log('🎛️ Initializing global resource constraints...');

    this.globalResourceConstraints = {
      maxActiveWorkflows: 50,
      maxConcurrentAgents: 20,
      maxMemoryMB: 8192,
      maxCpuPercent: 85,
      reservedCapacity: 0.15, // Keep 15% capacity reserved
      maxWorkItemsPerAgent: 5,
    };

    // Initialize priority queues
    for (let priority = 1; priority <= 5; priority++) {
      this.priorityQueue.set(priority, []);
    }

    console.log('✅ Global resource constraints initialized');
  }

  /**
   * Initialize workload balancer with agent registry
   */
  private async initializeWorkloadBalancer(): Promise<void> {
    console.log('⚖️ Initializing workload balancer...');

    try {
      const { storage } = await import('../../storage');
      const agents = await storage.getAllAgentRegistries();

      for (const agent of agents) {
        const workloadBalance: WorkloadBalance = {
          agentId: agent.agentId,
          tier: agent.tier as any,
          currentWorkItems: 0,
          maxWorkItems: this.calculateMaxWorkItemsForAgent(
            agent.tier,
            agent.capabilities
          ),
          utilizationPercent: 0,
          avgTaskDuration: 0,
          successRate: 1.0,
          capabilities: agent.capabilities,
          health: agent.status === 'active' ? 'healthy' : 'unhealthy',
        };

        this.workloadBalancer.set(agent.agentId, workloadBalance);
      }

      console.log(
        `✅ Workload balancer initialized with ${agents.length} agents`
      );
    } catch (error) {
      console.error('❌ Error initializing workload balancer:', error);
    }
  }

  /**
   * Calculate maximum work items for an agent based on tier and capabilities
   */
  private calculateMaxWorkItemsForAgent(
    tier: string,
    capabilities: string[]
  ): number {
    const baseLimits = {
      orchestrator: 3,
      manager: 4,
      specialist: 6,
    };

    let maxItems = baseLimits[tier as keyof typeof baseLimits] || 3;

    // Adjust based on capabilities
    const complexCapabilities = [
      'ai_generation',
      'compliance_checking',
      'document_processing',
    ];
    const hasComplexCapabilities = capabilities.some(cap =>
      complexCapabilities.includes(cap)
    );

    if (hasComplexCapabilities) {
      maxItems = Math.max(2, maxItems - 1); // Reduce for complex tasks
    }

    return Math.min(
      maxItems,
      this.globalResourceConstraints.maxWorkItemsPerAgent
    );
  }

  /**
   * Create a new pipeline orchestration
   */
  async createPipelineOrchestration(
    name: string,
    description: string,
    pipelineIds: string[],
    coordinationType:
      | 'sequential'
      | 'parallel'
      | 'conditional'
      | 'priority_based',
    options: {
      resourceConstraints?: Partial<ResourceConstraints>;
      dependencies?: string[];
      completionCriteria?: Record<string, any>;
      priority?: number;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<string> {
    const orchestrationId = `orchestration_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const orchestration: PipelineCoordinationContext = {
      orchestrationId,
      name,
      description,
      pipelineIds,
      coordinationType,
      currentStage: 0,
      totalStages: this.calculateTotalStages(coordinationType, pipelineIds),
      resourceConstraints: {
        ...this.globalResourceConstraints,
        ...options.resourceConstraints,
      },
      allocatedResources: [],
      dependencies: options.dependencies || [],
      completionCriteria: options.completionCriteria || {},
      status: 'pending',
      metadata: {
        ...options.metadata,
        createdAt: new Date().toISOString(),
        priority: options.priority || 3,
      },
    };

    // Store in database
    try {
      const { storage } = await import('../../storage');
      await storage.createPipelineOrchestration({
        orchestrationId,
        name,
        description,
        pipelineIds,
        coordinationType,
        currentStage: 0,
        totalStages: orchestration.totalStages,
        priority: options.priority || 3,
        resourceConstraints: orchestration.resourceConstraints,
        allocatedResources: {},
        dependencies: options.dependencies,
        completionCriteria: options.completionCriteria,
        failureHandling: {},
        estimatedDuration: this.estimateOrchestrationDuration(
          pipelineIds,
          coordinationType
        ),
      });
    } catch (error) {
      console.error(
        `❌ Failed to store orchestration ${orchestrationId}:`,
        error
      );
    }

    // Store in memory
    this.activeOrchestrations.set(orchestrationId, orchestration);

    // Add to priority queue
    this.addToPriorityQueue(orchestrationId, options.priority || 3);

    console.log(
      `🎭 Created pipeline orchestration: ${orchestrationId} (${coordinationType})`
    );
    return orchestrationId;
  }

  /**
   * Calculate total stages for an orchestration type
   */
  private calculateTotalStages(
    coordinationType: string,
    pipelineIds: string[]
  ): number {
    switch (coordinationType) {
      case 'sequential':
        return pipelineIds.length;
      case 'parallel':
        return 1; // All pipelines run simultaneously
      case 'conditional':
        return Math.ceil(pipelineIds.length / 2); // Estimate based on branching
      case 'priority_based':
        return pipelineIds.length; // Similar to sequential but with priority ordering
      default:
        return pipelineIds.length;
    }
  }

  /**
   * Estimate orchestration duration based on pipelines and coordination type
   */
  private estimateOrchestrationDuration(
    pipelineIds: string[],
    coordinationType: string
  ): number {
    const avgPipelineDuration = 45; // minutes - estimated average RFP pipeline duration

    switch (coordinationType) {
      case 'sequential':
        return avgPipelineDuration * pipelineIds.length;
      case 'parallel':
        return avgPipelineDuration; // All run simultaneously
      case 'conditional':
        return avgPipelineDuration * Math.ceil(pipelineIds.length / 2);
      case 'priority_based':
        return avgPipelineDuration * pipelineIds.length * 0.8; // Slight efficiency gain
      default:
        return avgPipelineDuration * pipelineIds.length;
    }
  }

  /**
   * Add orchestration to priority queue
   */
  private addToPriorityQueue(orchestrationId: string, priority: number): void {
    const priorityLevel = Math.max(1, Math.min(5, priority));
    const queue = this.priorityQueue.get(priorityLevel) || [];
    queue.push(orchestrationId);
    this.priorityQueue.set(priorityLevel, queue);
  }

  /**
   * Remove orchestration from priority queue
   */
  private removeFromPriorityQueue(orchestrationId: string): void {
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.priorityQueue.get(priority) || [];
      const index = queue.indexOf(orchestrationId);
      if (index >= 0) {
        queue.splice(index, 1);
        this.priorityQueue.set(priority, queue);
        break;
      }
    }
  }

  /**
   * Allocate resources for a pipeline orchestration
   */
  async allocateResourcesForOrchestration(orchestrationId: string): Promise<{
    success: boolean;
    allocation?: ResourceAllocation;
    error?: string;
  }> {
    const orchestration = this.activeOrchestrations.get(orchestrationId);
    if (!orchestration) {
      return {
        success: false,
        error: `Orchestration ${orchestrationId} not found`,
      };
    }

    console.log(
      `🔧 Allocating resources for orchestration: ${orchestrationId}`
    );

    try {
      // Check if we have available resources
      const availableResources = await this.calculateAvailableResources();
      const requiredResources = this.calculateRequiredResources(orchestration);

      if (!this.canAllocateResources(availableResources, requiredResources)) {
        return {
          success: false,
          error: `Insufficient resources: need ${JSON.stringify(requiredResources)}, available ${JSON.stringify(availableResources)}`,
        };
      }

      // Select optimal agents for this orchestration
      const allocatedAgents = await this.selectOptimalAgents(
        orchestration.pipelineIds,
        orchestration.metadata.priority || 3
      );

      const allocation: ResourceAllocation = {
        workflowId: orchestrationId,
        allocatedAgents: allocatedAgents.map(agent => agent.agentId),
        allocatedMemoryMB: requiredResources.memoryMB,
        allocatedCpuPercent: requiredResources.cpuPercent,
        priorityBoost: this.calculatePriorityBoost(
          orchestration.metadata.priority || 3
        ),
        timestamp: new Date(),
      };

      // Update agent workloads
      for (const agent of allocatedAgents) {
        const workload = this.workloadBalancer.get(agent.agentId);
        if (workload) {
          workload.currentWorkItems +=
            this.estimateWorkItemsForPipeline(orchestration);
          workload.utilizationPercent =
            (workload.currentWorkItems / workload.maxWorkItems) * 100;
        }
      }

      // Store allocation
      this.resourceAllocations.set(orchestrationId, allocation);
      orchestration.allocatedResources.push(allocation);
      orchestration.status = 'running';

      console.log(
        `✅ Resources allocated for orchestration ${orchestrationId}: ${allocatedAgents.length} agents`
      );

      return { success: true, allocation };
    } catch (error) {
      console.error(
        `❌ Resource allocation failed for ${orchestrationId}:`,
        error
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Calculate available system resources
   */
  private async calculateAvailableResources(): Promise<{
    agents: number;
    memoryMB: number;
    cpuPercent: number;
  }> {
    const activeAgents = Array.from(this.workloadBalancer.values()).filter(
      agent => agent.health === 'healthy' && agent.utilizationPercent < 90
    ).length;

    const reservedCapacity = this.globalResourceConstraints.reservedCapacity;

    return {
      agents: Math.floor(activeAgents * (1 - reservedCapacity)),
      memoryMB: Math.floor(
        this.globalResourceConstraints.maxMemoryMB * (1 - reservedCapacity)
      ),
      cpuPercent: Math.floor(
        this.globalResourceConstraints.maxCpuPercent * (1 - reservedCapacity)
      ),
    };
  }

  /**
   * Calculate required resources for an orchestration
   */
  private calculateRequiredResources(
    orchestration: PipelineCoordinationContext
  ): { agents: number; memoryMB: number; cpuPercent: number } {
    const basePipelineRequirements = {
      agents: 2, // Minimum agents per pipeline
      memoryMB: 256, // Base memory per pipeline
      cpuPercent: 15, // Base CPU per pipeline
    };

    let multiplier = 1;
    switch (orchestration.coordinationType) {
      case 'sequential':
        multiplier = 1; // Process one at a time
        break;
      case 'parallel':
        multiplier = orchestration.pipelineIds.length; // All simultaneously
        break;
      case 'conditional':
        multiplier = Math.ceil(orchestration.pipelineIds.length / 2); // Estimate concurrent branches
        break;
      case 'priority_based':
        multiplier = Math.min(3, orchestration.pipelineIds.length); // Limited parallelism
        break;
    }

    return {
      agents: basePipelineRequirements.agents * multiplier,
      memoryMB: basePipelineRequirements.memoryMB * multiplier,
      cpuPercent: basePipelineRequirements.cpuPercent * multiplier,
    };
  }

  /**
   * Check if resources can be allocated
   */
  private canAllocateResources(
    available: { agents: number; memoryMB: number; cpuPercent: number },
    required: { agents: number; memoryMB: number; cpuPercent: number }
  ): boolean {
    return (
      available.agents >= required.agents &&
      available.memoryMB >= required.memoryMB &&
      available.cpuPercent >= required.cpuPercent
    );
  }

  /**
   * Select optimal agents for pipelines based on capabilities, load, and priority
   */
  private async selectOptimalAgents(
    pipelineIds: string[],
    priority: number
  ): Promise<WorkloadBalance[]> {
    const availableAgents = Array.from(this.workloadBalancer.values()).filter(
      agent =>
        agent.health === 'healthy' &&
        agent.utilizationPercent < 85 &&
        agent.currentWorkItems < agent.maxWorkItems
    );

    // Sort by selection criteria
    const scoredAgents = availableAgents
      .map(agent => ({
        agent,
        score: this.calculateAgentSelectionScore(agent, priority),
      }))
      .sort((a, b) => b.score - a.score);

    // Select agents based on required capabilities
    const selectedAgents: WorkloadBalance[] = [];
    const requiredCapabilities = [
      'portal_scraping',
      'compliance_checking',
      'proposal_generation',
      'portal_automation',
    ];

    // Ensure we have coverage for all required capabilities
    for (const capability of requiredCapabilities) {
      const capableAgent = scoredAgents.find(
        ({ agent }) =>
          agent.capabilities.includes(capability) &&
          !selectedAgents.includes(agent)
      );

      if (capableAgent) {
        selectedAgents.push(capableAgent.agent);
      }
    }

    // Add additional agents for load distribution
    const remainingSlots = Math.max(0, 2 - selectedAgents.length); // At least 2 agents per orchestration
    for (let i = 0; i < remainingSlots && i < scoredAgents.length; i++) {
      const agent = scoredAgents[i].agent;
      if (!selectedAgents.includes(agent)) {
        selectedAgents.push(agent);
      }
    }

    return selectedAgents;
  }

  /**
   * Calculate agent selection score based on multiple factors
   */
  private calculateAgentSelectionScore(
    agent: WorkloadBalance,
    priority: number
  ): number {
    let score = 0;

    // Load factor (higher score for less loaded agents)
    score += (100 - agent.utilizationPercent) * 0.3;

    // Success rate (higher score for more successful agents)
    score += agent.successRate * 100 * 0.25;

    // Tier bonus (specialists get bonus for complex tasks)
    if (agent.tier === 'specialist') score += 20;
    if (agent.tier === 'manager') score += 10;

    // Health factor
    if (agent.health === 'healthy') score += 15;

    // Capability diversity (more capabilities = higher score)
    score += Math.min(agent.capabilities.length * 2, 20);

    // Priority adjustment
    if (priority <= 2) score += 10; // Boost for high priority

    // Recency bonus (avoid agents that were just assigned)
    if (
      !agent.lastAssignedAt ||
      Date.now() - agent.lastAssignedAt.getTime() > 300000
    ) {
      score += 5; // 5 minute cooldown bonus
    }

    return score;
  }

  /**
   * Calculate priority boost for resource allocation
   */
  private calculatePriorityBoost(priority: number): number {
    const boostMap = {
      1: 2.0, // Critical priority gets 2x boost
      2: 1.5, // High priority gets 1.5x boost
      3: 1.0, // Normal priority (no boost)
      4: 0.8, // Low priority gets slight reduction
      5: 0.6, // Lowest priority gets significant reduction
    };

    return boostMap[priority as keyof typeof boostMap] || 1.0;
  }

  /**
   * Estimate work items for a pipeline orchestration
   */
  private estimateWorkItemsForPipeline(
    orchestration: PipelineCoordinationContext
  ): number {
    // Base work items per RFP pipeline phase
    const baseWorkItems = 4; // discovery, analysis, generation, submission

    switch (orchestration.coordinationType) {
      case 'sequential':
        return baseWorkItems;
      case 'parallel':
        return baseWorkItems * orchestration.pipelineIds.length;
      case 'conditional':
        return baseWorkItems * 2; // Estimate for branching
      case 'priority_based':
        return baseWorkItems + 1; // Slight overhead for prioritization
      default:
        return baseWorkItems;
    }
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    console.log('📊 Starting resource monitoring...');

    this.resourceMonitoringInterval = setInterval(async () => {
      await this.updateResourceUtilization();
      await this.detectResourceContentions();
      await this.optimizeResourceDistribution();
    }, 30000); // Every 30 seconds
  }

  /**
   * Update resource utilization metrics
   */
  private async updateResourceUtilization(): Promise<void> {
    try {
      const { storage } = await import('../../storage');

      // Update agent workloads with actual work item counts
      const workItems = await storage.getWorkItems();
      const agentWorkItemCounts = new Map<string, number>();

      // Count active work items per agent
      for (const item of workItems) {
        if (
          item.assignedAgentId &&
          ['assigned', 'in_progress'].includes(item.status)
        ) {
          const count = agentWorkItemCounts.get(item.assignedAgentId) || 0;
          agentWorkItemCounts.set(item.assignedAgentId, count + 1);
        }
      }

      // Update workload balancer
      for (const [agentId, workload] of this.workloadBalancer) {
        const actualWorkItems = agentWorkItemCounts.get(agentId) || 0;
        workload.currentWorkItems = actualWorkItems;
        workload.utilizationPercent =
          (actualWorkItems / workload.maxWorkItems) * 100;

        // Update health based on utilization
        if (workload.utilizationPercent > 95) {
          workload.health = 'unhealthy';
        } else if (workload.utilizationPercent > 80) {
          workload.health = 'degraded';
        } else {
          workload.health = 'healthy';
        }
      }
    } catch (error) {
      console.error('❌ Error updating resource utilization:', error);
    }
  }

  /**
   * Detect resource contentions and bottlenecks
   */
  private async detectResourceContentions(): Promise<void> {
    const overloadedAgents = Array.from(this.workloadBalancer.values()).filter(
      agent => agent.utilizationPercent > 90
    );

    const underutilizedAgents = Array.from(
      this.workloadBalancer.values()
    ).filter(
      agent => agent.utilizationPercent < 30 && agent.health === 'healthy'
    );

    if (overloadedAgents.length > 0) {
      console.log(
        `⚠️ Resource contention detected: ${overloadedAgents.length} overloaded agents`
      );

      // Attempt load redistribution
      await this.redistributeWorkload(overloadedAgents, underutilizedAgents);
    }

    // Check for memory/CPU constraints
    const totalUtilization = this.calculateSystemUtilization();
    if (
      totalUtilization.cpuPercent > 85 ||
      totalUtilization.memoryPercent > 90
    ) {
      console.log(
        `🚨 System resource pressure: CPU ${totalUtilization.cpuPercent}%, Memory ${totalUtilization.memoryPercent}%`
      );
      await this.handleResourcePressure();
    }
  }

  /**
   * Calculate overall system utilization
   */
  private calculateSystemUtilization(): {
    cpuPercent: number;
    memoryPercent: number;
    agentUtilization: number;
  } {
    const agents = Array.from(this.workloadBalancer.values());
    const avgUtilization =
      agents.reduce((sum, agent) => sum + agent.utilizationPercent, 0) /
      agents.length;

    // Estimate CPU and memory based on agent utilization
    const estimatedCpuPercent = avgUtilization * 0.8; // Rough estimation
    const estimatedMemoryPercent = avgUtilization * 0.6; // Rough estimation

    return {
      cpuPercent: estimatedCpuPercent,
      memoryPercent: estimatedMemoryPercent,
      agentUtilization: avgUtilization,
    };
  }

  /**
   * Redistribute workload between agents
   */
  private async redistributeWorkload(
    overloadedAgents: WorkloadBalance[],
    underutilizedAgents: WorkloadBalance[]
  ): Promise<void> {
    if (underutilizedAgents.length === 0) {
      console.log('⚠️ No underutilized agents available for redistribution');
      return;
    }

    try {
      const { storage } = await import('../../storage');

      for (const overloadedAgent of overloadedAgents) {
        // Find work items that can be reassigned
        const workItems = await storage.getWorkItemsByAgent(
          overloadedAgent.agentId
        );
        const reassignableItems = workItems.filter(
          item =>
            item.status === 'assigned' && // Not yet started
            !item.isBlocking // Not blocking other work
        );

        // Reassign items to underutilized agents
        for (const item of reassignableItems.slice(0, 2)) {
          // Max 2 items per redistribution
          const targetAgent = underutilizedAgents.find(agent =>
            agent.capabilities.some(cap =>
              (item.metadata as any)?.requiredCapabilities?.includes(cap)
            )
          );

          if (targetAgent) {
            await storage.updateWorkItem(item.id, {
              assignedAgentId: targetAgent.agentId,
              updatedAt: new Date(),
            });

            // Update workload tracking
            overloadedAgent.currentWorkItems--;
            targetAgent.currentWorkItems++;
            targetAgent.lastAssignedAt = new Date();

            console.log(
              `🔄 Redistributed work item ${item.id}: ${overloadedAgent.agentId} → ${targetAgent.agentId}`
            );
          }
        }
      }
    } catch (error) {
      console.error('❌ Error redistributing workload:', error);
    }
  }

  /**
   * Handle system resource pressure
   */
  private async handleResourcePressure(): Promise<void> {
    console.log('🚨 Handling system resource pressure...');

    // 1. Pause lower priority orchestrations
    const lowPriorityOrchestrations = Array.from(
      this.activeOrchestrations.values()
    )
      .filter(
        orch => (orch.metadata.priority || 3) >= 4 && orch.status === 'running'
      )
      .slice(0, 3); // Pause up to 3 low priority orchestrations

    for (const orchestration of lowPriorityOrchestrations) {
      await this.suspendOrchestration(
        orchestration.orchestrationId,
        'system',
        'Resource pressure mitigation'
      );
    }

    // 2. Reduce resource allocations for non-critical orchestrations
    await this.optimizeResourceDistribution();

    // 3. Alert administrators (in a real system, this would send notifications)
    console.log(
      '📢 SYSTEM ALERT: High resource utilization detected. Consider scaling resources.'
    );
  }

  /**
   * Optimize resource distribution across active orchestrations
   */
  private async optimizeResourceDistribution(): Promise<void> {
    const activeOrchestrations = Array.from(
      this.activeOrchestrations.values()
    ).filter(orch => orch.status === 'running');

    if (activeOrchestrations.length === 0) {
      return;
    }

    // Sort by priority (higher priority gets better resources)
    activeOrchestrations.sort(
      (a, b) => (a.metadata.priority || 3) - (b.metadata.priority || 3)
    );

    // Rebalance allocations
    for (const orchestration of activeOrchestrations) {
      const allocation = this.resourceAllocations.get(
        orchestration.orchestrationId
      );
      if (allocation) {
        const priorityBoost = this.calculatePriorityBoost(
          orchestration.metadata.priority || 3
        );
        allocation.priorityBoost = priorityBoost;

        // Update allocated resources if needed
        if (priorityBoost < 1.0) {
          // Reduce allocation for lower priority orchestrations
          const reducedAgents = Math.floor(
            allocation.allocatedAgents.length * priorityBoost
          );
          if (reducedAgents < allocation.allocatedAgents.length) {
            console.log(
              `📉 Reducing agents for orchestration ${orchestration.orchestrationId}: ${allocation.allocatedAgents.length} → ${reducedAgents}`
            );
          }
        }
      }
    }
  }

  /**
   * Start priority rebalancing
   */
  private startPriorityRebalancing(): void {
    console.log('🎯 Starting priority rebalancing...');

    this.priorityRebalancingInterval = setInterval(async () => {
      await this.rebalancePriorities();
      await this.processHighPriorityQueue();
    }, 15000); // Every 15 seconds
  }

  /**
   * Rebalance priorities based on changing conditions
   */
  private async rebalancePriorities(): Promise<void> {
    for (const [orchestrationId, orchestration] of this.activeOrchestrations) {
      if (
        orchestration.status === 'running' ||
        orchestration.status === 'pending'
      ) {
        const newPriority = this.calculateDynamicPriority(orchestration);
        const currentPriority = orchestration.metadata.priority || 3;

        if (newPriority !== currentPriority) {
          console.log(
            `🎯 Priority updated for ${orchestrationId}: ${currentPriority} → ${newPriority}`
          );

          // Remove from old priority queue
          this.removeFromPriorityQueue(orchestrationId);

          // Update priority
          orchestration.metadata.priority = newPriority;

          // Add to new priority queue
          this.addToPriorityQueue(orchestrationId, newPriority);
        }
      }
    }
  }

  /**
   * Calculate dynamic priority based on current conditions
   */
  private calculateDynamicPriority(
    orchestration: PipelineCoordinationContext
  ): number {
    let priority = orchestration.metadata.priority || 3;

    // Deadline urgency
    if (orchestration.metadata.deadline) {
      const deadline = new Date(orchestration.metadata.deadline);
      const now = new Date();
      const hoursUntilDeadline =
        (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilDeadline <= 6)
        priority = Math.min(priority, 1); // Critical
      else if (hoursUntilDeadline <= 24) priority = Math.min(priority, 2); // High
    }

    // Business value boost
    if (orchestration.metadata.businessValue > 10000) {
      priority = Math.min(priority, 2);
    }

    // Age factor (older pending orchestrations get priority boost)
    const age =
      Date.now() - new Date(orchestration.metadata.createdAt).getTime();
    const ageHours = age / (1000 * 60 * 60);
    if (ageHours > 2 && orchestration.status === 'pending') {
      priority = Math.max(1, priority - 1);
    }

    return Math.max(1, Math.min(5, priority));
  }

  /**
   * Process high priority queue
   */
  private async processHighPriorityQueue(): Promise<void> {
    // Process queues in priority order (1 = highest)
    for (let priority = 1; priority <= 5; priority++) {
      const queue = this.priorityQueue.get(priority) || [];

      for (const orchestrationId of queue.slice(0, 3)) {
        // Process up to 3 at a time
        const orchestration = this.activeOrchestrations.get(orchestrationId);

        if (orchestration && orchestration.status === 'pending') {
          const allocation =
            await this.allocateResourcesForOrchestration(orchestrationId);

          if (allocation.success) {
            this.removeFromPriorityQueue(orchestrationId);
            console.log(
              `🚀 Started orchestration ${orchestrationId} (priority ${priority})`
            );

            // Start the orchestration execution
            await this.executeOrchestration(orchestrationId);
          } else {
            console.log(
              `⏸️ Orchestration ${orchestrationId} waiting for resources: ${allocation.error}`
            );
          }
        }
      }

      // If high priority items are being processed, give them more resources
      if (priority <= 2 && queue.length > 0) {
        break; // Focus on high priority items first
      }
    }
  }

  /**
   * Start load balancing optimization
   */
  private startLoadBalancingOptimization(): void {
    console.log('⚖️ Starting load balancing optimization...');

    this.loadBalancingInterval = setInterval(async () => {
      await this.optimizeLoadBalancing();
      await this.updateAgentPerformanceMetrics();
    }, 45000); // Every 45 seconds
  }

  /**
   * Shutdown and cleanup all resources
   * Should be called on application shutdown to prevent memory leaks
   */
  shutdown(): void {
    console.log('🛑 PipelineOrchestrationService shutdown initiated...');

    // Stop all monitoring intervals
    if (this.resourceMonitoringInterval) {
      clearInterval(this.resourceMonitoringInterval);
      this.resourceMonitoringInterval = null;
    }
    if (this.priorityRebalancingInterval) {
      clearInterval(this.priorityRebalancingInterval);
      this.priorityRebalancingInterval = null;
    }
    if (this.loadBalancingInterval) {
      clearInterval(this.loadBalancingInterval);
      this.loadBalancingInterval = null;
    }

    // Clear all data structures
    this.activeOrchestrations.clear();
    this.resourceAllocations.clear();
    this.workloadBalancer.clear();
    this.priorityQueue.clear();

    console.log('✅ PipelineOrchestrationService shutdown complete');
  }

  /**
   * Optimize load balancing across agents
   */
  private async optimizeLoadBalancing(): Promise<void> {
    const agents = Array.from(this.workloadBalancer.values());
    const avgUtilization =
      agents.reduce((sum, agent) => sum + agent.utilizationPercent, 0) /
      agents.length;

    // Find agents that deviate significantly from average
    const threshold = 25; // 25% deviation threshold
    const overloadedAgents = agents.filter(
      agent =>
        agent.utilizationPercent > avgUtilization + threshold &&
        agent.health !== 'unhealthy'
    );
    const underloadedAgents = agents.filter(
      agent =>
        agent.utilizationPercent < avgUtilization - threshold &&
        agent.health === 'healthy'
    );

    if (overloadedAgents.length > 0 && underloadedAgents.length > 0) {
      console.log(
        `⚖️ Load balancing: ${overloadedAgents.length} overloaded, ${underloadedAgents.length} underloaded`
      );
      await this.redistributeWorkload(overloadedAgents, underloadedAgents);
    }
  }

  /**
   * Update agent performance metrics
   */
  private async updateAgentPerformanceMetrics(): Promise<void> {
    try {
      const { storage } = await import('../../storage');

      for (const [agentId, workload] of this.workloadBalancer) {
        // Get completed work items for this agent in the last hour
        const completedItems =
          await storage.getCompletedWorkItemsByAgentInTimeRange(
            agentId,
            new Date(Date.now() - 3600000), // 1 hour ago
            new Date()
          );

        if (completedItems.length > 0) {
          // Calculate success rate
          const successfulItems = completedItems.filter(
            item => item.status === 'completed'
          ).length;
          workload.successRate = successfulItems / completedItems.length;

          // Calculate average task duration
          const durations = completedItems
            .filter(item => item.startedAt && item.completedAt)
            .map(
              item =>
                new Date(item.completedAt!).getTime() -
                new Date(item.startedAt!).getTime()
            );

          if (durations.length > 0) {
            workload.avgTaskDuration =
              durations.reduce((sum, duration) => sum + duration, 0) /
              durations.length /
              (1000 * 60); // minutes
          }
        }
      }
    } catch (error) {
      console.error('❌ Error updating agent performance metrics:', error);
    }
  }

  /**
   * Execute a pipeline orchestration
   */
  private async executeOrchestration(orchestrationId: string): Promise<void> {
    const orchestration = this.activeOrchestrations.get(orchestrationId);
    if (!orchestration) {
      return;
    }

    console.log(
      `🎭 Executing orchestration: ${orchestrationId} (${orchestration.coordinationType})`
    );

    try {
      switch (orchestration.coordinationType) {
        case 'sequential':
          await this.executeSequentialOrchestration(orchestration);
          break;
        case 'parallel':
          await this.executeParallelOrchestration(orchestration);
          break;
        case 'conditional':
          await this.executeConditionalOrchestration(orchestration);
          break;
        case 'priority_based':
          await this.executePriorityBasedOrchestration(orchestration);
          break;
      }
    } catch (error) {
      console.error(
        `❌ Orchestration execution failed ${orchestrationId}:`,
        error
      );
      orchestration.status = 'failed';
      orchestration.metadata.failedAt = new Date().toISOString();
      orchestration.metadata.failureReason =
        error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Execute sequential orchestration
   */
  private async executeSequentialOrchestration(
    orchestration: PipelineCoordinationContext
  ): Promise<void> {
    console.log(
      `📊 Sequential orchestration started: ${orchestration.orchestrationId}`
    );

    for (let i = 0; i < orchestration.pipelineIds.length; i++) {
      const pipelineId = orchestration.pipelineIds[i];
      orchestration.currentStage = i + 1;

      console.log(
        `🔄 Processing pipeline ${i + 1}/${orchestration.pipelineIds.length}: ${pipelineId}`
      );

      // In a real implementation, this would start the actual pipeline workflow
      // For now, we'll simulate the process
      await this.simulatePipelineExecution(pipelineId);

      // Check if orchestration should continue
      if (
        orchestration.status === 'suspended' ||
        orchestration.status === 'failed'
      ) {
        break;
      }
    }

    if (orchestration.status === 'running') {
      orchestration.status = 'completed';
      orchestration.metadata.completedAt = new Date().toISOString();
      console.log(
        `✅ Sequential orchestration completed: ${orchestration.orchestrationId}`
      );
    }
  }

  /**
   * Execute parallel orchestration
   */
  private async executeParallelOrchestration(
    orchestration: PipelineCoordinationContext
  ): Promise<void> {
    console.log(
      `🔀 Parallel orchestration started: ${orchestration.orchestrationId}`
    );

    orchestration.currentStage = 1;

    // Start all pipelines simultaneously
    const pipelinePromises = orchestration.pipelineIds.map(pipelineId =>
      this.simulatePipelineExecution(pipelineId)
    );

    try {
      await Promise.all(pipelinePromises);

      if (orchestration.status === 'running') {
        orchestration.status = 'completed';
        orchestration.metadata.completedAt = new Date().toISOString();
        console.log(
          `✅ Parallel orchestration completed: ${orchestration.orchestrationId}`
        );
      }
    } catch (error) {
      console.error(
        `❌ Parallel orchestration failed: ${orchestration.orchestrationId}`,
        error
      );
      orchestration.status = 'failed';
    }
  }

  /**
   * Execute conditional orchestration
   */
  private async executeConditionalOrchestration(
    orchestration: PipelineCoordinationContext
  ): Promise<void> {
    console.log(
      `🔀 Conditional orchestration started: ${orchestration.orchestrationId}`
    );

    // Simplified conditional logic - in reality this would be much more sophisticated
    for (let i = 0; i < orchestration.pipelineIds.length; i++) {
      const pipelineId = orchestration.pipelineIds[i];
      orchestration.currentStage = Math.ceil((i + 1) / 2);

      // Simple condition: process every other pipeline, or all if high priority
      const shouldProcess =
        (orchestration.metadata.priority || 3) <= 2 || i % 2 === 0;

      if (shouldProcess) {
        console.log(`🔄 Conditionally processing pipeline: ${pipelineId}`);
        await this.simulatePipelineExecution(pipelineId);
      } else {
        console.log(`⏭️ Skipping pipeline based on conditions: ${pipelineId}`);
      }

      if (
        orchestration.status === 'suspended' ||
        orchestration.status === 'failed'
      ) {
        break;
      }
    }

    if (orchestration.status === 'running') {
      orchestration.status = 'completed';
      orchestration.metadata.completedAt = new Date().toISOString();
      console.log(
        `✅ Conditional orchestration completed: ${orchestration.orchestrationId}`
      );
    }
  }

  /**
   * Execute priority-based orchestration
   */
  private async executePriorityBasedOrchestration(
    orchestration: PipelineCoordinationContext
  ): Promise<void> {
    console.log(
      `🎯 Priority-based orchestration started: ${orchestration.orchestrationId}`
    );

    // Sort pipelines by priority (would use actual pipeline priorities in real implementation)
    const prioritizedPipelines = [...orchestration.pipelineIds].sort(() => {
      // Simulate priority sorting - in reality this would look up actual pipeline priorities
      return Math.random() - 0.5; // Random for demonstration
    });

    for (let i = 0; i < prioritizedPipelines.length; i++) {
      const pipelineId = prioritizedPipelines[i];
      orchestration.currentStage = i + 1;

      console.log(
        `🔄 Processing prioritized pipeline ${i + 1}/${prioritizedPipelines.length}: ${pipelineId}`
      );
      await this.simulatePipelineExecution(pipelineId);

      if (
        orchestration.status === 'suspended' ||
        orchestration.status === 'failed'
      ) {
        break;
      }
    }

    if (orchestration.status === 'running') {
      orchestration.status = 'completed';
      orchestration.metadata.completedAt = new Date().toISOString();
      console.log(
        `✅ Priority-based orchestration completed: ${orchestration.orchestrationId}`
      );
    }
  }

  /**
   * Simulate pipeline execution (in real implementation, this would integrate with workflow engine)
   */
  private async simulatePipelineExecution(pipelineId: string): Promise<void> {
    const executionTime = Math.random() * 2000 + 500; // 0.5-2.5 seconds simulation
    await new Promise(resolve => setTimeout(resolve, executionTime));

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error(`Simulated pipeline failure: ${pipelineId}`);
    }

    console.log(
      `✅ Pipeline simulation completed: ${pipelineId} (${Math.round(executionTime)}ms)`
    );
  }

  /**
   * Suspend an orchestration
   */
  async suspendOrchestration(
    orchestrationId: string,
    triggeredBy: string,
    reason?: string
  ): Promise<{ success: boolean; error?: string }> {
    const orchestration = this.activeOrchestrations.get(orchestrationId);
    if (!orchestration) {
      return {
        success: false,
        error: `Orchestration ${orchestrationId} not found`,
      };
    }

    if (orchestration.status !== 'running') {
      return {
        success: false,
        error: `Orchestration is not running (current status: ${orchestration.status})`,
      };
    }

    orchestration.status = 'suspended';
    orchestration.metadata.suspendedAt = new Date().toISOString();
    orchestration.metadata.suspendedBy = triggeredBy;
    orchestration.metadata.suspensionReason = reason;

    // Free up allocated resources
    const allocation = this.resourceAllocations.get(orchestrationId);
    if (allocation) {
      for (const agentId of allocation.allocatedAgents) {
        const workload = this.workloadBalancer.get(agentId);
        if (workload) {
          workload.currentWorkItems = Math.max(
            0,
            workload.currentWorkItems - 1
          );
          workload.utilizationPercent =
            (workload.currentWorkItems / workload.maxWorkItems) * 100;
        }
      }
    }

    console.log(
      `⏸️ Orchestration ${orchestrationId} suspended by ${triggeredBy}`
    );
    return { success: true };
  }

  /**
   * Resume a suspended orchestration
   */
  async resumeOrchestration(
    orchestrationId: string,
    triggeredBy: string
  ): Promise<{ success: boolean; error?: string }> {
    const orchestration = this.activeOrchestrations.get(orchestrationId);
    if (!orchestration) {
      return {
        success: false,
        error: `Orchestration ${orchestrationId} not found`,
      };
    }

    if (orchestration.status !== 'suspended') {
      return {
        success: false,
        error: `Orchestration is not suspended (current status: ${orchestration.status})`,
      };
    }

    // Try to reallocate resources
    const allocation =
      await this.allocateResourcesForOrchestration(orchestrationId);
    if (!allocation.success) {
      return { success: false, error: `Cannot resume - ${allocation.error}` };
    }

    orchestration.status = 'running';
    orchestration.metadata.resumedAt = new Date().toISOString();
    orchestration.metadata.resumedBy = triggeredBy;
    delete orchestration.metadata.suspendedAt;
    delete orchestration.metadata.suspensionReason;

    console.log(
      `▶️ Orchestration ${orchestrationId} resumed by ${triggeredBy}`
    );
    return { success: true };
  }

  /**
   * Get orchestration status and metrics
   */
  getOrchestrationStatus(
    orchestrationId: string
  ): PipelineCoordinationContext | undefined {
    return this.activeOrchestrations.get(orchestrationId);
  }

  /**
   * Get system-wide orchestration metrics
   */
  getSystemMetrics(): {
    activeOrchestrations: number;
    totalResourceUtilization: number;
    agentHealth: { healthy: number; degraded: number; unhealthy: number };
    priorityQueueLengths: Record<number, number>;
    systemLoad: {
      cpuPercent: number;
      memoryPercent: number;
      agentUtilization: number;
    };
  } {
    const agents = Array.from(this.workloadBalancer.values());
    const healthCounts = agents.reduce(
      (acc, agent) => {
        acc[agent.health]++;
        return acc;
      },
      { healthy: 0, degraded: 0, unhealthy: 0 }
    );

    const priorityQueueLengths: Record<number, number> = {};
    for (let i = 1; i <= 5; i++) {
      priorityQueueLengths[i] = this.priorityQueue.get(i)?.length || 0;
    }

    const totalUtilization =
      agents.reduce((sum, agent) => sum + agent.utilizationPercent, 0) /
      agents.length;
    const systemLoad = this.calculateSystemUtilization();

    return {
      activeOrchestrations: this.activeOrchestrations.size,
      totalResourceUtilization: totalUtilization,
      agentHealth: healthCounts,
      priorityQueueLengths,
      systemLoad,
    };
  }
}

// Export singleton instance
export const pipelineOrchestrationService = new PipelineOrchestrationService();
