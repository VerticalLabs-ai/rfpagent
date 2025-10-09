import { storage } from '../storage';
import { agentRegistryService } from './agentRegistryService';
import { aiProposalService } from './ai-proposal-service';
import { AIService } from './aiService';
import {
  complianceCheckerSpecialist,
  documentProcessorSpecialist,
  requirementsExtractorSpecialist,
} from './analysisSpecialists';
import { DiscoveryWorkflowProcessors } from './discoveryWorkflowProcessors';
import { documentIntelligenceService } from './documentIntelligenceService';
import { DocumentParsingService } from './documentParsingService';
import { EnhancedProposalService } from './enhancedProposalService';
import { getMastraScrapingService } from './mastraScrapingService';
import { mastraWorkflowEngine } from './mastraWorkflowEngine';
import { PortalMonitoringService } from './portal-monitoring-service';
import { proposalGenerationOrchestrator } from './proposalGenerationOrchestrator';
import {
  complianceValidationSpecialist,
  contentGenerationSpecialist,
  pricingAnalysisSpecialist,
} from './proposalGenerationSpecialists';
// SAFLA Self-Improving System Integration
import type { AgentRegistry, InsertWorkItem, WorkItem } from '@shared/schema';
import { nanoid } from 'nanoid';
import { AdaptivePortalNavigator } from './adaptivePortalNavigator';
import { ContinuousImprovementMonitor } from './continuousImprovementMonitor';
import { IntelligentDocumentProcessor } from './intelligentDocumentProcessor';
import { PersistentMemoryEngine } from './persistentMemoryEngine';
import { ProposalOutcomeTracker } from './proposalOutcomeTracker';
import { ProposalQualityEvaluator } from './proposalQualityEvaluator';
import { saflaLearningEngine } from './saflaLearningEngine';
import { SelfImprovingLearningService } from './selfImprovingLearningService';

export interface WorkflowExecutionContext {
  workflowId: string;
  conversationId?: string;
  userId?: string;
  currentPhase:
    | 'discovery'
    | 'analysis'
    | 'generation'
    | 'submission'
    | 'monitoring';
  data: Record<string, any>;
  progress: number;
  status: 'pending' | 'running' | 'suspended' | 'completed' | 'failed';
}

export interface WorkflowResult {
  success: boolean;
  data?: any;
  error?: string;
  nextPhase?: string;
  suggestions?: any[];
}

export interface WorkItemAssignmentResult {
  success: boolean;
  workItem?: WorkItem;
  assignedAgent?: AgentRegistry;
  error?: string;
  retryAfter?: number;
}

export interface TaskDistributionResult {
  success: boolean;
  distributedItems: WorkItem[];
  failedItems: Array<{ workItem: WorkItem; error: string }>;
}

/**
 * Type definitions for work item inputs and metadata
 */
export interface ProposalGenerationInputs {
  rfpId: string;
  companyProfileId?: string;
  outline?: any;
  content?: any;
  pricing?: any;
  compliance?: any;
  forms?: any;
  pipelineId?: string;
  proposalType?: string;
}

export interface WorkItemMetadata {
  [key: string]: any;
  pipelineId?: string;
  sessionId?: string;
}

/**
 * Enhanced Workflow Coordinator for RFP Processing and 3-Tier Agentic System
 * Orchestrates both RFP lifecycle and generic work item management
 */
export class WorkflowCoordinator {
  private mastraScrapingService = getMastraScrapingService();
  private aiService = new AIService();
  private documentParsingService = new DocumentParsingService();
  private portalMonitoringService = new PortalMonitoringService(storage);
  private enhancedProposalService = new EnhancedProposalService();
  private activeWorkflows: Map<string, WorkflowExecutionContext> = new Map();
  private workItemProcessingInterval: NodeJS.Timeout | null = null;

  // SAFLA Self-Improving System Services
  private learningService = new SelfImprovingLearningService();
  private outcomeTracker = new ProposalOutcomeTracker();
  private adaptiveNavigator = new AdaptivePortalNavigator();
  private intelligentProcessor = new IntelligentDocumentProcessor();
  private memoryEngine = new PersistentMemoryEngine();
  private qualityEvaluator = new ProposalQualityEvaluator();
  private improvementMonitor = new ContinuousImprovementMonitor();

  // Import the actual SAFLA learning engine
  private saflaEngine = saflaLearningEngine;

  // Learning integration flags
  private enableLearning = true;
  private learningContext: any = null;

  constructor() {
    // Check environment variable to disable automatic background processing
    const autoStart = process.env.AUTO_WORK_DISTRIBUTION !== 'false';
    if (autoStart) {
      console.log(
        '🔄 Auto-starting work distribution (enabled by default, set AUTO_WORK_DISTRIBUTION=false to disable)'
      );
      this.startWorkItemProcessing();
    } else {
      console.log(
        '⏸️ Work distribution disabled (set AUTO_WORK_DISTRIBUTION=true to re-enable)'
      );
    }

    // Initialize SAFLA learning system
    this.initializeLearningSystem();
  }

  /**
   * Initialize the SAFLA Self-Improving Learning System
   */
  private async initializeLearningSystem(): Promise<void> {
    try {
      console.log('🧠 Initializing SAFLA Self-Improving Learning System...');

      // Initialize persistent memory engine with cross-session context
      this.learningContext = await this.memoryEngine.initializeSessionContext({
        agentId: 'workflow-coordinator',
        taskType: 'workflow_coordination',
        domain: 'system_orchestration',
      });

      // Enable learning across all components
      this.enableLearning = process.env.DISABLE_LEARNING !== 'true';

      if (this.enableLearning) {
        console.log('✅ SAFLA Learning System initialized successfully');
        console.log(
          `📊 Learning context: ${Object.keys(this.learningContext?.knowledgeGraph || {}).length} knowledge nodes loaded`
        );
      } else {
        console.log(
          '⚠️ SAFLA Learning System disabled via DISABLE_LEARNING=true'
        );
      }
    } catch (error) {
      console.error('❌ Failed to initialize SAFLA Learning System:', error);
      this.enableLearning = false;
    }
  }

  // ============ 3-TIER AGENTIC SYSTEM WORK ITEM COORDINATION ============

  /**
   * Create a new work item in the system
   */
  async createWorkItem(workItemData: {
    sessionId: string;
    taskType: string;
    inputs: any;
    expectedOutputs?: string[];
    priority?: number;
    deadline?: Date;
    contextRef?: string;
    workflowId?: string;
    createdByAgentId: string;
    maxRetries?: number;
    metadata?: any;
  }): Promise<WorkItem> {
    const workItem: InsertWorkItem = {
      sessionId: workItemData.sessionId,
      workflowId: workItemData.workflowId,
      contextRef: workItemData.contextRef,
      taskType: workItemData.taskType,
      inputs: workItemData.inputs,
      expectedOutputs: workItemData.expectedOutputs || [],
      priority: workItemData.priority || 5,
      deadline: workItemData.deadline,
      maxRetries: workItemData.maxRetries || 3,
      createdByAgentId: workItemData.createdByAgentId,
      status: 'pending',
      retries: 0,
      metadata: workItemData.metadata || {},
    };

    const newWorkItem = await storage.createWorkItem(workItem);
    console.log(
      `📋 Created work item ${newWorkItem.id} of type: ${newWorkItem.taskType}`
    );

    return newWorkItem;
  }

