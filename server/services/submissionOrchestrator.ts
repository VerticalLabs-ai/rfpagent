import { storage } from '../storage';
import { workflowCoordinator } from './workflowCoordinator';
import { agentRegistryService } from './agentRegistryService';
import { agentMemoryService } from './agentMemoryService';
import { stagehandTools } from './stagehandTools';
import type {
  Submission,
  Proposal,
  Portal,
  RFP,
  SubmissionPipeline,
  WorkItem,
  AgentSession,
} from '@shared/schema';
import { nanoid } from 'nanoid';

export interface SubmissionPipelineRequest {
  submissionId: string;
  sessionId: string;
  portalCredentials?: {
    username?: string;
    password?: string;
    mfaMethod?: string;
  };
  priority?: number;
  deadline?: Date;
  retryOptions?: {
    maxRetries?: number;
    retryDelay?: number;
  };
  browserOptions?: {
    headless?: boolean;
    timeout?: number;
  };
  metadata?: any;
}

export interface SubmissionPipelineResult {
  success: boolean;
  pipelineId?: string;
  submissionId?: string;
  currentPhase?: string;
  progress?: number;
  status?: string;
  error?: string;
  estimatedCompletion?: Date;
  receiptData?: any;
  nextSteps?: string[];
}

export interface SubmissionPipelineInstance {
  pipelineId: string;
  submissionId: string;
  sessionId: string;
  rfpId: string;
  proposalId: string;
  portalId: string;
  currentPhase:
    | 'queued'
    | 'preflight'
    | 'authenticating'
    | 'filling'
    | 'uploading'
    | 'submitting'
    | 'verifying'
    | 'completed'
    | 'failed';
  status: 'pending' | 'in_progress' | 'suspended' | 'completed' | 'failed';
  progress: number;
  workItems: string[]; // IDs of created work items
  browserSessionId?: string;
  authenticationData?: any;
  formData?: any;
  uploadedDocuments?: any;
  submissionReceipt?: any;
  errorData?: any;
  retryCount: number;
  maxRetries: number;
  results: {
    preflight?: any;
    authentication?: any;
    formFilling?: any;
    documentUploads?: any;
    submission?: any;
    verification?: any;
  };
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Submission Pipeline Orchestrator
 *
 * Orchestrates the complete proposal submission pipeline through a 3-tier agent system:
 * - Orchestrator: Manages the overall submission pipeline and coordinates phases
 * - Manager: Coordinates specialists for each phase (submission-manager)
 * - Specialists: Execute specific tasks (portal-auth-specialist, form-submission-specialist, document-upload-specialist)
 *
 * Pipeline Phases:
 * 1. Preflight Checks - Validate submission readiness and portal requirements
 * 2. Portal Authentication - Login to government portal with credentials
 * 3. Form Population - Navigate and fill submission forms
 * 4. Document Attachment - Upload required documents and attachments
 * 5. Submission Execution - Execute the submission and capture confirmation
 * 6. Receipt Verification - Verify submission receipt and capture reference numbers
 * 7. Status Confirmation - Confirm final submission status and complete pipeline
 */
export class SubmissionOrchestrator {
  private activePipelines: Map<string, SubmissionPipelineInstance> = new Map();
  private phaseTimeout = 15 * 60 * 1000; // 15 minutes per phase
  private authTimeout = 5 * 60 * 1000; // 5 minutes for authentication
  private submitTimeout = 10 * 60 * 1000; // 10 minutes for submission

  constructor() {
    this.initializeSubmissionAgents();
  }

  /**
   * Initialize and register submission-specific agents in the 3-tier system
   */
  private async initializeSubmissionAgents(): Promise<void> {
    try {
      // Register Submission Orchestrator Agent (Tier 1)
      await this.registerSubmissionOrchestrator();

      // Register Submission Manager Agent (Tier 2)
      await this.registerSubmissionManager();

      // Register Submission Specialists (Tier 3)
      await this.registerSubmissionSpecialists();

      console.log('✅ Submission agents initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize submission agents:', error);
    }
  }

