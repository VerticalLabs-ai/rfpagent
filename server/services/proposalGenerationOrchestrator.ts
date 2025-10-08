import { storage } from '../storage';
import { workflowCoordinator } from './workflowCoordinator';
import { agentRegistryService } from './agentRegistryService';
import { aiProposalService } from './ai-proposal-service';
import { enhancedProposalService } from './enhancedProposalService';
import { agentMemoryService } from './agentMemoryService';
import type { RFP, Proposal, WorkItem, AgentSession } from '@shared/schema';
import { nanoid } from 'nanoid';

export interface ProposalGenerationPipeline {
  pipelineId: string;
  rfpId: string;
  sessionId: string;
  companyProfileId?: string;
  proposalType:
    | 'standard'
    | 'technical'
    | 'construction'
    | 'professional_services';
  currentPhase:
    | 'outline'
    | 'content_generation'
    | 'pricing_analysis'
    | 'compliance_validation'
    | 'form_completion'
    | 'final_assembly'
    | 'quality_assurance'
    | 'completed';
  status: 'pending' | 'in_progress' | 'suspended' | 'completed' | 'failed';
  progress: number;
  workItems: string[]; // IDs of created work items
  results: {
    outline?: any;
    content?: any;
    pricing?: any;
    compliance?: any;
    forms?: any;
    proposalId?: string;
  };
  qualityScore?: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProposalGenerationRequest {
  rfpId: string;
  sessionId: string;
  companyProfileId?: string;
  proposalType?:
    | 'standard'
    | 'technical'
    | 'construction'
    | 'professional_services';
  priority?: number;
  deadline?: Date;
  autoSubmit?: boolean;
  qualityThreshold?: number;
  metadata?: any;
}

export interface ProposalGenerationResult {
  success: boolean;
  pipelineId?: string;
  proposalId?: string;
  currentPhase?: string;
  progress?: number;
  error?: string;
  estimatedCompletion?: Date;
  qualityScore?: number;
  nextSteps?: string[];
}

/**
 * Proposal Generation Orchestrator
 *
 * Orchestrates the complete proposal generation pipeline through a 3-tier agent system:
 * - Orchestrator: Manages the overall pipeline and coordinates phases
 * - Manager: Coordinates specialists for each phase (proposal-manager)
 * - Specialists: Execute specific tasks (content-generator, pricing-analyst, compliance-checker)
 *
 * Pipeline Phases:
 * 1. Outline Creation - Analyze RFP and create proposal structure
 * 2. Content Generation - Generate narrative sections, technical content
 * 3. Pricing Analysis - Analyze requirements and generate pricing
 * 4. Compliance Validation - Validate against requirements and regulations
 * 5. Form Completion - Fill out forms and documents
 * 6. Final Assembly - Combine all components into complete proposal
 * 7. Quality Assurance - Validate and score the complete proposal
 */
export class ProposalGenerationOrchestrator {
  private activePipelines: Map<string, ProposalGenerationPipeline> = new Map();
  private phaseTimeout = 30 * 60 * 1000; // 30 minutes per phase

