import { storage } from '../../storage';
import { agentRegistryService } from '../agents/agentRegistryService';
import { workflowCoordinator } from '../workflows/workflowCoordinator';
import { scanManager } from '../portals/scan-manager';
import { agentMemoryService } from '../agents/agentMemoryService';
import type {
  Portal,
  AgentRegistry,
  WorkItem,
  InsertWorkItem,
  AgentSession,
} from '@shared/schema';
import { nanoid } from 'nanoid';

export interface DiscoveryWorkflowRequest {
  sessionId: string;
  portalIds: string[];
  priority?: number;
  deadline?: Date;
  initiatedByUserId?: string;
  workflowId?: string;
  options?: {
    fullScan?: boolean;
    deepExtraction?: boolean;
    realTimeNotifications?: boolean;
    maxRetries?: number;
    searchCriteria?: unknown;
    maxRfps?: number;
  };
}

export interface DiscoveryWorkflowResult {
  success: boolean;
  workflowId: string;
  sessionId: string;
  createdWorkItems: WorkItem[];
  assignedAgents: AgentRegistry[];
  estimatedCompletion?: Date;
  error?: string;
}

export interface WorkItemSequence {
  sequenceId: string;
  portalId: string;
  portalName: string;
  workItems: {
    authentication: WorkItem;
    scanning: WorkItem;
    extraction: WorkItem;
    monitoring: WorkItem;
  };
  scanId?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

interface WorkItemMetadataShape {
  sequenceId?: string;
  scanId?: string;
  previousStep?: string;
  nextStep?: string;
  finalStep?: boolean;
  step?: number;
}

type WorkItemResultPayload = Record<string, unknown>;

/**
 * DiscoveryOrchestrator - Orchestrates complete portal discovery workflows
 *
 * This class implements the discovery pipeline integration by:
 * 1. Creating sequenced work items for portal scanning workflows
 * 2. Coordinating between portal-manager and portal specialists
 * 3. Integrating with existing services (MastraScrapingService, PortalMonitoringService, ScanManager)
 * 4. Managing progress tracking and error handling
 * 5. Ensuring end-to-end RFP creation with proper persistence
 */
export class DiscoveryOrchestrator {
  private activeWorkflows = new Map<string, WorkItemSequence[]>();
  constructor() {
    this.initializeDiscoveryAgents();
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return null;
  }

  private parseWorkItemMetadata(workItem: WorkItem): WorkItemMetadataShape {
    const raw = this.asRecord(workItem.metadata);
    return raw ?? {};
  }

  private toErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }

  private addAssignedAgent(
    assignedAgents: AgentRegistry[],
    agent?: AgentRegistry | null
  ): void {
    if (!agent) return;
    if (!assignedAgents.some(existing => existing.agentId === agent.agentId)) {
      assignedAgents.push(agent);
    }
  }

  /**
   * Initialize and register discovery-specific agents in the 3-tier system
   */
  private async initializeDiscoveryAgents(): Promise<void> {
    try {
      // Register Discovery Orchestrator Agent (Tier 1)
      await this.registerDiscoveryOrchestrator();

      // Register Portal Manager Agent (Tier 2)
      await this.registerPortalManager();

      // Register Portal Specialist Agents (Tier 3)
      await this.registerPortalSpecialists();

      console.log('✅ Discovery agents initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize discovery agents:', error);
    }
  }

  /**
   * Register the primary discovery orchestrator agent
   */
  private async registerDiscoveryOrchestrator(): Promise<void> {
    await agentRegistryService.registerAgent({
      agentId: 'discovery-orchestrator',
      tier: 'orchestrator',
      role: 'discovery-orchestrator',
      displayName: 'Discovery Orchestrator',
      description: 'Primary orchestrator for portal discovery workflows',
      capabilities: [
        'workflow_orchestration',
        'discovery_coordination',
        'portal_workflow_management',
        'progress_tracking',
        'error_recovery',
      ],
      tools: [
        'workflow_coordinator',
        'scan_manager',
        'agent_registry',
        'notification_service',
      ],
      maxConcurrency: 5,
      configuration: {
        maxPortalsPerWorkflow: 10,
        defaultTimeout: 3600000, // 1 hour
        retryAttempts: 3,
        progressReportingInterval: 30000, // 30 seconds
      },
    });
  }