  private async registerSubmissionOrchestrator(): Promise<void> {
    try {
      await agentRegistryService.registerAgent({
        agentId: 'submission-orchestrator',
        tier: 'orchestrator',
        role: 'submission-orchestrator',
        displayName: 'Submission Pipeline Orchestrator',
        description:
          'Orchestrates complete proposal submission workflows through government portals',
        capabilities: [
          'submission_pipeline_management',
          'phase_coordination',
          'progress_tracking',
          'error_recovery',
          'audit_logging',
        ],
        tools: [
          'workflow_coordinator',
          'agent_memory',
          'storage',
          'notifications',
        ],
        maxConcurrency: 3,
        configuration: {
          phaseTimeout: this.phaseTimeout,
          authTimeout: this.authTimeout,
          submitTimeout: this.submitTimeout,
          maxRetries: 3,
        },
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  private async registerSubmissionManager(): Promise<void> {
    try {
      await agentRegistryService.registerAgent({
        agentId: 'submission-manager',
        tier: 'manager',
        role: 'submission-manager',
        displayName: 'Submission Manager',
        description:
          'Manages submission specialists and coordinates portal automation',
        capabilities: [
          'specialist_coordination',
          'browser_session_management',
          'portal_navigation',
          'error_handling',
          'retry_management',
        ],
        tools: ['stagehand_tools', 'mastra_scraping', 'agent_coordination'],
        maxConcurrency: 5,
        parentAgentId: 'submission-orchestrator',
        configuration: {
          browserTimeout: 300000, // 5 minutes
          retryDelay: 30000, // 30 seconds
          maxConcurrentSessions: 3,
        },
      });
    } catch (error) {
      if (!error.message.includes('already exists')) {
        throw error;
      }
    }
  }

  private async registerSubmissionSpecialists(): Promise<void> {
    const specialists = [
      {
        agentId: 'portal-authentication-specialist',
        displayName: 'Portal Authentication Specialist',
        description: 'Handles portal login, MFA, and session management',
        capabilities: [
          'portal_login',
          'mfa_handling',
          'session_management',
          'credential_validation',
        ],
      },
      {
        agentId: 'form-submission-specialist',
        displayName: 'Form Submission Specialist',
        description: 'Navigates and fills submission forms with proposal data',
        capabilities: [
          'form_navigation',
          'field_population',
          'validation_handling',
          'dynamic_forms',
        ],
      },
      {
        agentId: 'document-upload-specialist',
        displayName: 'Document Upload Specialist',
        description: 'Handles document uploads and attachment management',
        capabilities: [
          'file_upload',
          'document_validation',
          'attachment_management',
          'upload_verification',
        ],
      },
    ];

    for (const specialist of specialists) {
      try {
        await agentRegistryService.registerAgent({
          agentId: specialist.agentId,
          tier: 'specialist',
          role: specialist.agentId,
          displayName: specialist.displayName,
          description: specialist.description,
          capabilities: specialist.capabilities,
          tools: ['stagehand_tools', 'browser_automation', 'dom_manipulation'],
          maxConcurrency: 2,
          parentAgentId: 'submission-manager',
          configuration: {
            browserHeadless: false,
            actionTimeout: 30000,
            waitTimeout: 10000,
          },
        });
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.warn(
            `⚠️ Failed to register specialist ${specialist.agentId}:`,
            error.message
          );
        }
      }
    }
  }

  /**
   * Initiate a comprehensive submission pipeline
   */
  async initiateSubmissionPipeline(
    request: SubmissionPipelineRequest
  ): Promise<SubmissionPipelineResult> {
    console.log(
      `🚀 Initiating submission pipeline for submission: ${request.submissionId}`
    );

    try {
      // Validate submission exists and get related data
      const submission = await storage.getSubmission(request.submissionId);
      if (!submission) {
        throw new Error(`Submission not found: ${request.submissionId}`);
      }

      const proposal = await storage.getProposal(submission.proposalId);
      if (!proposal) {
        throw new Error(`Proposal not found: ${submission.proposalId}`);
      }

      const rfp = await storage.getRFP(proposal.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${proposal.rfpId}`);
      }

      const portal = await storage.getPortal(submission.portalId);
      if (!portal) {
        throw new Error(`Portal not found: ${submission.portalId}`);
      }

      // Create pipeline instance
      const pipelineId = nanoid();
      const pipeline: SubmissionPipelineInstance = {
        pipelineId,
        submissionId: request.submissionId,
        sessionId: request.sessionId,
        rfpId: proposal.rfpId,
        proposalId: submission.proposalId,
        portalId: submission.portalId,
        currentPhase: 'queued',
        status: 'pending',
        progress: 0,
        workItems: [],
        retryCount: 0,
        maxRetries: request.retryOptions?.maxRetries || 3,
        results: {},
        metadata: {
          portalName: portal.name,
          rfpTitle: rfp.title,
          proposalType: proposal.status,
          priority: request.priority || 5,
          deadline: request.deadline,
          browserOptions: request.browserOptions || {
            headless: false,
            timeout: 300000,
          },
          ...request.metadata,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.activePipelines.set(pipelineId, pipeline);

      // Create submission pipeline record in database
      await storage.createSubmissionPipeline({
        submissionId: request.submissionId,
        sessionId: request.sessionId,
        currentPhase: 'queued',
        status: 'pending',
        progress: 0,
        maxRetries: pipeline.maxRetries,
        metadata: pipeline.metadata,
      });

      // Store pipeline in agent memory for tracking
      await agentMemoryService.storeMemory({
        agentId: 'submission-orchestrator',
        memoryType: 'working',
        contextKey: `pipeline_${pipelineId}`,
        title: `Submission Pipeline - ${rfp.title}`,
        content: pipeline,
        importance: 9,
        tags: ['submission_pipeline', 'active_pipeline', portal.name],
        metadata: {
          submissionId: request.submissionId,
          sessionId: request.sessionId,
          portalId: submission.portalId,
        },
      });

      // Update submission status
      await storage.updateSubmission(request.submissionId, {
        status: 'pending',
        submissionData: {
          pipelineId,
          initiatedAt: new Date(),
          portalName: portal.name,
        },
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'submission',
        entityId: request.submissionId,
        action: 'pipeline_initiated',
        details: {
          pipelineId,
          portalId: submission.portalId,
          sessionId: request.sessionId,
          rfpTitle: rfp.title,
        },
      });

      // Create initial event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId: request.submissionId,
        eventType: 'pipeline_started',
        phase: 'queued',
        level: 'info',
        message: `Submission pipeline initiated for ${portal.name}`,
        details: {
          rfpTitle: rfp.title,
          portalName: portal.name,
          proposalId: submission.proposalId,
        },
        agentId: 'submission-orchestrator',
      });

      // Start the pipeline with Phase 1: Preflight Checks
      await this.executePhase1_PreflightChecks(pipeline);

      return {
        success: true,
        pipelineId,
        submissionId: request.submissionId,
        currentPhase: pipeline.currentPhase,
        progress: pipeline.progress,
        status: pipeline.status,
        estimatedCompletion: this.calculateEstimatedCompletion(pipeline),
        nextSteps: this.getNextSteps(pipeline),
      };
    } catch (error) {
      console.error('❌ Failed to initiate submission pipeline:', error);

      // Create failure event
      if (request.submissionId) {
        await storage.createSubmissionEvent({
          pipelineId: 'unknown',
          submissionId: request.submissionId,
          eventType: 'error',
          phase: 'queued',
          level: 'error',
          message: 'Failed to initiate submission pipeline',
          details: { error: error.message },
          agentId: 'submission-orchestrator',
        });
      }

      return {
        success: false,
        submissionId: request.submissionId,
        error:
          error instanceof Error ? error.message : 'Pipeline initiation failed',
      };
    }
  }

  /**
   * Phase 1: Preflight Checks
   * Validate submission readiness and portal requirements
   */
  private async executePhase1_PreflightChecks(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `🔍 Phase 1: Preflight checks for pipeline ${pipeline.pipelineId}`
    );

    pipeline.status = 'in_progress';
    pipeline.currentPhase = 'preflight';
    pipeline.progress = 10;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'preflight',
      level: 'info',
      message: 'Starting preflight checks',
      agentId: 'submission-orchestrator',
    });

    // Create work item for preflight checks
    const preflightWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'submission_preflight_checks',
      inputs: {
        submissionId: pipeline.submissionId,
        proposalId: pipeline.proposalId,
        portalId: pipeline.portalId,
        rfpId: pipeline.rfpId,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'portal_requirements',
        'document_checklist',
        'form_mapping',
        'validation_results',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'preflight', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(preflightWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(
      pipeline,
      preflightWorkItem.id,
      'authenticating'
    );
  }

  /**
   * Phase 2: Portal Authentication
   * Login to government portal with credentials
   */
  private async executePhase2_PortalAuthentication(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `🔐 Phase 2: Portal authentication for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'authenticating';
    pipeline.progress = 25;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'authenticating',
      level: 'info',
      message: 'Starting portal authentication',
      agentId: 'submission-orchestrator',
    });

    // Create work item for portal authentication
    const authWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'portal_authentication',
      inputs: {
        submissionId: pipeline.submissionId,
        portalId: pipeline.portalId,
        preflightResults: pipeline.results.preflight,
        browserOptions: pipeline.metadata.browserOptions,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'browser_session_id',
        'authentication_status',
        'session_data',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.authTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'authenticating', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(authWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, authWorkItem.id, 'filling');
  }

  /**
   * Phase 3: Form Population
   * Navigate and fill submission forms
   */
  private async executePhase3_FormPopulation(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `📝 Phase 3: Form population for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'filling';
    pipeline.progress = 45;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'filling',
      level: 'info',
      message: 'Starting form population',
      agentId: 'submission-orchestrator',
    });

    // Create work item for form population
    const formWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'form_population',
      inputs: {
        submissionId: pipeline.submissionId,
        proposalId: pipeline.proposalId,
        browserSessionId: pipeline.results.authentication?.browser_session_id,
        formMapping: pipeline.results.preflight?.form_mapping,
        authenticationData: pipeline.results.authentication,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: ['form_data', 'populated_fields', 'validation_status'],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'filling', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(formWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, formWorkItem.id, 'uploading');
  }

  /**
   * Phase 4: Document Attachment
   * Upload required documents and attachments
   */
  private async executePhase4_DocumentAttachment(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `📎 Phase 4: Document attachment for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'uploading';
    pipeline.progress = 65;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'uploading',
      level: 'info',
      message: 'Starting document uploads',
      agentId: 'submission-orchestrator',
    });

    // Create work item for document uploads
    const uploadWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'document_upload',
      inputs: {
        submissionId: pipeline.submissionId,
        proposalId: pipeline.proposalId,
        browserSessionId: pipeline.results.authentication?.browser_session_id,
        documentChecklist: pipeline.results.preflight?.document_checklist,
        formData: pipeline.results.formFilling,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'uploaded_documents',
        'upload_confirmations',
        'attachment_status',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'uploading', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(uploadWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, uploadWorkItem.id, 'submitting');
  }

  /**
   * Phase 5: Submission Execution
   * Execute the submission and capture confirmation
   */
  private async executePhase5_SubmissionExecution(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `🚀 Phase 5: Submission execution for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'submitting';
    pipeline.progress = 80;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'submitting',
      level: 'info',
      message: 'Executing submission',
      agentId: 'submission-orchestrator',
    });

    // Create work item for submission execution
    const submitWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'submission_execution',
      inputs: {
        submissionId: pipeline.submissionId,
        browserSessionId: pipeline.results.authentication?.browser_session_id,
        formData: pipeline.results.formFilling,
        uploadedDocuments: pipeline.results.documentUploads,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'submission_confirmation',
        'reference_number',
        'submission_timestamp',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.submitTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'submitting', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(submitWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, submitWorkItem.id, 'verifying');
  }

  /**
   * Phase 6: Receipt Verification
   * Verify submission receipt and capture reference numbers
   */
  private async executePhase6_ReceiptVerification(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `📋 Phase 6: Receipt verification for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'verifying';
    pipeline.progress = 95;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Create event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'phase_started',
      phase: 'verifying',
      level: 'info',
      message: 'Verifying submission receipt',
      agentId: 'submission-orchestrator',
    });

    // Create work item for receipt verification
    const verifyWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'receipt_verification',
      inputs: {
        submissionId: pipeline.submissionId,
        browserSessionId: pipeline.results.authentication?.browser_session_id,
        submissionConfirmation: pipeline.results.submission,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'receipt_data',
        'verification_status',
        'final_confirmation',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.submissionId,
      createdByAgentId: 'submission-orchestrator',
      metadata: { phase: 'verifying', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(verifyWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, verifyWorkItem.id, 'completed');
  }

  /**
   * Complete the submission pipeline
   */
  private async completeSubmissionPipeline(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(`🎉 Completing submission pipeline ${pipeline.pipelineId}`);

    pipeline.currentPhase = 'completed';
    pipeline.status = 'completed';
    pipeline.progress = 100;
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Update submission with final status and receipt data
    await storage.updateSubmission(pipeline.submissionId, {
      status: 'submitted',
      submittedAt: new Date(),
      receiptData: pipeline.results.verification?.receipt_data,
      submissionData: {
        ...pipeline.metadata,
        pipelineId: pipeline.pipelineId,
        completedAt: new Date(),
        referenceNumber: pipeline.results.verification?.reference_number,
      },
    });

    // CRITICAL: Update proposal status to 'submitted' after receipt verification
    await storage.updateProposal(pipeline.proposalId, {
      status: 'submitted',
      submittedAt: new Date(),
      receiptData: pipeline.results.verification?.receipt_data,
    });

    // Create success notification
    await storage.createNotification({
      type: 'submission',
      title: 'Proposal Submitted Successfully',
      message: `Proposal has been successfully submitted to ${pipeline.metadata.portalName}. Reference: ${pipeline.results.verification?.reference_number || 'N/A'}`,
      relatedEntityType: 'submission',
      relatedEntityId: pipeline.submissionId,
    });

    // Store completion in agent memory
    await agentMemoryService.storeMemory({
      agentId: 'submission-orchestrator',
      memoryType: 'episodic',
      contextKey: `completed_pipeline_${pipeline.pipelineId}`,
      title: `Completed Submission Pipeline - ${pipeline.metadata.rfpTitle}`,
      content: {
        pipelineId: pipeline.pipelineId,
        submissionId: pipeline.submissionId,
        portalName: pipeline.metadata.portalName,
        referenceNumber: pipeline.results.verification?.reference_number,
        duration: pipeline.updatedAt.getTime() - pipeline.createdAt.getTime(),
        phases: Object.keys(pipeline.results).length,
      },
      importance: 10,
      tags: [
        'completed_pipeline',
        'submission_success',
        pipeline.metadata.portalName,
      ],
      metadata: { success: true, submissionType: 'automated' },
    });

    // Create completion event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'pipeline_completed',
      phase: 'completed',
      level: 'info',
      message: 'Submission pipeline completed successfully',
      details: {
        referenceNumber: pipeline.results.verification?.reference_number,
        duration: pipeline.updatedAt.getTime() - pipeline.createdAt.getTime(),
        phases: Object.keys(pipeline.results).length,
      },
      agentId: 'submission-orchestrator',
    });

    // Create audit log
    await storage.createAuditLog({
      entityType: 'submission',
      entityId: pipeline.submissionId,
      action: 'pipeline_completed',
      details: {
        pipelineId: pipeline.pipelineId,
        portalName: pipeline.metadata.portalName,
        referenceNumber: pipeline.results.verification?.reference_number,
        duration: pipeline.updatedAt.getTime() - pipeline.createdAt.getTime(),
      },
    });

    // Remove from active pipelines
    this.activePipelines.delete(pipeline.pipelineId);

    console.log(`✅ Pipeline ${pipeline.pipelineId} completed successfully`);
  }

  /**
   * Handle phase completion and transition to next phase
   */
  async handlePhaseCompletion(
    pipelineId: string,
    workItemIds: string[],
    nextPhase: string
  ): Promise<void> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      console.warn(`⚠️ Pipeline not found: ${pipelineId}`);
      return;
    }

