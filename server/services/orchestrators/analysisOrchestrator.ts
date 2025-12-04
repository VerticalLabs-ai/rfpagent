import type { WorkItem } from '@shared/schema';
import { nanoid } from 'nanoid';
import { storage } from '../../storage';
import { agentRegistryService } from '../agents/agentRegistryService';
import { analysisProgressTracker } from '../monitoring/analysisProgressTracker';
import { workflowCoordinator } from '../workflows/workflowCoordinator';

export interface AnalysisWorkflowInput {
  rfpId: string;
  sessionId: string;
  companyProfileId?: string;
  priority?: number;
  deadline?: Date;
}

export interface AnalysisWorkflowResult {
  success: boolean;
  rfpId: string;
  analysisComplete: boolean;
  documentsProcessed: number;
  complianceAnalysisComplete: boolean;
  requirementsExtracted: number;
  riskFlags: number;
  error?: string;
  metadata?: any;
}

export interface WorkItemSequence {
  id: string;
  sequenceId: string;
  name: string;
  taskType: string;
  dependencies: string[];
  assignedAgent?: string;
  inputs: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * Analysis Pipeline Orchestrator for 3-Tier RFP Automation System
 *
 * Orchestrates the complete document analysis workflow:
 * 1. Document Download & Storage
 * 2. OCR/Text Extraction
 * 3. Requirement Parsing
 * 4. Compliance Checklist Generation
 * 5. Risk Assessment & Flag Generation
 *
 * Coordinates between analysis managers and specialists for parallel processing
 */
export class AnalysisOrchestrator {
  private activeWorkflows = new Map<string, WorkItemSequence[]>();
  private progressTracking = new Map<string, any>();

  constructor() {
    this.initializeAnalysisAgents();
  }

  /**
   * Initialize and register analysis-specific agents in the 3-tier system
   */
  private async initializeAnalysisAgents(): Promise<void> {
    try {
      // Register Analysis Orchestrator Agent (Tier 1)
      await this.registerAnalysisOrchestrator();

      // Register Analysis Manager Agent (Tier 2)
      await this.registerAnalysisManager();

      // Register Analysis Specialist Agents (Tier 3)
      await this.registerAnalysisSpecialists();

      console.log('✅ Analysis agents initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize analysis agents:', error);
    }
  }

  /**
   * Register the primary analysis orchestrator agent
   */
  private async registerAnalysisOrchestrator(): Promise<void> {
    await agentRegistryService.registerAgent({
      agentId: 'analysis-orchestrator',
      tier: 'orchestrator',
      role: 'analysis-orchestrator',
      displayName: 'Analysis Orchestrator',
      description: 'Primary orchestrator for RFP document analysis workflows',
      capabilities: [
        'workflow_orchestration',
        'analysis_coordination',
        'document_workflow_management',
        'progress_tracking',
        'error_recovery',
        'compliance_oversight',
      ],
      tools: [
        'workflow_coordinator',
        'document_parser',
        'document_intelligence',
        'ai_service',
        'agent_registry',
        'notification_service',
      ],
      maxConcurrency: 3,
      configuration: {
        maxRfpsPerWorkflow: 5,
        defaultTimeout: 7200000, // 2 hours for complex analysis
        retryAttempts: 3,
        progressReportingInterval: 15000, // 15 seconds
        parallelDocumentProcessing: true,
      },
    });
  }

  /**
   * Register the analysis manager agent
   */
  private async registerAnalysisManager(): Promise<void> {
    await agentRegistryService.registerAgent({
      agentId: 'analysis-manager',
      tier: 'manager',
      role: 'analysis-manager',
      displayName: 'Analysis Manager',
      description: 'Coordinates document processing tasks across specialists',
      capabilities: [
        'document_coordination',
        'specialist_management',
        'task_distribution',
        'progress_monitoring',
        'quality_assurance',
      ],
      tools: [
        'document_parser',
        'document_intelligence',
        'agent_coordination',
        'progress_tracker',
      ],
      maxConcurrency: 5,
      parentAgentId: 'analysis-orchestrator',
      configuration: {
        maxDocumentsPerBatch: 10,
        specialistTimeout: 1800000, // 30 minutes per document
        qualityCheckEnabled: true,
        parallelProcessing: true,
      },
    });
  }