  /**
   * Register the portal manager agent
   */
  private async registerPortalManager(): Promise<void> {
    await agentRegistryService.registerAgent({
      agentId: 'portal-manager',
      tier: 'manager',
      role: 'portal-manager',
      displayName: 'Portal Manager',
      description: 'Manages portal discovery tasks and coordinates specialists',
      capabilities: [
        'portal_coordination',
        'specialist_management',
        'task_distribution',
        'progress_aggregation',
        'quality_control',
      ],
      tools: [
        'portal_monitoring_service',
        'scan_manager',
        'mastra_scraping_service',
      ],
      maxConcurrency: 3,
      parentAgentId: 'discovery-orchestrator',
      configuration: {
        maxSpecialistsPerPortal: 2,
        taskTimeout: 1800000, // 30 minutes
        qualityCheckEnabled: true,
      },
    });
  }

  /**
   * Register portal specialist agents
   */
  private async registerPortalSpecialists(): Promise<void> {
    const specialists = [
      {
        agentId: 'portal-scanner-specialist',
        displayName: 'Portal Scanner Specialist',
        description:
          'Specializes in portal authentication and content scanning',
        capabilities: [
          'portal_authentication',
          'content_scanning',
          'page_navigation',
          'data_extraction',
        ],
      },
      {
        agentId: 'portal-monitor-specialist',
        displayName: 'Portal Monitor Specialist',
        description: 'Specializes in RFP extraction and monitoring',
        capabilities: [
          'rfp_extraction',
          'content_monitoring',
          'data_parsing',
          'change_detection',
        ],
      },
      {
        agentId: 'portal-validator-specialist',
        displayName: 'Portal Validator Specialist',
        description: 'Specializes in data validation and quality control',
        capabilities: [
          'data_validation',
          'quality_control',
          'duplicate_detection',
          'content_verification',
        ],
      },
    ];

    for (const specialist of specialists) {
      await agentRegistryService.registerAgent({
        ...specialist,
        tier: 'specialist',
        role: 'portal-specialist',
        tools: [
          'mastra_scraping_service',
          'portal_monitoring_service',
          'document_parsing_service',
          'scan_manager',
        ],
        maxConcurrency: 2,
        parentAgentId: 'portal-manager',
        configuration: {
          taskTimeout: 900000, // 15 minutes
          maxRetries: 2,
          detailedLogging: true,
        },
      });
    }
  }