    try {
      // Check if all work items for this phase are completed
      const workItems = await Promise.all(
        (Array.isArray(workItemIds) ? workItemIds : [workItemIds]).map(id =>
          storage.getWorkItem(id)
        )
      );

      const allCompleted = workItems.every(
        item => item?.status === 'completed'
      );
      const hasFailures = workItems.some(item => item?.status === 'failed');

      if (hasFailures) {
        await this.handlePipelineFailure(
          pipeline,
          'Work item failure in phase',
          workItems
        );
        return;
      }

      if (!allCompleted) {
        console.log(
          `⏳ Waiting for work items to complete in phase ${pipeline.currentPhase}`
        );
        return;
      }

      // Collect results from completed work items
      const phaseResults = workItems.reduce((acc, item) => {
        if (item?.result) {
          return { ...acc, ...item.result };
        }
        return acc;
      }, {});

      // Store phase results
      pipeline.results[pipeline.currentPhase] = phaseResults;

      // Create phase completion event
      await storage.createSubmissionEvent({
        pipelineId: pipeline.pipelineId,
        submissionId: pipeline.submissionId,
        eventType: 'phase_completed',
        phase: pipeline.currentPhase,
        level: 'info',
        message: `Phase ${pipeline.currentPhase} completed successfully`,
        details: phaseResults,
        agentId: 'submission-orchestrator',
      });

      // Transition to next phase
      switch (nextPhase) {
        case 'authenticating':
          await this.executePhase2_PortalAuthentication(pipeline);
          break;
        case 'filling':
          await this.executePhase3_FormPopulation(pipeline);
          break;
        case 'uploading':
          await this.executePhase4_DocumentAttachment(pipeline);
          break;
        case 'submitting':
          await this.executePhase5_SubmissionExecution(pipeline);
          break;
        case 'verifying':
          await this.executePhase6_ReceiptVerification(pipeline);
          break;
        case 'completed':
          await this.completeSubmissionPipeline(pipeline);
          break;
        default:
          console.warn(`⚠️ Unknown next phase: ${nextPhase}`);
      }
    } catch (error) {
      console.error(
        `❌ Failed to handle phase completion for pipeline ${pipelineId}:`,
        error
      );
      await this.handlePipelineFailure(
        pipeline,
        error instanceof Error ? error.message : 'Phase transition failed'
      );
    }
  }