  /**
   * Register analysis specialist agents
   */
  private async registerAnalysisSpecialists(): Promise<void> {
    // Document Processor Specialist
    await agentRegistryService.registerAgent({
      agentId: 'document-processor',
      tier: 'specialist',
      role: 'document-processor',
      displayName: 'Document Processor',
      description: 'Specializes in document parsing, OCR, and text extraction',
      capabilities: [
        'document_parsing',
        'ocr_processing',
        'text_extraction',
        'file_format_conversion',
        'metadata_extraction',
      ],
      tools: ['document_parser', 'pdf_parser', 'ocr_engine', 'text_extractor'],
      maxConcurrency: 3,
      parentAgentId: 'analysis-manager',
      configuration: {
        supportedFormats: ['pdf', 'docx', 'txt', 'rtf'],
        ocrEnabled: true,
        textExtractionQuality: 'high',
        maxFileSize: 50000000, // 50MB
      },
    });

    // Compliance Checker Specialist
    await agentRegistryService.registerAgent({
      agentId: 'compliance-checker',
      tier: 'specialist',
      role: 'compliance-checker',
      displayName: 'Compliance Checker',
      description: 'Specializes in compliance analysis and risk assessment',
      capabilities: [
        'compliance_analysis',
        'requirement_parsing',
        'risk_assessment',
        'checklist_generation',
        'deadline_extraction',
      ],
      tools: [
        'ai_service',
        'document_intelligence',
        'compliance_analyzer',
        'risk_assessor',
      ],
      maxConcurrency: 2,
      parentAgentId: 'analysis-manager',
      configuration: {
        aiModel: 'gpt-5',
        confidenceThreshold: 0.7,
        riskSensitivity: 'high',
        complianceFrameworks: ['government', 'federal', 'state', 'local'],
      },
    });

    // Requirements Extractor Specialist
    await agentRegistryService.registerAgent({
      agentId: 'requirements-extractor',
      tier: 'specialist',
      role: 'requirements-extractor',
      displayName: 'Requirements Extractor',
      description:
        'Specializes in extracting and categorizing RFP requirements',
      capabilities: [
        'requirement_extraction',
        'requirement_categorization',
        'mandatory_field_identification',
        'evaluation_criteria_parsing',
        'technical_specification_analysis',
      ],
      tools: [
        'ai_service',
        'document_intelligence',
        'nlp_processor',
        'requirement_analyzer',
      ],
      maxConcurrency: 2,
      parentAgentId: 'analysis-manager',
      configuration: {
        aiModel: 'gpt-5',
        requirementCategories: [
          'technical',
          'financial',
          'legal',
          'operational',
        ],
        extractionAccuracy: 'high',
        structuredOutput: true,
      },
    });
  }