  /**
   * Initiate a comprehensive proposal generation pipeline
   */
  async initiateProposalGeneration(
    request: ProposalGenerationRequest
  ): Promise<ProposalGenerationResult> {
    console.log(
      `🚀 Initiating proposal generation pipeline for RFP: ${request.rfpId}`
    );

    try {
      // Validate RFP exists
      const rfp = await storage.getRFP(request.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${request.rfpId}`);
      }

      // Create pipeline instance
      const pipelineId = nanoid();
      const pipeline: ProposalGenerationPipeline = {
        pipelineId,
        rfpId: request.rfpId,
        sessionId: request.sessionId,
        companyProfileId: request.companyProfileId,
        proposalType: request.proposalType || 'standard',
        currentPhase: 'outline',
        status: 'pending',
        progress: 0,
        workItems: [],
        results: {},
        metadata: {
          priority: request.priority || 5,
          deadline: request.deadline,
          autoSubmit: request.autoSubmit || false,
          qualityThreshold: request.qualityThreshold || 0.8,
          ...request.metadata,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.activePipelines.set(pipelineId, pipeline);

      // Store pipeline in agent memory for tracking
      await agentMemoryService.storeMemory({
        agentId: 'proposal-orchestrator',
        memoryType: 'working',
        contextKey: `pipeline_${pipelineId}`,
        title: `Proposal Generation Pipeline - ${rfp.title}`,
        content: pipeline,
        importance: 8,
        tags: ['proposal_generation', 'active_pipeline', pipeline.proposalType],
        metadata: { rfpId: request.rfpId, sessionId: request.sessionId },
      });

      // Update RFP status
      await storage.updateRFP(request.rfpId, {
        status: 'drafting',
        progress: 5,
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'proposal',
        entityId: pipelineId,
        action: 'pipeline_initiated',
        details: {
          rfpId: request.rfpId,
          proposalType: pipeline.proposalType,
          sessionId: request.sessionId,
        },
      });

      // Start the pipeline with Phase 1: Outline Creation
      await this.executePhase1_OutlineCreation(pipeline);

      return {
        success: true,
        pipelineId,
        currentPhase: pipeline.currentPhase,
        progress: pipeline.progress,
        estimatedCompletion: this.calculateEstimatedCompletion(pipeline),
        nextSteps: this.getNextSteps(pipeline),
      };
    } catch (error) {
      console.error('❌ Failed to initiate proposal generation:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Pipeline initiation failed',
      };
    }
  }

  /**
   * Phase 1: Outline Creation
   * Analyze RFP requirements and create proposal structure
   */
  private async executePhase1_OutlineCreation(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `📋 Phase 1: Creating proposal outline for pipeline ${pipeline.pipelineId}`
    );

    pipeline.status = 'in_progress';
    pipeline.currentPhase = 'outline';
    pipeline.progress = 10;
    pipeline.updatedAt = new Date();

    // Create work item for outline creation
    const outlineWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_outline_creation',
      inputs: {
        rfpId: pipeline.rfpId,
        proposalType: pipeline.proposalType,
        companyProfileId: pipeline.companyProfileId,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'proposal_outline',
        'section_breakdown',
        'requirements_mapping',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: { phase: 'outline', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(outlineWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(
      pipeline,
      outlineWorkItem.id,
      'content_generation'
    );
  }

  /**
   * Phase 2: Content Generation
   * Generate narrative sections and technical content
   */
  private async executePhase2_ContentGeneration(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `✍️ Phase 2: Content generation for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'content_generation';
    pipeline.progress = 25;
    pipeline.updatedAt = new Date();

    // Create parallel work items for different content types
    const contentWorkItems = await Promise.all([
      // Executive summary and company overview
      workflowCoordinator.createWorkItem({
        sessionId: pipeline.sessionId,
        taskType: 'executive_summary_generation',
        inputs: {
          rfpId: pipeline.rfpId,
          companyProfileId: pipeline.companyProfileId,
          outline: pipeline.results.outline,
          pipelineId: pipeline.pipelineId,
        },
        expectedOutputs: ['executive_summary', 'company_overview'],
        priority: pipeline.metadata.priority,
        deadline: new Date(Date.now() + this.phaseTimeout),
        contextRef: pipeline.rfpId,
        createdByAgentId: 'proposal-orchestrator',
        metadata: {
          phase: 'content_generation',
          contentType: 'executive',
          pipelineId: pipeline.pipelineId,
        },
      }),

      // Technical approach and methodology
      workflowCoordinator.createWorkItem({
        sessionId: pipeline.sessionId,
        taskType: 'technical_content_generation',
        inputs: {
          rfpId: pipeline.rfpId,
          companyProfileId: pipeline.companyProfileId,
          outline: pipeline.results.outline,
          proposalType: pipeline.proposalType,
          pipelineId: pipeline.pipelineId,
        },
        expectedOutputs: ['technical_approach', 'methodology', 'timeline'],
        priority: pipeline.metadata.priority,
        deadline: new Date(Date.now() + this.phaseTimeout),
        contextRef: pipeline.rfpId,
        createdByAgentId: 'proposal-orchestrator',
        metadata: {
          phase: 'content_generation',
          contentType: 'technical',
          pipelineId: pipeline.pipelineId,
        },
      }),

      // Qualifications and experience
      workflowCoordinator.createWorkItem({
        sessionId: pipeline.sessionId,
        taskType: 'qualifications_generation',
        inputs: {
          rfpId: pipeline.rfpId,
          companyProfileId: pipeline.companyProfileId,
          outline: pipeline.results.outline,
          pipelineId: pipeline.pipelineId,
        },
        expectedOutputs: [
          'qualifications',
          'experience_narratives',
          'case_studies',
        ],
        priority: pipeline.metadata.priority,
        deadline: new Date(Date.now() + this.phaseTimeout),
        contextRef: pipeline.rfpId,
        createdByAgentId: 'proposal-orchestrator',
        metadata: {
          phase: 'content_generation',
          contentType: 'qualifications',
          pipelineId: pipeline.pipelineId,
        },
      }),
    ]);

    pipeline.workItems.push(...contentWorkItems.map(item => item.id));

    // Schedule phase monitoring for all content work items
    this.schedulePhaseCompletion(
      pipeline,
      contentWorkItems.map(item => item.id),
      'pricing_analysis'
    );
  }

  /**
   * Phase 3: Pricing Analysis
   * Analyze requirements and generate competitive pricing
   */
  private async executePhase3_PricingAnalysis(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `💰 Phase 3: Pricing analysis for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'pricing_analysis';
    pipeline.progress = 50;
    pipeline.updatedAt = new Date();

    // Create work item for pricing analysis
    const pricingWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_pricing_analysis',
      inputs: {
        rfpId: pipeline.rfpId,
        companyProfileId: pipeline.companyProfileId,
        outline: pipeline.results.outline,
        content: pipeline.results.content,
        proposalType: pipeline.proposalType,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'pricing_breakdown',
        'cost_analysis',
        'competitive_strategy',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: { phase: 'pricing_analysis', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(pricingWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(
      pipeline,
      pricingWorkItem.id,
      'compliance_validation'
    );
  }

  /**
   * Phase 4: Compliance Validation
   * Validate against requirements and regulations
   */
  private async executePhase4_ComplianceValidation(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `✅ Phase 4: Compliance validation for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'compliance_validation';
    pipeline.progress = 65;
    pipeline.updatedAt = new Date();

    // Create work item for compliance validation
    const complianceWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_compliance_validation',
      inputs: {
        rfpId: pipeline.rfpId,
        companyProfileId: pipeline.companyProfileId,
        outline: pipeline.results.outline,
        content: pipeline.results.content,
        pricing: pipeline.results.pricing,
        proposalType: pipeline.proposalType,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'compliance_matrix',
        'validation_report',
        'risk_assessment',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: {
        phase: 'compliance_validation',
        pipelineId: pipeline.pipelineId,
      },
    });

    pipeline.workItems.push(complianceWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(
      pipeline,
      complianceWorkItem.id,
      'form_completion'
    );
  }

  /**
   * Phase 5: Form Completion
   * Fill out required forms and documents
   */
  private async executePhase5_FormCompletion(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `📄 Phase 5: Form completion for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'form_completion';
    pipeline.progress = 75;
    pipeline.updatedAt = new Date();

    // Create work item for form completion
    const formsWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_form_completion',
      inputs: {
        rfpId: pipeline.rfpId,
        companyProfileId: pipeline.companyProfileId,
        outline: pipeline.results.outline,
        content: pipeline.results.content,
        pricing: pipeline.results.pricing,
        compliance: pipeline.results.compliance,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'completed_forms',
        'attachments_list',
        'submission_package',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: { phase: 'form_completion', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(formsWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, formsWorkItem.id, 'final_assembly');
  }

  /**
   * Phase 6: Final Assembly
   * Combine all components into complete proposal
   */
  private async executePhase6_FinalAssembly(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `🔧 Phase 6: Final assembly for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'final_assembly';
    pipeline.progress = 85;
    pipeline.updatedAt = new Date();

    // Create work item for final assembly
    const assemblyWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_final_assembly',
      inputs: {
        rfpId: pipeline.rfpId,
        companyProfileId: pipeline.companyProfileId,
        outline: pipeline.results.outline,
        content: pipeline.results.content,
        pricing: pipeline.results.pricing,
        compliance: pipeline.results.compliance,
        forms: pipeline.results.forms,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'complete_proposal',
        'proposal_metadata',
        'submission_ready',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: { phase: 'final_assembly', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(assemblyWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(
      pipeline,
      assemblyWorkItem.id,
      'quality_assurance'
    );
  }

  /**
   * Phase 7: Quality Assurance
   * Validate and score the complete proposal
   */
  private async executePhase7_QualityAssurance(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `🔍 Phase 7: Quality assurance for pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'quality_assurance';
    pipeline.progress = 95;
    pipeline.updatedAt = new Date();

    // Create work item for quality assurance
    const qaWorkItem = await workflowCoordinator.createWorkItem({
      sessionId: pipeline.sessionId,
      taskType: 'proposal_quality_assurance',
      inputs: {
        rfpId: pipeline.rfpId,
        proposalId: pipeline.results.proposalId,
        qualityThreshold: pipeline.metadata.qualityThreshold,
        pipelineId: pipeline.pipelineId,
      },
      expectedOutputs: [
        'quality_score',
        'validation_report',
        'improvement_recommendations',
      ],
      priority: pipeline.metadata.priority,
      deadline: new Date(Date.now() + this.phaseTimeout),
      contextRef: pipeline.rfpId,
      createdByAgentId: 'proposal-orchestrator',
      metadata: { phase: 'quality_assurance', pipelineId: pipeline.pipelineId },
    });

    pipeline.workItems.push(qaWorkItem.id);

    // Schedule phase monitoring
    this.schedulePhaseCompletion(pipeline, qaWorkItem.id, 'completed');
  }

  /**
   * Complete the proposal generation pipeline
   */
  private async completePipeline(
    pipeline: ProposalGenerationPipeline
  ): Promise<void> {
    console.log(
      `🎉 Completing proposal generation pipeline ${pipeline.pipelineId}`
    );

    pipeline.currentPhase = 'completed';
    pipeline.status = 'completed';
    pipeline.progress = 100;
    pipeline.updatedAt = new Date();

    // Update RFP status
    await storage.updateRFP(pipeline.rfpId, {
      status:
        pipeline.qualityScore &&
        pipeline.qualityScore >= pipeline.metadata.qualityThreshold
          ? 'review'
          : 'drafting',
      progress:
        pipeline.qualityScore &&
        pipeline.qualityScore >= pipeline.metadata.qualityThreshold
          ? 75
          : 60, // Proposal complete but not submitted
    });

    // Create completion notification
    await storage.createNotification({
      type: 'approval',
      title: 'Proposal Generation Complete',
      message: `Proposal generation pipeline completed for RFP. Quality score: ${pipeline.qualityScore?.toFixed(2) || 'N/A'}`,
      relatedEntityType: 'proposal',
      relatedEntityId: pipeline.results.proposalId || pipeline.pipelineId,
    });

    // Store completion in agent memory
    await agentMemoryService.storeMemory({
      agentId: 'proposal-orchestrator',
      memoryType: 'episodic',
      contextKey: `completed_pipeline_${pipeline.pipelineId}`,
      title: `Completed Proposal Pipeline - ${pipeline.rfpId}`,
      content: {
        pipelineId: pipeline.pipelineId,
        rfpId: pipeline.rfpId,
        proposalId: pipeline.results.proposalId,
        qualityScore: pipeline.qualityScore,
        duration: pipeline.updatedAt.getTime() - pipeline.createdAt.getTime(),
        phases: Object.keys(pipeline.results).length,
      },
      importance: 9,
      tags: [
        'completed_pipeline',
        'proposal_generation',
        pipeline.proposalType,
      ],
      metadata: { success: true, proposalType: pipeline.proposalType },
    });

    // Create audit log
    await storage.createAuditLog({
      entityType: 'proposal',
      entityId: pipeline.results.proposalId || pipeline.pipelineId,
      action: 'pipeline_completed',
      details: {
        pipelineId: pipeline.pipelineId,
        rfpId: pipeline.rfpId,
        qualityScore: pipeline.qualityScore,
        phases: Object.keys(pipeline.results).length,
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
        workItemIds.map(id => storage.getWorkItem(id))
      );

      const allCompleted = workItems.every(
        item => item?.status === 'completed'
      );
      const hasFailures = workItems.some(item => item?.status === 'failed');

      if (hasFailures) {
        await this.handlePipelineFailure(
          pipeline,
          'Work item failure in phase'
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
      (pipeline.results as any)[pipeline.currentPhase] = phaseResults;

      // Transition to next phase
      switch (nextPhase) {
        case 'content_generation':
          await this.executePhase2_ContentGeneration(pipeline);
          break;
        case 'pricing_analysis':
          await this.executePhase3_PricingAnalysis(pipeline);
          break;
        case 'compliance_validation':
          await this.executePhase4_ComplianceValidation(pipeline);
          break;
        case 'form_completion':
          await this.executePhase5_FormCompletion(pipeline);
          break;
        case 'final_assembly':
          await this.executePhase6_FinalAssembly(pipeline);
          break;
        case 'quality_assurance':
          await this.executePhase7_QualityAssurance(pipeline);
          break;
        case 'completed':
          await this.completePipeline(pipeline);
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
   * Handle pipeline failure
   */
  private async handlePipelineFailure(
    pipeline: ProposalGenerationPipeline,
    error: string
  ): Promise<void> {
    console.error(`❌ Pipeline ${pipeline.pipelineId} failed: ${error}`);

    pipeline.status = 'failed';
    pipeline.updatedAt = new Date();

    // Update RFP status
    await storage.updateRFP(pipeline.rfpId, {
      status: 'discovered', // Reset to discovered for retry
      progress: 0,
    });

    // Create error notification
    await storage.createNotification({
      type: 'compliance',
      title: 'Proposal Generation Failed',
      message: `Proposal generation pipeline failed: ${error}`,
      relatedEntityType: 'rfp',
      relatedEntityId: pipeline.rfpId,
    });

    // Store failure in agent memory
    await agentMemoryService.storeMemory({
      agentId: 'proposal-orchestrator',
      memoryType: 'episodic',
      contextKey: `failed_pipeline_${pipeline.pipelineId}`,
      title: `Failed Proposal Pipeline - ${pipeline.rfpId}`,
      content: {
        pipelineId: pipeline.pipelineId,
        rfpId: pipeline.rfpId,
        error,
        phase: pipeline.currentPhase,
        progress: pipeline.progress,
      },
      importance: 8,
      tags: ['failed_pipeline', 'proposal_generation', 'error'],
      metadata: { success: false, error },
    });

    // Remove from active pipelines
    this.activePipelines.delete(pipeline.pipelineId);
  }

  /**
   * Schedule phase completion monitoring
   */
  private schedulePhaseCompletion(
    pipeline: ProposalGenerationPipeline,
    workItemIds: string | string[],
    nextPhase: string
  ): void {
    const itemIds = Array.isArray(workItemIds) ? workItemIds : [workItemIds];

    // Check periodically for work item completion
    const checkInterval = setInterval(async () => {
      try {
        await this.handlePhaseCompletion(
          pipeline.pipelineId,
          itemIds,
          nextPhase
        );

        // Clear interval if pipeline is no longer active
        if (!this.activePipelines.has(pipeline.pipelineId)) {
          clearInterval(checkInterval);
        }
      } catch (error) {
        console.error('❌ Error in phase completion check:', error);
        clearInterval(checkInterval);
      }
    }, 10000); // Check every 10 seconds

    // Set timeout for phase
    setTimeout(() => {
      clearInterval(checkInterval);
      if (this.activePipelines.has(pipeline.pipelineId)) {
        this.handlePipelineFailure(
          pipeline,
          `Phase ${pipeline.currentPhase} timeout`
        );
      }
    }, this.phaseTimeout);
  }

  /**
   * Get pipeline status
   */
  async getPipelineStatus(
    pipelineId: string
  ): Promise<ProposalGenerationPipeline | undefined> {
    return this.activePipelines.get(pipelineId);
  }

  /**
   * List active pipelines
   */
  async getActivePipelines(): Promise<ProposalGenerationPipeline[]> {
    return Array.from(this.activePipelines.values());
  }

  /**
   * Get active workflows - API compatible method name
   */
  async getActiveWorkflows(filters?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ProposalGenerationPipeline[]> {
    let pipelines = Array.from(this.activePipelines.values());

    // Apply status filter
    if (filters?.status) {
      pipelines = pipelines.filter(p => p.status === filters.status);
    }

    // Apply pagination
    if (filters?.offset) {
      pipelines = pipelines.slice(filters.offset);
    }

    if (filters?.limit) {
      pipelines = pipelines.slice(0, filters.limit);
    }

    return pipelines;
  }

  /**
   * Cancel a pipeline
   */
  async cancelPipeline(
    pipelineId: string
  ): Promise<{ success: boolean; error?: string }> {
    console.log(`🚫 Cancelling proposal generation pipeline: ${pipelineId}`);

    try {
      const pipeline = this.activePipelines.get(pipelineId);

      if (!pipeline) {
        return {
          success: false,
          error: 'Pipeline not found',
        };
      }

      // Update pipeline status to cancelled
      pipeline.status = 'failed'; // Using 'failed' as cancelled status
      pipeline.updatedAt = new Date();

      // Cancel any active work items
      for (const workItemId of pipeline.workItems) {
        try {
          // TODO: Implement cancelWorkItem method in WorkflowCoordinator
          // await workflowCoordinator.cancelWorkItem(workItemId);
          console.log(`Would cancel work item ${workItemId}`);
        } catch (error) {
          console.warn(`⚠️ Failed to cancel work item ${workItemId}:`, error);
        }
      }

      // Update RFP status back to discovered
      await storage.updateRFP(pipeline.rfpId, {
        status: 'discovered',
        progress: 0,
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'proposal',
        entityId: pipelineId,
        action: 'pipeline_cancelled',
        details: {
          rfpId: pipeline.rfpId,
          phase: pipeline.currentPhase,
          progress: pipeline.progress,
        },
      });

      // Create notification
      await storage.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Cancelled',
        message: `Proposal generation pipeline for RFP ${pipeline.rfpId} was cancelled`,
        relatedEntityType: 'rfp',
        relatedEntityId: pipeline.rfpId,
      });

      // Remove from active pipelines
      this.activePipelines.delete(pipelineId);

      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error cancelling pipeline:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create proposal generation pipeline - API compatible wrapper method
   */
  async createProposalGenerationPipeline(request: {
    rfpId: string;
    companyProfileId?: string;
    proposalType?:
      | 'standard'
      | 'technical'
      | 'construction'
      | 'professional_services';
    qualityThreshold?: number;
    autoSubmit?: boolean;
    generatePricing?: boolean;
    generateCompliance?: boolean;
  }): Promise<{
    success: boolean;
    pipelineId?: string;
    currentPhase?: string;
    totalPhases?: number;
    workItemsCreated?: number;
    estimatedDuration?: string;
    error?: string;
  }> {
    console.log(
      `🎬 Creating proposal generation pipeline for RFP: ${request.rfpId}`
    );

    try {
      // Generate sessionId for the request
      const sessionId = nanoid();

      // Convert to ProposalGenerationRequest format
      const proposalRequest: ProposalGenerationRequest = {
        rfpId: request.rfpId,
        sessionId,
        companyProfileId: request.companyProfileId,
        proposalType: request.proposalType || 'standard',
        qualityThreshold: request.qualityThreshold || 0.8,
        autoSubmit: request.autoSubmit || false,
        metadata: {
          generatePricing: request.generatePricing !== false,
          generateCompliance: request.generateCompliance !== false,
        },
      };

      // Call the actual implementation
      const result = await this.initiateProposalGeneration(proposalRequest);

      if (!result.success) {
        return {
          success: false,
          error: result.error,
        };
      }

      // Transform to expected API response format
      const totalPhases = 7; // outline, content_generation, pricing_analysis, compliance_validation, form_completion, final_assembly, quality_assurance
      const estimatedDurationMinutes = totalPhases * 30; // 30 minutes per phase

      return {
        success: true,
        pipelineId: result.pipelineId,
        currentPhase: result.currentPhase,
        totalPhases,
        workItemsCreated: 1, // Initial work items created
        estimatedDuration: `${estimatedDurationMinutes} minutes`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Error creating pipeline:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Calculate estimated completion time
   */
  private calculateEstimatedCompletion(
    pipeline: ProposalGenerationPipeline
  ): Date {
    const phaseDuration = this.phaseTimeout;
    const remainingPhases = 7 - this.getPhaseNumber(pipeline.currentPhase);
    return new Date(Date.now() + remainingPhases * phaseDuration);
  }

  /**
   * Get phase number for progress calculation
   */
  private getPhaseNumber(phase: string): number {
    const phases = [
      'outline',
      'content_generation',
      'pricing_analysis',
      'compliance_validation',
      'form_completion',
      'final_assembly',
      'quality_assurance',
    ];
    return phases.indexOf(phase) + 1;
  }

  /**
   * Get next steps for pipeline
   */
  private getNextSteps(pipeline: ProposalGenerationPipeline): string[] {
    switch (pipeline.currentPhase) {
      case 'outline':
        return [
          'Analyzing RFP requirements',
          'Creating proposal structure',
          'Mapping requirements to sections',
        ];
      case 'content_generation':
        return [
          'Generating executive summary',
          'Writing technical approach',
          'Creating qualifications narrative',
        ];
      case 'pricing_analysis':
        return [
          'Analyzing cost requirements',
          'Researching market rates',
          'Creating pricing strategy',
        ];
      case 'compliance_validation':
        return [
          'Validating requirements compliance',
          'Checking certifications',
          'Performing risk assessment',
        ];
      case 'form_completion':
        return [
          'Filling required forms',
          'Preparing attachments',
          'Creating submission package',
        ];
      case 'final_assembly':
        return [
          'Combining all components',
          'Creating final proposal',
          'Preparing for submission',
        ];
      case 'quality_assurance':
        return [
          'Validating proposal quality',
          'Checking completeness',
          'Generating quality score',
        ];
      default:
        return ['Processing...'];
    }
  }
}

export const proposalGenerationOrchestrator =
  new ProposalGenerationOrchestrator();