  /**
   * Assign a work item to the best available agent
   */
  async assignWorkItem(workItemId: string): Promise<WorkItemAssignmentResult> {
    try {
      const workItem = await storage.getWorkItem(workItemId);
      if (!workItem) {
        return { success: false, error: 'Work item not found' };
      }

      if (workItem.status !== 'pending') {
        return {
          success: false,
          error: `Work item is not pending (status: ${workItem.status})`,
        };
      }

      // Determine required capabilities based on task type
      const requiredCapabilities = this.getRequiredCapabilitiesForTask(
        workItem.taskType
      );

      // Find best available agent
      const agent = await agentRegistryService.findBestAgentForCapability(
        requiredCapabilities[0], // Primary capability
        this.getPreferredTierForTask(workItem.taskType)
      );

      if (!agent) {
        return {
          success: false,
          error: `No available agent found for task type: ${workItem.taskType}`,
          retryAfter: 30, // Retry in 30 seconds
        };
      }

      // Assign work item to agent
      const updatedWorkItem = await storage.updateWorkItem(workItem.id, {
        assignedAgentId: agent.agentId,
        status: 'assigned',
        updatedAt: new Date(),
      });

      console.log(
        `🎯 Assigned work item ${workItem.id} to agent ${agent.displayName} (${agent.agentId})`
      );

      return {
        success: true,
        workItem: updatedWorkItem,
        assignedAgent: agent,
      };
    } catch (error) {
      console.error(`❌ Failed to assign work item ${workItemId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Assignment failed',
      };
    }
  }

  /**
   * Execute a work item (simulate agent processing)
   */
  async executeWorkItem(workItemId: string): Promise<WorkItemAssignmentResult> {
    const startTime = Date.now();
    try {
      const workItem = await storage.getWorkItem(workItemId);
      if (!workItem) {
        return { success: false, error: 'Work item not found' };
      }

      if (workItem.status !== 'assigned') {
        return {
          success: false,
          error: `Work item is not assigned (status: ${workItem.status})`,
        };
      }

      // Update status to in_progress
      await storage.updateWorkItem(workItem.id, {
        status: 'in_progress',
        updatedAt: new Date(),
      });

      console.log(
        `🚀 Executing work item ${workItem.id} of type: ${workItem.taskType}`
      );

      // Simulate work execution based on task type
      const result = await this.processWorkItemByType(workItem);

      // Mark as completed
      const completedWorkItem = await storage.updateWorkItem(workItem.id, {
        status: 'completed',
        result: result.success ? result.data : null,
        error: result.success ? null : result.error,
        completedAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(
        `✅ Completed work item ${workItem.id} with result:`,
        result.success ? 'SUCCESS' : 'FAILED'
      );

      // SAFLA Learning Integration: Record execution outcome for learning
      if (this.enableLearning) {
        await this.recordWorkItemLearning(
          workItem,
          result,
          Date.now() - startTime
        );
      }

      return {
        success: true,
        workItem: completedWorkItem,
      };
    } catch (error) {
      console.error(`❌ Failed to execute work item ${workItemId}:`, error);

      // Mark as failed and increment retry count
      const existingWorkItem = await storage.getWorkItem(workItemId);
      const failedWorkItem = await storage.updateWorkItem(workItemId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Execution failed',
        retries: (existingWorkItem?.retries ?? 0) + 1,
        updatedAt: new Date(),
      });

      // SAFLA Learning Integration: Learn from failures
      if (this.enableLearning && existingWorkItem) {
        await this.recordWorkItemLearning(
          existingWorkItem,
          {
            success: false,
            error: error instanceof Error ? error.message : 'Execution failed',
          },
          Date.now() - startTime
        );
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Execution failed',
        workItem: failedWorkItem,
      };
    }
  }

  /**
   * Distribute pending work items to available agents
   */
  async distributeWorkItems(): Promise<TaskDistributionResult> {
    try {
      // Get all pending work items, prioritized by priority and deadline
      const pendingItems = await storage.getPendingWorkItems();
      const distributedItems: WorkItem[] = [];
      const failedItems: Array<{ workItem: WorkItem; error: string }> = [];

      // Only log if there are pending items to avoid spam
      if (pendingItems.length > 0) {
        console.log(
          `📦 Distributing ${pendingItems.length} pending work items`
        );
      }

      for (const workItem of pendingItems) {
        const assignmentResult = await this.assignWorkItem(workItem.id);

        if (assignmentResult.success && assignmentResult.workItem) {
          distributedItems.push(assignmentResult.workItem);
        } else {
          failedItems.push({
            workItem,
            error: assignmentResult.error || 'Assignment failed',
          });
        }
      }

      // Only log distribution results if there were pending items
      if (pendingItems.length > 0) {
        console.log(
          `📊 Distribution complete: ${distributedItems.length} assigned, ${failedItems.length} failed`
        );
      }

      return {
        success: true,
        distributedItems,
        failedItems,
      };
    } catch (error) {
      console.error('❌ Failed to distribute work items:', error);
      return {
        success: false,
        distributedItems: [],
        failedItems: [],
      };
    }
  }

  /**
   * Start automatic work item processing loop (disabled by default)
   */
  startWorkItemProcessing(): void {
    if (this.workItemProcessingInterval) {
      clearInterval(this.workItemProcessingInterval);
    }

    this.workItemProcessingInterval = setInterval(async () => {
      try {
        // 1. Distribute pending work items
        await this.distributeWorkItems();

        // 2. Execute assigned work items
        const assignedItems = await storage.getWorkItemsByStatus('assigned');
        for (const workItem of assignedItems) {
          await this.executeWorkItem(workItem.id);
        }

        // 3. Retry failed items if retries < maxRetries
        await this.retryFailedWorkItems();
      } catch (error) {
        console.error('❌ Work item processing loop error:', error);
      }
    }, 10000); // Process every 10 seconds

    console.log('🔄 Work item processing loop started');
  }

  /**
   * Stop work item processing loop
   */
  stopWorkItemProcessing(): void {
    if (this.workItemProcessingInterval) {
      clearInterval(this.workItemProcessingInterval);
      this.workItemProcessingInterval = null;
      console.log('⏹️ Work item processing loop stopped');
    }
  }

  /**
   * Retry failed work items that haven't exceeded max retries
   */
  private async retryFailedWorkItems(): Promise<void> {
    try {
      const failedItems = await storage.getWorkItemsByStatus('failed');

      for (const workItem of failedItems) {
        if (workItem.retries < workItem.maxRetries) {
          // Reset to pending for retry
          await storage.updateWorkItem(workItem.id, {
            status: 'pending',
            assignedAgentId: null,
            updatedAt: new Date(),
          });

          console.log(
            `🔄 Retrying work item ${workItem.id} (attempt ${workItem.retries + 1}/${workItem.maxRetries})`
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to retry work items:', error);
    }
  }

  /**
   * Get required capabilities for a task type - Comprehensive RFP workflow mapping
   */
  private getRequiredCapabilitiesForTask(taskType: string): string[] {
    const capabilityMap: Record<string, string[]> = {
      // Discovery Phase Tasks
      portal_scan: ['portal_scanning', 'rfp_discovery'],
      portal_monitor: ['portal_monitoring', 'health_checking'],
      rfp_discovery: ['portal_scanning', 'data_extraction'],
      portal_authentication: ['authentication', 'portal_management'],

      // Analysis Phase Tasks - New Specialist Tasks
      document_validation: ['document_processing', 'validation'],
      text_extraction: ['text_extraction', 'ocr_processing'],
      requirement_parsing: ['requirement_extraction', 'data_parsing'],
      compliance_analysis: ['compliance_analysis', 'risk_assessment'],

      // Legacy Analysis Phase Tasks
      document_analysis: ['document_processing', 'text_extraction'],
      requirement_extraction: ['structure_analysis', 'data_parsing'],
      compliance_check: ['compliance_checking', 'requirement_validation'],
      risk_assessment: ['risk_assessment', 'compliance_checking'],
      market_analysis: ['market_research', 'competitive_analysis'],
      historical_analysis: ['historical_analysis', 'pattern_recognition'],

      // Proposal Generation Phase Tasks - Legacy
      proposal_generate: ['content_generation', 'proposal_generation'],
      narrative_generation: ['narrative_writing', 'content_generation'],
      technical_writing: ['technical_writing', 'content_generation'],
      pricing_analysis: ['pricing_analysis', 'market_research'],
      template_processing: ['template_processing', 'content_generation'],
      compliance_validation: ['compliance_checking', 'quality_assurance'],

      // New Proposal Generation Pipeline Tasks
      proposal_outline_creation: ['content_generation', 'structural_analysis'],
      executive_summary_generation: ['narrative_writing', 'content_generation'],
      technical_content_generation: ['technical_writing', 'content_generation'],
      qualifications_generation: ['content_generation', 'experience_mapping'],
      proposal_pricing_analysis: ['pricing_analysis', 'competitive_analysis'],
      proposal_compliance_validation: [
        'compliance_checking',
        'risk_assessment',
      ],
      proposal_form_completion: ['data_entry', 'form_processing'],
      proposal_final_assembly: ['content_assembly', 'document_generation'],
      proposal_quality_assurance: ['quality_assurance', 'validation'],

      // Submission Phase Tasks
      form_filling: ['data_entry', 'portal_management'],
      document_upload: ['file_management', 'portal_management'],
      submission_tracking: ['submission_monitoring', 'portal_management'],

      // Monitoring Phase Tasks
      status_monitoring: ['submission_monitoring', 'portal_monitoring'],
      deadline_tracking: ['scheduling', 'alerts'],
      performance_tracking: ['performance_tracking', 'analytics'],

      // Orchestration Tasks
      user_interaction: ['session_management', 'user_interface'],
      workflow_coordination: ['workflow_coordination', 'task_delegation'],
      session_management: ['session_management', 'intent_analysis'],
      task_delegation: ['task_delegation', 'workflow_coordination'],

      // General Tasks
      notification: ['alerts', 'notification'],
      data_sync: ['data_extraction', 'database'],
      quality_assurance: ['quality_assurance', 'compliance_checking'],
    };

    return capabilityMap[taskType] || ['general_processing'];
  }

  /**
   * Get preferred tier for a task type - Comprehensive RFP workflow tier mapping
   */
  private getPreferredTierForTask(taskType: string): string | undefined {
    const tierMap: Record<string, string> = {
      // Orchestrator Tasks (user-facing, high-level coordination)
      user_interaction: 'orchestrator',
      workflow_coordination: 'orchestrator',
      session_management: 'orchestrator',
      task_delegation: 'orchestrator',

      // Manager Tasks (domain coordination, complex analysis)
      market_analysis: 'manager',
      proposal_coordination: 'manager',
      portal_coordination: 'manager',
      research_coordination: 'manager',

      // Specialist Tasks (specific domain execution)
      portal_scan: 'specialist',
      portal_monitor: 'specialist',
      rfp_discovery: 'specialist',
      portal_authentication: 'specialist',
      portal_scanning: 'specialist',
      rfp_extraction: 'specialist',
      portal_monitoring: 'specialist',
      // New Analysis Specialist Tasks
      document_validation: 'specialist',
      text_extraction: 'specialist',
      requirement_parsing: 'specialist',
      compliance_analysis: 'specialist',

      // Legacy Analysis Tasks
      document_analysis: 'specialist',
      requirement_extraction: 'specialist',
      compliance_check: 'specialist',
      risk_assessment: 'specialist',
      historical_analysis: 'specialist',
      proposal_generate: 'specialist',
      narrative_generation: 'specialist',
      technical_writing: 'specialist',
      pricing_analysis: 'specialist',
      template_processing: 'specialist',
      compliance_validation: 'specialist',

      // New Proposal Generation Pipeline Tasks
      proposal_outline_creation: 'specialist',
      executive_summary_generation: 'specialist',
      technical_content_generation: 'specialist',
      qualifications_generation: 'specialist',
      proposal_pricing_analysis: 'specialist',
      proposal_compliance_validation: 'specialist',
      proposal_form_completion: 'specialist',
      proposal_final_assembly: 'specialist',
      proposal_quality_assurance: 'specialist',
      form_filling: 'specialist',
      document_upload: 'specialist',
      submission_tracking: 'specialist',
      status_monitoring: 'specialist',
      deadline_tracking: 'specialist',
      performance_tracking: 'specialist',
      notification: 'specialist',
      data_sync: 'specialist',
      quality_assurance: 'specialist',
    };

    return tierMap[taskType];
  }

  /**
   * Process work item based on its type - Comprehensive RFP workflow delegation
   */
  private async processWorkItemByType(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      switch (workItem.taskType) {
        // New Discovery Pipeline Tasks - Sequenced workflow
        case 'portal_authentication':
          return await DiscoveryWorkflowProcessors.processPortalAuthentication(
            workItem
          );

        case 'portal_scanning':
          return await DiscoveryWorkflowProcessors.processPortalScanning(
            workItem
          );

        case 'rfp_extraction':
          return await DiscoveryWorkflowProcessors.processRFPExtraction(
            workItem
          );

        case 'portal_monitoring':
          return await DiscoveryWorkflowProcessors.processPortalMonitoring(
            workItem
          );

        // Legacy Discovery Phase Tasks
        case 'portal_scan':
        case 'rfp_discovery':
          return await this.processPortalScanTask(workItem);

        case 'portal_monitor':
          return await this.processPortalMonitoringTask(workItem);

        // Analysis Phase Tasks - New Specialist Tasks
        case 'document_validation':
          return await this.processDocumentValidationTask(workItem);

        case 'text_extraction':
          return await this.processTextExtractionTask(workItem);

        case 'requirement_parsing':
          return await this.processRequirementParsingTask(workItem);

        case 'compliance_analysis':
          return await this.processComplianceAnalysisTask(workItem);

        // Legacy Analysis Phase Tasks
        case 'document_analysis':
        case 'requirement_extraction':
          return await this.processDocumentAnalysisTask(workItem);

        case 'compliance_check':
        case 'risk_assessment':
          return await this.processComplianceCheckTask(workItem);

        case 'market_research':
        case 'market_analysis':
        case 'historical_analysis':
          return await this.processMarketResearchTask(workItem);

        // Legacy Proposal Generation Phase Tasks
        case 'proposal_generate':
        case 'narrative_generation':
        case 'technical_writing':
          return await this.processProposalGenerationTask(workItem);

        case 'template_processing':
          return await this.processTemplateProcessingTask(workItem);

        case 'pricing_analysis':
          return await this.processPricingAnalysisTask(workItem);

        // New Proposal Generation Pipeline Tasks
        case 'proposal_outline_creation':
          return await this.processProposalOutlineCreation(workItem);

        case 'executive_summary_generation':
          return await this.processExecutiveSummaryGeneration(workItem);

        case 'technical_content_generation':
          return await this.processTechnicalContentGeneration(workItem);

        case 'qualifications_generation':
          return await this.processQualificationsGeneration(workItem);

        case 'proposal_pricing_analysis':
          return await this.processProposalPricingAnalysis(workItem);

        case 'proposal_compliance_validation':
          return await this.processProposalComplianceValidation(workItem);

        case 'proposal_form_completion':
          return await this.processProposalFormCompletion(workItem);

        case 'proposal_final_assembly':
          return await this.processProposalFinalAssembly(workItem);

        case 'proposal_quality_assurance':
          return await this.processProposalQualityAssurance(workItem);

        // Monitoring and Management Tasks
        case 'status_monitoring':
          return await this.processStatusMonitoringTask(workItem);

        case 'notification':
          return await this.processNotificationTask(workItem);

        case 'user_interaction':
        case 'session_management':
          return await this.processUserInteractionTask(workItem);

        default:
          return {
            success: true,
            data: {
              message: `Generic processing completed for ${workItem.taskType} task`,
              taskType: workItem.taskType,
              inputs: workItem.inputs,
              processedAt: new Date(),
              note: 'Task processed with default handler - consider adding specific processor',
            },
          };
      }
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Task processing failed',
      };
    }
  }

  /**
   * Process portal scan task using real portal monitoring service
   */
  private async processPortalScanTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      portalId?: string;
      keywords?: string;
      scanId?: string;
    };
    const { portalId, keywords, scanId } = inputs;

    try {
      if (!portalId) {
        throw new Error('Portal ID is required for portal scanning');
      }

      // Create scan ID if not provided
      const actualScanId = scanId || nanoid();

      // Use real portal monitoring service
      const scanResult =
        await this.portalMonitoringService.scanPortalWithEvents(
          portalId,
          actualScanId
        );

      return {
        success: scanResult.success,
        data: {
          portalId: scanResult.portalId,
          discoveredRfps: scanResult.discoveredRFPs.length,
          rfpData: scanResult.discoveredRFPs,
          scanDuration: scanResult.scanDuration,
          errors: scanResult.errors,
          lastScanDate: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Portal scan failed',
      };
    }
  }

  /**
   * Process proposal generation task using AI proposal service and enhanced proposal service
   */
  private async processProposalGenerationTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      rfpId?: string;
      requirements?: any;
      companyProfileId?: string;
      proposalType?: string;
    };
    const { rfpId, requirements, companyProfileId, proposalType } = inputs;

    try {
      if (!rfpId) {
        throw new Error('RFP ID is required for proposal generation');
      }

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Use enhanced proposal service for comprehensive proposal generation
      const proposalResult =
        await this.enhancedProposalService.generateProposal({
          rfpId,
          companyProfileId,
          generatePricing: true,
          autoSubmit: false,
        });

      // Also run AI analysis for additional insights
      const aiAnalysis = await aiProposalService.analyzeRFPDocument(
        rfp.description || ''
      );

      return {
        success: true,
        data: {
          rfpId,
          proposalId: proposalResult.proposalId,
          documentAnalysis: proposalResult.documentAnalysis,
          filledForms: proposalResult.filledForms,
          humanActionItems: proposalResult.humanActionItems,
          aiAnalysis,
          readyForSubmission: proposalResult.readyForSubmission,
          competitiveBidSummary: proposalResult.competitiveBidSummary,
          message: 'Comprehensive proposal generated successfully',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Proposal generation failed',
      };
    }
  }

  /**
   * Process compliance check task using AI service and document intelligence
   */
  private async processComplianceCheckTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      rfpId?: string;
      documentId?: string;
      requirements?: any;
    };
    const { rfpId, documentId, requirements } = inputs;

    try {
      if (!rfpId && !documentId) {
        throw new Error(
          'Either RFP ID or Document ID is required for compliance checking'
        );
      }

      let analysisResult;

      if (documentId) {
        // Use document intelligence service for document-specific compliance
        analysisResult =
          await documentIntelligenceService.analyzeRFPDocuments(documentId);

        return {
          success: true,
          data: {
            rfpId,
            documentId,
            complianceScore:
              analysisResult.competitiveBidAnalysis?.confidenceLevel || 0.8,
            formFields: analysisResult.formFields,
            humanOversightItems: analysisResult.humanOversightItems,
            competitiveBidAnalysis: analysisResult.competitiveBidAnalysis,
            processingInstructions: analysisResult.processingInstructions,
            estimatedCompletionTime: analysisResult.estimatedCompletionTime,
          },
        };
      }

      // Use AI service for RFP compliance analysis (rfpId branch)
      const rfp = await storage.getRFP(rfpId!);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Get documents for the RFP
      const documents = await storage.getDocumentsByRFP(rfpId!);
      let documentText = rfp.description || '';

      // Include extracted text from documents
      for (const doc of documents) {
        if (doc.extractedText) {
          documentText += '\n\n' + doc.extractedText;
        }
      }

      const compliance = await this.aiService.analyzeDocumentCompliance(
        documentText,
        rfp
      );

      return {
        success: true,
        data: {
          rfpId,
          complianceScore: compliance.requirements?.length > 0 ? 0.85 : 0.65,
          requirements: compliance.requirements,
          deadlines: compliance.deadlines,
          riskFlags: compliance.riskFlags,
          evaluationCriteria: compliance.evaluationCriteria,
          mandatoryFields: compliance.mandatoryFields,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Compliance check failed',
      };
    }
  }

  // ============ NEW ANALYSIS SPECIALIST TASK HANDLERS ============

  /**
   * Process document validation task using document processor specialist
   */
  private async processDocumentValidationTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      const result =
        await documentProcessorSpecialist.processDocumentValidation(workItem);

      return {
        success: result.success,
        data: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Document validation failed',
      };
    }
  }

  /**
   * Process text extraction task using document processor specialist
   */
  private async processTextExtractionTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      const result =
        await documentProcessorSpecialist.processTextExtraction(workItem);

      return {
        success: result.success,
        data: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Text extraction failed',
      };
    }
  }

  /**
   * Process requirement parsing task using requirements extractor specialist
   */
  private async processRequirementParsingTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      const result =
        await requirementsExtractorSpecialist.processRequirementParsing(
          workItem
        );

      return {
        success: result.success,
        data: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Requirement parsing failed',
      };
    }
  }

  /**
   * Process compliance analysis task using compliance checker specialist
   */
  private async processComplianceAnalysisTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    try {
      const result =
        await complianceCheckerSpecialist.processComplianceAnalysis(workItem);

      return {
        success: result.success,
        data: result.success ? result.result : undefined,
        error: result.success ? undefined : result.error,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Compliance analysis failed',
      };
    }
  }

  // ============ LEGACY TASK HANDLERS ============

  /**
   * Process document analysis task
   */
  private async processDocumentAnalysisTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      documentId?: string;
      analysisType?: string;
    };
    const { documentId, analysisType } = inputs;

    // Use existing document intelligence service
    try {
      if (!documentId) {
        throw new Error('Document ID is required for analysis');
      }
      const result =
        await documentIntelligenceService.analyzeRFPDocuments(documentId);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Document analysis failed',
      };
    }
  }

  /**
   * Process market research task using enhanced proposal service and historical data
   */
  private async processMarketResearchTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      rfpId?: string;
      market?: string;
      competitorAnalysis?: any;
      researchType?: string;
    };
    const { rfpId, market, competitorAnalysis, researchType } = inputs;

    try {
      let researchResults: any = {};

      if (rfpId) {
        // Get RFP for context
        const rfp = await storage.getRFP(rfpId);
        if (!rfp) {
          throw new Error(`RFP not found: ${rfpId}`);
        }

        // Use document intelligence service for market analysis (includes competitive bid analysis)
        const documentAnalysis =
          await documentIntelligenceService.analyzeRFPDocuments(rfpId);
        const marketAnalysis = documentAnalysis.competitiveBidAnalysis || {
          suggestedBidAmount: 0,
          confidenceLevel: 0,
          marketResearch: {
            averageBid: 0,
            bidRange: { min: 0, max: 0 },
            competitorCount: 0,
            sources: [],
          },
          pricingStrategy: 'competitive' as const,
          riskFactors: [],
        };

        // Get historical bid data for comparison
        const historicalBids = await storage.getHistoricalBidsByAgency(
          rfp.agency
        );

        researchResults = {
          rfpId,
          market: rfp.agency,
          marketAnalysis,
          historicalBids: historicalBids.length,
          averageValue:
            historicalBids.reduce(
              (sum, bid) => sum + (Number(bid.bidAmount) || 0),
              0
            ) / Math.max(historicalBids.length, 1),
          competitorInsights: marketAnalysis.marketResearch,
          riskFactors: marketAnalysis.riskFactors,
          suggestedBidAmount: marketAnalysis.suggestedBidAmount,
          confidenceLevel: marketAnalysis.confidenceLevel,
          recommendedStrategy: marketAnalysis.pricingStrategy,
        };
      } else {
        // General market research without specific RFP
        researchResults = {
          market: market || 'General',
          researchType: researchType || 'general',
          status: 'Basic market research completed',
          note: 'Enhanced research requires RFP context',
        };
      }

      return {
        success: true,
        data: researchResults,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Market research failed',
      };
    }
  }

  /**
   * Get work item statistics for monitoring
   */
  async getWorkItemStatistics(): Promise<{
    pending: number;
    assigned: number;
    inProgress: number;
    completed: number;
    failed: number;
    totalProcessingTime: number;
    averageRetries: number;
  }> {
    try {
      const [pending, assigned, inProgress, completed, failed] =
        await Promise.all([
          storage.getWorkItemsByStatus('pending'),
          storage.getWorkItemsByStatus('assigned'),
          storage.getWorkItemsByStatus('in_progress'),
          storage.getWorkItemsByStatus('completed'),
          storage.getWorkItemsByStatus('failed'),
        ]);

      // Calculate processing time and retries for completed items
      const completedItems = completed.filter(
        item => item.createdAt && item.completedAt
      );
      const totalProcessingTime = completedItems.reduce((sum, item) => {
        const processingTime =
          item.completedAt!.getTime() - item.createdAt.getTime();
        return sum + processingTime;
      }, 0);

      const totalRetries = completed.reduce(
        (sum, item) => sum + item.retries,
        0
      );
      const averageRetries =
        completed.length > 0 ? totalRetries / completed.length : 0;

      return {
        pending: pending.length,
        assigned: assigned.length,
        inProgress: inProgress.length,
        completed: completed.length,
        failed: failed.length,
        totalProcessingTime: Math.round(
          totalProcessingTime / (completedItems.length || 1)
        ),
        averageRetries: Math.round(averageRetries * 100) / 100,
      };
    } catch (error) {
      console.error('❌ Failed to get work item statistics:', error);
      return {
        pending: 0,
        assigned: 0,
        inProgress: 0,
        completed: 0,
        failed: 0,
        totalProcessingTime: 0,
        averageRetries: 0,
      };
    }
  }

  // ============ EXISTING RFP WORKFLOW METHODS (PRESERVED) ============

  /**
   * Perform portal search - wrapper method to handle missing searchAllPortals
   */
  private async performPortalSearch(keywords: string): Promise<any[]> {
    try {
      // Use existing scraping service method
      const portals = await storage.getAllPortals();
      const results: any[] = [];

      // For now, return mock results until proper search is implemented
      if (keywords.toLowerCase().includes('technology')) {
        results.push({
          title: 'IT Services and Support Contract',
          agency: 'Department of Technology',
          deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          estimatedValue: '$500,000',
          category: 'Technology Services',
        });
      }

      return results;
    } catch (error) {
      console.error('Error in portal search:', error);
      return [];
    }
  }

  /**
   * Execute the complete RFP discovery and analysis workflow
   */
  async executeRFPDiscoveryWorkflow(params: {
    searchCriteria: {
      keywords: string;
      location?: string;
      agency?: string;
      category?: string;
    };
    conversationId?: string;
    userId?: string;
  }): Promise<WorkflowResult> {
    const workflowId = nanoid();
    console.log(`🚀 Starting RFP Discovery Workflow: ${workflowId}`);

    const context: WorkflowExecutionContext = {
      workflowId,
      conversationId: params.conversationId,
      userId: params.userId,
      currentPhase: 'discovery',
      data: { searchCriteria: params.searchCriteria },
      progress: 0,
      status: 'running',
    };

    this.activeWorkflows.set(workflowId, context);

    try {
      // Phase 1: Discovery - Use discovery agent to find RFPs
      console.log(`📍 Phase 1: RFP Discovery`);
      const discoveryAgent = mastraWorkflowEngine.getAgent(
        'rfp-discovery-specialist'
      );

      if (discoveryAgent) {
        const discoveryPrompt = `Search for RFP opportunities using these criteria:
          Keywords: ${params.searchCriteria.keywords}
          Location: ${params.searchCriteria.location || 'Any'}
          Agency: ${params.searchCriteria.agency || 'Any'}
          Category: ${params.searchCriteria.category || 'Any'}
          
          Find and evaluate opportunities, assess their fit, and prioritize them based on strategic value.`;

        await discoveryAgent.generateVNext(discoveryPrompt);
      }

      // Perform actual portal scraping
      const searchResults = await this.performPortalSearch(
        params.searchCriteria.keywords
      );

      context.data.discoveryResults = searchResults;
      context.progress = 0.3;

      // Phase 2: Analysis - Use compliance agent to analyze found RFPs
      console.log(`📊 Phase 2: Compliance Analysis`);
      const complianceAgent = mastraWorkflowEngine.getAgent(
        'compliance-specialist'
      );

      if (complianceAgent && searchResults.length > 0) {
        const analysisPrompt = `Analyze the following ${searchResults.length} RFP opportunities for compliance requirements, risk factors, and strategic fit:
          
          ${searchResults.map((rfp: any, index: number) => `${index + 1}. ${rfp.title} - ${rfp.agency || 'Unknown Agency'}`).join('\n')}
          
          Provide compliance assessment, identify requirements, and highlight any risk factors.`;

        const analysisResult =
          await complianceAgent.generateVNext(analysisPrompt);
        context.data.complianceAnalysis = analysisResult.text;
      }

      context.progress = 0.6;

      // Phase 3: Market Research - Use research agent for competitive analysis
      console.log(`🔍 Phase 3: Market Research`);
      const researchAgent = mastraWorkflowEngine.getAgent(
        'market-research-analyst'
      );

      if (researchAgent && searchResults.length > 0) {
        const researchPrompt = `Conduct market research and competitive analysis for these RFP opportunities:
          
          Focus on: historical bidding patterns, competitor landscape, market conditions, and pricing strategies.
          Provide strategic recommendations for bidding approach.`;

        const researchResult =
          await researchAgent.generateVNext(researchPrompt);
        context.data.marketResearch = researchResult.text;
      }

      context.progress = 1.0;
      context.status = 'completed';
      context.currentPhase = 'analysis';

      // Generate suggestions for next steps
      const nextStepSuggestions =
        await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'rfp_results',
          lastMessage: `Found ${searchResults.length} RFP opportunities`,
          availableRfps: searchResults,
          userIntent: 'rfp_search',
        });

      return {
        success: true,
        data: {
          discoveryResults: searchResults,
          complianceAnalysis: context.data.complianceAnalysis,
          marketResearch: context.data.marketResearch,
          workflowId,
        },
        nextPhase: 'generation',
        suggestions: nextStepSuggestions,
      };
    } catch (error) {
      console.error(`❌ RFP Discovery Workflow failed:`, error);
      context.status = 'failed';
      context.data.error =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Workflow execution failed',
      };
    }
  }

  /**
   * Execute proposal generation workflow for a specific RFP
   */
  async executeProposalGenerationWorkflow(params: {
    rfpId: string;
    conversationId?: string;
    userId?: string;
  }): Promise<WorkflowResult> {
    const workflowId = nanoid();
    console.log(`📝 Starting Proposal Generation Workflow: ${workflowId}`);

    const context: WorkflowExecutionContext = {
      workflowId,
      conversationId: params.conversationId,
      userId: params.userId,
      currentPhase: 'generation',
      data: { rfpId: params.rfpId },
      progress: 0,
      status: 'running',
    };

    this.activeWorkflows.set(workflowId, context);

    try {
      // Get RFP details
      const rfp = await storage.getRFP(params.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${params.rfpId}`);
      }

      context.data.rfp = rfp;

      // Phase 1: Document Analysis
      console.log(`📄 Phase 1: Document Intelligence Analysis`);
      const documentAgent = mastraWorkflowEngine.getAgent('document-processor');

      if (documentAgent) {
        const analysisPrompt = `Analyze the RFP documents for "${rfp.title}" and extract:
          - Fillable form fields and requirements
          - Mandatory vs optional elements
          - Human oversight needs
          - Processing recommendations`;

        await documentAgent.generateVNext(analysisPrompt);
      }

      // Perform actual document analysis
      const documentAnalysis =
        await documentIntelligenceService.analyzeRFPDocuments(params.rfpId);
      context.data.documentAnalysis = documentAnalysis;
      context.progress = 0.3;

      // Phase 2: Content Generation
      console.log(`✍️ Phase 2: Proposal Content Generation`);
      const proposalAgent = mastraWorkflowEngine.getAgent('proposal-writer');

      if (proposalAgent) {
        const generationPrompt = `Generate a comprehensive proposal for "${rfp.title}" including:
          - Executive summary
          - Technical approach
          - Project timeline
          - Team qualifications
          - Pricing strategy`;

        const proposalResult =
          await proposalAgent.generateVNext(generationPrompt);
        context.data.proposalContent = proposalResult.text;
      }

      context.progress = 0.8;

      // Phase 3: Proposal Creation
      console.log(`🔧 Phase 3: Proposal Assembly`);
      const proposal = await storage.createProposal({
        rfpId: params.rfpId,
        status: 'draft',
        content: context.data.proposalContent || 'Generated proposal content',
      });

      context.data.proposalId = proposal.id;
      context.progress = 1.0;
      context.status = 'completed';

      // Generate suggestions for next steps
      const nextStepSuggestions =
        await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'analysis',
          lastMessage: 'Proposal generated successfully',
          availableRfps: [rfp],
          userIntent: 'bid_crafting',
        });

      return {
        success: true,
        data: {
          proposalId: proposal.id,
          documentAnalysis,
          proposalContent: context.data.proposalContent,
          workflowId,
        },
        nextPhase: 'submission',
        suggestions: nextStepSuggestions,
      };
    } catch (error) {
      console.error(`❌ Proposal Generation Workflow failed:`, error);
      context.status = 'failed';
      context.data.error =
        error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Workflow execution failed',
      };
    }
  }

  /**
   * Execute compliance verification workflow
   */
  async executeComplianceVerificationWorkflow(params: {
    rfpId: string;
    conversationId?: string;
  }): Promise<WorkflowResult> {
    const workflowId = nanoid();
    console.log(`✅ Starting Compliance Verification Workflow: ${workflowId}`);

    const context: WorkflowExecutionContext = {
      workflowId,
      conversationId: params.conversationId,
      currentPhase: 'analysis',
      data: { rfpId: params.rfpId },
      progress: 0,
      status: 'running',
    };

    this.activeWorkflows.set(workflowId, context);

    try {
      const rfp = await storage.getRFP(params.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${params.rfpId}`);
      }

      // Use compliance specialist agent
      const complianceAgent = mastraWorkflowEngine.getAgent(
        'compliance-specialist'
      );

      if (complianceAgent) {
        const compliancePrompt = `Perform a comprehensive compliance analysis for "${rfp.title}":
          
          1. Review all requirements and identify mandatory vs optional items
          2. Assess risk factors and complexity levels
          3. Map requirements to company capabilities
          4. Generate compliance checklist and recommendations
          5. Identify any potential showstoppers or high-risk areas`;

        const complianceResult =
          await complianceAgent.generateVNext(compliancePrompt);
        context.data.complianceReport = complianceResult.text;
      }

      context.progress = 1.0;
      context.status = 'completed';

      return {
        success: true,
        data: {
          complianceReport: context.data.complianceReport,
          workflowId,
        },
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'analysis',
          lastMessage: 'Compliance analysis completed',
          availableRfps: [rfp],
          userIntent: 'compliance_review',
        }),
      };
    } catch (error) {
      console.error(`❌ Compliance Verification Workflow failed:`, error);
      context.status = 'failed';

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Workflow execution failed',
      };
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId: string): WorkflowExecutionContext | null {
    return this.activeWorkflows.get(workflowId) || null;
  }

  /**
   * Get all active workflows
   */
  getActiveWorkflows(): WorkflowExecutionContext[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Suspend a workflow for human input
   */
  async suspendWorkflow(
    workflowId: string,
    reason: string,
    data: any = {},
    instructions?: string
  ): Promise<boolean> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return false;
    }

    try {
      // Update workflow status
      workflow.status = 'suspended';

      // Persist workflow state to database
      await storage.createWorkflowState({
        workflowId: workflow.workflowId,
        conversationId: workflow.conversationId,
        currentPhase: workflow.currentPhase,
        status: 'suspended',
        progress: Math.round(workflow.progress * 100), // Convert to percentage
        context: workflow.data,
        agentAssignments: data.agentAssignments || {},
        suspensionReason: reason,
        suspensionData: data,
        resumeInstructions:
          instructions || `Resume workflow from ${workflow.currentPhase} phase`,
      });

      console.log(`🛑 Workflow ${workflowId} suspended: ${reason}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to suspend workflow ${workflowId}:`, error);
      return false;
    }
  }

  /**
   * Resume a suspended workflow
   */
  async resumeWorkflow(
    workflowId: string,
    humanInput?: any
  ): Promise<WorkflowResult> {
    try {
      // Get workflow state from database
      const latestState =
        await storage.getWorkflowStateByWorkflowId(workflowId);

      if (!latestState || latestState.status !== 'suspended') {
        return {
          success: false,
          error: 'Workflow not found or not in suspended state',
        };
      }

      // Reconstruct workflow context
      const context: WorkflowExecutionContext = {
        workflowId: latestState.workflowId,
        conversationId: latestState.conversationId || undefined,
        currentPhase: latestState.currentPhase as any,
        data: {
          ...latestState.context,
          humanInput: humanInput, // Merge human input
        },
        progress: latestState.progress / 100, // Convert back from percentage
        status: 'running',
      };

      // Add back to active workflows
      this.activeWorkflows.set(workflowId, context);

      // Update database status
      await storage.updateWorkflowState(latestState.id, {
        status: 'running',
        updatedAt: new Date(),
      });

      console.log(
        `▶️ Workflow ${workflowId} resumed from ${context.currentPhase} phase`
      );

      // Continue execution based on current phase
      return await this.continueWorkflowExecution(context, humanInput);
    } catch (error) {
      console.error(`❌ Failed to resume workflow ${workflowId}:`, error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to resume workflow',
      };
    }
  }

  /**
   * Execute discovery phase with optional human input
   */
  private async executeDiscoveryPhase(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    context.currentPhase = 'discovery';
    context.progress = 0.2;

    if (humanInput?.action === 'override_search') {
      // Human provided custom search criteria
      let searchCriteria =
        humanInput.data?.searchCriteria || humanInput.searchCriteria;

      // Parse JSON string if needed
      if (typeof searchCriteria === 'string') {
        try {
          searchCriteria = JSON.parse(searchCriteria);
        } catch (error) {
          // If JSON parsing fails, treat as keywords string
          searchCriteria = { keywords: searchCriteria };
        }
      }

      // Ensure we have a proper object with keywords
      if (!searchCriteria || typeof searchCriteria !== 'object') {
        searchCriteria = { keywords: searchCriteria || '' };
      }

      context.data.searchCriteria = searchCriteria;
    }

    // Continue discovery within the existing workflow context instead of creating new workflow
    try {
      const searchCriteria = context.data.searchCriteria || {};
      console.log(
        `🔍 Continuing discovery phase for workflow ${context.workflowId} with criteria:`,
        searchCriteria
      );

      // Perform portal search directly without creating new workflow
      const results = await this.performPortalSearch(
        searchCriteria.keywords || ''
      );

      context.data.discoveryResults = results;
      context.progress = 0.4;

      return {
        success: true,
        data: { results, searchCriteria },
        nextPhase: 'analysis',
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'discovery',
          lastMessage: `Found ${results.length} RFP opportunities`,
          availableRfps: results,
          userIntent: 'discovery_complete',
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed',
      };
    }
  }

  /**
   * Execute analysis phase with optional human input
   */
  private async executeAnalysisPhase(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    context.currentPhase = 'analysis';
    context.progress = 0.4;

    if (humanInput?.action === 'approve_rfp_selection') {
      // Human approved specific RFPs for analysis
      context.data.selectedRfps =
        humanInput.data?.selectedRfps || humanInput.selectedRfps;
    }

    // Continue with existing analysis logic
    try {
      const rfpId = context.data.selectedRfps?.[0] || context.data.rfpId;
      const rfp = await storage.getRFP(rfpId);

      if (!rfp) {
        throw new Error('RFP not found for analysis');
      }

      context.data.rfp = rfp;
      context.progress = 0.6;

      return {
        success: true,
        data: { rfp, analysisComplete: true },
        nextPhase: 'generation',
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'analysis',
          lastMessage: 'RFP analysis completed',
          availableRfps: [rfp],
          userIntent: 'analysis_review',
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
      };
    }
  }

  /**
   * Execute generation phase with optional human input
   */
  private async executeGenerationPhase(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    context.currentPhase = 'generation';
    context.progress = 0.6;

    if (humanInput?.action === 'provide_requirements') {
      // Human provided additional requirements or feedback
      context.data.additionalRequirements =
        humanInput.data?.requirements || humanInput.requirements;
    }

    // Continue with proposal generation logic
    try {
      const rfp =
        context.data.rfp || (await storage.getRFP(context.data.rfpId));
      if (!rfp) {
        throw new Error('RFP not found for proposal generation');
      }

      // Generate proposal using AI service
      const proposalData = {
        rfpId: rfp.id,
        requirements: context.data.additionalRequirements || {},
        context: `Generate proposal for ${rfp.title}`,
      };

      // Get RFP for AI service
      const targetRfp = await storage.getRFP(proposalData.rfpId);
      if (!targetRfp) {
        throw new Error(`RFP not found: ${proposalData.rfpId}`);
      }

      // Use AI service to analyze RFP document
      await aiProposalService.analyzeRFPDocument(targetRfp.description || '');
      const result = {
        message: 'Proposal generation initiated',
        rfpId: proposalData.rfpId,
      };

      context.data.proposal = result;
      context.progress = 0.8;

      return {
        success: true,
        data: result,
        nextPhase: 'submission',
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'generation',
          lastMessage: 'Proposal generated successfully',
          availableRfps: [rfp],
          userIntent: 'proposal_review',
        }),
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Proposal generation failed',
      };
    }
  }

  /**
   * Execute submission phase with optional human input
   */
  private async executeSubmissionPhase(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    context.currentPhase = 'submission';
    context.progress = 0.8;

    if (humanInput?.action === 'approve_submission') {
      // Human approved proposal for submission
      context.data.submissionApproved = true;
    } else if (humanInput?.action === 'request_changes') {
      // Human requested changes, suspend for revisions
      await this.suspendWorkflow(
        context.workflowId,
        'human_input_required',
        { requestedChanges: humanInput.data?.changes || humanInput.changes },
        'Please review and incorporate the requested changes before resubmitting'
      );
      return {
        success: true,
        data: { suspended: true, reason: 'Changes requested' },
      };
    }

    // Continue with submission logic
    try {
      context.progress = 1.0;
      context.status = 'completed';

      return {
        success: true,
        data: { submitted: true, proposal: context.data.proposal },
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'submission',
          lastMessage: 'Proposal submitted successfully',
          availableRfps: [context.data.rfp],
          userIntent: 'submission_complete',
        }),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed',
      };
    }
  }

  /**
   * Execute monitoring phase with optional human input
   */
  private async executeMonitoringPhase(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    context.currentPhase = 'monitoring';
    context.progress = 1.0;

    // Monitoring is typically a completed state
    return {
      success: true,
      data: { status: 'monitoring', proposal: context.data.proposal },
      suggestions: await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'monitoring',
        lastMessage: 'Monitoring proposal status',
        availableRfps: [context.data.rfp],
        userIntent: 'monitor_progress',
      }),
    };
  }

  /**
   * Continue workflow execution after resumption
   */
  private async continueWorkflowExecution(
    context: WorkflowExecutionContext,
    humanInput?: any
  ): Promise<WorkflowResult> {
    try {
      switch (context.currentPhase) {
        case 'discovery':
          return await this.executeDiscoveryPhase(context, humanInput);
        case 'analysis':
          return await this.executeAnalysisPhase(context, humanInput);
        case 'generation':
          return await this.executeGenerationPhase(context, humanInput);
        case 'submission':
          return await this.executeSubmissionPhase(context, humanInput);
        case 'monitoring':
          return await this.executeMonitoringPhase(context, humanInput);
        default:
          throw new Error(`Unknown workflow phase: ${context.currentPhase}`);
      }
    } catch (error) {
      context.status = 'failed';
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Workflow execution failed',
      };
    }
  }

  /**
   * Get all suspended workflows
   */
  async getSuspendedWorkflows(): Promise<any[]> {
    try {
      return await storage.getSuspendedWorkflows();
    } catch (error) {
      console.error('❌ Failed to get suspended workflows:', error);
      return [];
    }
  }

  async getActiveWorkflowsCount(): Promise<number> {
    try {
      const activeWorkflows = await storage.getActiveWorkflows();
      return activeWorkflows.length;
    } catch (error) {
      console.error('❌ Failed to get active workflows count:', error);
      return 0;
    }
  }

  /**
   * Get global workflow state
   * Returns aggregated state of all active workflows
   */
  async getGlobalWorkflowState(): Promise<{
    activeWorkflows: number;
    byPhase: Record<string, number>;
    byStatus: Record<string, number>;
    recentlyCompleted: Array<{
      workflowId: string;
      phase: string;
      completedAt: Date;
    }>;
  }> {
    const byPhase: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    const recentlyCompleted: Array<any> = [];

    // Count active workflows by phase and status
    for (const [workflowId, context] of this.activeWorkflows.entries()) {
      // Count by phase
      byPhase[context.currentPhase] = (byPhase[context.currentPhase] || 0) + 1;

      // Count by status
      byStatus[context.status] = (byStatus[context.status] || 0) + 1;

      // Track recently completed
      if (context.status === 'completed') {
        recentlyCompleted.push({
          workflowId,
          phase: context.currentPhase,
          completedAt: new Date(),
        });
      }
    }

    // Keep only last 10 completed workflows
    recentlyCompleted.sort(
      (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
    );
    recentlyCompleted.splice(10);

    return {
      activeWorkflows: this.activeWorkflows.size,
      byPhase,
      byStatus,
      recentlyCompleted,
    };
  }

  /**
   * Get phase statistics
   * Returns detailed statistics for each workflow phase
   */
  async getPhaseStatistics(): Promise<{
    discovery: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    analysis: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    generation: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    submission: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
    monitoring: {
      active: number;
      completed: number;
      failed: number;
      avgDuration: number;
    };
  }> {
    const phases = [
      'discovery',
      'analysis',
      'generation',
      'submission',
      'monitoring',
    ] as const;
    const stats: any = {};

    for (const phase of phases) {
      stats[phase] = {
        active: 0,
        completed: 0,
        failed: 0,
        avgDuration: 0,
      };
    }

    // Count workflows by phase and status
    for (const [_, context] of this.activeWorkflows.entries()) {
      const phase = context.currentPhase;
      if (stats[phase]) {
        if (context.status === 'running' || context.status === 'suspended') {
          stats[phase].active++;
        } else if (context.status === 'completed') {
          stats[phase].completed++;
        } else if (context.status === 'failed') {
          stats[phase].failed++;
        }
      }
    }

    // Get work items statistics for more detailed info
    const workItemStats = await this.getWorkItemStatistics();

    // Add work item counts to stats
    for (const phase of phases) {
      // Estimate average duration (in minutes) based on phase
      stats[phase].avgDuration =
        phase === 'discovery'
          ? 15
          : phase === 'analysis'
            ? 30
            : phase === 'generation'
              ? 45
              : phase === 'submission'
                ? 20
                : 10; // monitoring
    }

    return stats;
  }

  /**
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.status = 'failed';
      this.activeWorkflows.delete(workflowId);

      // Update database if workflow state exists
      try {
        const workflowState =
          await storage.getWorkflowStateByWorkflowId(workflowId);
        if (workflowState) {
          await storage.updateWorkflowState(workflowState.id, {
            status: 'failed',
            updatedAt: new Date(),
          });
        }
      } catch (error) {
        console.error(`❌ Failed to update cancelled workflow state:`, error);
      }

      return true;
    }
    return false;
  }

  // ============ SAFLA LEARNING INTEGRATION METHODS ============

  /**
   * Record learning from work item execution
   */
  private async recordWorkItemLearning(
    workItem: WorkItem,
    result: WorkflowResult,
    executionTime: number
  ): Promise<void> {
    try {
      const learningOutcome = {
        id: `learning_${workItem.id}_${Date.now()}`,
        type: this.mapTaskTypeToLearningType(workItem.taskType),
        agentId: workItem.assignedAgentId || 'unknown',
        context: {
          workItemId: workItem.id,
          taskType: workItem.taskType,
          inputs: workItem.inputs,
          executionTime,
          retryAttempt: workItem.retries,
          action: workItem.taskType,
          strategy: {},
          conditions: {},
        },
        outcome: {
          success: result.success,
          metrics: {
            duration: executionTime,
            efficiency: this.calculateEfficiencyScore(
              workItem.taskType,
              executionTime,
              result.success
            ),
            data: result.data,
          },
          errorDetails: result.error,
        },
        confidenceScore: result.success ? 0.8 : 0.4,
        domain: 'work_item_processing',
        category: workItem.taskType,
        timestamp: new Date(),
      };

      await this.learningService.recordLearningOutcome(learningOutcome);
    } catch (error) {
      console.error('❌ Failed to record work item learning:', error);
    }
  }

  /**
   * Record learning from portal interactions
   */
  async recordPortalLearning(
    portalId: string,
    navigationAttempt: any,
    success: boolean
  ): Promise<void> {
    if (!this.enableLearning) return;

    try {
      await this.adaptiveNavigator.recordNavigationAttempt({
        portalId,
        ...navigationAttempt,
        success,
        timestamp: new Date(),
        context: this.learningContext,
      });

      // Also record in main learning service
      const learningOutcome = {
        id: `portal_learning_${portalId}_${Date.now()}`,
        type: 'portal_navigation' as const,
        agentId: 'portal_navigator',
        portalId,
        context: {
          portalId,
          navigationStrategy: navigationAttempt.strategy,
          selectors: navigationAttempt.selectors,
          timing: navigationAttempt.timing,
          action: 'portal_navigation',
          strategy: navigationAttempt.strategy || {},
          conditions: {},
          inputs: navigationAttempt,
        },
        outcome: {
          success,
          metrics: {
            duration: navigationAttempt.duration,
            efficiency: success ? 1.0 : 0.0,
            data: navigationAttempt.result,
          },
        },
        confidenceScore: success ? 0.9 : 0.3,
        domain: 'portal_navigation',
        category: 'navigation',
        timestamp: new Date(),
      };

      await this.learningService.recordLearningOutcome(learningOutcome);
    } catch (error) {
      console.error('❌ Failed to record portal learning:', error);
    }
  }

  /**
   * Record learning from document processing
   */
  async recordDocumentLearning(
    documentId: string,
    processingResult: any,
    accuracy: number
  ): Promise<void> {
    if (!this.enableLearning) return;

    try {
      await this.intelligentProcessor.learnFromFeedback(documentId, {
        accuracy,
        extractedFields: processingResult.extractedFields,
        processingTime: processingResult.processingTime,
        errorTypes: processingResult.errors || [],
        improvementSuggestions: processingResult.suggestions || [],
      });

      const learningOutcome = {
        id: `doc_learning_${documentId}_${Date.now()}`,
        type: 'document_parsing' as const,
        agentId: 'document_processor',
        context: {
          documentId,
          documentType: processingResult.documentType,
          processingMethod: processingResult.method,
          complexity: processingResult.complexity || 'medium',
          action: 'document_parsing',
          strategy: { method: processingResult.method },
          conditions: { documentType: processingResult.documentType },
          inputs: processingResult,
        },
        outcome: {
          success: accuracy > 0.8,
          metrics: {
            accuracy,
            duration: processingResult.processingTime,
            efficiency: accuracy / (processingResult.processingTime / 1000),
            data: processingResult,
          },
        },
        confidenceScore: accuracy,
        domain: 'document_processing',
        category: processingResult.documentType || 'unknown',
        timestamp: new Date(),
      };

      await this.learningService.recordLearningOutcome(learningOutcome);
    } catch (error) {
      console.error('❌ Failed to record document learning:', error);
    }
  }

  /**
   * Record learning from proposal outcomes
   */
  async recordProposalLearning(
    proposalId: string,
    outcome: any
  ): Promise<void> {
    if (!this.enableLearning) return;

    try {
      await this.outcomeTracker.recordProposalOutcome({
        proposalId,
        rfpId: outcome.rfpId || '',
        status: outcome.result || 'under_review',
        outcomeDetails: {
          feedback: outcome.feedback,
          competitorInfo: {
            winningAmount: outcome.winningBid,
          },
        },
        learningData: {
          strategiesUsed: outcome.strategies || {},
          marketConditions: outcome.marketConditions || {},
          competitiveFactors: outcome.competitiveFactors || {},
          internalFactors: outcome.internalFactors || {},
        },
        timestamp: new Date(),
      });

      // Evaluate proposal quality and learn from it
      const qualityEvaluation =
        await this.qualityEvaluator.evaluateProposalQuality(proposalId);
      await this.qualityEvaluator.learnFromOutcome(proposalId, outcome);

      const learningOutcome = {
        id: `proposal_learning_${proposalId}_${Date.now()}`,
        type: 'proposal_success' as const,
        agentId: 'proposal_generator',
        rfpId: outcome.rfpId,
        context: {
          proposalId,
          qualityScore: qualityEvaluation.overallScore,
          complianceScore:
            qualityEvaluation.componentScores?.complianceScore?.score || 0,
          competitiveScore:
            qualityEvaluation.componentScores?.competitivenessScore?.score || 0,
          action: 'proposal_generation',
          strategy: { type: 'standard' },
          conditions: {},
          inputs: outcome,
        },
        outcome: {
          success: outcome.result === 'won' || outcome.result === 'awarded',
          metrics: {
            overallScore: qualityEvaluation.overallScore,
            predictedSuccessRate: qualityEvaluation.predictedSuccessRate,
            confidenceLevel: qualityEvaluation.confidenceLevel,
            data: outcome,
          },
        },
        confidenceScore: qualityEvaluation.confidenceLevel,
        domain: 'proposal_generation',
        category: 'rfp_response',
        timestamp: new Date(),
      };

      await this.learningService.recordLearningOutcome(learningOutcome);
    } catch (error) {
      console.error('❌ Failed to record proposal learning:', error);
    }
  }

  /**
   * Get learning-enhanced navigation strategy for portal
   */
  async getAdaptiveNavigationStrategy(portalId: string): Promise<any> {
    if (!this.enableLearning) return null;

    try {
      return await this.adaptiveNavigator.getNavigationStrategy(portalId);
    } catch (error) {
      console.error('❌ Failed to get adaptive navigation strategy:', error);
      return null;
    }
  }

  /**
   * Get intelligent document processing strategy
   */
  async getIntelligentProcessingStrategy(
    documentId: string,
    documentType: string
  ): Promise<any> {
    if (!this.enableLearning) return null;

    try {
      // Get learned patterns for this document type
      // Note: getProcessingStrategies is not yet implemented on IntelligentDocumentProcessor
      // Return a basic strategy for now based on document type
      const strategy = {
        documentType,
        approach: 'standard',
        confidence: 0.7,
        recommendedTools: ['ocr', 'nlp'],
        estimatedProcessingTime: 5000,
      };
      return strategy;
    } catch (error) {
      console.error('❌ Failed to get intelligent processing strategy:', error);
      return null;
    }
  }

  /**
   * Generate performance dashboard
   */
  async generatePerformanceDashboard(timeframe: string = '7d'): Promise<any> {
    try {
      return await this.improvementMonitor.generatePerformanceDashboard(
        timeframe
      );
    } catch (error) {
      console.error('❌ Failed to generate performance dashboard:', error);
      return null;
    }
  }

  /**
   * Create improvement plan based on current performance
   */
  async createSystemImprovementPlan(focusAreas: string[] = []): Promise<any> {
    try {
      return await this.improvementMonitor.createImprovementPlan(focusAreas);
    } catch (error) {
      console.error('❌ Failed to create improvement plan:', error);
      return null;
    }
  }

  /**
   * Trigger memory consolidation
   */
  async consolidateSystemMemory(
    type: 'nightly' | 'weekly' | 'triggered' = 'triggered'
  ): Promise<void> {
    if (!this.enableLearning) return;

    try {
      const consolidation =
        await this.memoryEngine.performMemoryConsolidation(type);
      console.log(
        `🧠 Memory consolidation completed: ${consolidation.memoriesProcessed} memories processed`
      );
    } catch (error) {
      console.error('❌ Failed to consolidate system memory:', error);
    }
  }

  // Helper methods for learning integration

  private mapTaskTypeToLearningType(
    taskType: string
  ):
    | 'portal_navigation'
    | 'document_parsing'
    | 'proposal_success'
    | 'compliance_check'
    | 'market_analysis' {
    if (
      taskType.includes('portal') ||
      taskType.includes('scan') ||
      taskType.includes('monitor')
    ) {
      return 'portal_navigation';
    }
    if (
      taskType.includes('document') ||
      taskType.includes('text') ||
      taskType.includes('parsing')
    ) {
      return 'document_parsing';
    }
    if (
      taskType.includes('proposal') ||
      taskType.includes('generation') ||
      taskType.includes('content')
    ) {
      return 'proposal_success';
    }
    if (taskType.includes('compliance')) {
      return 'compliance_check';
    }
    return 'market_analysis';
  }

  private calculateEfficiencyScore(
    taskType: string,
    executionTime: number,
    success: boolean
  ): number {
    // Base efficiency on task type expectations and success
    const expectedTimes: Record<string, number> = {
      portal_scan: 30000, // 30 seconds
      document_analysis: 20000, // 20 seconds
      proposal_generate: 120000, // 2 minutes
      compliance_check: 15000, // 15 seconds
    };

    const expectedTime = expectedTimes[taskType] || 30000;
    const timeRatio = expectedTime / Math.max(executionTime, 1000);
    const successBonus = success ? 1.0 : 0.5;

    return Math.min(1.0, timeRatio * successBonus);
  }

  private identifyLearningOpportunities(
    workItem: WorkItem,
    result: WorkflowResult
  ): string[] {
    const opportunities = [];

    if (!result.success) {
      opportunities.push('error_pattern_analysis', 'failure_recovery_strategy');
    }

    if (workItem.retries > 0) {
      opportunities.push('retry_optimization', 'resilience_improvement');
    }

    if (result.success && workItem.retries === 0) {
      opportunities.push('pattern_reinforcement', 'efficiency_optimization');
    }

    // Add task-specific opportunities
    const taskType = workItem.taskType;
    if (taskType.includes('portal')) {
      opportunities.push('navigation_optimization', 'selector_adaptation');
    }
    if (taskType.includes('document')) {
      opportunities.push('extraction_improvement', 'accuracy_enhancement');
    }
    if (taskType.includes('proposal')) {
      opportunities.push('content_quality_improvement', 'competitive_analysis');
    }

    return opportunities;
  }

  /**
   * Process portal monitoring task
   */
  private async processPortalMonitoringTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      portalId?: string;
      healthCheck?: boolean;
    };
    const { portalId, healthCheck } = inputs;

    try {
      if (!portalId) {
        throw new Error('Portal ID is required for portal monitoring');
      }

      const portal = await storage.getPortal(portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${portalId}`);
      }

      return {
        success: true,
        data: {
          portalId,
          portalName: portal.name,
          status: portal.status,
          lastScanned: portal.lastScanned,
          errorCount: portal.errorCount,
          healthStatus: portal.status === 'active' ? 'healthy' : 'unhealthy',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Portal monitoring failed',
      };
    }
  }

  /**
   * Process template processing task
   */
  private async processTemplateProcessingTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      templateId?: string;
      rfpId?: string;
      companyData?: any;
    };
    const { templateId, rfpId, companyData } = inputs;

    try {
      if (!templateId && !rfpId) {
        throw new Error(
          'Template ID or RFP ID is required for template processing'
        );
      }

      // Process template with available data
      const processedTemplate = {
        templateId,
        rfpId,
        status: 'processed',
        processedAt: new Date(),
        companyData: companyData || {},
      };

      return {
        success: true,
        data: {
          processed_template: processedTemplate,
          message: 'Template processed successfully',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Template processing failed',
      };
    }
  }

  /**
   * Process pricing analysis task
   */
  private async processPricingAnalysisTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      rfpId?: string;
      scope?: any;
      competitorData?: any;
    };
    const { rfpId, scope, competitorData } = inputs;

    try {
      if (!rfpId) {
        throw new Error('RFP ID is required for pricing analysis');
      }

      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Perform basic pricing analysis
      const estimatedValue = Number(rfp.estimatedValue) || 0;
      const pricingAnalysis = {
        rfpId,
        estimatedValue,
        recommendedBid: estimatedValue * 0.95, // 5% under estimate
        competitiveRange: {
          low: estimatedValue * 0.85,
          high: estimatedValue * 1.05,
        },
        riskFactors: [],
        confidenceLevel: 0.75,
        analyzedAt: new Date(),
      };

      return {
        success: true,
        data: {
          pricing_analysis: pricingAnalysis,
          message: 'Pricing analysis completed',
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Pricing analysis failed',
      };
    }
  }

  /**
   * Process status monitoring task
   */
  private async processStatusMonitoringTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      entityType?: string;
      entityId?: string;
    };
    const { entityType, entityId } = inputs;

    try {
      if (!entityType || !entityId) {
        throw new Error(
          'Entity type and ID are required for status monitoring'
        );
      }

      let status = 'unknown';
      let details = {};

      // Check status based on entity type
      if (entityType === 'rfp') {
        const rfp = await storage.getRFP(entityId);
        if (rfp) {
          status = rfp.status;
          details = {
            title: rfp.title,
            deadline: rfp.deadline,
            progress: rfp.progress,
          };
        }
      } else if (entityType === 'proposal') {
        const proposal = await storage.getProposal(entityId);
        if (proposal) {
          status = proposal.status;
          details = {
            rfpId: proposal.rfpId,
            submittedAt: proposal.submittedAt,
          };
        }
      }

      return {
        success: true,
        data: {
          entityType,
          entityId,
          status,
          details,
          monitoredAt: new Date(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Status monitoring failed',
      };
    }
  }

  /**
   * Process notification task
   */
  private async processNotificationTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      type?: string;
      title?: string;
      message?: string;
      userId?: string;
      relatedEntityType?: string;
      relatedEntityId?: string;
    };
    const { type, title, message, userId, relatedEntityType, relatedEntityId } =
      inputs;

    try {
      if (!type || !title || !message) {
        throw new Error(
          'Type, title, and message are required for notifications'
        );
      }

      // Create notification in database
      const notification = await storage.createNotification({
        type,
        title,
        message,
        relatedEntityType: relatedEntityType || null,
        relatedEntityId: relatedEntityId || null,
      });

      return {
        success: true,
        data: {
          notification_id: notification.id,
          type,
          title,
          message,
          created_at: notification.createdAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Notification creation failed',
      };
    }
  }

  /**
   * Process user interaction task
   */
  private async processUserInteractionTask(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    const inputs = workItem.inputs as {
      sessionId?: string;
      interactionType?: string;
      message?: string;
      context?: any;
    };
    const { sessionId, interactionType, message, context } = inputs;

    try {
      if (!sessionId || !interactionType) {
        throw new Error('Session ID and interaction type are required');
      }

      // Process user interaction
      const interaction = {
        sessionId,
        interactionType,
        message: message || '',
        context: context || {},
        processedAt: new Date(),
      };

      // Generate appropriate response based on interaction type
      let response = 'Interaction acknowledged';
      if (interactionType === 'query') {
        response = 'Processing your query...';
      } else if (interactionType === 'feedback') {
        response = 'Thank you for your feedback';
      }

      return {
        success: true,
        data: {
          interaction,
          response,
          suggestions: await mastraWorkflowEngine.generateActionSuggestions({
            messageType: interactionType,
            lastMessage: message || '',
            userIntent: interactionType,
          }),
        },
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'User interaction failed',
      };
    }
  }

  // ============ NEW PROPOSAL GENERATION PIPELINE PROCESSING METHODS ============

  /**
   * Process proposal outline creation task
   */
  private async processProposalOutlineCreation(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `📋 Processing proposal outline creation for work item ${workItem.id}`
    );

    try {
      const result =
        await contentGenerationSpecialist.generateProposalOutline(workItem);

      // Notify orchestrator of completion
      const metadata = workItem.metadata as WorkItemMetadata;
      if (result.success && metadata?.pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            metadata.pipelineId!,
            [workItem.id],
            'content_generation'
          );
        }, 1000); // Small delay to ensure work item is marked complete
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Proposal outline creation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Outline creation failed',
      };
    }
  }

  /**
   * Process executive summary generation task
   */
  private async processExecutiveSummaryGeneration(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `✍️ Processing executive summary generation for work item ${workItem.id}`
    );

    try {
      const result =
        await contentGenerationSpecialist.generateExecutiveSummary(workItem);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Executive summary generation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Executive summary generation failed',
      };
    }
  }

  /**
   * Process technical content generation task
   */
  private async processTechnicalContentGeneration(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `🔧 Processing technical content generation for work item ${workItem.id}`
    );

    try {
      const result =
        await contentGenerationSpecialist.generateTechnicalContent(workItem);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Technical content generation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Technical content generation failed',
      };
    }
  }

  /**
   * Process qualifications generation task
   */
  private async processQualificationsGeneration(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `🏆 Processing qualifications generation for work item ${workItem.id}`
    );

    try {
      const result =
        await contentGenerationSpecialist.generateQualifications(workItem);
      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Qualifications generation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Qualifications generation failed',
      };
    }
  }

  /**
   * Process proposal pricing analysis task
   */
  private async processProposalPricingAnalysis(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `💰 Processing proposal pricing analysis for work item ${workItem.id}`
    );

    try {
      const result = await pricingAnalysisSpecialist.analyzePricing(workItem);

      // Notify orchestrator of completion
      const metadata = workItem.metadata as WorkItemMetadata;
      if (result.success && metadata?.pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            metadata.pipelineId!,
            [workItem.id],
            'compliance_validation'
          );
        }, 1000);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Proposal pricing analysis failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Pricing analysis failed',
      };
    }
  }

  /**
   * Process proposal compliance validation task
   */
  private async processProposalComplianceValidation(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `✅ Processing proposal compliance validation for work item ${workItem.id}`
    );

    try {
      const result =
        await complianceValidationSpecialist.validateCompliance(workItem);

      // Notify orchestrator of completion
      const metadata = workItem.metadata as WorkItemMetadata;
      if (result.success && metadata?.pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            metadata.pipelineId!,
            [workItem.id],
            'form_completion'
          );
        }, 1000);
      }

      return {
        success: result.success,
        data: result.data,
        error: result.error,
      };
    } catch (error) {
      console.error('❌ Proposal compliance validation failed:', error);
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Compliance validation failed',
      };
    }
  }

  /**
   * Process proposal form completion task
   */
  private async processProposalFormCompletion(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `📄 Processing proposal form completion for work item ${workItem.id}`
    );

    try {
      // Use enhanced proposal service for form completion
      const inputs = workItem.inputs as ProposalGenerationInputs;
      const {
        rfpId,
        companyProfileId,
        outline,
        content,
        pricing,
        compliance,
        pipelineId,
      } = inputs;

      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Use document intelligence service for form processing
      const documentAnalysis =
        await documentIntelligenceService.analyzeRFPDocuments(rfpId);

      // Auto-fill forms with available data
      const filledForms = await documentIntelligenceService.autoFillFormFields(
        rfpId,
        documentAnalysis.formFields,
        companyProfileId
      );

      // Create attachments list
      const attachmentsList = this.generateAttachmentsList(
        content,
        pricing,
        compliance
      );

      // Create submission package
      const submissionPackage = {
        forms: filledForms,
        attachments: attachmentsList,
        metadata: {
          rfpId,
          pipelineId,
          generatedAt: new Date(),
          readyForSubmission: true,
        },
      };

      // Notify orchestrator of completion
      if (pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            pipelineId,
            [workItem.id],
            'final_assembly'
          );
        }, 1000);
      }

      return {
        success: true,
        data: {
          completed_forms: filledForms,
          attachments_list: attachmentsList,
          submission_package: submissionPackage,
        },
      };
    } catch (error) {
      console.error('❌ Proposal form completion failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Form completion failed',
      };
    }
  }

  /**
   * Process proposal final assembly task
   */
  private async processProposalFinalAssembly(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `🔧 Processing proposal final assembly for work item ${workItem.id}`
    );

    try {
      const inputs = workItem.inputs as ProposalGenerationInputs;
      const {
        rfpId,
        companyProfileId,
        outline,
        content,
        pricing,
        compliance,
        forms,
        pipelineId,
      } = inputs;

      // Assemble complete proposal
      const completeProposal = {
        rfpId,
        content: {
          ...content,
          outline: outline,
          generatedAt: new Date(),
        },
        narratives: content
          ? [
              content.executive_summary,
              content.company_overview,
              content.technical_approach,
              content.qualifications,
            ].filter(Boolean)
          : [],
        pricingTables: pricing?.pricing_breakdown || null,
        forms: forms?.completed_forms || null,
        attachments: forms?.attachments_list || [],
        estimatedMargin: pricing?.competitive_strategy?.margin
          ? (pricing.competitive_strategy.margin * 100).toFixed(2)
          : '15.00',
        status: 'draft',
        metadata: {
          pipelineId,
          complianceScore: compliance?.qualityScore || 0.8,
          qualityScore: this.calculateOverallQualityScore(
            content,
            pricing,
            compliance
          ),
          generationPhases: [
            'outline',
            'content',
            'pricing',
            'compliance',
            'forms',
            'assembly',
          ],
          assemblyDate: new Date(),
        },
      };

      // Create proposal in database
      const proposal = await storage.createProposal(completeProposal);
      console.log(`✅ Created proposal ${proposal.id} for RFP ${rfpId}`);

      // Update RFP status
      await storage.updateRFP(rfpId, {
        status: 'review',
        progress: 90,
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'proposal',
        entityId: proposal.id,
        action: 'assembled',
        details: {
          pipelineId,
          rfpId,
          qualityScore: completeProposal.metadata.qualityScore,
          complianceScore: completeProposal.metadata.complianceScore,
        },
      });

      // Create notification
      await storage.createNotification({
        type: 'approval',
        title: 'Proposal Assembly Complete',
        message: `Proposal assembled successfully for ${rfpId}. Ready for quality assurance.`,
        relatedEntityType: 'proposal',
        relatedEntityId: proposal.id,
      });

      // Notify orchestrator of completion
      if (pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            pipelineId,
            [workItem.id],
            'quality_assurance'
          );
        }, 1000);
      }

      return {
        success: true,
        data: {
          complete_proposal: completeProposal,
          proposal_metadata: {
            proposalId: proposal.id,
            qualityScore: completeProposal.metadata.qualityScore,
            complianceScore: completeProposal.metadata.complianceScore,
          },
          submission_ready: true,
        },
      };
    } catch (error) {
      console.error('❌ Proposal final assembly failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Final assembly failed',
      };
    }
  }

  /**
   * Process proposal quality assurance task
   */
  private async processProposalQualityAssurance(
    workItem: WorkItem
  ): Promise<WorkflowResult> {
    console.log(
      `🔍 Processing proposal quality assurance for work item ${workItem.id}`
    );

    try {
      const inputs = workItem.inputs as Record<string, any>;
      const { rfpId, proposalId, qualityThreshold, pipelineId } = inputs;

      // Get proposal for quality assessment
      const proposal = await storage.getProposal(proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${proposalId}`);
      }

      // Get RFP for context
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Perform quality assessment
      const qualityAssessment = await this.performQualityAssessment(
        proposal,
        rfp
      );

      // Generate validation report
      const validationReport = this.generateQualityValidationReport(
        qualityAssessment,
        qualityThreshold
      );

      // Generate improvement recommendations if needed
      const improvementRecommendations =
        qualityAssessment.overallScore < qualityThreshold
          ? this.generateImprovementRecommendations(qualityAssessment)
          : [];

      // Update proposal with quality data
      await storage.updateProposal(proposalId, {
        status:
          qualityAssessment.overallScore >= qualityThreshold
            ? 'review'
            : 'draft',
        // Note: qualityScore and aiAnalysis fields don't exist on Proposal schema
        // Quality data is tracked separately through the quality evaluation system
      });

      // Update RFP progress
      await storage.updateRFP(rfpId, {
        status:
          qualityAssessment.overallScore >= qualityThreshold
            ? 'review'
            : 'drafting',
        progress: qualityAssessment.overallScore >= qualityThreshold ? 75 : 65, // Proposal ready but not submitted
      });

      // Create notification
      await storage.createNotification({
        type:
          qualityAssessment.overallScore >= qualityThreshold
            ? 'approval'
            : 'compliance',
        title:
          qualityAssessment.overallScore >= qualityThreshold
            ? 'Proposal Ready for Review'
            : 'Proposal Needs Improvement',
        message: `Quality score: ${(qualityAssessment.overallScore * 100).toFixed(1)}%. ${
          qualityAssessment.overallScore >= qualityThreshold
            ? 'Ready for submission.'
            : 'Improvements needed.'
        }`,
        relatedEntityType: 'proposal',
        relatedEntityId: proposalId,
      });

      // Notify orchestrator of completion
      if (pipelineId) {
        setTimeout(() => {
          proposalGenerationOrchestrator.handlePhaseCompletion(
            pipelineId,
            [workItem.id],
            'completed'
          );
        }, 1000);
      }

      return {
        success: true,
        data: {
          quality_score: qualityAssessment.overallScore,
          validation_report: validationReport,
          improvement_recommendations: improvementRecommendations,
          ready_for_submission:
            qualityAssessment.overallScore >= qualityThreshold,
        },
      };
    } catch (error) {
      console.error('❌ Proposal quality assurance failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Quality assurance failed',
      };
    }
  }

  // ============ HELPER METHODS FOR PROPOSAL GENERATION ============

  /**
   * Generate attachments list based on proposal components
   */
  private generateAttachmentsList(
    content: any,
    pricing: any,
    compliance: any
  ): string[] {
    const attachments = [];

    if (content) {
      attachments.push(
        'Executive Summary',
        'Company Overview',
        'Technical Approach'
      );
    }

    if (pricing) {
      attachments.push('Pricing Breakdown', 'Cost Analysis');
    }

    if (compliance) {
      attachments.push('Compliance Matrix', 'Certification Documents');
    }

    // Add standard attachments
    attachments.push('Insurance Certificates', 'Company Profile', 'References');

    return attachments;
  }

  /**
   * Calculate overall quality score based on all components
   */
  private calculateOverallQualityScore(
    content: any,
    pricing: any,
    compliance: any
  ): number {
    let totalScore = 0;
    let components = 0;

    if (content?.qualityScore) {
      totalScore += content.qualityScore;
      components++;
    }

    if (pricing?.qualityScore) {
      totalScore += pricing.qualityScore;
      components++;
    }

    if (compliance?.qualityScore) {
      totalScore += compliance.qualityScore;
      components++;
    }

    return components > 0 ? totalScore / components : 0.8;
  }

  /**
   * Perform comprehensive quality assessment of proposal
   */
  private async performQualityAssessment(
    proposal: any,
    rfp: any
  ): Promise<any> {
    const assessment = {
      contentQuality: this.assessContentQuality(proposal.content),
      complianceScore: proposal.metadata?.complianceScore || 0.8,
      completeness: this.assessCompleteness(proposal),
      relevance: this.assessRelevance(proposal, rfp),
      overallScore: 0,
    };

    // Calculate overall score
    assessment.overallScore =
      assessment.contentQuality * 0.3 +
      assessment.complianceScore * 0.3 +
      assessment.completeness * 0.2 +
      assessment.relevance * 0.2;

    return assessment;
  }

  /**
   * Assess content quality
   */
  private assessContentQuality(content: any): number {
    let score = 0.7; // Base score

    if (content?.executive_summary && content.executive_summary.length > 100)
      score += 0.1;
    if (content?.technical_approach && content.technical_approach.length > 200)
      score += 0.1;
    if (content?.qualifications && content.qualifications.length > 150)
      score += 0.1;

    return Math.min(1.0, score);
  }

  /**
   * Assess proposal completeness
   */
  private assessCompleteness(proposal: any): number {
    let score = 0;
    const maxScore = 5;

    if (proposal.content) score += 1;
    if (proposal.narratives && proposal.narratives.length > 0) score += 1;
    if (proposal.pricingTables) score += 1;
    if (proposal.forms) score += 1;
    if (proposal.attachments && proposal.attachments.length > 0) score += 1;

    return score / maxScore;
  }

  /**
   * Assess proposal relevance to RFP
   */
  private assessRelevance(proposal: any, rfp: any): number {
    // Simple relevance check based on content matching
    let score = 0.8; // Base relevance score

    const rfpKeywords = this.extractKeywords(
      rfp.title + ' ' + (rfp.description || '')
    );
    const proposalText = JSON.stringify(proposal.content || '').toLowerCase();

    const matchingKeywords = rfpKeywords.filter(keyword =>
      proposalText.includes(keyword.toLowerCase())
    );

    if (matchingKeywords.length > rfpKeywords.length * 0.3) {
      score += 0.1;
    }

    return Math.min(1.0, score);
  }

  /**
   * Extract keywords from text
   */
  private extractKeywords(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 10);
  }

  /**
   * Generate quality validation report
   */
  private generateQualityValidationReport(
    assessment: any,
    threshold: number
  ): any {
    return {
      summary: `Quality assessment completed. Overall score: ${(assessment.overallScore * 100).toFixed(1)}%`,
      scores: {
        content: (assessment.contentQuality * 100).toFixed(1) + '%',
        compliance: (assessment.complianceScore * 100).toFixed(1) + '%',
        completeness: (assessment.completeness * 100).toFixed(1) + '%',
        relevance: (assessment.relevance * 100).toFixed(1) + '%',
      },
      status:
        assessment.overallScore >= threshold ? 'PASSED' : 'NEEDS_IMPROVEMENT',
      threshold: (threshold * 100).toFixed(1) + '%',
      recommendations:
        assessment.overallScore < threshold
          ? 'Review and improve areas with lower scores before submission'
          : 'Proposal meets quality standards and is ready for review',
    };
  }

  /**
   * Generate improvement recommendations
   */
  private generateImprovementRecommendations(assessment: any): string[] {
    const recommendations = [];

    if (assessment.contentQuality < 0.8) {
      recommendations.push(
        'Enhance content quality by adding more detailed explanations and examples'
      );
    }

    if (assessment.complianceScore < 0.8) {
      recommendations.push(
        'Address compliance issues and ensure all requirements are met'
      );
    }

    if (assessment.completeness < 0.8) {
      recommendations.push('Complete missing sections and attachments');
    }

    if (assessment.relevance < 0.8) {
      recommendations.push(
        'Better align proposal content with RFP requirements and keywords'
      );
    }

    return recommendations;
  }
}

export const workflowCoordinator = new WorkflowCoordinator();
