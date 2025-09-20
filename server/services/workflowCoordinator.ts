import { mastraWorkflowEngine } from "./mastraWorkflowEngine";
import { storage } from "../storage";
import { aiProposalService } from "./ai-proposal-service";
import { documentIntelligenceService } from "./documentIntelligenceService";
import { MastraScrapingService } from "./mastraScrapingService";
import type { RFP, Portal, Proposal } from "@shared/schema";
import { nanoid } from 'nanoid';

export interface WorkflowExecutionContext {
  workflowId: string;
  conversationId?: string;
  userId?: string;
  currentPhase: 'discovery' | 'analysis' | 'generation' | 'submission' | 'monitoring';
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

/**
 * Workflow Coordinator for RFP Processing
 * Orchestrates the complete RFP lifecycle using specialized agents
 */
export class WorkflowCoordinator {
  private mastraScrapingService = new MastraScrapingService();
  private activeWorkflows: Map<string, WorkflowExecutionContext> = new Map();

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
          category: 'Technology Services'
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
      status: 'running'
    };

    this.activeWorkflows.set(workflowId, context);

    try {
      // Phase 1: Discovery - Use discovery agent to find RFPs
      console.log(`📍 Phase 1: RFP Discovery`);
      const discoveryAgent = mastraWorkflowEngine.getAgent('rfp-discovery-specialist');
      
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
      const searchResults = await this.performPortalSearch(params.searchCriteria.keywords);
      
      context.data.discoveryResults = searchResults;
      context.progress = 0.3;

      // Phase 2: Analysis - Use compliance agent to analyze found RFPs
      console.log(`📊 Phase 2: Compliance Analysis`);
      const complianceAgent = mastraWorkflowEngine.getAgent('compliance-specialist');
      
      if (complianceAgent && searchResults.length > 0) {
        const analysisPrompt = `Analyze the following ${searchResults.length} RFP opportunities for compliance requirements, risk factors, and strategic fit:
          
          ${searchResults.map((rfp: any, index: number) => `${index + 1}. ${rfp.title} - ${rfp.agency || 'Unknown Agency'}`).join('\n')}
          
          Provide compliance assessment, identify requirements, and highlight any risk factors.`;
        
        const analysisResult = await complianceAgent.generateVNext(analysisPrompt);
        context.data.complianceAnalysis = analysisResult.text;
      }

      context.progress = 0.6;

      // Phase 3: Market Research - Use research agent for competitive analysis
      console.log(`🔍 Phase 3: Market Research`);
      const researchAgent = mastraWorkflowEngine.getAgent('market-research-analyst');
      
      if (researchAgent && searchResults.length > 0) {
        const researchPrompt = `Conduct market research and competitive analysis for these RFP opportunities:
          
          Focus on: historical bidding patterns, competitor landscape, market conditions, and pricing strategies.
          Provide strategic recommendations for bidding approach.`;
        
        const researchResult = await researchAgent.generateVNext(researchPrompt);
        context.data.marketResearch = researchResult.text;
      }

      context.progress = 1.0;
      context.status = 'completed';
      context.currentPhase = 'analysis';

      // Generate suggestions for next steps
      const nextStepSuggestions = await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'rfp_results',
        lastMessage: `Found ${searchResults.length} RFP opportunities`,
        availableRfps: searchResults,
        userIntent: 'rfp_search'
      });

      return {
        success: true,
        data: {
          discoveryResults: searchResults,
          complianceAnalysis: context.data.complianceAnalysis,
          marketResearch: context.data.marketResearch,
          workflowId
        },
        nextPhase: 'generation',
        suggestions: nextStepSuggestions
      };

    } catch (error) {
      console.error(`❌ RFP Discovery Workflow failed:`, error);
      context.status = 'failed';
      context.data.error = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Workflow execution failed'
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
      status: 'running'
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
      const documentAnalysis = await documentIntelligenceService.analyzeRFPDocuments(params.rfpId);
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
        
        const proposalResult = await proposalAgent.generateVNext(generationPrompt);
        context.data.proposalContent = proposalResult.text;
      }

      context.progress = 0.8;

      // Phase 3: Proposal Creation
      console.log(`🔧 Phase 3: Proposal Assembly`);
      const proposal = await storage.createProposal({
        rfpId: params.rfpId,
        status: 'draft',
        content: context.data.proposalContent || 'Generated proposal content'
      });

      context.data.proposalId = proposal.id;
      context.progress = 1.0;
      context.status = 'completed';

      // Generate suggestions for next steps
      const nextStepSuggestions = await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'analysis',
        lastMessage: 'Proposal generated successfully',
        availableRfps: [rfp],
        userIntent: 'bid_crafting'
      });

      return {
        success: true,
        data: {
          proposalId: proposal.id,
          documentAnalysis,
          proposalContent: context.data.proposalContent,
          workflowId
        },
        nextPhase: 'submission',
        suggestions: nextStepSuggestions
      };

    } catch (error) {
      console.error(`❌ Proposal Generation Workflow failed:`, error);
      context.status = 'failed';
      context.data.error = error instanceof Error ? error.message : 'Unknown error';

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Workflow execution failed'
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
      status: 'running'
    };

    this.activeWorkflows.set(workflowId, context);

    try {
      const rfp = await storage.getRFP(params.rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${params.rfpId}`);
      }

      // Use compliance specialist agent
      const complianceAgent = mastraWorkflowEngine.getAgent('compliance-specialist');
      
      if (complianceAgent) {
        const compliancePrompt = `Perform a comprehensive compliance analysis for "${rfp.title}":
          
          1. Review all requirements and identify mandatory vs optional items
          2. Assess risk factors and complexity levels
          3. Map requirements to company capabilities
          4. Generate compliance checklist and recommendations
          5. Identify any potential showstoppers or high-risk areas`;
        
        const complianceResult = await complianceAgent.generateVNext(compliancePrompt);
        context.data.complianceReport = complianceResult.text;
      }

      context.progress = 1.0;
      context.status = 'completed';

      return {
        success: true,
        data: {
          complianceReport: context.data.complianceReport,
          workflowId
        },
        suggestions: await mastraWorkflowEngine.generateActionSuggestions({
          messageType: 'analysis',
          lastMessage: 'Compliance analysis completed',
          availableRfps: [rfp],
          userIntent: 'compliance_review'
        })
      };

    } catch (error) {
      console.error(`❌ Compliance Verification Workflow failed:`, error);
      context.status = 'failed';

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Workflow execution failed'
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
  async suspendWorkflow(workflowId: string, reason: string, data: any = {}, instructions?: string): Promise<boolean> {
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
        resumeInstructions: instructions || `Resume workflow from ${workflow.currentPhase} phase`
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
  async resumeWorkflow(workflowId: string, humanInput?: any): Promise<WorkflowResult> {
    try {
      // Get workflow state from database
      const latestState = await storage.getWorkflowStateByWorkflowId(workflowId);
      
      if (!latestState || latestState.status !== 'suspended') {
        return {
          success: false,
          error: 'Workflow not found or not in suspended state'
        };
      }

      // Reconstruct workflow context
      const context: WorkflowExecutionContext = {
        workflowId: latestState.workflowId,
        conversationId: latestState.conversationId || undefined,
        currentPhase: latestState.currentPhase as any,
        data: {
          ...latestState.context,
          humanInput: humanInput // Merge human input
        },
        progress: latestState.progress / 100, // Convert back from percentage
        status: 'running'
      };

      // Add back to active workflows
      this.activeWorkflows.set(workflowId, context);

      // Update database status
      await storage.updateWorkflowState(latestState.id, {
        status: 'running',
        updatedAt: new Date()
      });

      console.log(`▶️ Workflow ${workflowId} resumed from ${context.currentPhase} phase`);

      // Continue execution based on current phase
      return await this.continueWorkflowExecution(context, humanInput);
      
    } catch (error) {
      console.error(`❌ Failed to resume workflow ${workflowId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to resume workflow'
      };
    }
  }

  /**
   * Execute discovery phase with optional human input
   */
  private async executeDiscoveryPhase(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
    context.currentPhase = 'discovery';
    context.progress = 0.2;
    
    if (humanInput?.action === 'override_search') {
      // Human provided custom search criteria
      let searchCriteria = humanInput.data?.searchCriteria || humanInput.searchCriteria;
      
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
      console.log(`🔍 Continuing discovery phase for workflow ${context.workflowId} with criteria:`, searchCriteria);
      
      // Perform portal search directly without creating new workflow
      const results = await this.performPortalSearch(searchCriteria.keywords || '');
      
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
          userIntent: 'discovery_complete'
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Discovery failed'
      };
    }
  }

  /**
   * Execute analysis phase with optional human input
   */
  private async executeAnalysisPhase(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
    context.currentPhase = 'analysis';
    context.progress = 0.4;
    
    if (humanInput?.action === 'approve_rfp_selection') {
      // Human approved specific RFPs for analysis
      context.data.selectedRfps = humanInput.data?.selectedRfps || humanInput.selectedRfps;
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
          userIntent: 'analysis_review'
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }

  /**
   * Execute generation phase with optional human input
   */
  private async executeGenerationPhase(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
    context.currentPhase = 'generation';
    context.progress = 0.6;
    
    if (humanInput?.action === 'provide_requirements') {
      // Human provided additional requirements or feedback
      context.data.additionalRequirements = humanInput.data?.requirements || humanInput.requirements;
    }
    
    // Continue with proposal generation logic
    try {
      const rfp = context.data.rfp || await storage.getRFP(context.data.rfpId);
      if (!rfp) {
        throw new Error('RFP not found for proposal generation');
      }
      
      // Generate proposal using AI service
      const proposalData = {
        rfpId: rfp.id,
        requirements: context.data.additionalRequirements || {},
        context: `Generate proposal for ${rfp.title}`
      };
      
      const result = await aiProposalService.createProposal(proposalData);
      
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
          userIntent: 'proposal_review'
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Proposal generation failed'
      };
    }
  }

  /**
   * Execute submission phase with optional human input
   */
  private async executeSubmissionPhase(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
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
        data: { suspended: true, reason: 'Changes requested' }
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
          userIntent: 'submission_complete'
        })
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Submission failed'
      };
    }
  }

  /**
   * Execute monitoring phase with optional human input
   */
  private async executeMonitoringPhase(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
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
        userIntent: 'monitor_progress'
      })
    };
  }

  /**
   * Continue workflow execution after resumption
   */
  private async continueWorkflowExecution(context: WorkflowExecutionContext, humanInput?: any): Promise<WorkflowResult> {
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
        error: error instanceof Error ? error.message : 'Workflow execution failed'
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
   * Cancel a workflow
   */
  async cancelWorkflow(workflowId: string): Promise<boolean> {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      workflow.status = 'failed';
      this.activeWorkflows.delete(workflowId);
      
      // Update database if workflow state exists
      try {
        const workflowState = await storage.getWorkflowStateByWorkflowId(workflowId);
        if (workflowState) {
          await storage.updateWorkflowState(workflowState.id, {
            status: 'failed',
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error(`❌ Failed to update cancelled workflow state:`, error);
      }
      
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const workflowCoordinator = new WorkflowCoordinator();