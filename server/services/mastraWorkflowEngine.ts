import { Agent } from "@mastra/core/agent";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { createTool } from "@mastra/core/tools";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { storage } from "../storage";
import { AIService } from "./aiService";
import { aiProposalService } from "./ai-proposal-service";
import { documentIntelligenceService } from "./documentIntelligenceService";
import { MastraScrapingService } from "./mastraScrapingService";
import { agentMemoryService } from './agentMemoryService';
import { retryBackoffDlqService } from './retryBackoffDlqService';
import type { RFP, Portal, CompanyProfile } from "@shared/schema";
import { nanoid } from 'nanoid';

// Enhanced schemas for workflow orchestration
const RFPSearchCriteriaSchema = z.object({
  keywords: z.string(),
  location: z.string().optional(),
  agency: z.string().optional(),
  valueRange: z.object({
    min: z.number().optional(),
    max: z.number().optional()
  }).optional(),
  deadline: z.string().optional(),
  category: z.string().optional()
});

const WorkflowStateSchema = z.object({
  id: z.string(),
  status: z.enum(['pending', 'running', 'suspended', 'completed', 'failed']),
  currentStep: z.string().optional(),
  progress: z.number().min(0).max(1),
  results: z.record(z.any()).optional(),
  context: z.record(z.any()).optional()
});

const ActionSuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: z.enum(['workflow', 'agent', 'tool', 'navigation']),
  priority: z.enum(['high', 'medium', 'low']),
  estimatedTime: z.string(),
  description: z.string(),
  icon: z.string(),
  payload: z.record(z.any()).optional()
});

export interface WorkflowState {
  id: string;
  status: 'pending' | 'running' | 'suspended' | 'completed' | 'failed';
  currentStep?: string;
  progress: number;
  results?: Record<string, any>;
  context?: Record<string, any>;
}

export interface ActionSuggestion {
  id: string;
  label: string;
  action: 'workflow' | 'agent' | 'tool' | 'navigation';
  priority: 'high' | 'medium' | 'low';
  estimatedTime: string;
  description: string;
  icon: string;
  payload?: Record<string, any>;
}

// Enhanced interfaces for Phase State Machine
export interface PhaseTransition {
  from: string;
  to: string;
  conditions?: Record<string, any>;
  actions?: string[];
  validationRules?: Record<string, any>;
}

export interface PhaseDefinition {
  name: string;
  displayName: string;
  description: string;
  allowedTransitions: string[];
  entryActions?: string[];
  exitActions?: string[];
  timeoutMinutes?: number;
  requiredCapabilities?: string[];
  dependencies?: string[];
}

export interface WorkflowPhaseState {
  workflowId: string;
  currentPhase: string;
  status: 'pending' | 'in_progress' | 'suspended' | 'completed' | 'failed' | 'cancelled';
  phaseHistory: PhaseTransitionRecord[];
  canTransitionTo: string[];
  blockedReasons?: string[];
  metadata: Record<string, any>;
}

export interface PhaseTransitionRecord {
  fromPhase: string | null;
  toPhase: string;
  fromStatus: string | null;
  toStatus: string;
  transitionType: 'automatic' | 'manual' | 'retry' | 'rollback' | 'escalation';
  triggeredBy: string;
  reason?: string;
  duration?: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Enhanced Mastra Workflow Engine for RFP Processing with Phase State Machine
 * Orchestrates specialized agents and workflows for end-to-end RFP management
 */
export class MastraWorkflowEngine {
  private aiService = new AIService();
  private mastraScrapingService = new MastraScrapingService();
  private agents: Map<string, Agent> = new Map();
  private activeWorkflows: Map<string, WorkflowPhaseState> = new Map();
  private agentCoordinator: Map<string, any> = new Map();
  
  // Phase State Machine Configuration
  private phaseDefinitions: Map<string, PhaseDefinition> = new Map();
  private validTransitions: Map<string, PhaseTransition[]> = new Map();
  
  constructor() {
    this.initializePhaseStateMachine();
    this.initializeSpecializedAgents();
    this.initializeWorkflows();
    this.initializeAgentCoordination();
  }