  /**
   * Execute analysis workflow for an RFP and return detailed results
   */
  async executeAnalysisWorkflow(
    input: AnalysisWorkflowInput
  ): Promise<AnalysisWorkflowResult> {
    try {
      const workflowId = await this.startAnalysisWorkflow(input);

      // Initialize progress tracking with analysis progress tracker
      await analysisProgressTracker.initializeProgress({
        rfpId: input.rfpId,
        workflowId: workflowId,
        totalSteps: 4,
      });

      // Return immediate result with workflow started status
      const result: AnalysisWorkflowResult = {
        success: true,
        rfpId: input.rfpId,
        analysisComplete: false,
        documentsProcessed: 0,
        complianceAnalysisComplete: false,
        requirementsExtracted: 0,
        riskFlags: 0,
        metadata: {
          workflowId,
          startedAt: new Date(),
          status: 'started',
          sessionId: input.sessionId,
        },
      };

      // Note: The actual workflow execution happens asynchronously
      // Progress can be tracked using the analysisProgressTracker

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      return {
        success: false,
        rfpId: input.rfpId,
        analysisComplete: false,
        documentsProcessed: 0,
        complianceAnalysisComplete: false,
        requirementsExtracted: 0,
        riskFlags: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Start analysis workflow for an RFP
   */
  async startAnalysisWorkflow(input: AnalysisWorkflowInput): Promise<string> {
    const workflowId = nanoid();
    console.log(
      `🔍 Starting analysis workflow ${workflowId} for RFP: ${input.rfpId}`
    );

    try {
      // Get RFP and documents
      const rfp = await storage.getRFP(input.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${input.rfpId}`);
      }

      const documents = await storage.getDocumentsByRFP(input.rfpId);
      console.log(`📄 Found ${documents.length} documents to analyze`);

      // Initialize progress tracking
      this.progressTracking.set(workflowId, {
        rfpId: input.rfpId,
        totalSteps: 4 + documents.length, // 4 phases + individual document processing
        completedSteps: 0,
        status: 'initializing',
        startedAt: new Date(),
        lastUpdated: new Date(),
      });

      // Create sequenced work items
      const workSequence = await this.createAnalysisWorkSequence(
        workflowId,
        input.rfpId,
        input.sessionId,
        documents,
        input.priority || 5,
        input.deadline
      );

      // Store work sequence
      this.activeWorkflows.set(workflowId, workSequence);

      // Update RFP status to analysis phase
      await storage.updateRFP(input.rfpId, {
        status: 'parsing',
        progress: 10,
      });

      // Create notification
      await storage.createNotification({
        type: 'analysis',
        title: 'Analysis Workflow Started',
        message: `Started document analysis for RFP: ${rfp.title}`,
        relatedEntityType: 'rfp',
        relatedEntityId: input.rfpId,
      });

      // Submit initial work items (those with no dependencies)
      await this.submitInitialWorkItems(
        workflowId,
        workSequence,
        input.sessionId
      );

      console.log(
        `✅ Analysis workflow ${workflowId} started with ${workSequence.length} work items`
      );
      return workflowId;
    } catch (error) {
      console.error(
        `❌ Failed to start analysis workflow for RFP ${input.rfpId}:`,
        error
      );

      // Update RFP status to error
      await storage.updateRFP(input.rfpId, {
        status: 'error',
        progress: 0,
      });

      throw error;
    }
  }

  /**
   * Create the sequenced analysis workflow
   */
  private async createAnalysisWorkSequence(
    workflowId: string,
    rfpId: string,
    sessionId: string,
    documents: Document[],
    priority: number,
    deadline?: Date
  ): Promise<WorkItemSequence[]> {
    const sequence: WorkItemSequence[] = [];

    // Phase 1: Document Download & Validation (parallel for all documents)
    const documentValidationTasks = documents.map(doc => ({
      id: `doc-validate-${doc.id}`,
      sequenceId: `doc-validate-${doc.id}`,
      name: `Validate Document: ${doc.filename}`,
      taskType: 'document_validation',
      dependencies: [],
      assignedAgent: 'document-processor',
      inputs: {
        documentId: doc.id,
        rfpId: rfpId,
        filename: doc.filename,
        fileType: doc.fileType,
        objectPath: doc.objectPath,
      },
      metadata: {
        workflowId,
        phase: 1,
        parallel: true,
        priority,
        deadline,
        sequenceId: `doc-validate-${doc.id}`,
      },
    }));

    sequence.push(...documentValidationTasks);

    // Phase 2: OCR/Text Extraction (depends on validation)
    const textExtractionTasks = documents.map(doc => ({
      id: `text-extract-${doc.id}`,
      sequenceId: `text-extract-${doc.id}`,
      name: `Extract Text: ${doc.filename}`,
      taskType: 'text_extraction',
      dependencies: [`doc-validate-${doc.id}`],
      assignedAgent: 'document-processor',
      inputs: {
        documentId: doc.id,
        rfpId: rfpId,
        extractionMethod: this.determineExtractionMethod(doc.fileType),
        qualityLevel: 'high',
      },
      metadata: {
        workflowId,
        phase: 2,
        parallel: true,
        priority,
        deadline,
        sequenceId: `text-extract-${doc.id}`,
      },
    }));

    sequence.push(...textExtractionTasks);

    // Phase 3: Requirement Parsing (depends on text extraction)
    const requirementTasks = documents.map(doc => ({
      id: `req-parse-${doc.id}`,
      sequenceId: `req-parse-${doc.id}`,
      name: `Parse Requirements: ${doc.filename}`,
      taskType: 'requirement_parsing',
      dependencies: [`text-extract-${doc.id}`],
      assignedAgent: 'requirements-extractor',
      inputs: {
        documentId: doc.id,
        rfpId: rfpId,
        extractionFocus: [
          'mandatory',
          'optional',
          'evaluation_criteria',
          'deadlines',
        ],
        structuredOutput: true,
      },
      metadata: {
        workflowId,
        phase: 3,
        parallel: true,
        priority,
        deadline,
        sequenceId: `req-parse-${doc.id}`,
      },
    }));

    sequence.push(...requirementTasks);

    // Phase 4: Compliance Analysis (depends on requirement parsing)
    const complianceTask = {
      id: `compliance-analysis-${rfpId}`,
      sequenceId: `compliance-analysis-${rfpId}`,
      name: `Compliance Analysis: Complete RFP`,
      taskType: 'compliance_analysis',
      dependencies: requirementTasks.map(task => task.id),
      assignedAgent: 'compliance-checker',
      inputs: {
        rfpId: rfpId,
        documentIds: documents.map(doc => doc.id),
        analysisScope: [
          'compliance_checklist',
          'risk_flags',
          'mandatory_fields',
          'deadlines',
        ],
        riskAssessment: true,
      },
      metadata: {
        workflowId,
        phase: 4,
        parallel: false,
        priority: priority + 1, // Higher priority for final phase
        deadline,
        sequenceId: `compliance-analysis-${rfpId}`,
      },
    };

    sequence.push(complianceTask);

    return sequence;
  }

  /**
   * Submit initial work items that have no dependencies
   */
  private async submitInitialWorkItems(
    workflowId: string,
    workSequence: WorkItemSequence[],
    sessionId: string
  ): Promise<void> {
    const initialTasks = workSequence.filter(
      task => task.dependencies.length === 0
    );

    console.log(
      `📤 Submitting ${initialTasks.length} initial work items for workflow ${workflowId}`
    );

    for (const task of initialTasks) {
      try {
        const taskInputs = task.inputs as Record<string, unknown>;
        const taskMetadata = task.metadata as Record<string, unknown>;
        const priorityValue =
          (taskMetadata.priority as number | undefined) ?? 5;
        const deadlineValue =
          taskMetadata.deadline instanceof Date
            ? (taskMetadata.deadline as Date)
            : undefined;
        const contextRef = taskInputs.rfpId as string | undefined;

        const workItem = await workflowCoordinator.createWorkItem({
          sessionId,
          taskType: task.taskType,
          inputs: task.inputs,
          priority: priorityValue,
          deadline: deadlineValue,
          contextRef,
          workflowId: workflowId,
          createdByAgentId: 'analysis-orchestrator',
          metadata: {
            ...task.metadata,
            sequenceId: task.id,
            taskName: task.name,
          },
        });

        console.log(
          `✅ Created work item ${workItem.id} for task: ${task.name}`
        );

        const assignment = await workflowCoordinator.assignWorkItem(
          workItem.id
        );
        if (!assignment.success) {
          console.warn(
            `⚠️ Work item ${workItem.id} pending assignment: ${assignment.error}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Failed to create work item for task ${task.name}:`,
          error
        );
      }
    }
  }

  /**
   * Handle work item completion and trigger dependent tasks
   */
  async handleWorkItemCompletion(workItemId: string): Promise<void> {
    try {
      const workItem = await storage.getWorkItem(workItemId);
      if (!workItem || !workItem.workflowId) return;

      const workflowId = workItem.workflowId;
      const workSequence = this.activeWorkflows.get(workflowId);
      if (!workSequence) return;

      console.log(
        `✅ Work item ${workItemId} completed for workflow ${workflowId}`
      );

      // Update progress tracking
      this.updateWorkflowProgress(workflowId, workItem);

      // Find and submit dependent tasks
      const workItemMetadata = (workItem.metadata || {}) as Record<
        string,
        unknown
      >;
      const completedSequenceId = workItemMetadata.sequenceId as
        | string
        | undefined;
      if (!completedSequenceId) return;

      const dependentTasks = workSequence.filter(task =>
        task.dependencies.includes(completedSequenceId)
      );

      // Check if all dependencies are completed for each dependent task
      for (const dependentTask of dependentTasks) {
        const allDependenciesCompleted = await this.checkDependenciesCompleted(
          workflowId,
          dependentTask.dependencies
        );

        if (allDependenciesCompleted) {
          console.log(`📤 Submitting dependent task: ${dependentTask.name}`);

          const dependentInputs = dependentTask.inputs as Record<
            string,
            unknown
          >;
          const dependentMetadata = dependentTask.metadata as Record<
            string,
            unknown
          >;
          const dependentPriority =
            (dependentMetadata.priority as number | undefined) ?? 5;
          const dependentDeadline =
            dependentMetadata.deadline instanceof Date
              ? (dependentMetadata.deadline as Date)
              : undefined;
          const dependentContextRef = dependentInputs.rfpId as
            | string
            | undefined;

          const newWorkItem = await workflowCoordinator.createWorkItem({
            sessionId: workItem.sessionId,
            taskType: dependentTask.taskType,
            inputs: dependentTask.inputs,
            priority: dependentPriority,
            deadline: dependentDeadline,
            contextRef: dependentContextRef,
            workflowId: workflowId,
            createdByAgentId: 'analysis-orchestrator',
            metadata: {
              ...dependentTask.metadata,
              sequenceId: dependentTask.id,
              taskName: dependentTask.name,
            },
          });

          // Assign to specific agent if specified
          const dependAssignment = await workflowCoordinator.assignWorkItem(
            newWorkItem.id
          );
          if (!dependAssignment.success) {
            console.warn(
              `⚠️ Dependent work item ${newWorkItem.id} pending assignment: ${dependAssignment.error}`
            );
          }
        }
      }

      // Check if workflow is complete
      await this.checkWorkflowCompletion(workflowId);
    } catch (error) {
      console.error(`❌ Failed to handle work item completion:`, error);
    }
  }

  /**
   * Check if all dependencies for a task are completed
   */
  private async checkDependenciesCompleted(
    workflowId: string,
    dependencies: string[]
  ): Promise<boolean> {
    if (dependencies.length === 0) return true;

    // Get all completed work items for this workflow
    const allWorkItems = await storage.getWorkItemsByStatus('completed');
    const workflowItems = allWorkItems.filter(
      item => item.workflowId === workflowId && item.status === 'completed'
    );

    const completedSequenceIds = workflowItems
      .map(item => (item.metadata || {}) as Record<string, unknown>)
      .map(metadata => metadata.sequenceId as string | undefined)
      .filter((id): id is string => typeof id === 'string');

    return dependencies.every(dep => completedSequenceIds.includes(dep));
  }

  /**
   * Update workflow progress tracking
   */
  private updateWorkflowProgress(
    workflowId: string,
    completedWorkItem: WorkItem
  ): void {
    const progress = this.progressTracking.get(workflowId);
    if (!progress) return;

    progress.completedSteps += 1;
    progress.lastUpdated = new Date();

    const percentComplete = Math.round(
      (progress.completedSteps / progress.totalSteps) * 100
    );
    progress.percentComplete = percentComplete;

    // Update RFP progress
    if (completedWorkItem.contextRef) {
      storage.updateRFP(completedWorkItem.contextRef, {
        progress: Math.min(10 + percentComplete * 0.8, 90), // Keep 10% buffer for final steps
      });
    }

    console.log(
      `📈 Workflow ${workflowId} progress: ${progress.completedSteps}/${progress.totalSteps} (${percentComplete}%)`
    );
  }

  /**
   * Check if workflow is complete and finalize
   */
  private async checkWorkflowCompletion(workflowId: string): Promise<void> {
    const workSequence = this.activeWorkflows.get(workflowId);
    const progress = this.progressTracking.get(workflowId);

    if (!workSequence || !progress) return;

    // Check if all tasks in sequence are completed
    const allCompleted = await Promise.all(
      workSequence.map(async task => {
        const allWorkItems = await storage.getWorkItemsByStatus('completed');
        return allWorkItems.some(item => {
          if (item.workflowId !== workflowId || item.status !== 'completed') {
            return false;
          }
          const metadata = (item.metadata || {}) as Record<string, unknown>;
          return metadata.sequenceId === task.id;
        });
      })
    );

    if (allCompleted.every(completed => completed)) {
      console.log(`🎉 Analysis workflow ${workflowId} completed successfully!`);

      // Finalize workflow
      await this.finalizeAnalysisWorkflow(workflowId, progress.rfpId);

      // Clean up
      this.activeWorkflows.delete(workflowId);
      this.progressTracking.delete(workflowId);
    }
  }

  /**
   * Finalize the analysis workflow
   */
  private async finalizeAnalysisWorkflow(
    workflowId: string,
    rfpId: string
  ): Promise<void> {
    try {
      // Update RFP status to completed analysis
      await storage.updateRFP(rfpId, {
        status: 'review',
        progress: 25, // Analysis complete, but still needs proposal generation and submission
      });

      // Get final analysis results
      const documents = await storage.getDocumentsByRFP(rfpId);
      const rfp = await storage.getRFP(rfpId);

      // Create completion notification
      await storage.createNotification({
        type: 'analysis',
        title: 'Analysis Workflow Completed',
        message: `Completed document analysis for RFP: ${rfp?.title}. ${documents.length} documents processed.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'analysis_completed',
        details: {
          workflowId,
          documentsProcessed: documents.length,
          completedAt: new Date(),
          analysisResults: {
            requirements: rfp?.requirements,
            complianceItems: rfp?.complianceItems,
            riskFlags: rfp?.riskFlags,
          },
        },
      });

      console.log(
        `✅ Analysis workflow ${workflowId} finalized for RFP ${rfpId}`
      );
    } catch (error) {
      console.error(
        `❌ Failed to finalize analysis workflow ${workflowId}:`,
        error
      );
    }
  }

  /**
   * Determine the best text extraction method based on file type
   */
  private determineExtractionMethod(fileType: string): string {
    switch (fileType.toLowerCase()) {
      case 'application/pdf':
      case 'pdf':
        return 'pdf_parser_with_ocr';
      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      case 'docx':
        return 'mammoth_docx_parser';
      case 'text/plain':
      case 'txt':
        return 'direct_text_reader';
      default:
        return 'universal_text_extractor';
    }
  }

  /**
   * Get workflow status
   */
  async getWorkflowStatus(workflowId: string): Promise<any> {
    const progress = this.progressTracking.get(workflowId);
    const workSequence = this.activeWorkflows.get(workflowId);

    return {
      workflowId,
      progress: progress || null,
      totalTasks: workSequence?.length || 0,
      isActive: this.activeWorkflows.has(workflowId),
    };
  }

  /**
   * Cancel workflow
   */
  async cancelWorkflow(
    workflowId: string,
    reason: string = 'User requested'
  ): Promise<void> {
    console.log(`🚫 Cancelling analysis workflow ${workflowId}: ${reason}`);

    const progress = this.progressTracking.get(workflowId);
    if (progress) {
      // Update RFP status
      await storage.updateRFP(progress.rfpId, {
        status: 'discovered', // Reset to discovered state
        progress: 0,
      });

      // Create notification
      await storage.createNotification({
        type: 'analysis',
        title: 'Analysis Workflow Cancelled',
        message: `Analysis workflow cancelled: ${reason}`,
        relatedEntityType: 'rfp',
        relatedEntityId: progress.rfpId,
      });
    }

    // Clean up
    this.activeWorkflows.delete(workflowId);
    this.progressTracking.delete(workflowId);
  }
}

// Export singleton instance
export const analysisOrchestrator = new AnalysisOrchestrator();
export { DocumentIntelligenceService } from '../processing/documentIntelligenceService';
export { DocumentParsingService } from '../processing/documentParsingService';
