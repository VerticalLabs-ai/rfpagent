import { captureException, withScope } from '@sentry/node';
import type { AiConversation, ConversationMessage } from '@shared/schema';
import type { RFP } from '@shared/schema';
import OpenAI from 'openai';
import { storage } from '../../storage';
import { circuitBreakerManager } from './circuitBreaker';

// OpenAI client will be initialized lazily
let openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
    });
  }
  return openai;
}

// Initialize circuit breakers for different AI operations
const conversationCircuit = circuitBreakerManager.getBreaker(
  'openai-conversation',
  {
    failureThreshold: 3,
    timeout: 30000, // 30 sec
    requestTimeout: 15000, // 15 sec
  }
);

const analysisCircuit = circuitBreakerManager.getBreaker('openai-analysis', {
  failureThreshold: 5,
  timeout: 60000, // 1 min
  requestTimeout: 90000, // 90 sec - increased for complex RFP extraction
});

const generationCircuit = circuitBreakerManager.getBreaker(
  'openai-generation',
  {
    failureThreshold: 5,
    timeout: 60000, // 1 min
    requestTimeout: 45000, // 45 sec for long generations
  }
);

export class AIService {
  private checkApiKeyAvailable(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
  }

  private readonly defaultAssistantPrompt =
    'You are a helpful procurement analyst assisting with RFP research and bid preparation. Respond concisely in markdown.';

  private toOpenAIRole(role: string): 'assistant' | 'system' | 'user' {
    switch (role) {
      case 'assistant':
      case 'system':
        return role;
      default:
        return 'user';
    }
  }

  private async buildConversationMessages(
    conversationId: string
  ): Promise<ConversationMessage[]> {
    return await storage.getConversationMessages(conversationId);
  }

  private async generateAssistantReply(options: {
    conversation: AiConversation;
    history: ConversationMessage[];
    latestUserMessage: string;
  }): Promise<string> {
    const { conversation, history, latestUserMessage } = options;

    if (!this.checkApiKeyAvailable()) {
      return this.generateFallbackReply(latestUserMessage, conversation.type);
    }

    try {
      const messages = [
        { role: 'system' as const, content: this.defaultAssistantPrompt },
        ...history.map(message => ({
          role: this.toOpenAIRole(message.role),
          content: message.content,
        })),
        { role: 'user' as const, content: latestUserMessage },
      ];

      // Execute OpenAI call with circuit breaker protection
      const completion = await conversationCircuit.execute(
        () =>
          getOpenAI().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-5',
            messages,
          }),
        () => {
          // Fallback when circuit is open
          console.warn(
            'Circuit breaker OPEN for conversation - using fallback'
          );
          return {
            choices: [
              {
                message: {
                  content: this.generateFallbackReply(
                    latestUserMessage,
                    conversation.type
                  ),
                },
              },
            ],
          } as any;
        }
      );