  /**
   * Main entry point: Create a complete discovery workflow
   */
  async createDiscoveryWorkflow(
    request: DiscoveryWorkflowRequest
  ): Promise<DiscoveryWorkflowResult> {
    console.log(
      `🚀 Creating discovery workflow for ${request.portalIds.length} portals`
    );

    try {
      const workflowId = request.workflowId || nanoid();
      const sequences: WorkItemSequence[] = [];
      const createdWorkItems: WorkItem[] = [];
      const assignedAgents: AgentRegistry[] = [];

      // Create work item sequences for each portal
      for (const portalId of request.portalIds) {
        const portal = await storage.getPortal(portalId);
        if (!portal) {
          console.warn(`Portal ${portalId} not found, skipping`);
          continue;
        }

        console.log(`📋 Creating work sequence for portal: ${portal.name}`);

        const sequence = await this.createPortalWorkSequence({
          portalId,
          portalName: portal.name,
          sessionId: request.sessionId,
          workflowId,
          priority: request.priority || 5,
          deadline: request.deadline,
          options: request.options,
        });

        sequences.push(sequence);
        createdWorkItems.push(
          sequence.workItems.authentication,
          sequence.workItems.scanning,
          sequence.workItems.extraction,
          sequence.workItems.monitoring
        );
      }

      // Store workflow sequences
      this.activeWorkflows.set(workflowId, sequences);

      // Prime authentication tasks by requesting coordinator assignment
      for (const sequence of sequences) {
        const assignment = await workflowCoordinator.assignWorkItem(
          sequence.workItems.authentication.id
        );

        if (!assignment.success) {
          console.warn(
            `Failed to assign authentication work item ${sequence.workItems.authentication.id}: ${assignment.error}`
          );
        }

        this.addAssignedAgent(assignedAgents, assignment.assignedAgent);
      }

      // Store workflow memory
      await agentMemoryService.storeMemory({
        agentId: 'discovery-orchestrator',
        memoryType: 'procedural',
        contextKey: `workflow_${workflowId}`,
        title: `Discovery Workflow ${workflowId}`,
        content: {
          request,
          sequences: sequences.map(s => ({
            sequenceId: s.sequenceId,
            portalId: s.portalId,
            portalName: s.portalName,
            workItemIds: Object.values(s.workItems).map(wi => wi.id),
          })),
          createdAt: new Date(),
          status: 'active',
        },
        importance: 8,
        tags: ['discovery_workflow', 'portal_scanning'],
      });

      console.log(
        `✅ Created discovery workflow ${workflowId} with ${createdWorkItems.length} work items`
      );

      return {
        success: true,
        workflowId,
        sessionId: request.sessionId,
        createdWorkItems,
        assignedAgents,
        estimatedCompletion: this.calculateEstimatedCompletion(
          sequences.length
        ),
      };
    } catch (error) {
      const message = this.toErrorMessage(error);
      console.error('❌ Failed to create discovery workflow:', message);
      return {
        success: false,
        workflowId: request.workflowId || 'failed',
        sessionId: request.sessionId,
        createdWorkItems: [],
        assignedAgents: [],
        error: message,
      };
    }
  }