  /**
   * Initialize the Phase State Machine with RFP workflow phases
   */
  private initializePhaseStateMachine(): void {
    console.log('🎯 Initializing Phase State Machine for RFP automation...');

    // Define RFP processing phases
    const phases: PhaseDefinition[] = [
      {
        name: 'discovery',
        displayName: 'RFP Discovery',
        description: 'Scan portals and discover new RFP opportunities',
        allowedTransitions: ['analysis', 'cancelled'],
        entryActions: ['initialize_discovery', 'allocate_discovery_agents'],
        exitActions: ['validate_rfp_data', 'calculate_discovery_metrics'],
        timeoutMinutes: 60,
        requiredCapabilities: ['portal_scraping', 'rfp_parsing'],
        dependencies: []
      },
      {
        name: 'analysis',
        displayName: 'RFP Analysis',
        description: 'Analyze RFP requirements, compliance, and feasibility',
        allowedTransitions: ['proposal_generation', 'discovery', 'cancelled'],
        entryActions: ['initialize_analysis', 'allocate_analysis_agents'],
        exitActions: ['validate_analysis', 'calculate_analysis_metrics'],
        timeoutMinutes: 120,
        requiredCapabilities: ['compliance_checking', 'requirements_extraction', 'risk_assessment'],
        dependencies: ['discovery']
      },
      {
        name: 'proposal_generation',
        displayName: 'Proposal Generation',
        description: 'Generate proposal content, pricing, and documentation',
        allowedTransitions: ['submission', 'analysis', 'cancelled'],
        entryActions: ['initialize_proposal_generation', 'allocate_proposal_agents'],
        exitActions: ['validate_proposal', 'calculate_proposal_metrics'],
        timeoutMinutes: 180,
        requiredCapabilities: ['content_generation', 'pricing_analysis', 'document_assembly'],
        dependencies: ['analysis']
      },
      {
        name: 'submission',
        displayName: 'Proposal Submission',
        description: 'Submit proposal through portal automation',
        allowedTransitions: ['monitoring', 'proposal_generation', 'cancelled'],
        entryActions: ['initialize_submission', 'allocate_submission_agents'],
        exitActions: ['validate_submission', 'calculate_submission_metrics'],
        timeoutMinutes: 90,
        requiredCapabilities: ['portal_automation', 'document_upload', 'form_filling'],
        dependencies: ['proposal_generation']
      },
      {
        name: 'monitoring',
        displayName: 'Post-Submission Monitoring',
        description: 'Monitor submission status and follow up activities',
        allowedTransitions: ['completed', 'failed'],
        entryActions: ['initialize_monitoring', 'setup_monitoring_alerts'],
        exitActions: ['finalize_metrics', 'archive_workflow_data'],
        timeoutMinutes: 720, // 12 hours
        requiredCapabilities: ['status_monitoring', 'notification_management'],
        dependencies: ['submission']
      }
    ];

    // Register phase definitions
    phases.forEach(phase => {
      this.phaseDefinitions.set(phase.name, phase);
    });

    // Define valid transitions with conditions
    const transitions: Record<string, PhaseTransition[]> = {
      'discovery': [
        {
          from: 'discovery',
          to: 'analysis',
          conditions: { 
            rfpCount: { min: 1 }, 
            requiredFields: ['title', 'agency', 'deadline'] 
          },
          actions: ['transition_to_analysis', 'notify_analysis_agents']
        },
        {
          from: 'discovery',
          to: 'cancelled',
          conditions: { 
            or: [
              { errorCount: { gte: 3 } },
              { manualCancellation: true }
            ]
          },
          actions: ['cleanup_discovery_resources', 'log_cancellation_reason']
        }
      ],
      'analysis': [
        {
          from: 'analysis',
          to: 'proposal_generation',
          conditions: { 
            complianceScore: { min: 0.8 },
            riskLevel: { max: 'medium' },
            allRequirementsExtracted: true
          },
          actions: ['transition_to_proposal_generation', 'prepare_proposal_context']
        },
        {
          from: 'analysis',
          to: 'discovery',
          conditions: { 
            needsMoreData: true 
          },
          actions: ['rollback_to_discovery', 'request_additional_data']
        },
        {
          from: 'analysis',
          to: 'cancelled',
          conditions: { 
            or: [
              { complianceScore: { lt: 0.5 } },
              { riskLevel: { eq: 'high' } },
              { manualCancellation: true }
            ]
          },
          actions: ['cleanup_analysis_resources', 'log_cancellation_reason']
        }
      ],
      'proposal_generation': [
        {
          from: 'proposal_generation',
          to: 'submission',
          conditions: { 
            proposalComplete: true,
            qualityScore: { min: 0.85 },
            allDocumentsGenerated: true
          },
          actions: ['transition_to_submission', 'prepare_submission_package']
        },
        {
          from: 'proposal_generation',
          to: 'analysis',
          conditions: { 
            needsReanalysis: true 
          },
          actions: ['rollback_to_analysis', 'request_analysis_update']
        },
        {
          from: 'proposal_generation',
          to: 'cancelled',
          conditions: { 
            or: [
              { qualityScore: { lt: 0.6 } },
              { deadlineExceeded: true },
              { manualCancellation: true }
            ]
          },
          actions: ['cleanup_proposal_resources', 'log_cancellation_reason']
        }
      ],
      'submission': [
        {
          from: 'submission',
          to: 'monitoring',
          conditions: { 
            submissionSuccessful: true,
            confirmationReceived: true
          },
          actions: ['transition_to_monitoring', 'setup_status_tracking']
        },
        {
          from: 'submission',
          to: 'proposal_generation',
          conditions: { 
            submissionFailed: true,
            retryPossible: true
          },
          actions: ['rollback_to_proposal_generation', 'fix_submission_issues']
        },
        {
          from: 'submission',
          to: 'cancelled',
          conditions: { 
            or: [
              { maxRetriesExceeded: true },
              { deadlineExceeded: true },
              { manualCancellation: true }
            ]
          },
          actions: ['cleanup_submission_resources', 'log_cancellation_reason']
        }
      ],
      'monitoring': [
        {
          from: 'monitoring',
          to: 'completed',
          conditions: { 
            monitoringComplete: true,
            allTasksFinished: true
          },
          actions: ['finalize_workflow', 'generate_completion_report']
        },
        {
          from: 'monitoring',
          to: 'failed',
          conditions: { 
            or: [
              { criticalError: true },
              { submissionRejected: true }
            ]
          },
          actions: ['handle_workflow_failure', 'generate_failure_report']
        }
      ]
    };

    // Register transitions
    Object.entries(transitions).forEach(([phase, phaseTransitions]) => {
      this.validTransitions.set(phase, phaseTransitions);
    });

    console.log(`✅ Phase State Machine initialized with ${phases.length} phases and ${Object.values(transitions).flat().length} transitions`);
  }

  /**
   * Create a new workflow with initial phase state
   */
  async createWorkflowWithPhaseState(workflowId: string, initialPhase: string = 'discovery', context: Record<string, any> = {}): Promise<WorkflowPhaseState> {
    const phaseState: WorkflowPhaseState = {
      workflowId,
      currentPhase: initialPhase,
      status: 'pending',
      phaseHistory: [],
      canTransitionTo: this.getValidTransitionsFromPhase(initialPhase),
      metadata: {
        ...context,
        createdAt: new Date().toISOString(),
        phaseTimeouts: {}
      }
    };

    this.activeWorkflows.set(workflowId, phaseState);
    
    // Record initial phase transition
    await this.recordPhaseTransition(workflowId, null, initialPhase, null, 'pending', 'automatic', 'system', 'Workflow initiated');
    
    console.log(`🚀 Created workflow ${workflowId} in phase '${initialPhase}'`);
    return phaseState;
  }

  /**
   * Transition a workflow to a new phase with validation
   */
  async transitionWorkflowPhase(
    workflowId: string, 
    toPhase: string, 
    triggeredBy: string, 
    transitionType: 'automatic' | 'manual' | 'retry' | 'rollback' | 'escalation' = 'automatic',
    reason?: string,
    context?: Record<string, any>
  ): Promise<{ success: boolean; error?: string; state?: WorkflowPhaseState }> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    const currentPhase = workflow.currentPhase;
    console.log(`🔄 Attempting phase transition: ${workflowId} ${currentPhase} → ${toPhase}`);

    // Validate transition is allowed
    if (!workflow.canTransitionTo.includes(toPhase)) {
      return { 
        success: false, 
        error: `Invalid transition from '${currentPhase}' to '${toPhase}'. Valid transitions: ${workflow.canTransitionTo.join(', ')}` 
      };
    }

    // Get transition definition
    const transitions = this.validTransitions.get(currentPhase) || [];
    const transition = transitions.find(t => t.to === toPhase);
    if (!transition) {
      return { success: false, error: `No transition definition found for ${currentPhase} → ${toPhase}` };
    }

    // Validate transition conditions
    const conditionCheck = await this.validateTransitionConditions(workflowId, transition, context || {});
    if (!conditionCheck.valid) {
      workflow.blockedReasons = conditionCheck.reasons;
      return { success: false, error: `Transition conditions not met: ${conditionCheck.reasons?.join(', ')}` };
    }

    const fromStatus = workflow.status;
    const previousPhase = workflow.currentPhase;
    const startTime = Date.now();