      const content = completion.choices[0]?.message?.content;
      if (content) {
        return content.trim();
      }
    } catch (error) {
      console.error('AIService.generateAssistantReply error:', error);
    }

    return this.generateFallbackReply(latestUserMessage, conversation.type);
  }

  private generateFallbackReply(
    query: string,
    conversationType: string
  ): string {
    const normalizedQuery = query.trim();
    const followUp =
      normalizedQuery.length > 0
        ? `I captured your request about "${normalizedQuery.slice(0, 80)}".`
        : 'I captured your request.';

    const contextHint = (() => {
      switch (conversationType) {
        case 'rfp_search':
          return 'I will look for relevant opportunities and highlight key deadlines.';
        case 'bid_crafting':
          return 'I will summarize requirements and key differentiators for your bid.';
        case 'research':
          return 'I will gather supporting insights to strengthen your response.';
        default:
          return 'I will prepare the next set of actions to move this forward.';
      }
    })();

    return `${followUp}\n\n${contextHint}`;
  }

  async processQuery(
    query: string,
    conversationId?: string,
    userId?: string,
    conversationType:
      | 'general'
      | 'rfp_search'
      | 'bid_crafting'
      | 'research' = 'general'
  ): Promise<{
    conversationId: string;
    message: string;
    messageType:
      | 'text'
      | 'analysis'
      | 'follow_up'
      | 'rfp_results'
      | 'search_results';
    data?: unknown;
    followUpQuestions?: string[];
    actionSuggestions?: Array<{
      id: string;
      label: string;
      action: 'workflow' | 'agent' | 'tool' | 'navigation';
      priority: 'high' | 'medium' | 'low';
      estimatedTime: string;
      description: string;
      icon: string;
      payload?: Record<string, unknown>;
    }>;
  }> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error('Query must not be empty');
    }

    let conversation: AiConversation | undefined;

    if (conversationId) {
      conversation = await storage.getAiConversation(conversationId);
    }

    if (!conversation) {
      conversation = await storage.createAiConversation({
        title: trimmedQuery.slice(0, 120),
        type: conversationType,
        userId: userId ?? null,
        status: 'active',
        context: null,
        metadata: null,
      });
    } else if (conversation.type !== conversationType) {
      conversation = await storage.updateAiConversation(conversation.id, {
        type: conversationType,
      });
    }

    await storage.createConversationMessage({
      conversationId: conversation.id,
      role: 'user',
      content: trimmedQuery,
      messageType: 'text',
      metadata: null,
      relatedEntityId: null,
      relatedEntityType: null,
    });

    const history = await this.buildConversationMessages(conversation.id);
    const assistantReply = await this.generateAssistantReply({
      conversation,
      history,
      latestUserMessage: trimmedQuery,
    });

    const assistantMessage = await storage.createConversationMessage({
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantReply,
      messageType: 'text',
      metadata: null,
      relatedEntityId: null,
      relatedEntityType: null,
    });

    const followUpQuestions = this.suggestFollowUps(
      trimmedQuery,
      conversation.type
    );

    return {
      conversationId: conversation.id,
      message: assistantMessage.content,
      messageType: assistantMessage.messageType as
        | 'text'
        | 'analysis'
        | 'follow_up'
        | 'rfp_results'
        | 'search_results',
      followUpQuestions,
      actionSuggestions: this.buildActionSuggestions(
        conversation.type,
        trimmedQuery
      ),
    };
  }

  private suggestFollowUps(query: string, conversationType: string): string[] {
    const suggestions = new Set<string>();

    if (conversationType === 'rfp_search') {
      suggestions.add('Do you want me to filter by deadline or agency?');
      suggestions.add(
        'Should I surface similar opportunities from the past quarter?'
      );
    }

    if (conversationType === 'bid_crafting') {
      suggestions.add('Would you like a compliance checklist draft?');
      suggestions.add('Should I prepare pricing assumptions for review?');
    }

    if (suggestions.size === 0) {
      suggestions.add('Would you like me to summarize the key next steps?');
    }

    return Array.from(suggestions);
  }

  private buildActionSuggestions(conversationType: string, query: string) {
    const baseId = `${Date.now()}`;

    switch (conversationType) {
      case 'rfp_search':
        return [
          {
            id: `${baseId}-search`,
            label: 'Launch RFP discovery workflow',
            action: 'workflow' as const,
            priority: 'medium' as const,
            estimatedTime: '2-3 minutes',
            description:
              'Run the discovery specialist to capture fresh opportunities related to your query.',
            icon: 'Search',
            payload: { query },
          },
        ];
      case 'bid_crafting':
        return [
          {
            id: `${baseId}-compliance`,
            label: 'Generate compliance checklist draft',
            action: 'agent' as const,
            priority: 'high' as const,
            estimatedTime: '4-5 minutes',
            description:
              'Compile required forms, signatures, and supporting documentation.',
            icon: 'CheckSquare',
            payload: { query },
          },
        ];
      default:
        return [];
    }
  }

  async analyzeDocumentCompliance(
    documentText: string,
    rfpContext: any
  ): Promise<any> {
    if (!this.checkApiKeyAvailable()) {
      console.warn(
        'OpenAI API key not available - returning basic compliance analysis'
      );
      return {
        requirements: [
          {
            type: 'general',
            description: 'Review document for compliance requirements',
            mandatory: true,
          },
        ],
        complianceItems: [
          {
            field: 'Company Information',
            description: 'Provide company registration details',
            format: 'text',
          },
        ],
        riskFlags: [],
        mandatoryFields: [
          {
            field: 'Company Information',
            description: 'Provide company registration details',
            format: 'text',
          },
        ],
      };
    }

    try {
      const prompt = `
Analyze this RFP document and extract compliance requirements, deadlines, and risk factors.
Respond with JSON in this exact format:
{
  "requirements": [{"type": "string", "description": "string", "mandatory": boolean}],
  "complianceItems": [{"field": "string", "description": "string", "format": "string"}],
  "riskFlags": [{"type": "high|medium|low", "category": "string", "description": "string"}],
  "mandatoryFields": [{"field": "string", "description": "string", "format": "string"}]
}

The UI expects these specific fields:
- requirements: array of requirement objects with type, description, and mandatory boolean
- complianceItems: array of compliance items with field, description, and format
- riskFlags: array of risk flags with type (high/medium/low), category, and description
- mandatoryFields: array of mandatory fields with field, description, and format

Pay special attention to:
- Notarization requirements
- Cashier's check or bond requirements
- Insurance certificate requirements
- Specific form formats
- Submission deadlines and methods
- License and certification requirements
- Insurance requirements
- Bonding requirements

RFP Context:
Title: ${rfpContext?.title || 'Unknown'}
Agency: ${rfpContext?.agency || 'Unknown'}

Document text:
${documentText}
`;

      // Execute OpenAI call with circuit breaker protection
      const response = await analysisCircuit.execute(
        () =>
          getOpenAI().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-5',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
        () => {
          // Fallback when circuit is open
          console.warn(
            'Circuit breaker OPEN for document analysis - using basic compliance'
          );
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    requirements: [],
                    complianceItems: [],
                    riskFlags: [],
                    mandatoryFields: [],
                  }),
                },
              },
            ],
          } as any;
        }
      );

      const content = response.choices[0].message.content;
      const result = content ? JSON.parse(content) : null;

      // Ensure the result has the expected structure
      if (result) {
        result.requirements = result.requirements || [];
        result.complianceItems =
          result.complianceItems || result.mandatoryFields || [];
        result.riskFlags = result.riskFlags || [];
        result.mandatoryFields =
          result.mandatoryFields || result.complianceItems || [];
      }

      return result;
    } catch (error) {
      console.error('Error analyzing document compliance:', error);

      // Capture to Sentry with document context
      withScope(scope => {
        scope.setTag('service', 'ai-service');
        scope.setTag('operation', 'analyze-compliance');
        scope.setTag('rfp_id', rfpContext?.id || 'unknown');
        scope.setContext('compliance_analysis', {
          rfpId: rfpContext?.id || 'unknown',
          documentLength: documentText?.length || 0,
        });
        scope.setLevel('error');
        captureException(error);
      });

      throw new Error('Failed to analyze document compliance');
    }
  }

  async generateProposal(rfp: RFP): Promise<void> {
    if (!this.checkApiKeyAvailable()) {
      console.warn(
        'OpenAI API key not available - skipping proposal generation'
      );
      return;
    }

    try {
      // Get related documents for context
      const documents = await storage.getDocumentsByRFP(rfp.id);
      const documentContext = documents
        .map(doc => doc.extractedText)
        .join('\n\n');

      // Generate proposal content
      const proposalContent = await this.generateProposalContent(
        rfp,
        documentContext
      );

      // Generate pricing
      const pricingTables = await this.generatePricingTables(
        rfp,
        documentContext
      );

      // Create or update proposal
      const existingProposal = await storage.getProposalByRFP(rfp.id);

      if (existingProposal) {
        await storage.updateProposal(existingProposal.id, {
          content: proposalContent,
          pricingTables,
          status: 'review',
          estimatedMargin: pricingTables?.defaultMargin || '40.00',
        });
      } else {
        await storage.createProposal({
          rfpId: rfp.id,
          content: proposalContent,
          pricingTables,
          status: 'review',
          estimatedMargin: pricingTables?.defaultMargin || '40.00',
        });
      }

      // Update RFP status
      await storage.updateRFP(rfp.id, {
        status: 'review',
        progress: 85,
      });

      // Create notification
      await storage.createNotification({
        type: 'approval',
        title: 'Proposal Ready for Review',
        message: `AI has completed the proposal for ${rfp.title}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      // Create audit log
      await storage.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'proposal_generated',
        details: { aiGenerated: true },
      });
    } catch (error) {
      console.error('Error generating proposal:', error);

      // Capture to Sentry with RFP context
      withScope(scope => {
        scope.setTag('service', 'ai-service');
        scope.setTag('operation', 'generate-proposal');
        scope.setTag('rfp_id', rfp.id);
        scope.setContext('proposal_generation', {
          rfpId: rfp.id,
          rfpTitle: rfp.title,
          agency: rfp.agency,
        });
        scope.setLevel('error');
        captureException(error);
      });

      // Update RFP status to indicate error
      await storage.updateRFP(rfp.id, {
        status: 'discovered',
        progress: 0,
      });

      // Create notification about error
      await storage.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Failed',
        message: `Failed to generate proposal for ${rfp.title}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });
    }
  }

  private async generateProposalContent(
    rfp: RFP,
    documentContext: string
  ): Promise<any> {
    const prompt = `
Generate a comprehensive, professional proposal response for this RFP.
Respond with JSON in this format:
{
  "executiveSummary": "string",
  "companyOverview": "string", 
  "technicalApproach": "string",
  "projectTeam": "string",
  "timeline": "string",
  "qualifications": "string",
  "references": "string"
}

RFP Details:
Title: ${rfp.title}
Agency: ${rfp.agency}
Description: ${rfp.description}
Estimated Value: ${rfp.estimatedValue}

Requirements Context:
${documentContext}

Focus on water supply expertise, compliance with government regulations, and proven track record.
Use professional language suitable for government procurement.
`;

    // Execute OpenAI call with circuit breaker protection
    const response = await generationCircuit.execute(
      () =>
        getOpenAI().chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-5',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
        }),
      () => {
        // Fallback when circuit is open
        console.warn(
          'Circuit breaker OPEN for proposal generation - using template'
        );
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  executiveSummary:
                    'Circuit breaker active - please retry later',
                  companyOverview: '',
                  technicalApproach: '',
                  projectTeam: '',
                  timeline: '',
                  qualifications: '',
                  references: '',
                }),
              },
            },
          ],
        } as any;
      }
    );

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  }

  private async generatePricingTables(
    rfp: RFP,
    _documentContext: string
  ): Promise<any> {
    const prompt = `
Generate a detailed pricing breakdown for this water supply RFP targeting 40% margin.
Respond with JSON in this format:
{
  "lineItems": [
    {
      "description": "string",
      "quantity": number,
      "unit": "string", 
      "unitCost": number,
      "totalCost": number
    }
  ],
  "subtotal": number,
  "margin": number,
  "totalPrice": number,
  "defaultMargin": number,
  "notes": ["string"]
}

RFP Details:
Title: ${rfp.title}
Estimated Value: ${rfp.estimatedValue}

Base your pricing on industry standards for:
- Bottled water supply (per gallon/case)
- Delivery costs
- Storage and handling
- Administrative overhead
- Insurance and bonding

Target 40% gross margin. Be competitive but profitable.
`;

    // Execute OpenAI call with circuit breaker protection
    const response = await generationCircuit.execute(
      () =>
        getOpenAI().chat.completions.create({
          model: process.env.OPENAI_MODEL || 'gpt-5',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.3,
        }),
      () => {
        // Fallback when circuit is open
        console.warn(
          'Circuit breaker OPEN for pricing generation - using default'
        );
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  lineItems: [],
                  subtotal: 0,
                  margin: 0,
                  totalPrice: 0,
                  defaultMargin: 40,
                  notes: ['Circuit breaker active - please retry later'],
                }),
              },
            },
          ],
        } as any;
      }
    );

    const content = response.choices[0].message.content;
    return content ? JSON.parse(content) : null;
  }

  async extractRFPDetails(
    scrapedContent: string,
    sourceUrl: string
  ): Promise<any> {
    if (!this.checkApiKeyAvailable()) {
      console.warn('OpenAI API key not available - using basic RFP extraction');
      return null;
    }

    try {
      const prompt = `
Extract structured RFP information from this scraped content. Analyze ANY legitimate government contract, procurement, or solicitation opportunity.

Respond with JSON in this format:
{
  "title": "string",
  "description": "string", 
  "agency": "string",
  "deadline": "YYYY-MM-DD" or null,
  "estimatedValue": number or null,
  "category": "string",
  "requirements": ["string"],
  "contactInfo": "string",
  "confidence": number (0.0 to 1.0 based on how clearly this is a legitimate RFP/procurement opportunity)
}

Consider these legitimate RFP types:
- Government procurement (supplies, equipment, services)
- Construction and infrastructure projects
- IT and technology contracts
- Professional services (consulting, engineering, legal)
- Maintenance and operations contracts
- Any municipal, state, or federal solicitations

Set confidence based on:
- 0.9-1.0: Clear RFP with title, deadline, and description
- 0.7-0.8: Good RFP information but missing some details
- 0.5-0.6: Basic procurement info but unclear requirements
- 0.3-0.4: Possible opportunity but limited information
- 0.1-0.2: Very unclear or incomplete

If this is clearly NOT a procurement opportunity, return null.

Source URL: ${sourceUrl}
Content: ${scrapedContent}
`;

      // Execute OpenAI call with circuit breaker protection
      const response = await analysisCircuit.execute(
        () =>
          getOpenAI().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-5',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' },
          }),
        () => {
          // Fallback when circuit is open
          console.warn(
            'Circuit breaker OPEN for RFP extraction - returning null'
          );
          return null;
        }
      );

      if (!response) return null;

      const content = response.choices[0].message.content;
      if (!content) return null;

      const result = JSON.parse(content);

      // Ensure confidence score exists
      if (result && result.title && !result.confidence) {
        result.confidence = 0.6; // Default moderate confidence
      }

      return result && result.title ? result : null;
    } catch (error) {
      console.error('Error extracting RFP details:', error);
      return null;
    }
  }

  /**
   * Generate content using OpenAI
   */
  async generateContent(prompt: string): Promise<string> {
    if (!this.checkApiKeyAvailable()) {
      console.warn('OpenAI API key not available - returning empty response');
      return '';
    }

    try {
      // Execute OpenAI call with circuit breaker protection
      const response = await generationCircuit.execute(
        () =>
          getOpenAI().chat.completions.create({
            model: process.env.OPENAI_MODEL || 'gpt-5',
            messages: [{ role: 'user', content: prompt }],
          }),
        () => {
          // Fallback when circuit is open
          console.warn(
            'Circuit breaker OPEN for content generation - returning fallback'
          );
          return {
            choices: [
              {
                message: {
                  content:
                    'Service temporarily unavailable. Please try again later.',
                },
              },
            ],
          } as any;
        }
      );

      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating content:', error);

      // Capture to Sentry with context
      withScope(scope => {
        scope.setTag('service', 'ai-service');
        scope.setTag('operation', 'generate-content');
        scope.setContext('content_generation', {
          promptLength: prompt?.length || 0,
        });
        scope.setLevel('error');
        captureException(error);
      });

      throw new Error('Failed to generate content');
    }
  }

  /**
   * Get circuit breaker health status
   */
  getCircuitBreakerHealth(): {
    conversationCircuit: any;
    analysisCircuit: any;
    generationCircuit: any;
    overall: 'healthy' | 'degraded' | 'unhealthy';
  } {
    const conversationMetrics = conversationCircuit.getMetrics();
    const analysisMetrics = analysisCircuit.getMetrics();
    const generationMetrics = generationCircuit.getMetrics();

    // Determine overall health
    const isHealthy =
      conversationCircuit.isHealthy() &&
      analysisCircuit.isHealthy() &&
      generationCircuit.isHealthy();

    const hasOpenCircuit =
      conversationMetrics.state === 'OPEN' ||
      analysisMetrics.state === 'OPEN' ||
      generationMetrics.state === 'OPEN';

    const overall = hasOpenCircuit
      ? 'unhealthy'
      : isHealthy
        ? 'healthy'
        : 'degraded';

    return {
      conversationCircuit: conversationMetrics,
      analysisCircuit: analysisMetrics,
      generationCircuit: generationMetrics,
      overall,
    };
  }

  /**
   * Manually reset all circuit breakers (for admin use)
   */
  resetCircuitBreakers(): void {
    console.log('[AIService] Resetting all circuit breakers');
    conversationCircuit.reset();
    analysisCircuit.reset();
    generationCircuit.reset();
  }

  async executeSuggestion(
    suggestionId: string,
    conversationId: string,
    suggestion: {
      id: string;
      label: string;
      action: string;
      parameters?: Record<string, unknown>;
    }
  ): Promise<{
    success: boolean;
    message: string;
    result?: Record<string, unknown>;
  }> {
    const conversation = await storage.getAiConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    const actionSummary = `Executed suggestion "${suggestion.label}" (${suggestion.action}).`;

    await storage.createConversationMessage({
      conversationId,
      role: 'assistant',
      content: `${actionSummary}\n\nReference ID: ${suggestionId}`,
      messageType: 'follow_up',
      metadata: {
        suggestion,
        suggestionId,
      },
      relatedEntityId: null,
      relatedEntityType: null,
    });

    return {
      success: true,
      message: actionSummary,
      result: {
        suggestionId,
        action: suggestion.action,
        parameters: suggestion.parameters ?? {},
      },
    };
  }
}

// Export singleton instance
export const aiService = new AIService();