  /**
   * Create a sequenced work item workflow for a single portal
   */
  private async createPortalWorkSequence(params: {
    portalId: string;
    portalName: string;
    sessionId: string;
    workflowId: string;
    priority: number;
    deadline?: Date;
    options?: DiscoveryWorkflowRequest['options'];
  }): Promise<WorkItemSequence> {
    const sequenceId = nanoid();
    const scanId = scanManager.startScan(params.portalId, params.portalName);

    // Create authentication work item (Step 1)
    const authWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: params.sessionId,
      taskType: 'portal_authentication',
      inputs: {
        portalId: params.portalId,
        portalName: params.portalName,
        scanId: scanId,
        sequenceId: sequenceId,
        authenticationRequired: true,
      },
      expectedOutputs: [
        'authentication_status',
        'session_data',
        'credentials_validated',
      ],
      priority: params.priority,
      deadline: params.deadline,
      contextRef: params.portalId,
      workflowId: params.workflowId,
      createdByAgentId: 'discovery-orchestrator',
      maxRetries: params.options?.maxRetries || 3,
      metadata: {
        step: 1,
        sequenceId: sequenceId,
        scanId: scanId,
        nextStep: 'portal_scanning',
      },
    });

    // Create scanning work item (Step 2)
    const scanWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: params.sessionId,
      taskType: 'portal_scanning',
      inputs: {
        portalId: params.portalId,
        portalName: params.portalName,
        scanId: scanId,
        sequenceId: sequenceId,
        fullScan: params.options?.fullScan || false,
        dependsOn: authWorkItem.id,
      },
      expectedOutputs: ['scanned_content', 'page_data', 'navigation_map'],
      priority: params.priority,
      deadline: params.deadline,
      contextRef: params.portalId,
      workflowId: params.workflowId,
      createdByAgentId: 'discovery-orchestrator',
      maxRetries: params.options?.maxRetries || 3,
      metadata: {
        step: 2,
        sequenceId: sequenceId,
        scanId: scanId,
        previousStep: authWorkItem.id,
        nextStep: 'rfp_extraction',
      },
    });

    // Create RFP extraction work item (Step 3)
    const extractionWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: params.sessionId,
      taskType: 'rfp_extraction',
      inputs: {
        portalId: params.portalId,
        portalName: params.portalName,
        scanId: scanId,
        sequenceId: sequenceId,
        deepExtraction: params.options?.deepExtraction || false,
        dependsOn: scanWorkItem.id,
      },
      expectedOutputs: ['discovered_rfps', 'rfp_metadata', 'extraction_report'],
      priority: params.priority,
      deadline: params.deadline,
      contextRef: params.portalId,
      workflowId: params.workflowId,
      createdByAgentId: 'discovery-orchestrator',
      maxRetries: params.options?.maxRetries || 3,
      metadata: {
        step: 3,
        sequenceId: sequenceId,
        scanId: scanId,
        previousStep: scanWorkItem.id,
        nextStep: 'portal_monitoring',
      },
    });

    // Create monitoring work item (Step 4)
    const monitoringWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: params.sessionId,
      taskType: 'portal_monitoring',
      inputs: {
        portalId: params.portalId,
        portalName: params.portalName,
        scanId: scanId,
        sequenceId: sequenceId,
        realTimeNotifications: params.options?.realTimeNotifications ?? true,
        dependsOn: extractionWorkItem.id,
      },
      expectedOutputs: [
        'monitoring_status',
        'change_notifications',
        'final_report',
      ],
      priority: params.priority,
      deadline: params.deadline,
      contextRef: params.portalId,
      workflowId: params.workflowId,
      createdByAgentId: 'discovery-orchestrator',
      maxRetries: params.options?.maxRetries || 3,
      metadata: {
        step: 4,
        sequenceId: sequenceId,
        scanId: scanId,
        previousStep: extractionWorkItem.id,
        finalStep: true,
      },
    });

    return {
      sequenceId,
      portalId: params.portalId,
      portalName: params.portalName,
      workItems: {
        authentication: authWorkItem,
        scanning: scanWorkItem,
        extraction: extractionWorkItem,
        monitoring: monitoringWorkItem,
      },
      scanId,
      status: 'pending',
    };
  }

  /**
   * Execute the next step in a portal work sequence
   */
  async executeNextWorkflowStep(
    workItemId: string,
    result: WorkItemResultPayload
  ): Promise<void> {
    console.log(`🔄 Executing next workflow step for work item: ${workItemId}`);

    try {
      const workItem = await storage.getWorkItem(workItemId);
      if (!workItem) {
        console.warn('Work item not found when executing next workflow step');
        return;
      }

      const workflowId = workItem.workflowId ?? undefined;
      if (!workflowId) {
        console.warn('Work item is missing workflowId metadata');
        return;
      }

      const metadata = this.parseWorkItemMetadata(workItem);
      if (!metadata.sequenceId) {
        console.warn('Work item metadata missing sequenceId');
        return;
      }

      const sequences = this.activeWorkflows.get(workflowId);
      if (!sequences) {
        console.warn(`No active workflow found for: ${workflowId}`);
        return;
      }

      const sequence = sequences.find(
        s => s.sequenceId === metadata.sequenceId
      );
      if (!sequence) {
        console.warn(`Sequence not found: ${metadata.sequenceId}`);
        return;
      }

      // Determine next work item based on completed step
      let nextWorkItem: WorkItem | null = null;
      const scanId = sequence.scanId;

      if (workItem.taskType === 'portal_authentication') {
        nextWorkItem = sequence.workItems.scanning;
        if (scanId) {
          scanManager.updateStep(
            scanId,
            'authenticated',
            25,
            'Portal authentication completed'
          );
        }
        sequence.status = 'in_progress';
      } else if (workItem.taskType === 'portal_scanning') {
        nextWorkItem = sequence.workItems.extraction;
        if (scanId) {
          scanManager.updateStep(
            scanId,
            'extracting',
            50,
            'Portal scanning completed, extracting RFPs'
          );
        }
      } else if (workItem.taskType === 'rfp_extraction') {
        nextWorkItem = sequence.workItems.monitoring;
        if (scanId) {
          scanManager.updateStep(
            scanId,
            'parsing',
            75,
            'RFP extraction completed, starting monitoring'
          );
        }
      } else if (workItem.taskType === 'portal_monitoring') {
        // Final step - complete the workflow
        sequence.status = 'completed';
        if (scanId) {
          scanManager.completeScan(scanId, true);
        }
        await this.completeWorkflowSequence(sequence, result);
        return;
      }

      if (nextWorkItem) {
        const assignment = await workflowCoordinator.assignWorkItem(
          nextWorkItem.id
        );

        if (!assignment.success) {
          console.warn(
            `Failed to assign work item ${nextWorkItem.id}: ${assignment.error}`
          );
        }
      }
    } catch (error) {
      const message = this.toErrorMessage(error);
      console.error('❌ Failed to execute next workflow step:', message);
    }
  }

  /**
   * Complete a workflow sequence and persist results
   */
  private async completeWorkflowSequence(
    sequence: WorkItemSequence,
    finalResult: WorkItemResultPayload
  ): Promise<void> {
    console.log(`✅ Completing workflow sequence: ${sequence.sequenceId}`);

    try {
      const discoveredRFPs = Array.isArray(finalResult.discoveredRFPs)
        ? (finalResult.discoveredRFPs as unknown[])
        : [];

      // Update agent memory with workflow completion
      await agentMemoryService.storeMemory({
        agentId: 'discovery-orchestrator',
        memoryType: 'episodic',
        contextKey: `sequence_completed_${sequence.sequenceId}`,
        title: `Portal Discovery Completed: ${sequence.portalName}`,
        content: {
          sequenceId: sequence.sequenceId,
          portalId: sequence.portalId,
          portalName: sequence.portalName,
          completedAt: new Date(),
          finalResult,
          rfpsDiscovered: discoveredRFPs.length,
        },
        importance: 7,
        tags: ['workflow_completion', 'portal_discovery'],
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'workflow',
        entityId: sequence.sequenceId,
        action: 'completed',
        details: {
          portalId: sequence.portalId,
          portalName: sequence.portalName,
          workItems: Object.keys(sequence.workItems).length,
          rfpsDiscovered: discoveredRFPs.length,
        },
      });

      // Create notification
      await storage.createNotification({
        type: 'discovery',
        title: 'Portal Discovery Completed',
        message: `Discovery workflow completed for ${sequence.portalName}. Found ${discoveredRFPs.length} RFPs.`,
        relatedEntityType: 'portal',
        relatedEntityId: sequence.portalId,
      });

      console.log(
        `🎉 Workflow sequence ${sequence.sequenceId} completed successfully`
      );
    } catch (error) {
      const message = this.toErrorMessage(error);
      console.error('❌ Failed to complete workflow sequence:', message);
    }
  }

  /**
   * Calculate estimated completion time for workflows
   */
  private calculateEstimatedCompletion(portalCount: number): Date {
    // Estimate: 15 minutes per portal on average
    const minutesPerPortal = 15;
    const totalMinutes = portalCount * minutesPerPortal;
    return new Date(Date.now() + totalMinutes * 60 * 1000);
  }

  /**
   * Get workflow status for monitoring
   */
  async getWorkflowStatus(workflowId: string): Promise<any> {
    const sequences = this.activeWorkflows.get(workflowId);
    if (!sequences) {
      return null;
    }

    const status = {
      workflowId,
      sequences: sequences.map(seq => ({
        sequenceId: seq.sequenceId,
        portalName: seq.portalName,
        status: seq.status,
        workItems: {
          authentication: { status: seq.workItems.authentication.status },
          scanning: { status: seq.workItems.scanning.status },
          extraction: { status: seq.workItems.extraction.status },
          monitoring: { status: seq.workItems.monitoring.status },
        },
      })),
    };

    return status;
  }

  /**
   * Cancel an active workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    try {
      const sequences = this.activeWorkflows.get(workflowId);
      if (!sequences) {
        return false;
      }

      // Cancel all active scans
      for (const sequence of sequences) {
        if (sequence.scanId) {
          scanManager.completeScan(sequence.scanId, false);
        }
        sequence.status = 'failed';
      }

      // Remove from active workflows
      this.activeWorkflows.delete(workflowId);

      console.log(`❌ Cancelled workflow: ${workflowId}`);
      return true;
    } catch (error) {
      const message = this.toErrorMessage(error);
      console.error('❌ Failed to cancel workflow:', message);
      return false;
    }
  }
}

// Export singleton instance
export const discoveryOrchestrator = new DiscoveryOrchestrator();