    try {
      // Execute exit actions for current phase
      await this.executePhaseExitActions(workflowId, currentPhase, context || {});

      // Update workflow state
      workflow.currentPhase = toPhase;
      workflow.status = toPhase === 'completed' || toPhase === 'failed' || toPhase === 'cancelled' 
        ? toPhase as any
        : 'in_progress';
      workflow.canTransitionTo = this.getValidTransitionsFromPhase(toPhase);
      workflow.blockedReasons = undefined;
      workflow.metadata = { 
        ...workflow.metadata, 
        ...context,
        lastTransitionAt: new Date().toISOString(),
        [`${toPhase}StartedAt`]: new Date().toISOString()
      };

      // Record phase transition
      const duration = Math.round((Date.now() - startTime) / 1000);
      await this.recordPhaseTransition(
        workflowId,
        previousPhase,
        toPhase,
        fromStatus,
        workflow.status,
        transitionType,
        triggeredBy,
        reason,
        duration,
        context
      );

      // Execute entry actions for new phase
      await this.executePhaseEntryActions(workflowId, toPhase, context || {});

      console.log(`✅ Phase transition completed: ${workflowId} ${previousPhase} → ${toPhase} (${duration}s)`);
      
      return { success: true, state: workflow };
    } catch (error) {
      console.error(`❌ Phase transition failed: ${workflowId} ${currentPhase} → ${toPhase}:`, error);
      
      // Rollback on failure
      workflow.currentPhase = currentPhase;
      workflow.status = 'failed';
      workflow.canTransitionTo = ['cancelled']; // Only allow cancellation on failure
      workflow.blockedReasons = [`Transition failed: ${error instanceof Error ? error.message : String(error)}`];

      return { success: false, error: `Phase transition failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
   * Validate conditions for a phase transition
   */
  private async validateTransitionConditions(
    workflowId: string,
    transition: PhaseTransition,
    context: Record<string, any>
  ): Promise<{ valid: boolean; reasons?: string[] }> {
    if (!transition.conditions) {
      return { valid: true };
    }

    const reasons: string[] = [];
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return { valid: false, reasons: ['Workflow not found'] };
    }

    // Get workflow context from metadata
    const workflowContext = { ...workflow.metadata, ...context };

    try {
      const valid = await this.evaluateConditions(transition.conditions, workflowContext);
      if (!valid) {
        reasons.push(`Conditions not satisfied for transition to ${transition.to}`);
      }
      
      return { valid, reasons: reasons.length > 0 ? reasons : undefined };
    } catch (error) {
      console.error('Error evaluating transition conditions:', error);
      return { valid: false, reasons: [`Condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`] };
    }
  }

  /**
   * Evaluate complex condition objects
   */
  private async evaluateConditions(conditions: Record<string, any>, context: Record<string, any>): Promise<boolean> {
    // Handle OR conditions
    if (conditions.or && Array.isArray(conditions.or)) {
      for (const orCondition of conditions.or) {
        if (await this.evaluateConditions(orCondition, context)) {
          return true;
        }
      }
      return false;
    }

    // Handle AND conditions (default)
    for (const [key, condition] of Object.entries(conditions)) {
      if (key === 'or') continue; // Already handled
      
      if (!this.evaluateCondition(key, condition, context)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(key: string, condition: any, context: Record<string, any>): boolean {
    const contextValue = context[key];

    // Handle different condition types
    if (typeof condition === 'boolean') {
      return contextValue === condition;
    }

    if (typeof condition === 'string' || typeof condition === 'number') {
      return contextValue === condition;
    }

    if (typeof condition === 'object' && condition !== null) {
      // Handle comparison operators
      if (condition.min !== undefined && (contextValue === undefined || contextValue < condition.min)) {
        return false;
      }
      if (condition.max !== undefined && (contextValue === undefined || contextValue > condition.max)) {
        return false;
      }
      if (condition.eq !== undefined && contextValue !== condition.eq) {
        return false;
      }
      if (condition.lt !== undefined && (contextValue === undefined || contextValue >= condition.lt)) {
        return false;
      }
      if (condition.lte !== undefined && (contextValue === undefined || contextValue > condition.lte)) {
        return false;
      }
      if (condition.gt !== undefined && (contextValue === undefined || contextValue <= condition.gt)) {
        return false;
      }
      if (condition.gte !== undefined && (contextValue === undefined || contextValue < condition.gte)) {
        return false;
      }

      // Handle array inclusion
      if (Array.isArray(condition) && Array.isArray(contextValue)) {
        return condition.every(item => contextValue.includes(item));
      }
    }

    return true;
  }

  /**
   * Execute entry actions when entering a phase
   */
  private async executePhaseEntryActions(workflowId: string, phase: string, context: Record<string, any>): Promise<void> {
    const phaseDefinition = this.phaseDefinitions.get(phase);
    if (!phaseDefinition?.entryActions) {
      return;
    }

    console.log(`🎯 Executing entry actions for phase '${phase}': ${phaseDefinition.entryActions.join(', ')}`);
    
    for (const action of phaseDefinition.entryActions) {
      try {
        await this.executePhaseAction(workflowId, phase, action, 'entry', context);
      } catch (error) {
        console.error(`❌ Entry action '${action}' failed for workflow ${workflowId} phase '${phase}':`, error);
        // Continue with other actions even if one fails
      }
    }
  }

  /**
   * Execute exit actions when leaving a phase
   */
  private async executePhaseExitActions(workflowId: string, phase: string, context: Record<string, any>): Promise<void> {
    const phaseDefinition = this.phaseDefinitions.get(phase);
    if (!phaseDefinition?.exitActions) {
      return;
    }

    console.log(`🏁 Executing exit actions for phase '${phase}': ${phaseDefinition.exitActions.join(', ')}`);
    
    for (const action of phaseDefinition.exitActions) {
      try {
        await this.executePhaseAction(workflowId, phase, action, 'exit', context);
      } catch (error) {
        console.error(`❌ Exit action '${action}' failed for workflow ${workflowId} phase '${phase}':`, error);
        // Continue with other actions even if one fails
      }
    }
  }

  /**
   * Execute a specific phase action
   */
  private async executePhaseAction(
    workflowId: string,
    phase: string,
    action: string,
    type: 'entry' | 'exit',
    context: Record<string, any>
  ): Promise<void> {
    // Import storage dynamically to avoid circular imports
    const { storage } = await import('../storage');
    
    switch (action) {
      case 'initialize_discovery':
        console.log(`📋 Initializing discovery phase for workflow ${workflowId}`);
        // Initialize discovery agents and resources
        break;
        
      case 'allocate_discovery_agents':
        console.log(`👥 Allocating discovery agents for workflow ${workflowId}`);
        // Allocate available agents with discovery capabilities
        break;
        
      case 'validate_rfp_data':
        console.log(`✅ Validating RFP data for workflow ${workflowId}`);
        // Validate discovered RFP data completeness and quality
        break;
        
      case 'calculate_discovery_metrics':
        console.log(`📊 Calculating discovery metrics for workflow ${workflowId}`);
        // Calculate and record discovery phase metrics
        break;
        
      case 'initialize_analysis':
        console.log(`🔍 Initializing analysis phase for workflow ${workflowId}`);
        // Initialize analysis agents and resources
        break;
        
      case 'allocate_analysis_agents':
        console.log(`👥 Allocating analysis agents for workflow ${workflowId}`);
        // Allocate available agents with analysis capabilities
        break;
        
      case 'transition_to_analysis':
        console.log(`🔄 Transitioning to analysis phase for workflow ${workflowId}`);
        // Prepare context for analysis phase
        break;
        
      case 'notify_analysis_agents':
        console.log(`📢 Notifying analysis agents for workflow ${workflowId}`);
        // Send notifications to analysis agents
        break;
        
      case 'cleanup_discovery_resources':
        console.log(`🧹 Cleaning up discovery resources for workflow ${workflowId}`);
        // Release discovery phase resources
        break;
        
      case 'log_cancellation_reason':
        console.log(`📝 Logging cancellation reason for workflow ${workflowId}`);
        // Record why the workflow was cancelled
        break;
        
      default:
        console.log(`⚠️ Unknown phase action: ${action} for workflow ${workflowId}`);
    }
  }

  /**
   * Get valid transitions from a given phase
   */
  private getValidTransitionsFromPhase(phase: string): string[] {
    const phaseDefinition = this.phaseDefinitions.get(phase);
    return phaseDefinition?.allowedTransitions || [];
  }

  /**
   * Record a phase transition in the database and workflow history
   */
  private async recordPhaseTransition(
    workflowId: string,
    fromPhase: string | null,
    toPhase: string,
    fromStatus: string | null,
    toStatus: string,
    transitionType: string,
    triggeredBy: string,
    reason?: string,
    duration?: number,
    metadata?: Record<string, any>
  ): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) return;

    const transitionRecord: PhaseTransitionRecord = {
      fromPhase,
      toPhase,
      fromStatus,
      toStatus,
      transitionType: transitionType as any,
      triggeredBy,
      reason,
      duration,
      timestamp: new Date(),
      metadata
    };

    // Add to workflow history
    workflow.phaseHistory.push(transitionRecord);

    try {
      // Record in database for persistent tracking
      const { storage } = await import('../storage');
      await storage.createPhaseStateTransition({
        workflowId,
        entityType: 'workflow',
        entityId: workflowId,
        fromPhase,
        toPhase,
        fromStatus,
        toStatus,
        transitionType,
        triggeredBy,
        reason,
        duration,
        metadata
      });
    } catch (error) {
      console.error('Failed to record phase transition in database:', error);
      // Don't fail the transition if database recording fails
    }
  }

  /**
   * Get current workflow phase state
   */
  getWorkflowPhaseState(workflowId: string): WorkflowPhaseState | undefined {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get all active workflow states
   */
  getAllActiveWorkflows(): WorkflowPhaseState[] {
    return Array.from(this.activeWorkflows.values());
  }

  /**
   * Pause a workflow (if allowed)
   */
  async pauseWorkflow(workflowId: string, triggeredBy: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    if (workflow.status === 'suspended') {
      return { success: false, error: 'Workflow is already suspended' };
    }

    if (workflow.status === 'completed' || workflow.status === 'failed' || workflow.status === 'cancelled') {
      return { success: false, error: `Cannot pause workflow in '${workflow.status}' state` };
    }

    const previousStatus = workflow.status;
    workflow.status = 'suspended';
    workflow.metadata.suspendedAt = new Date().toISOString();
    workflow.metadata.suspensionReason = reason;
    workflow.metadata.suspendedBy = triggeredBy;

    await this.recordPhaseTransition(
      workflowId,
      workflow.currentPhase,
      workflow.currentPhase,
      previousStatus,
      'suspended',
      'manual',
      triggeredBy,
      reason || 'Workflow paused',
      0,
      { action: 'pause' }
    );

    console.log(`⏸️ Workflow ${workflowId} paused by ${triggeredBy}`);
    return { success: true };
  }

  /**
   * Resume a paused workflow
   */
  async resumeWorkflow(workflowId: string, triggeredBy: string, reason?: string): Promise<{ success: boolean; error?: string }> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    if (workflow.status !== 'suspended') {
      return { success: false, error: `Workflow is not suspended (current status: ${workflow.status})` };
    }

    const previousStatus = workflow.status;
    workflow.status = 'in_progress';
    workflow.metadata.resumedAt = new Date().toISOString();
    workflow.metadata.resumedBy = triggeredBy;
    delete workflow.metadata.suspendedAt;
    delete workflow.metadata.suspensionReason;

    await this.recordPhaseTransition(
      workflowId,
      workflow.currentPhase,
      workflow.currentPhase,
      previousStatus,
      'in_progress',
      'manual',
      triggeredBy,
      reason || 'Workflow resumed',
      0,
      { action: 'resume' }
    );

    console.log(`▶️ Workflow ${workflowId} resumed by ${triggeredBy}`);
    return { success: true };
  }

  /**
   * Cancel a workflow with cascading cancellation
   */
  async cancelWorkflow(workflowId: string, triggeredBy: string, reason?: string, cascading: boolean = false): Promise<{ success: boolean; error?: string }> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return { success: false, error: `Workflow ${workflowId} not found` };
    }

    if (workflow.status === 'cancelled' || workflow.status === 'completed') {
      return { success: false, error: `Workflow is already ${workflow.status}` };
    }

    const previousStatus = workflow.status;
    const previousPhase = workflow.currentPhase;
    
    workflow.status = 'cancelled';
    workflow.currentPhase = 'cancelled';
    workflow.canTransitionTo = [];
    workflow.metadata.cancelledAt = new Date().toISOString();
    workflow.metadata.cancelledBy = triggeredBy;
    workflow.metadata.cancellationReason = reason;

    await this.recordPhaseTransition(
      workflowId,
      previousPhase,
      'cancelled',
      previousStatus,
      'cancelled',
      cascading ? 'automatic' : 'manual',
      triggeredBy,
      reason || 'Workflow cancelled',
      0,
      { action: 'cancel', cascading }
    );

    // Handle cascading cancellation for child workflows
    if (workflow.metadata.childWorkflowIds && Array.isArray(workflow.metadata.childWorkflowIds)) {
      console.log(`🔗 Cascading cancellation to ${workflow.metadata.childWorkflowIds.length} child workflows`);
      for (const childWorkflowId of workflow.metadata.childWorkflowIds) {
        await this.cancelWorkflow(childWorkflowId, triggeredBy, `Parent workflow cancelled: ${reason}`, true);
      }
    }

    console.log(`❌ Workflow ${workflowId} cancelled by ${triggeredBy}${cascading ? ' (cascading)' : ''}`);
    return { success: true };
  }

  /**
   * Handle work item failure with retry/DLQ integration
   */
  async handleWorkItemFailure(
    workItemId: string,
    taskType: string,
    error: string,
    context?: Record<string, any>
  ): Promise<{ success: boolean; action: 'retried' | 'moved_to_dlq' | 'permanent_failure'; nextRetryAt?: Date; error?: string }> {
    try {
      // Get work item details
      const { storage } = await import('../storage');
      const workItem = await storage.getWorkItemById(workItemId);
      
      if (!workItem) {
        return { success: false, action: 'permanent_failure', error: `Work item ${workItemId} not found` };
      }

      console.log(`⚠️ Handling failure for work item ${workItemId}: ${error}`);

      // Check with retry service
      const retryResult = await retryBackoffDlqService.shouldRetryWorkItem(
        workItemId,
        taskType,
        error,
        workItem.retries,
        { ...workItem.metadata, ...context }
      );

      if (retryResult.shouldRetry && retryResult.nextRetryAt) {
        // Schedule retry
        await storage.updateWorkItem(workItemId, {
          status: 'failed',
          retries: workItem.retries + 1,
          nextRetryAt: retryResult.nextRetryAt,
          lastRetryAt: new Date(),
          error,
          canRetry: true,
          updatedAt: new Date()
        });

        console.log(`🔄 Scheduled retry for work item ${workItemId} at ${retryResult.nextRetryAt}`);
        return { 
          success: true, 
          action: 'retried', 
          nextRetryAt: retryResult.nextRetryAt 
        };

      } else if (retryResult.moveToDLQ) {
        // Move to Dead Letter Queue
        await retryBackoffDlqService.moveToDeadLetterQueue(
          workItemId,
          workItem,
          error,
          workItem.retries + 1,
          !this.isPermanentFailure(error),
          { 
            ...context,
            lastAttemptAt: new Date().toISOString(),
            taskType
          }
        );

        // Mark work item as DLQ
        await storage.updateWorkItem(workItemId, {
          status: 'dlq',
          canRetry: false,
          error,
          dlqReason: retryResult.reason,
          dlqTimestamp: new Date(),
          updatedAt: new Date()
        });

        console.log(`💀 Moved work item ${workItemId} to Dead Letter Queue`);
        return { 
          success: true, 
          action: 'moved_to_dlq' 
        };

      } else {
        // Permanent failure
        await storage.updateWorkItem(workItemId, {
          status: 'failed',
          canRetry: false,
          error,
          updatedAt: new Date(),
          failedAt: new Date()
        });

        console.log(`❌ Marked work item ${workItemId} as permanent failure`);
        return { 
          success: true, 
          action: 'permanent_failure' 
        };
      }

    } catch (processingError) {
      console.error(`❌ Error handling work item failure ${workItemId}:`, processingError);
      return { 
        success: false, 
        action: 'permanent_failure', 
        error: processingError instanceof Error ? processingError.message : String(processingError) 
      };
    }
  }

  /**
   * Check if an error represents a permanent failure
   */
  private isPermanentFailure(error: string): boolean {
    const permanentErrors = [
      'AUTHENTICATION_FAILED',
      'AUTHORIZATION_DENIED',
      'DEADLINE_PASSED',
      'MALFORMED_DATA',
      'QUOTA_EXCEEDED',
      'UNSUPPORTED_FORMAT',
      'DOCUMENT_CORRUPTED'
    ];
    
    return permanentErrors.some(permanentError => 
      error.includes(permanentError) || error === permanentError
    );
  }

  /**
   * Process work item completion with success/failure handling
   */
  async processWorkItemCompletion(
    workItemId: string,
    success: boolean,
    result?: any,
    error?: string,
    context?: Record<string, any>
  ): Promise<void> {
    try {
      const { storage } = await import('../storage');
      const workItem = await storage.getWorkItemById(workItemId);
      
      if (!workItem) {
        console.error(`Work item ${workItemId} not found for completion processing`);
        return;
      }

      if (success) {
        // Mark as completed
        await storage.updateWorkItem(workItemId, {
          status: 'completed',
          result,
          completedAt: new Date(),
          updatedAt: new Date(),
          actualDuration: workItem.startedAt 
            ? Math.round((Date.now() - new Date(workItem.startedAt).getTime()) / (1000 * 60))
            : undefined
        });

        console.log(`✅ Work item ${workItemId} completed successfully`);

        // Update workflow progress if this work item is part of a workflow
        if (workItem.workflowId) {
          await this.updateWorkflowProgress(workItem.workflowId);
        }

      } else {
        // Handle failure with retry/DLQ system
        await this.handleWorkItemFailure(
          workItemId,
          workItem.taskType,
          error || 'Unknown error',
          context
        );

        // Check if workflow should be affected by this failure
        if (workItem.workflowId && workItem.isBlocking) {
          await this.handleBlockingWorkItemFailure(workItem.workflowId, workItemId, error);
        }
      }

    } catch (processingError) {
      console.error(`❌ Error processing work item completion ${workItemId}:`, processingError);
    }
  }

  /**
   * Handle blocking work item failure that affects workflow progression
   */
  private async handleBlockingWorkItemFailure(workflowId: string, workItemId: string, error?: string): Promise<void> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return;
    }

    console.log(`🚫 Blocking work item ${workItemId} failed, evaluating workflow ${workflowId} impact`);

    // Check if this failure should block the current phase
    const criticalFailures = [
      'AUTHENTICATION_FAILED',
      'AUTHORIZATION_DENIED',
      'COMPLIANCE_VIOLATION',
      'DEADLINE_EXCEEDED'
    ];

    const isCritical = criticalFailures.some(critical => error?.includes(critical));

    if (isCritical) {
      // Transition workflow to failed state
      await this.transitionWorkflowPhase(
        workflowId,
        'failed',
        'system',
        'automatic',
        `Critical work item failure: ${error}`,
        { 
          failedWorkItemId: workItemId,
          criticalFailure: true,
          blockingFailure: true
        }
      );
    } else {
      // Mark workflow as needing attention but don't fail it entirely
      workflow.blockedReasons = [`Work item ${workItemId} failed: ${error}`];
      workflow.metadata.blockedByFailures = workflow.metadata.blockedByFailures || [];
      workflow.metadata.blockedByFailures.push({
        workItemId,
        error,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update workflow progress based on work item completions
   */
  private async updateWorkflowProgress(workflowId: string): Promise<void> {
    try {
      const { storage } = await import('../storage');
      const workflow = this.activeWorkflows.get(workflowId);
      
      if (!workflow) {
        return;
      }

      // Get all work items for this workflow
      const workItems = await storage.getWorkItemsByWorkflow(workflowId);
      
      if (workItems.length === 0) {
        return;
      }

      // Calculate progress
      const completedItems = workItems.filter(item => item.status === 'completed').length;
      const failedItems = workItems.filter(item => item.status === 'failed' && !item.canRetry).length;
      const dlqItems = workItems.filter(item => item.status === 'dlq').length;
      
      const totalItems = workItems.length;
      const progressPercentage = Math.round((completedItems / totalItems) * 100);

      // Update workflow progress
      workflow.metadata.workItemProgress = {
        total: totalItems,
        completed: completedItems,
        failed: failedItems,
        dlq: dlqItems,
        percentage: progressPercentage
      };

      console.log(`📊 Workflow ${workflowId} progress: ${completedItems}/${totalItems} (${progressPercentage}%)`);

      // Check if phase can progress
      const phaseDefinition = this.phaseDefinitions.get(workflow.currentPhase);
      if (phaseDefinition) {
        const phaseWorkItems = workItems.filter(item => 
          item.metadata?.phase === workflow.currentPhase
        );
        
        const phaseCompleted = phaseWorkItems.length > 0 && 
          phaseWorkItems.every(item => 
            item.status === 'completed' || 
            (item.status === 'failed' && !item.isBlocking)
          );

        if (phaseCompleted && workflow.canTransitionTo.length > 0) {
          console.log(`🎯 Phase ${workflow.currentPhase} completed for workflow ${workflowId}, checking for auto-transition`);
          
          // Attempt automatic phase transition
          const nextPhase = this.determineNextPhase(workflow.currentPhase, workflow.metadata);
          if (nextPhase) {
            await this.transitionWorkflowPhase(
              workflowId,
              nextPhase,
              'system',
              'automatic',
              'Phase completed successfully',
              { autoTransition: true, phaseProgress: workflow.metadata.workItemProgress }
            );
          }
        }
      }

    } catch (error) {
      console.error(`❌ Error updating workflow progress for ${workflowId}:`, error);
    }
  }

  /**
   * Determine the next phase based on current phase and workflow context
   */
  private determineNextPhase(currentPhase: string, metadata: Record<string, any>): string | null {
    const phaseDefinition = this.phaseDefinitions.get(currentPhase);
    if (!phaseDefinition || phaseDefinition.allowedTransitions.length === 0) {
      return null;
    }

    // Simple sequential progression for now
    // In a more sophisticated system, this could evaluate conditions
    const transitions = phaseDefinition.allowedTransitions.filter(t => 
      t !== 'cancelled' // Don't auto-transition to cancelled
    );

    if (transitions.length === 1) {
      return transitions[0];
    }

    // For multiple options, use business logic to decide
    switch (currentPhase) {
      case 'discovery':
        return metadata.rfpCount > 0 ? 'analysis' : null;
      case 'analysis':
        return metadata.complianceScore >= 0.8 ? 'proposal_generation' : null;
      case 'proposal_generation':
        return metadata.proposalComplete ? 'submission' : null;
      case 'submission':
        return metadata.submissionSuccessful ? 'monitoring' : null;
      case 'monitoring':
        return metadata.monitoringComplete ? 'completed' : null;
      default:
        return null;
    }
  }

  /**
   * Initialize specialized agents for different RFP lifecycle phases
   */
  private initializeSpecializedAgents() {
    // RFP Discovery & Research Agents
    const rfpDiscoveryAgent = new Agent({
      name: "rfp-discovery-specialist",
      instructions: `You are an expert RFP discovery specialist. Your role is to:
        - Find and categorize RFP opportunities across government portals
        - Assess opportunity quality and fit for the company
        - Extract key details like deadlines, values, and requirements
        - Prioritize opportunities based on strategic value
        - Provide recommendations for next actions`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    const marketResearchAgent = new Agent({
      name: "market-research-analyst",
      instructions: `You are a market research analyst specializing in government contracting. Your role is to:
        - Conduct competitive analysis for RFP opportunities
        - Research historical bidding patterns and pricing
        - Identify key competitors and their strategies
        - Assess market conditions and trends
        - Provide strategic bidding recommendations`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    // Analysis & Processing Agents
    const complianceAnalysisAgent = new Agent({
      name: "compliance-specialist",
      instructions: `You are a compliance specialist expert in government RFP requirements. Your role is to:
        - Analyze RFP documents for compliance requirements
        - Identify mandatory vs optional requirements
        - Assess risk factors and complexity
        - Map requirements to company capabilities
        - Generate compliance checklists and recommendations`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    const documentIntelligenceAgent = new Agent({
      name: "document-processor",
      instructions: `You are a document processing specialist. Your role is to:
        - Parse and analyze RFP documents and forms
        - Extract fillable fields and requirements
        - Identify human oversight needs
        - Auto-populate forms with company data
        - Generate processing recommendations`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    // Generation & Submission Agents
    const proposalGenerationAgent = new Agent({
      name: "proposal-writer",
      instructions: `You are an expert proposal writer specializing in government contracts. Your role is to:
        - Generate compelling proposal content and narratives
        - Create technical specifications and approaches
        - Develop pricing strategies and tables
        - Ensure compliance with all requirements
        - Optimize proposals for maximum win probability`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    const submissionAgent = new Agent({
      name: "submission-specialist",
      instructions: `You are a submission specialist for government proposals. Your role is to:
        - Handle automated proposal submissions
        - Manage document uploads and formatting
        - Track submission status and deadlines
        - Coordinate follow-up activities
        - Ensure all submission requirements are met`,
      model: openai("gpt-5-2025-08-07", {
        structuredOutputs: true
      })
    });

    // Store agents for reference
    this.agents.set('rfp-discovery-specialist', rfpDiscoveryAgent);
    this.agents.set('market-research-analyst', marketResearchAgent);
    this.agents.set('compliance-specialist', complianceAnalysisAgent);
    this.agents.set('document-processor', documentIntelligenceAgent);
    this.agents.set('proposal-writer', proposalGenerationAgent);
    this.agents.set('submission-specialist', submissionAgent);
  }

  /**
   * Initialize core workflows for RFP processing
   */
  private initializeWorkflows() {
    // This will be expanded with createWorkflow implementations
    console.log('🔧 Mastra workflow engine initialized with specialized agents');
  }

  /**
   * Get a specific agent by name
   */
  getAgent(agentName: string): Agent | undefined {
    return this.agents.get(agentName);
  }

  /**
   * Generate contextual action suggestions based on conversation state
   */
  async generateActionSuggestions(context: {
    messageType: string;
    lastMessage: string;
    availableRfps?: any[];
    currentWorkflowState?: WorkflowState;
    userIntent?: string;
  }): Promise<ActionSuggestion[]> {
    const suggestions: ActionSuggestion[] = [];

    // Generate suggestions based on message type and context
    switch (context.messageType) {
      case 'rfp_results':
        suggestions.push(
          {
            id: 'analyze-compliance',
            label: 'Analyze Compliance Requirements',
            action: 'workflow',
            priority: 'high',
            estimatedTime: '2-3 minutes',
            description: 'Deep dive into RFP requirements and compliance needs',
            icon: 'FileSearch',
            payload: { 
              workflowId: 'compliance-analysis',
              rfpIds: context.availableRfps?.map(rfp => rfp.id) || []
            }
          },
          {
            id: 'research-competitors',
            label: 'Research Past Bids',
            action: 'agent',
            priority: 'medium',
            estimatedTime: '5-7 minutes',
            description: 'Find and analyze competitive landscape and historical bids',
            icon: 'TrendingUp',
            payload: { 
              agentId: 'market-research-analyst',
              context: context
            }
          },
          {
            id: 'start-proposal',
            label: 'Generate Proposal Draft',
            action: 'workflow',
            priority: 'medium',
            estimatedTime: '10-15 minutes',
            description: 'Create initial proposal content and structure',
            icon: 'FileEdit',
            payload: { 
              workflowId: 'proposal-generation',
              rfpIds: context.availableRfps?.map(rfp => rfp.id) || []
            }
          }
        );
        break;

      case 'analysis':
        suggestions.push(
          {
            id: 'generate-proposal',
            label: 'Generate Proposal',
            action: 'workflow',
            priority: 'high',
            estimatedTime: '8-12 minutes',
            description: 'Create comprehensive proposal based on analysis',
            icon: 'FileText',
            payload: { workflowId: 'proposal-generation' }
          },
          {
            id: 'review-compliance',
            label: 'Review Compliance Matrix',
            action: 'navigation',
            priority: 'medium',
            estimatedTime: '2-3 minutes',
            description: 'View detailed compliance requirements and status',
            icon: 'CheckSquare',
            payload: { route: '/compliance' }
          }
        );
        break;

      case 'follow_up':
        suggestions.push(
          {
            id: 'schedule-review',
            label: 'Schedule Review',
            action: 'tool',
            priority: 'medium',
            estimatedTime: '1-2 minutes',
            description: 'Set up review meetings and deadlines',
            icon: 'Calendar',
            payload: { toolId: 'schedule-review' }
          },
          {
            id: 'export-summary',
            label: 'Export Summary',
            action: 'tool',
            priority: 'low',
            estimatedTime: '30 seconds',
            description: 'Generate PDF summary of analysis and recommendations',
            icon: 'Download',
            payload: { toolId: 'export-summary' }
          }
        );
        break;

      default:
        // Default suggestions for general conversation
        suggestions.push(
          {
            id: 'discover-rfps',
            label: 'Discover New RFPs',
            action: 'workflow',
            priority: 'high',
            estimatedTime: '3-5 minutes',
            description: 'Search for new RFP opportunities matching your criteria',
            icon: 'Search',
            payload: { workflowId: 'rfp-discovery' }
          },
          {
            id: 'analyze-portfolio',
            label: 'Analyze Portfolio',
            action: 'agent',
            priority: 'medium',
            estimatedTime: '4-6 minutes',
            description: 'Review your current RFP pipeline and performance metrics',
            icon: 'BarChart3',
            payload: { agentId: 'market-research-analyst' }
          }
        );
    }

    return suggestions;
  }

  /**
   * Initialize agent coordination system
   */
  private async initializeAgentCoordination(): Promise<void> {
    console.log('🤝 Initializing enhanced agent coordination with memory persistence...');
    
    // Set up agent coordination protocols
    this.agentCoordinator.set('rfp-discovery-specialist', {
      canDelegate: ['market-research-analyst', 'compliance-specialist'],
      canConsult: ['document-processor'],
      memoryRetention: 'high',
      learningEnabled: true
    });
    
    this.agentCoordinator.set('market-research-analyst', {
      canDelegate: ['proposal-writer'],
      canConsult: ['compliance-specialist', 'rfp-discovery-specialist'],
      memoryRetention: 'high',
      learningEnabled: true
    });
    
    this.agentCoordinator.set('compliance-specialist', {
      canDelegate: ['document-processor'],
      canConsult: ['proposal-writer', 'market-research-analyst'],
      memoryRetention: 'critical',
      learningEnabled: true
    });
    
    this.agentCoordinator.set('document-processor', {
      canConsult: ['compliance-specialist'],
      memoryRetention: 'medium',
      learningEnabled: true
    });
    
    this.agentCoordinator.set('proposal-writer', {
      canConsult: ['compliance-specialist', 'market-research-analyst'],
      canDelegate: ['document-processor'],
      memoryRetention: 'medium',
      learningEnabled: true
    });
  }

  /**
   * Enhanced agent delegation with memory and coordination
   */
  async delegateToAgent(agentId: string, context: any, conversationId: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    try {
      // Retrieve relevant memories for the agent
      const relevantMemories = await agentMemoryService.getRelevantMemories(agentId, {
        keywords: context?.keywords || [],
        tags: context?.tags || [],
        domain: context?.domain
      });

      // Retrieve relevant knowledge
      const relevantKnowledge = await agentMemoryService.getRelevantKnowledge(agentId, {
        domain: context?.domain,
        knowledgeType: context?.knowledgeType,
        tags: context?.tags || []
      });

      // Enhanced context with memory and knowledge
      const enhancedContext = {
        ...context,
        memories: relevantMemories.slice(0, 5), // Top 5 relevant memories
        knowledge: relevantKnowledge.slice(0, 3), // Top 3 relevant knowledge items
        conversationId,
        agentId
      };

      // Record agent coordination request
      console.log(`🤝 Creating coordination request for agent: ${agentId}`);
      const coordinationRecord = await agentMemoryService.createCoordinationRequest({
        sessionId: conversationId,
        initiatorAgentId: 'system',
        targetAgentId: agentId,
        coordinationType: 'delegation',
        context: enhancedContext,
        request: { action: 'process', context: enhancedContext },
        priority: context?.priority || 5
      });
      const coordinationId = coordinationRecord.id;
      console.log(`✅ Coordination request created with ID: ${coordinationId}`);

      // Process with enhanced context
      console.log(`🎯 Processing with agent: ${agentId}`);
      const result = await this.processWithAgent(agent, enhancedContext);
      console.log(`📝 Agent processing completed, updating coordination status`);

      // Record the successful coordination
      await agentMemoryService.updateCoordinationStatus(coordinationId, 'completed', result);
      console.log(`✅ Coordination status updated to completed for ID: ${coordinationId}`);

      // Learn from the experience
      await this.recordAgentExperience(agentId, {
        context: enhancedContext,
        outcome: result,
        success: true,
        conversationId
      });

      return result;

    } catch (error) {
      console.error(`Error delegating to agent ${agentId}:`, error);
      
      // Record the failed experience for learning
      await this.recordAgentExperience(agentId, {
        context,
        outcome: { error: error instanceof Error ? error.message : String(error) },
        success: false,
        conversationId
      });

      throw error;
    }
  }

  /**
   * Process context with an agent using enhanced capabilities
   */
  private async processWithAgent(agent: Agent, context: any): Promise<any> {
    // Create a comprehensive prompt that includes memory context
    const promptContext = {
      task: context.task || 'Analyze and provide recommendations',
      currentContext: context,
      relevantMemories: context.memories || [],
      availableKnowledge: context.knowledge || [],
      instructions: 'Use your memories and knowledge to provide the most accurate and helpful response'
    };

    // Use the agent to process the enhanced context with generateVNext for GPT-5 models
    const response = await agent.generateVNext(JSON.stringify(promptContext));
    
    return {
      agentId: agent.name,
      response: response.text,
      context: promptContext,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Record agent experience for learning and improvement
   */
  private async recordAgentExperience(agentId: string, experience: any): Promise<void> {
    try {
      await agentMemoryService.learnFromExperience(agentId, experience);
      
      // Record performance metrics
      await agentMemoryService.recordPerformanceMetric(
        agentId,
        'task_completion',
        experience.success ? 1 : 0,
        {
          entityType: 'conversation',
          entityId: experience.conversationId,
          domain: experience.context?.domain
        }
      );

    } catch (error) {
      console.error(`Error recording experience for agent ${agentId}:`, error);
    }
  }

  /**
   * Get agent performance summary
   */
  async getAgentPerformance(agentId: string): Promise<any> {
    return await agentMemoryService.getAgentPerformanceSummary(agentId);
  }

  /**
   * Execute an action suggestion
   */
  async executeActionSuggestion(suggestion: ActionSuggestion, conversationId: string): Promise<any> {
    switch (suggestion.action) {
      case 'workflow':
        return this.initiateWorkflow(suggestion.payload?.workflowId, suggestion.payload, conversationId);
      
      case 'agent':
        return this.delegateToAgent(suggestion.payload?.agentId, suggestion.payload?.context, conversationId);
      
      case 'tool':
        return this.executeTool(suggestion.payload?.toolId, suggestion.payload);
      
      case 'navigation':
        return { action: 'navigate', route: suggestion.payload?.route };
      
      default:
        throw new Error(`Unknown action type: ${suggestion.action}`);
    }
  }

  /**
   * Initiate a workflow with the given parameters
   */
  private async initiateWorkflow(workflowId: string, params: any, conversationId: string): Promise<any> {
    console.log(`🚀 Initiating workflow: ${workflowId}`);
    
    // Import workflow coordinator dynamically to avoid circular imports
    const { workflowCoordinator } = await import('./workflowCoordinator');
    
    // Route to appropriate workflow based on workflowId
    switch (workflowId) {
      case 'rfp-discovery':
        return await workflowCoordinator.executeRFPDiscoveryWorkflow({
          searchCriteria: params.searchCriteria || { keywords: 'technology services' },
          conversationId,
          userId: params.userId
        });
      
      case 'proposal-generation':
        return await workflowCoordinator.executeProposalGenerationWorkflow({
          rfpId: params.rfpIds?.[0] || 'mock-rfp-id',
          conversationId,
          userId: params.userId
        });
      
      case 'compliance-analysis':
        return await workflowCoordinator.executeComplianceVerificationWorkflow({
          rfpId: params.rfpIds?.[0] || 'mock-rfp-id',
          conversationId
        });
      
      default:
        return {
          status: 'initiated',
          workflowId,
          message: `Started ${workflowId} workflow`
        };
    }
  }


  /**
   * Execute a specific tool
   */
  private async executeTool(toolId: string, params: any): Promise<any> {
    // Tool execution logic will be implemented
    console.log(`🔧 Executing tool: ${toolId}`);
    return { status: 'executed', toolId };
  }

  /**
   * Generate appropriate prompt for agent based on context
   */
  private generateAgentPrompt(agentId: string, context: any): string {
    switch (agentId) {
      case 'market-research-analyst':
        return `Please analyze the market conditions and competitive landscape for the following RFPs or context: ${JSON.stringify(context)}`;
      
      case 'compliance-specialist':
        return `Please review and analyze the compliance requirements for: ${JSON.stringify(context)}`;
      
      default:
        return `Please provide analysis and recommendations for: ${JSON.stringify(context)}`;
    }
  }

  // Tool creation methods (placeholder implementations)
  private createPortalSearchTool() {
    return createTool({
      id: "portal-search",
      description: "Search government portals for RFP opportunities",
      inputSchema: z.object({
        criteria: RFPSearchCriteriaSchema
      }),
      execute: async (context) => {
        // Use existing scraping service  
        return { results: [], status: 'completed' };
      }
    });
  }

  private createOpportunityClassificationTool() {
    return createTool({
      id: "opportunity-classification",
      description: "Classify and prioritize RFP opportunities",
      inputSchema: z.object({
        opportunities: z.array(z.any())
      }),
      execute: async (context) => {
        // Classify opportunities using AI
        return {
          classified: [],
          status: 'completed'
        };
      }
    });
  }

  private createCompetitorAnalysisTool() {
    return createTool({
      id: "competitor-analysis",
      description: "Analyze competitors for RFP opportunities",
      inputSchema: z.object({
        rfpId: z.string()
      }),
      execute: async (context) => {
        // Perform competitor analysis
        return {
          competitors: [],
          marketConditions: {},
          recommendations: []
        };
      }
    });
  }

  private createHistoricalBidTool() {
    return createTool({
      id: "historical-bid-analysis",
      description: "Analyze historical bidding patterns",
      inputSchema: z.object({
        category: z.string(),
        agency: z.string().optional()
      }),
      execute: async (context) => {
        // Analyze historical bids
        return {
          averageBid: 0,
          winRate: 0,
          trends: []
        };
      }
    });
  }

  private createDocumentAnalysisTool() {
    return createTool({
      id: "document-analysis",
      description: "Analyze RFP documents for requirements",
      inputSchema: z.object({
        documentText: z.string()
      }),
      execute: async (context) => {
        // Use existing document intelligence service
        return await this.aiService.analyzeDocumentCompliance('sample text', {});
      }
    });
  }

  private createRequirementExtractionTool() {
    return createTool({
      id: "requirement-extraction",
      description: "Extract specific requirements from RFP documents",
      inputSchema: z.object({
        documentText: z.string()
      }),
      execute: async (context) => {
        // Extract requirements using AI
        return {
          mandatory: [],
          optional: [],
          deadlines: []
        };
      }
    });
  }

  private createFormFillingTool() {
    return createTool({
      id: "form-filling",
      description: "Auto-fill forms with company data",
      inputSchema: z.object({
        formFields: z.array(z.any()),
        companyData: z.any()
      }),
      execute: async (context) => {
        // Use document intelligence service
        return {
          filledFields: [],
          status: 'completed'
        };
      }
    });
  }

  private createDocumentParsingTool() {
    return createTool({
      id: "document-parsing",
      description: "Parse documents and extract data",
      inputSchema: z.object({
        documentUrl: z.string()
      }),
      execute: async (context) => {
        // Parse document
        return {
          extractedData: {},
          fields: []
        };
      }
    });
  }

  private createContentGenerationTool() {
    return createTool({
      id: "content-generation",
      description: "Generate proposal content",
      inputSchema: z.object({
        rfpId: z.string(),
        section: z.string()
      }),
      execute: async (context) => {
        // Use existing proposal service
        return {
          content: 'Generated content',
          status: 'completed'
        };
      }
    });
  }

  private createPricingAnalysisTool() {
    return createTool({
      id: "pricing-analysis",
      description: "Analyze pricing strategies",
      inputSchema: z.object({
        rfpId: z.string()
      }),
      execute: async (context) => {
        // Pricing analysis logic
        return {
          suggestedPrice: 0,
          strategy: 'competitive',
          confidence: 0.8
        };
      }
    });
  }

  private createSubmissionTool() {
    return createTool({
      id: "proposal-submission",
      description: "Submit proposal to portal",
      inputSchema: z.object({
        proposalId: z.string(),
        portalId: z.string()
      }),
      execute: async (context) => {
        // Submission logic
        return {
          status: 'submitted',
          confirmationNumber: nanoid()
        };
      }
    });
  }

  private createTrackingTool() {
    return createTool({
      id: "submission-tracking",
      description: "Track submission status",
      inputSchema: z.object({
        submissionId: z.string()
      }),
      execute: async (context) => {
        // Tracking logic
        return {
          status: 'pending',
          lastUpdate: new Date()
        };
      }
    });
  }
}

// Export singleton instance
export const mastraWorkflowEngine = new MastraWorkflowEngine();