  /**
   * Handle pipeline failure with retry logic
   */
  private async handlePipelineFailure(
    pipeline: SubmissionPipelineInstance,
    error: string,
    failedWorkItems?: any[]
  ): Promise<void> {
    console.error(`❌ Pipeline ${pipeline.pipelineId} failed: ${error}`);

    pipeline.retryCount++;

    // Check if we should retry
    if (pipeline.retryCount <= pipeline.maxRetries && this.shouldRetry(error)) {
      console.log(
        `🔄 Retrying pipeline ${pipeline.pipelineId} (attempt ${pipeline.retryCount}/${pipeline.maxRetries})`
      );

      // Create retry event
      await storage.createSubmissionEvent({
        pipelineId: pipeline.pipelineId,
        submissionId: pipeline.submissionId,
        eventType: 'retry',
        phase: pipeline.currentPhase,
        level: 'warn',
        message: `Retrying phase ${pipeline.currentPhase} due to: ${error}`,
        details: {
          retryCount: pipeline.retryCount,
          maxRetries: pipeline.maxRetries,
        },
        agentId: 'submission-orchestrator',
      });

      // Reset to current phase and retry
      setTimeout(() => {
        this.retryCurrentPhase(pipeline);
      }, 30000); // Wait 30 seconds before retry

      return;
    }

    // Permanent failure
    pipeline.status = 'failed';
    pipeline.errorData = {
      error,
      failedWorkItems,
      retryCount: pipeline.retryCount,
    };
    pipeline.updatedAt = new Date();

    // Update database
    await this.updatePipelineInDatabase(pipeline);

    // Update submission status
    await storage.updateSubmission(pipeline.submissionId, {
      status: 'failed',
      submissionData: {
        ...pipeline.metadata,
        pipelineId: pipeline.pipelineId,
        failedAt: new Date(),
        error,
        retryCount: pipeline.retryCount,
      },
    });

    // Create error notification
    await storage.createNotification({
      type: 'submission',
      title: 'Submission Failed',
      message: `Proposal submission failed for ${pipeline.metadata.portalName}: ${error}`,
      relatedEntityType: 'submission',
      relatedEntityId: pipeline.submissionId,
    });

    // Create failure event
    await storage.createSubmissionEvent({
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      eventType: 'error',
      phase: pipeline.currentPhase,
      level: 'error',
      message: `Pipeline failed permanently: ${error}`,
      details: {
        retryCount: pipeline.retryCount,
        maxRetries: pipeline.maxRetries,
      },
      agentId: 'submission-orchestrator',
    });

    // Store failure in agent memory
    await agentMemoryService.storeMemory({
      agentId: 'submission-orchestrator',
      memoryType: 'episodic',
      contextKey: `failed_pipeline_${pipeline.pipelineId}`,
      title: `Failed Submission Pipeline - ${pipeline.metadata.rfpTitle}`,
      content: {
        pipelineId: pipeline.pipelineId,
        submissionId: pipeline.submissionId,
        error,
        phase: pipeline.currentPhase,
        retryCount: pipeline.retryCount,
      },
      importance: 8,
      tags: [
        'failed_pipeline',
        'submission_error',
        pipeline.metadata.portalName,
      ],
      metadata: { success: false, error: true },
    });

    // Create audit log
    await storage.createAuditLog({
      entityType: 'submission',
      entityId: pipeline.submissionId,
      action: 'pipeline_failed',
      details: {
        pipelineId: pipeline.pipelineId,
        error,
        phase: pipeline.currentPhase,
        retryCount: pipeline.retryCount,
      },
    });

    // Remove from active pipelines
    this.activePipelines.delete(pipeline.pipelineId);

    console.log(`❌ Pipeline ${pipeline.pipelineId} failed permanently`);
  }

