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

/**
 * Enhanced Mastra Workflow Engine for RFP Processing
 * Orchestrates specialized agents and workflows for end-to-end RFP management
 */
export class MastraWorkflowEngine {
  private aiService = new AIService();
  private mastraScrapingService = new MastraScrapingService();
  private agents: Map<string, Agent> = new Map();
  private activeWorkflows: Map<string, any> = new Map();
  private agentCoordinator: Map<string, any> = new Map();

  constructor() {
    this.initializeSpecializedAgents();
    this.initializeWorkflows();
    this.initializeAgentCoordination();
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
      model: openai("gpt-5-2025-08-07")
    });

    const marketResearchAgent = new Agent({
      name: "market-research-analyst",
      instructions: `You are a market research analyst specializing in government contracting. Your role is to:
        - Conduct competitive analysis for RFP opportunities
        - Research historical bidding patterns and pricing
        - Identify key competitors and their strategies
        - Assess market conditions and trends
        - Provide strategic bidding recommendations`,
      model: openai("gpt-5-2025-08-07")
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
      model: openai("gpt-5-2025-08-07")
    });

    const documentIntelligenceAgent = new Agent({
      name: "document-processor",
      instructions: `You are a document processing specialist. Your role is to:
        - Parse and analyze RFP documents and forms
        - Extract fillable fields and requirements
        - Identify human oversight needs
        - Auto-populate forms with company data
        - Generate processing recommendations`,
      model: openai("gpt-5-2025-08-07")
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
      model: openai("gpt-5-2025-08-07")
    });

    const submissionAgent = new Agent({
      name: "submission-specialist",
      instructions: `You are a submission specialist for government proposals. Your role is to:
        - Handle automated proposal submissions
        - Manage document uploads and formatting
        - Track submission status and deadlines
        - Coordinate follow-up activities
        - Ensure all submission requirements are met`,
      model: openai("gpt-5-2025-08-07")
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
      const coordinationId = await agentMemoryService.createCoordinationRequest({
        sessionId: conversationId,
        initiatorAgentId: 'system',
        targetAgentId: agentId,
        coordinationType: 'delegation',
        context: enhancedContext,
        request: { action: 'process', context: enhancedContext },
        priority: context?.priority || 5
      });

      // Process with enhanced context
      const result = await this.processWithAgent(agent, enhancedContext);

      // Record the successful coordination
      await agentMemoryService.updateCoordinationStatus(coordinationId, 'completed', result);

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
        outcome: { error: error.message },
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
   * Delegate task to a specific agent
   */
  private async delegateToAgent(agentId: string, context: any, conversationId: string): Promise<any> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    // Generate appropriate prompt based on context
    const prompt = this.generateAgentPrompt(agentId, context);
    
    const response = await agent.generateVNext(prompt);
    
    return {
      agentId,
      response: response.text,
      suggestions: await this.generateActionSuggestions({
        messageType: 'analysis',
        lastMessage: response.text
      })
    };
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