  /**
   * Retry current phase
   */
  private async retryCurrentPhase(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    console.log(
      `🔄 Retrying phase ${pipeline.currentPhase} for pipeline ${pipeline.pipelineId}`
    );

    // Reset phase progress
    const phaseProgressMap = {
      preflight: 10,
      authenticating: 25,
      filling: 45,
      uploading: 65,
      submitting: 80,
      verifying: 95,
    };

    pipeline.progress = phaseProgressMap[pipeline.currentPhase] || 0;
    pipeline.status = 'in_progress';
    pipeline.updatedAt = new Date();

    // Execute the current phase again
    switch (pipeline.currentPhase) {
      case 'preflight':
        await this.executePhase1_PreflightChecks(pipeline);
        break;
      case 'authenticating':
        await this.executePhase2_PortalAuthentication(pipeline);
        break;
      case 'filling':
        await this.executePhase3_FormPopulation(pipeline);
        break;
      case 'uploading':
        await this.executePhase4_DocumentAttachment(pipeline);
        break;
      case 'submitting':
        await this.executePhase5_SubmissionExecution(pipeline);
        break;
      case 'verifying':
        await this.executePhase6_ReceiptVerification(pipeline);
        break;
    }
  }

  /**
   * Determine if error is retryable
   */
  private shouldRetry(error: string): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'temporary',
      'rate limit',
      'server error',
      '5xx',
      'unavailable',
    ];

    const errorLower = error.toLowerCase();
    return retryableErrors.some(retryableError =>
      errorLower.includes(retryableError)
    );
  }

  /**
   * Update pipeline in database
   */
  private async updatePipelineInDatabase(
    pipeline: SubmissionPipelineInstance
  ): Promise<void> {
    try {
      const existingPipeline = await storage.getSubmissionPipelineBySubmission(
        pipeline.submissionId
      );
      if (existingPipeline) {
        await storage.updateSubmissionPipeline(existingPipeline.id, {
          currentPhase: pipeline.currentPhase,
          status: pipeline.status,
          progress: pipeline.progress,
          authenticationData: pipeline.authenticationData,
          formData: pipeline.formData,
          uploadedDocuments: pipeline.uploadedDocuments,
          submissionReceipt: pipeline.submissionReceipt,
          errorData: pipeline.errorData,
          retryCount: pipeline.retryCount,
          metadata: pipeline.metadata,
          updatedAt: pipeline.updatedAt,
          completedAt:
            pipeline.status === 'completed' ? pipeline.updatedAt : undefined,
        });
      }
    } catch (error) {
      console.warn(`⚠️ Failed to update pipeline in database:`, error);
    }
  }

  /**
   * Schedule phase completion monitoring
   */
  private schedulePhaseCompletion(
    pipeline: SubmissionPipelineInstance,
    workItemIds: string | string[],
    nextPhase: string
  ): void {
    const itemIds = Array.isArray(workItemIds) ? workItemIds : [workItemIds];

    // Start monitoring work items
    const checkInterval = setInterval(async () => {
      try {
        const workItems = await Promise.all(
          itemIds.map(id => storage.getWorkItem(id))
        );

        const allCompleted = workItems.every(
          item => item?.status === 'completed' || item?.status === 'failed'
        );

        if (allCompleted) {
          clearInterval(checkInterval);
          await this.handlePhaseCompletion(
            pipeline.pipelineId,
            itemIds,
            nextPhase
          );
        }
      } catch (error) {
        console.error('Error monitoring phase completion:', error);
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds

    // Set timeout for phase
    setTimeout(() => {
      clearInterval(checkInterval);
      this.handlePipelineFailure(
        pipeline,
        `Phase ${pipeline.currentPhase} timed out`
      );
    }, this.phaseTimeout);
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(
    pipeline: SubmissionPipelineInstance
  ): Date {
    const phaseEstimates = {
      preflight: 5 * 60 * 1000, // 5 minutes
      authenticating: 3 * 60 * 1000, // 3 minutes
      filling: 10 * 60 * 1000, // 10 minutes
      uploading: 8 * 60 * 1000, // 8 minutes
      submitting: 5 * 60 * 1000, // 5 minutes
      verifying: 3 * 60 * 1000, // 3 minutes
    };

    const phases = [
      'preflight',
      'authenticating',
      'filling',
      'uploading',
      'submitting',
      'verifying',
    ];
    const currentIndex = phases.indexOf(pipeline.currentPhase);

    let remainingTime = 0;
    for (let i = currentIndex; i < phases.length; i++) {
      remainingTime += phaseEstimates[phases[i]];
    }

    return new Date(Date.now() + remainingTime);
  }

  /**
   * Get next steps for pipeline
   */
  private getNextSteps(pipeline: SubmissionPipelineInstance): string[] {
    const phaseSteps = {
      queued: [
        'Validate submission requirements',
        'Check portal status',
        'Prepare documents',
      ],
      preflight: [
        'Perform portal compatibility checks',
        'Validate document formats',
        'Map form requirements',
      ],
      authenticating: [
        'Login to portal',
        'Handle MFA if required',
        'Establish session',
      ],
      filling: [
        'Navigate to submission forms',
        'Populate required fields',
        'Validate form data',
      ],
      uploading: [
        'Upload proposal documents',
        'Attach required files',
        'Verify uploads',
      ],
      submitting: [
        'Review submission',
        'Execute final submission',
        'Capture confirmation',
      ],
      verifying: [
        'Verify submission receipt',
        'Extract reference numbers',
        'Confirm status',
      ],
      completed: ['Submission completed successfully'],
      failed: [
        'Review error logs',
        'Determine retry strategy',
        'Manual intervention may be required',
      ],
    };

    return phaseSteps[pipeline.currentPhase] || ['Processing...'];
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(
    pipelineId: string
  ): Promise<SubmissionPipelineResult | null> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      // Try to get from database
      const dbPipeline = await storage.getSubmissionPipeline(pipelineId);
      if (!dbPipeline) {
        return null;
      }

      return {
        success: dbPipeline.status === 'completed',
        pipelineId: dbPipeline.id,
        submissionId: dbPipeline.submissionId,
        currentPhase: dbPipeline.currentPhase,
        progress: dbPipeline.progress,
        status: dbPipeline.status,
        receiptData: dbPipeline.submissionReceipt,
        error: dbPipeline.errorData?.error,
      };
    }

    return {
      success: pipeline.status === 'completed',
      pipelineId: pipeline.pipelineId,
      submissionId: pipeline.submissionId,
      currentPhase: pipeline.currentPhase,
      progress: pipeline.progress,
      status: pipeline.status,
      estimatedCompletion: this.calculateEstimatedCompletion(pipeline),
      receiptData: pipeline.results.verification?.receipt_data,
      nextSteps: this.getNextSteps(pipeline),
      error: pipeline.errorData?.error,
    };
  }

  /**
   * Cancel pipeline
   */
  async cancelPipeline(pipelineId: string): Promise<boolean> {
    const pipeline = this.activePipelines.get(pipelineId);
    if (!pipeline) {
      return false;
    }

    try {
      pipeline.status = 'failed';
      pipeline.errorData = { error: 'Pipeline cancelled by user' };
      pipeline.updatedAt = new Date();

      // Update database
      await this.updatePipelineInDatabase(pipeline);

      // Create cancellation event
      await storage.createSubmissionEvent({
        pipelineId: pipeline.pipelineId,
        submissionId: pipeline.submissionId,
        eventType: 'pipeline_cancelled',
        phase: pipeline.currentPhase,
        level: 'warn',
        message: 'Pipeline cancelled by user',
        agentId: 'submission-orchestrator',
      });

      // Remove from active pipelines
      this.activePipelines.delete(pipelineId);

      console.log(`🚫 Pipeline ${pipelineId} cancelled`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to cancel pipeline ${pipelineId}:`, error);
      return false;
    }
  }

  /**
   * Get active pipelines
   */
  getActivePipelines(): SubmissionPipelineInstance[] {
    return Array.from(this.activePipelines.values());
  }
}

// Export singleton instance
export const submissionOrchestrator = new SubmissionOrchestrator();
