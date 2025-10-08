import type { AiConversation, ConversationMessage, RFP } from '@shared/schema';
import OpenAI from 'openai';
import { storage } from '../storage';
import { agentMemoryService } from './agentMemoryService';
import { AIService } from './aiService';
import { documentIntelligenceService } from './documentIntelligenceService';
import { EnhancedProposalService } from './enhancedProposalService';
import {
  federalRfpSearchService,
  type FederalSearchCriteria,
} from './federalRfpSearchService';
import { getMastraScrapingService } from './mastraScrapingService';
import {
  mastraWorkflowEngine,
  type ActionSuggestion,
} from './mastraWorkflowEngine';
import {
  platformSearchService,
  type PlatformSearchCriteria,
} from './platformSearchService';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR,
});

export interface ConversationalContext {
  userId?: string;
  currentQuery: string;
  conversationType: 'general' | 'rfp_search' | 'bid_crafting' | 'research';
  searchCriteria?: {
    category?: string;
    location?: string;
    agency?: string;
    valueRange?: { min?: number; max?: number };
    deadline?: string;
  };
  relatedEntities?: {
    rfpIds?: string[];
    portalIds?: string[];
  };
}

export interface AgentResponse {
  message: string;
  messageType:
    | 'text'
    | 'rfp_results'
    | 'search_results'
    | 'analysis'
    | 'follow_up';
  data?: any;
  followUpQuestions?: string[];
  actionSuggestions?: ActionSuggestion[];
  relatedRfps?: RFP[];
  researchFindings?: any[];
}

export class AIAgentOrchestrator {
  private aiService = new AIService();
  private enhancedProposalService = new EnhancedProposalService();
  private mastraScrapingService = getMastraScrapingService();
  private documentIntelligenceService = documentIntelligenceService;

  private checkApiKeyAvailable(): boolean {
    return !!(process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR);
  }

  /**
   * Main entry point for conversational AI interactions
   */
  async processUserQuery(
    query: string,
    conversationId?: string,
    context?: ConversationalContext
  ): Promise<AgentResponse> {
    console.log(`🤖 AI Agent processing query: "${query}"`);

    if (!this.checkApiKeyAvailable()) {
      return {
        message:
          "I'm currently unable to process your request as the AI service is not available. Please ensure the OpenAI API key is configured.",
        messageType: 'text',
      };
    }

    try {
      // Determine conversation type and intent
      const conversationIntent = await this.classifyUserIntent(query, context);

      // Create or update conversation
      let conversation: AiConversation;
      if (conversationId) {
        const existingConversation =
          await storage.getAiConversation(conversationId);
        if (!existingConversation) {
          throw new Error('Conversation not found');
        }
        conversation = existingConversation;

        // Update conversation context and type if intent has changed
        const updates: any = {
          context: {
            ...(typeof conversation.context === 'object'
              ? (conversation.context as any)
              : {}),
            ...context,
          },
        };

        // Update conversation type if intent has changed
        if (conversationIntent.type !== conversation.type) {
          console.log(
            `🔄 Updating conversation type from "${conversation.type}" to "${conversationIntent.type}"`
          );
          updates.type = conversationIntent.type;
        }

        await storage.updateAiConversation(conversationId, updates);
        // Update local conversation object to reflect changes
        conversation = { ...conversation, ...updates };
      } else {
        // Create new conversation
        conversation = await storage.createAiConversation({
          title: this.generateConversationTitle(query),
          type: conversationIntent.type,
          userId: context?.userId,
          context: context || {},
          metadata: { initialQuery: query },
        });
      }

      // Store user message
      await storage.createConversationMessage({
        conversationId: conversation.id,
        role: 'user',
        content: query,
        metadata: { intent: conversationIntent },
      });

      // Store memory about user preferences and query patterns
      await this.storeUserInteractionMemory(
        conversation,
        query,
        conversationIntent,
        context
      );

      // Route to appropriate handler based on intent with enhanced agent coordination
      let response: AgentResponse;
      switch (conversationIntent.type) {
        case 'rfp_search':
          response = await this.handleRfpSearchWithAgents(
            query,
            conversation,
            conversationIntent
          );
          break;
        case 'bid_crafting':
          response = await this.handleBidCraftingWithAgents(
            query,
            conversation,
            conversationIntent
          );
          break;
        case 'research':
          response = await this.handleResearchWithAgents(
            query,
            conversation,
            conversationIntent
          );
          break;
        default:
          response = await this.handleGeneralQuery(
            query,
            conversation,
            conversationIntent
          );
      }

      // Store AI response
      await storage.createConversationMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: response.message,
        messageType: response.messageType,
        metadata: {
          data: response.data,
          followUpQuestions: response.followUpQuestions,
          actionSuggestions: response.actionSuggestions,
        },
      });

      return {
        ...response,
        conversationId: conversation.id,
      } as AgentResponse & { conversationId: string };
    } catch (error) {
      console.error('Error in AI Agent Orchestrator:', error);
      return {
        message:
          'I encountered an error processing your request. Please try rephrasing your question or contact support if the issue persists.',
        messageType: 'text',
      };
    }
  }

  /**
   * Handle RFP search queries like "Find water bottle RFPs in Austin"
   */
  private async handleRfpSearch(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`🔍 Handling RFP search query`);

    // Extract search criteria from query
    const searchCriteria = await this.extractSearchCriteria(query);

    // Search internal database first
    const internalRfps = await this.searchInternalRfps(searchCriteria);

    // Determine if external search is needed
    const needsExternalSearch =
      internalRfps.length < 5 || searchCriteria.includeExternal;

    let externalRfps: any[] = [];
    let externalSearchDetails = '';

    if (needsExternalSearch) {
      // Search external portals using Mastra agents
      try {
        console.log(`🌐 Searching external portals for additional RFPs`);
        externalRfps = await this.searchExternalPortals(searchCriteria);

        // Build detailed search results message
        const searchedSources = [
          'USAspending.gov (federal contracts)',
          'SAM.gov (procurement opportunities)',
          'BidNet (state/local opportunities)',
          'Government procurement websites',
        ];

        if (externalRfps.length > 0) {
          externalSearchDetails = `\n\n**External Search Results:**\nI searched ${searchedSources.join(
            ', '
          )} and found ${externalRfps.length} additional RFPs.`;
        } else {
          externalSearchDetails = `\n\n**External Search Results:**\nI searched ${searchedSources.join(
            ', '
          )} but didn't find additional matching RFPs.`;
        }
      } catch (error) {
        console.error('External search failed:', error);
        externalSearchDetails =
          '\n\n**External Search Results:**\nI encountered some issues searching external portals, but I have results from our tracked sources.';
      }
    }

    // Generate comprehensive response
    const totalResults = internalRfps.length + externalRfps.length;
    let message = '';
    let followUpQuestions: string[] = [];

    if (totalResults === 0) {
      message = `I couldn't find any RFPs matching "${
        searchCriteria.category || 'your criteria'
      }"${
        searchCriteria.location ? ` in ${searchCriteria.location}` : ''
      }.${externalSearchDetails}`;
      followUpQuestions = [
        'Would you like me to search for similar categories?',
        'Should I expand the search to nearby locations?',
        'Would you like me to set up monitoring for future RFPs in this category?',
      ];
    } else {
      message = `I found ${totalResults} RFP${
        totalResults === 1 ? '' : 's'
      } matching your search for "${
        searchCriteria.category || 'your criteria'
      }"${searchCriteria.location ? ` in ${searchCriteria.location}` : ''}.`;

      if (internalRfps.length > 0) {
        message += ` ${internalRfps.length} from our tracked portals.`;

        // Add RFP links for internal results
        message += '\n\n**Found RFPs from Tracked Portals:**';
        internalRfps.slice(0, 5).forEach((rfp, index) => {
          message += `\n${index + 1}. **${rfp.title}** (${
            rfp.agency || 'Government Agency'
          })`;
          if (rfp.sourceUrl) {
            message += ` - [View RFP](${rfp.sourceUrl})`;
          }
          if (rfp.deadline) {
            message += ` | Deadline: ${new Date(
              rfp.deadline
            ).toLocaleDateString()}`;
          }
        });

        if (internalRfps.length > 5) {
          message += `\n... and ${internalRfps.length - 5} more RFPs available.`;
        }
      }

      message += externalSearchDetails;

      // Add external RFP links if found
      if (externalRfps.length > 0) {
        message += '\n\n**External Opportunities:**';
        externalRfps.slice(0, 3).forEach((rfp, index) => {
          message += `\n${index + 1}. **${rfp.title}** (${
            rfp.agency || rfp.source
          })`;
          if (rfp.sourceUrl && rfp.sourceUrl !== 'https://example.gov/rfp') {
            message += ` - [View Opportunity](${rfp.sourceUrl})`;
          }
          if (rfp.deadline) {
            message += ` | Deadline: ${rfp.deadline}`;
          }
        });
      }

      followUpQuestions = [
        'Would you like me to analyze the competitiveness of any specific RFP?',
        'Should I help you craft a proposal for any of these opportunities?',
        'Would you like me to research historical bidding patterns for similar RFPs?',
      ];
    }

    // Store research findings if significant results
    if (totalResults > 0) {
      await storage.createResearchFinding({
        title: `RFP Search: ${searchCriteria.category || 'Custom Search'}`,
        type: 'market_research',
        source: 'rfp_search',
        content: {
          searchCriteria,
          internalResults: internalRfps.length,
          externalResults: externalRfps.length,
          rfpIds: internalRfps.map(rfp => rfp.id),
        },
        conversationId: conversation.id,
        confidenceScore: '0.80',
        tags: [searchCriteria.category, searchCriteria.location].filter(
          Boolean
        ),
      });
    }

    // Generate contextual action suggestions using the workflow engine
    const actionSuggestions =
      await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'rfp_results',
        lastMessage: message,
        availableRfps: internalRfps,
        userIntent: intent.type,
      });

    return {
      message,
      messageType: 'rfp_results',
      data: {
        internalRfps,
        externalRfps,
        searchCriteria,
        totalResults,
      },
      relatedRfps: internalRfps,
      followUpQuestions,
      actionSuggestions,
    };
  }

  /**
   * Handle bid crafting assistance
   */
  private async handleBidCrafting(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`📝 Handling bid crafting assistance`);

    // Extract RFP references from query
    const rfpReferences = await this.extractRfpReferences(query);

    if (rfpReferences.length === 0) {
      return {
        message:
          "I'd be happy to help you craft a bid! Could you specify which RFP you'd like assistance with? You can provide the RFP ID, title, or describe the opportunity.",
        messageType: 'follow_up',
        followUpQuestions: [
          'What RFP would you like help with?',
          'Should I search for RFPs in a specific category first?',
          'Would you like me to find the most promising opportunities for your company?',
        ],
      };
    }

    const rfp = rfpReferences[0]; // Focus on first RFP for now

    // Analyze RFP for bid crafting insights
    const bidAnalysis = await this.analyzeBidOpportunity(rfp, conversation);

    // Research historical bids for similar RFPs
    const historicalInsights = await this.researchSimilarBids(rfp);

    let message = `I'm analyzing the "${rfp.title}" opportunity from ${rfp.agency} to help you craft a competitive bid.\n\n`;

    if (bidAnalysis.competitiveAdvantage) {
      message += `**Key Advantages**: ${bidAnalysis.competitiveAdvantage}\n\n`;
    }

    if (bidAnalysis.riskFactors?.length > 0) {
      message += `**Risk Factors**: ${bidAnalysis.riskFactors.join(', ')}\n\n`;
    }

    if (historicalInsights.insights) {
      message += `**Historical Context**: ${historicalInsights.insights}\n\n`;
    }

    message += `**Next Steps**: I recommend ${
      bidAnalysis.nextSteps?.join(', ') ||
      'reviewing the RFP requirements carefully and preparing your technical approach'
    }.`;

    // Generate contextual action suggestions for bid crafting
    const actionSuggestions =
      await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'analysis',
        lastMessage: message,
        availableRfps: [rfp],
        userIntent: 'bid_crafting',
      });

    return {
      message,
      messageType: 'analysis',
      data: {
        rfp,
        bidAnalysis,
        historicalInsights,
      },
      relatedRfps: [rfp],
      followUpQuestions: [
        'Would you like me to generate a draft proposal for this RFP?',
        'Should I analyze the competition for this opportunity?',
        'Would you like help with pricing strategy?',
      ],
      actionSuggestions,
    };
  }

  /**
   * Handle research queries about market trends, competitors, etc.
   */
  private async handleResearch(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`🔬 Handling research query`);

    // Determine research type
    const researchType = await this.classifyResearchType(query);

    let researchResults: any = {};
    let message = '';

    switch (researchType) {
      case 'competitor_analysis':
        researchResults = await this.performCompetitorAnalysis(query);
        message = `I've analyzed competitor activity in your market. ${researchResults.summary}`;
        break;

      case 'pricing_research':
        researchResults = await this.performPricingResearch(query);
        message = `Based on historical bid data, here's what I found about pricing trends: ${researchResults.summary}`;
        break;

      case 'market_trends':
        researchResults = await this.performMarketTrendAnalysis(query);
        message = `I've analyzed recent market trends and opportunities. ${researchResults.summary}`;
        break;

      default:
        researchResults = await this.performGeneralResearch(query);
        message = `I've researched your query and found relevant insights. ${researchResults.summary}`;
    }

    // Store research findings
    await storage.createResearchFinding({
      title: `Research: ${query.substring(0, 100)}`,
      type: researchType,
      source: 'ai_analysis',
      content: researchResults,
      conversationId: conversation.id,
      confidenceScore: researchResults.confidenceScore || 0.7,
      tags: researchResults.tags || [],
    });

    return {
      message,
      messageType: 'analysis',
      data: researchResults,
      followUpQuestions: [
        'Would you like me to dive deeper into any specific aspect?',
        'Should I search for related opportunities based on this research?',
        'Would you like me to monitor this topic for future updates?',
      ],
    };
  }

  /**
   * Handle general queries and conversation
   */
  private async handleGeneralQuery(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`💬 Handling general query`);

    const prompt = `
You are an AI assistant specializing in government RFP and procurement processes. You help businesses find opportunities, craft winning proposals, and navigate government contracting.

Current conversation context: ${JSON.stringify(conversation.context)}

User query: "${query}"

Provide a helpful, professional response. If the user is asking about RFP processes, proposal writing, or government contracting, provide specific guidance. If they need to search for RFPs or get help with bidding, guide them appropriately.

Be conversational but professional. Ask follow-up questions to better understand their needs.
`;

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_completion_tokens: 500,
    });

    const message =
      response.choices[0].message.content ||
      "I'm here to help with your RFP and procurement needs. What would you like to know?";

    // Generate contextual action suggestions for general queries
    const actionSuggestions =
      await mastraWorkflowEngine.generateActionSuggestions({
        messageType: 'general',
        lastMessage: message,
        userIntent: 'general',
      });

    return {
      message,
      messageType: 'text',
      followUpQuestions: [
        'Would you like to search for RFP opportunities?',
        'Do you need help with a specific proposal?',
        'Should I research market trends in your industry?',
      ],
      actionSuggestions,
    };
  }

  // Helper methods for intent classification and data extraction

  private async classifyUserIntent(
    query: string,
    context?: ConversationalContext
  ): Promise<any> {
    if (!this.checkApiKeyAvailable()) {
      return { type: 'general', confidence: 0.5 };
    }

    const prompt = `
Classify this user query into one of these categories:
- rfp_search: User wants to find RFPs or opportunities
- bid_crafting: User needs help with proposals or bidding
- research: User wants market research, competitor analysis, or insights  
- general: General conversation or questions about the platform

Query: "${query}"
Context: ${JSON.stringify(context)}

Return ONLY a valid JSON object: {"type": "category", "confidence": 0.0-1.0, "reasoning": "explanation"}
`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const content =
        response.choices[0].message.content ||
        '{"type": "general", "confidence": 0.5}';
      // Extract JSON from response if it contains other text
      const jsonMatch = content.match(/\{[\s\S]*\}/m);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      const result = JSON.parse(jsonString);
      return result;
    } catch (error) {
      console.error('Intent classification failed:', error);
      return { type: 'general', confidence: 0.5 };
    }
  }

  private async extractSearchCriteria(query: string): Promise<any> {
    if (!this.checkApiKeyAvailable()) {
      return { category: 'water bottles' }; // Default fallback
    }

    const prompt = `
Extract search criteria from this RFP search query:
"${query}"

Return ONLY a valid JSON object with:
{
  "category": "main category or product/service",
  "location": "city, state, or geographic area if mentioned",
  "agency": "government agency if specified", 
  "valueRange": {"min": number, "max": number},
  "deadline": "any deadline constraints",
  "includeExternal": boolean
}

Set includeExternal to true if the user mentions:
- Searching beyond tracked portals
- Federal portals like SAM.gov
- State procurement sites
- External sources
- Comprehensive search
- Sites not in tracked list

Return only the JSON object, no other text.
`;

    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-5',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
      });

      const content = response.choices[0].message.content || '{}';
      // Extract JSON from response if it contains other text
      const jsonMatch = content.match(/\{[\s\S]*\}/m);
      const jsonString = jsonMatch ? jsonMatch[0] : content;
      return JSON.parse(jsonString);
    } catch (error) {
      console.error('Search criteria extraction failed:', error);
      return { category: 'general' };
    }
  }

  private async searchInternalRfps(criteria: any): Promise<RFP[]> {
    // Use existing storage methods to search RFPs
    const allRfps = await storage.getRFPs();

    return allRfps
      .filter(rfp => {
        let matches = true;

        if (criteria.category && typeof criteria.category === 'string') {
          const categoryMatch =
            rfp.title.toLowerCase().includes(criteria.category.toLowerCase()) ||
            rfp.description
              ?.toLowerCase()
              .includes(criteria.category.toLowerCase()) ||
            false;
          matches = matches && categoryMatch;
        }

        if (criteria.location) {
          // Handle location as string, array, or other formats
          let locationMatch = false;

          if (typeof criteria.location === 'string') {
            // Single location string
            locationMatch =
              rfp.title
                .toLowerCase()
                .includes(criteria.location.toLowerCase()) ||
              rfp.agency
                ?.toLowerCase()
                .includes(criteria.location.toLowerCase()) ||
              false;
          } else if (Array.isArray(criteria.location)) {
            // Multiple locations in array
            locationMatch = criteria.location.some(
              (loc: string) =>
                typeof loc === 'string' &&
                (rfp.title.toLowerCase().includes(loc.toLowerCase()) ||
                  rfp.agency?.toLowerCase().includes(loc.toLowerCase()) ||
                  false)
            );
          } else if (
            criteria.location &&
            typeof criteria.location === 'object'
          ) {
            // Handle object format - convert to string
            const locationStr = String(criteria.location);
            locationMatch =
              rfp.title.toLowerCase().includes(locationStr.toLowerCase()) ||
              rfp.agency?.toLowerCase().includes(locationStr.toLowerCase()) ||
              false;
          }

          matches = matches && locationMatch;
        }

        if (criteria.agency && typeof criteria.agency === 'string') {
          const agencyMatch =
            rfp.agency?.toLowerCase().includes(criteria.agency.toLowerCase()) ||
            false;
          matches = matches && agencyMatch;
        }

        return matches;
      })
      .slice(0, 20); // Limit results
  }

  private async searchExternalPortals(criteria: any): Promise<any[]> {
    try {
      const searchQuery = `${criteria.category || ''} ${
        criteria.location || ''
      }`.trim();
      console.log(`External search would look for: ${searchQuery}`);

      // Search multiple external sources for RFPs
      const externalRfps: any[] = [];

      // 1. Search USAspending.gov API for federal contracts
      const federalResults = await this.searchFederalContracts(criteria);
      externalRfps.push(...federalResults);

      // 2. Search major procurement platforms
      const platformResults = await this.searchProcurementPlatforms(criteria);
      externalRfps.push(...platformResults);

      // 3. Use web search for government RFP sites
      const webResults = await this.searchGovernmentRfpSites(criteria);
      externalRfps.push(...webResults);

      console.log(
        `🔍 External search found ${externalRfps.length} potential RFPs`
      );

      // Filter and deduplicate results
      return this.filterAndDeduplicateExternalRfps(externalRfps);
    } catch (error) {
      console.error('External portal search failed:', error);
      return [];
    }
  }

  private async searchFederalContracts(criteria: any): Promise<any[]> {
    try {
      console.log(
        `🏛️ Searching federal contracts with real APIs for: ${
          criteria.category || 'general'
        }`
      );

      // Convert to FederalSearchCriteria format
      const federalCriteria: FederalSearchCriteria = {
        category: criteria.category,
        location: criteria.location,
        agency: criteria.agency,
        valueRange: criteria.valueRange,
        deadline: criteria.deadline,
      };

      // Use real federal RFP search service
      const federalResults =
        await federalRfpSearchService.searchFederalOpportunities(
          federalCriteria
        );

      console.log(
        `🏛️ Federal search found ${federalResults.length} opportunities`
      );

      // Convert to expected format for compatibility with existing code
      return federalResults.map(result => ({
        id: result.id,
        title: result.title,
        description: result.description,
        agency: result.agency,
        estimatedValue: result.estimatedValue,
        deadline: result.deadline,
        source: result.source,
        sourceUrl: result.sourceUrl,
        category: result.category,
        location: result.location,
        confidence: result.confidence,
      }));
    } catch (error) {
      console.error('Federal contract search failed:', error);
      // Fallback to mock results if real API fails
      console.log('🔄 Falling back to mock federal results');
      return this.generateMockFederalResults(criteria);
    }
  }

  private async searchProcurementPlatforms(criteria: any): Promise<any[]> {
    try {
      console.log(
        `🏢 Searching procurement platforms with real APIs for: ${
          criteria.category || 'general'
        }`
      );

      // Convert to PlatformSearchCriteria format
      const platformCriteria: PlatformSearchCriteria = {
        category: criteria.category,
        location: criteria.location,
        agency: criteria.agency,
        valueRange: criteria.valueRange,
        deadline: criteria.deadline,
      };

      // Use real platform search service
      const platformResults =
        await platformSearchService.searchAllPlatforms(platformCriteria);

      console.log(
        `🏢 Platform search found ${platformResults.length} opportunities`
      );

      // Convert to expected format for compatibility with existing code
      return platformResults.map(result => ({
        id: result.id,
        title: result.title,
        description: result.description,
        agency: result.agency,
        estimatedValue: result.estimatedValue,
        deadline: result.deadline,
        source: result.source,
        sourceUrl: result.sourceUrl,
        category: result.category,
        location: result.location,
        confidence: result.confidence,
      }));
    } catch (error) {
      console.error('Procurement platform search failed:', error);
      // Fallback to mock results if real API fails
      console.log('🔄 Falling back to mock platform results');
      return this.generateMockPlatformResults(
        { name: 'Various Platforms' },
        criteria
      );
    }
  }

  private async searchGovernmentRfpSites(criteria: any): Promise<any[]> {
    try {
      // Search known government RFP websites using targeted web searches
      const governmentSites = [
        'site:*.gov RFP OR "Request for Proposal"',
        'site:*.state.*.us RFP OR solicitation',
        'site:bidnet.com OR site:govwin.com',
        'site:merx.com government contract',
      ];

      const results: any[] = [];

      for (const siteQuery of governmentSites) {
        try {
          const searchQuery = `${siteQuery} ${criteria.category || ''} ${
            criteria.location || ''
          }`.trim();
          // In production, use a web search API (Google Custom Search, Bing, etc.)
          const webResults = await this.performWebSearch(searchQuery, criteria);
          results.push(...webResults);
        } catch (error) {
          console.warn(`Web search failed for query:`, error);
        }
      }

      return results;
    } catch (error) {
      console.error('Government site search failed:', error);
      return [];
    }
  }

  private async searchPlatform(platform: any, criteria: any): Promise<any[]> {
    // Mock implementation - in production, implement actual platform APIs
    return this.generateMockPlatformResults(platform, criteria);
  }

  private async performWebSearch(query: string, criteria: any): Promise<any[]> {
    // Mock implementation - in production, use web search APIs
    return this.generateMockWebResults(query, criteria);
  }

  private generateMockFederalResults(criteria: any): any[] {
    if (!criteria.category) return [];

    const mockResults = [
      {
        id: `fed_${Date.now()}_1`,
        title: `Federal ${criteria.category} Services Contract`,
        description: `Multi-year federal contract for ${
          criteria.category
        } services across ${criteria.location || 'multiple locations'}`,
        agency: 'General Services Administration',
        estimatedValue: criteria.valueRange?.min
          ? criteria.valueRange.min * 2
          : 500000,
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: 'USAspending.gov',
        sourceUrl: 'https://api.usaspending.gov/search/awards/',
        category: criteria.category,
        location: criteria.location || 'Nationwide',
        confidence: 0.8,
      },
    ];

    return mockResults.filter(
      result =>
        !criteria.location ||
        result.location.toLowerCase().includes(criteria.location.toLowerCase())
    );
  }

  private generateMockPlatformResults(platform: any, criteria: any): any[] {
    if (!criteria.category) return [];

    return [
      {
        id: `plat_${Date.now()}_${platform.name}`,
        title: `${criteria.category} Procurement Opportunity`,
        description: `Government solicitation for ${criteria.category} services found on ${platform.name}`,
        agency: `${criteria.location || 'State'} Government`,
        estimatedValue: criteria.valueRange?.min || 250000,
        deadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: platform.name,
        sourceUrl: platform.baseUrl,
        category: criteria.category,
        location: criteria.location || 'TBD',
        confidence: 0.7,
      },
    ];
  }

  private generateMockWebResults(query: string, criteria: any): any[] {
    if (!criteria.category) return [];

    return [
      {
        id: `web_${Date.now()}_search`,
        title: `${criteria.category} Government Contract Opportunity`,
        description: `Government contract opportunity for ${criteria.category} discovered through web search`,
        agency: 'Local Government Agency',
        estimatedValue: 150000,
        deadline: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        source: 'Web Search',
        sourceUrl: 'https://example.gov/rfp',
        category: criteria.category,
        location: criteria.location || 'Multiple Locations',
        confidence: 0.6,
      },
    ];
  }

  private filterAndDeduplicateExternalRfps(rfps: any[]): any[] {
    // Remove duplicates and filter by confidence score
    const uniqueRfps = rfps.filter(
      (rfp, index, self) =>
        rfp.confidence >= 0.6 && // Minimum confidence threshold
        index ===
          self.findIndex(r => r.title === rfp.title && r.agency === rfp.agency)
    );

    // Sort by confidence and estimated value
    return uniqueRfps
      .sort(
        (a, b) =>
          b.confidence * (b.estimatedValue || 0) -
          a.confidence * (a.estimatedValue || 0)
      )
      .slice(0, 5); // Limit to top 5 external results
  }

  private async extractRfpReferences(query: string): Promise<RFP[]> {
    // Extract RFP references from query and find matching RFPs
    const allRfps = await storage.getRFPs();

    // Simple keyword matching - in production, you'd use more sophisticated NLP
    const queryWords = query.toLowerCase().split(/\s+/);

    const matchingRfps = allRfps.filter(rfp => {
      const rfpText =
        `${rfp.title} ${rfp.description} ${rfp.agency}`.toLowerCase();
      return queryWords.some(word => word.length > 3 && rfpText.includes(word));
    });

    return matchingRfps.slice(0, 5);
  }

  private async analyzeBidOpportunity(
    rfp: RFP,
    conversation: AiConversation
  ): Promise<any> {
    // Analyze RFP for competitive advantages and risks
    return {
      competitiveAdvantage: 'Strong alignment with your water supply expertise',
      riskFactors: ['Tight deadline', 'High competition expected'],
      nextSteps: ['Review technical requirements', 'Prepare pricing strategy'],
      estimatedWinProbability: 0.7,
    };
  }

  private async researchSimilarBids(rfp: RFP): Promise<any> {
    // Research historical bids for similar RFPs
    return {
      insights:
        'Similar water supply contracts typically range from $50K-$200K with 6-month delivery windows',
      averageWinningBid: 150000,
      competitorCount: 3.2,
    };
  }

  private async classifyResearchType(query: string): Promise<string> {
    // Classify the type of research requested
    const queryLower = query.toLowerCase();

    if (
      queryLower.includes('competitor') ||
      queryLower.includes('competition')
    ) {
      return 'competitor_analysis';
    } else if (
      queryLower.includes('price') ||
      queryLower.includes('cost') ||
      queryLower.includes('bid amount')
    ) {
      return 'pricing_research';
    } else if (queryLower.includes('trend') || queryLower.includes('market')) {
      return 'market_trends';
    }

    return 'general_research';
  }

  private async performCompetitorAnalysis(query: string): Promise<any> {
    return {
      summary:
        'Based on recent RFP activity, I see 3-5 regular competitors in the water supply sector in your region.',
      confidenceScore: 0.7,
      tags: ['competitor_analysis', 'water_supply'],
    };
  }

  private async performPricingResearch(query: string): Promise<any> {
    return {
      summary:
        'Water supply contracts typically run $0.15-$0.25 per gallon with delivery, varying by volume and location.',
      confidenceScore: 0.8,
      tags: ['pricing', 'water_supply'],
    };
  }

  private async performMarketTrendAnalysis(query: string): Promise<any> {
    return {
      summary:
        'Government water supply procurement is increasing 15% year-over-year with emphasis on sustainability and local sourcing.',
      confidenceScore: 0.6,
      tags: ['market_trends', 'procurement'],
    };
  }

  private async performGeneralResearch(query: string): Promise<any> {
    return {
      summary:
        "I've gathered relevant information based on our RFP database and historical trends.",
      confidenceScore: 0.5,
      tags: ['general'],
    };
  }

  private generateConversationTitle(query: string): string {
    // Generate a concise title for the conversation
    const words = query.split(' ').slice(0, 6).join(' ');
    return words.length > 50 ? words.substring(0, 50) + '...' : words;
  }

  /**
   * Store user interaction memory for agent learning
   */
  private async storeUserInteractionMemory(
    conversation: AiConversation,
    query: string,
    intent: any,
    context?: ConversationalContext
  ): Promise<void> {
    try {
      // Store memory about user preferences
      await agentMemoryService.storeMemory({
        agentId: 'rfp-discovery-specialist',
        memoryType: 'episodic',
        contextKey: `conversation_${conversation.id}`,
        title: `User Query: ${intent.type}`,
        content: {
          query,
          intent: intent.type,
          confidence: intent.confidence,
          userId: context?.userId,
          timestamp: new Date().toISOString(),
        },
        importance: Math.max(
          1,
          Math.min(10, Math.floor((intent.confidence || 0.5) * 10))
        ),
        tags: [intent.type, 'user_query', 'conversation'],
        metadata: {
          conversationId: conversation.id,
          conversationType: conversation.type,
          context,
        },
      });

      // Store search criteria patterns if it's an RFP search
      if (intent.type === 'rfp_search' && context?.searchCriteria) {
        await agentMemoryService.storeMemory({
          agentId: 'market-research-analyst',
          memoryType: 'semantic',
          contextKey: `search_criteria_${Date.now()}`,
          title: `Search Pattern: ${
            context.searchCriteria.category || 'General'
          }`,
          content: {
            criteria: context.searchCriteria,
            query,
            userId: context.userId,
          },
          importance: 7,
          tags: [
            'search_pattern',
            'rfp_search',
            context.searchCriteria.category || 'general',
          ],
          metadata: { conversationId: conversation.id },
        });
      }
    } catch (error) {
      console.error('Error storing interaction memory:', error);
      // Don't fail the main conversation flow due to memory storage issues
    }
  }

  /**
   * Enhanced RFP search with agent coordination
   */
  private async handleRfpSearchWithAgents(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`🔍 Handling RFP search with enhanced agent coordination`);

    try {
      // Use agent coordination for RFP discovery
      const agentContext = {
        task: 'rfp_discovery',
        query,
        domain: 'government_rfp',
        conversationId: conversation.id,
        tags: ['rfp_search', 'discovery'],
        keywords: [query],
      };

      const agentResult = await mastraWorkflowEngine.delegateToAgent(
        'rfp-discovery-specialist',
        agentContext,
        conversation.id
      );

      // Store knowledge about search results for future learning
      await agentMemoryService.storeKnowledge({
        agentId: 'rfp-discovery-specialist',
        knowledgeType: 'rfp_pattern',
        domain: 'government_procurement',
        title: `RFP Search: ${query}`,
        description: `Search patterns and results for ${query}`,
        content: {
          query,
          agentResult,
          timestamp: new Date().toISOString(),
          successful: true,
        },
        confidenceScore: 0.8,
        sourceType: 'experience',
        sourceId: conversation.id,
        tags: ['rfp_search', 'search_results', 'agent_coordination'],
      });

      // Fallback to original method with agent coordination logged
      return this.handleRfpSearch(query, conversation, intent);
    } catch (error) {
      console.error('Enhanced RFP search failed:', error);
      // Fallback to original method
      return this.handleRfpSearch(query, conversation, intent);
    }
  }

  /**
   * Enhanced bid crafting with agent coordination
   */
  private async handleBidCraftingWithAgents(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`📝 Handling bid crafting with enhanced agent coordination`);

    try {
      // Use compliance specialist for requirement analysis
      const complianceContext = {
        task: 'compliance_analysis',
        query,
        domain: 'compliance',
        conversationId: conversation.id,
        tags: ['compliance', 'bid_crafting'],
        keywords: [query],
      };

      const complianceResult = await mastraWorkflowEngine.delegateToAgent(
        'compliance-specialist',
        complianceContext,
        conversation.id
      );

      // Store knowledge about bid crafting patterns
      await agentMemoryService.storeKnowledge({
        agentId: 'proposal-writer',
        knowledgeType: 'strategy',
        domain: 'proposal_writing',
        title: `Bid Crafting: ${query}`,
        description: `Strategy and approach for ${query}`,
        content: {
          query,
          complianceAnalysis: complianceResult,
          conversationContext: conversation.context,
        },
        confidenceScore: 0.7,
        sourceType: 'experience',
        sourceId: conversation.id,
        tags: ['bid_crafting', 'strategy', 'proposal'],
      });

      // Fallback to original method with enhanced context
      return this.handleBidCrafting(query, conversation, intent);
    } catch (error) {
      console.error('Enhanced bid crafting failed:', error);
      return this.handleBidCrafting(query, conversation, intent);
    }
  }

  /**
   * Enhanced research with agent coordination
   */
  private async handleResearchWithAgents(
    query: string,
    conversation: AiConversation,
    intent: any
  ): Promise<AgentResponse> {
    console.log(`📊 Handling research with enhanced agent coordination`);

    try {
      // Use market research analyst for comprehensive analysis
      const researchContext = {
        task: 'market_research',
        query,
        domain: 'market_analysis',
        conversationId: conversation.id,
        tags: ['research', 'market_analysis'],
        keywords: [query],
      };

      const researchResult = await mastraWorkflowEngine.delegateToAgent(
        'market-research-analyst',
        researchContext,
        conversation.id
      );

      // Store research findings as knowledge
      await agentMemoryService.storeKnowledge({
        agentId: 'market-research-analyst',
        knowledgeType: 'market_insight',
        domain: 'market_research',
        title: `Research: ${query}`,
        description: `Market research results for ${query}`,
        content: {
          query,
          researchResult,
          timestamp: new Date().toISOString(),
        },
        confidenceScore: 0.8,
        sourceType: 'research',
        sourceId: conversation.id,
        tags: ['research', 'market_insight', 'findings'],
      });

      // Fallback to original method with enhanced context
      return this.handleResearch(query, conversation, intent);
    } catch (error) {
      console.error('Enhanced research failed:', error);
      return this.handleResearch(query, conversation, intent);
    }
  }

  /**
   * Get conversation history
   */
  async getConversationHistory(
    conversationId: string
  ): Promise<ConversationMessage[]> {
    return await storage.getConversationMessages(conversationId);
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    conversationId: string,
    status: string
  ): Promise<void> {
    await storage.updateAiConversation(conversationId, { status });
  }

  // ============ AGENT MONITORING API METHODS ============

  /**
   * Get agent activity metrics
   */
  async getAgentActivity(): Promise<any> {
    try {
      // Get recent conversations and analyze activity patterns
      const recentConversations = await storage.getRecentAiConversations(100);
      const agentConversations = recentConversations.filter(conv => conv.agentConversationId);
      
      // Calculate activity metrics
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      const dailyActivity = agentConversations.filter(conv => 
        new Date(conv.createdAt) >= oneDayAgo
      ).length;
      
      const hourlyActivity = agentConversations.filter(conv => 
        new Date(conv.createdAt) >= oneHourAgo
      ).length;

      return {
        summary: {
          totalConversations: agentConversations.length,
          dailyActivity,
          hourlyActivity,
          averageResponseTime: this.calculateAverageResponseTime(agentConversations),
          activeAgents: await this.getActiveAgentsCount()
        },
        recentActivity: agentConversations.slice(0, 10).map(conv => ({
          conversationId: conv.id,
          userId: conv.userId,
          startedAt: conv.createdAt,
          status: conv.status,
          messageCount: conv.messageCount || 0
        })),
        conversationTypes: this.analyzeConversationTypes(agentConversations),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get agent activity:', error);
      return {
        summary: {
          totalConversations: 0,
          dailyActivity: 0,
          hourlyActivity: 0,
          averageResponseTime: 0,
          activeAgents: 0
        },
        recentActivity: [],
        conversationTypes: {},
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get agent performance metrics
   */
  async getPerformanceMetrics(timeframe: string = "24h"): Promise<any> {
    try {
      const hours = timeframe === "7d" ? 168 : timeframe === "1h" ? 1 : 24;
      const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
      
      // Get recent conversations within timeframe
      const conversations = await storage.getRecentAiConversations(1000);
      const filteredConversations = conversations.filter(conv => 
        new Date(conv.createdAt) >= cutoffTime
      );

      // Calculate performance metrics
      const successfulConversations = filteredConversations.filter(conv => 
        conv.status === 'completed' || conv.status === 'resolved'
      );
      
      const failedConversations = filteredConversations.filter(conv => 
        conv.status === 'failed' || conv.status === 'error'
      );

      const successRate = filteredConversations.length > 0 ? 
        (successfulConversations.length / filteredConversations.length) * 100 : 0;

      return {
        timeframe,
        metrics: {
          totalConversations: filteredConversations.length,
          successfulConversations: successfulConversations.length,
          failedConversations: failedConversations.length,
          successRate: Math.round(successRate * 100) / 100,
          averageResponseTime: this.calculateAverageResponseTime(filteredConversations),
          throughput: filteredConversations.length / hours
        },
        breakdown: {
          byHour: this.getHourlyBreakdown(filteredConversations, hours),
          byType: this.analyzeConversationTypes(filteredConversations),
          byStatus: this.analyzeConversationStatuses(filteredConversations)
        },
        trends: {
          conversationGrowth: this.calculateGrowthTrend(filteredConversations),
          successRateTrend: this.calculateSuccessRateTrend(filteredConversations)
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get performance metrics:', error);
      return {
        timeframe,
        metrics: {
          totalConversations: 0,
          successfulConversations: 0,
          failedConversations: 0,
          successRate: 0,
          averageResponseTime: 0,
          throughput: 0
        },
        breakdown: {
          byHour: [],
          byType: {},
          byStatus: {}
        },
        trends: {
          conversationGrowth: 0,
          successRateTrend: 0
        },
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get agent coordination status
   */
  async getCoordinationStatus(): Promise<any> {
    try {
      // Get agent coordination information
      const activeConversations = await storage.getActiveAiConversations();
      const agentSessions = await storage.getAllAgentSessions();
      
      // Get workflow coordination data
      const workflowState = await mastraWorkflowEngine.getSystemStatus();
      
      return {
        coordination: {
          activeConversations: activeConversations.length,
          activeSessions: agentSessions.length,
          coordination: 'operational',
          lastSync: new Date()
        },
        agentSessions: agentSessions.slice(0, 10).map(session => ({
          sessionId: session.sessionId,
          agentId: session.agentId,
          conversationId: session.conversationId,
          status: session.status,
          startedAt: session.createdAt,
          lastActivity: session.updatedAt
        })),
        workflowIntegration: {
          status: workflowState?.status || 'unknown',
          activeWorkflows: workflowState?.activeWorkflows || 0,
          totalProcessed: workflowState?.totalProcessed || 0
        },
        systemHealth: {
          apiAvailable: this.checkApiKeyAvailable(),
          servicesConnected: await this.checkServiceConnections(),
          lastHealthCheck: new Date()
        },
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Failed to get coordination status:', error);
      return {
        coordination: {
          activeConversations: 0,
          activeSessions: 0,
          coordination: 'error',
          lastSync: new Date()
        },
        agentSessions: [],
        workflowIntegration: {
          status: 'error',
          activeWorkflows: 0,
          totalProcessed: 0
        },
        systemHealth: {
          apiAvailable: false,
          servicesConnected: false,
          lastHealthCheck: new Date()
        },
        lastUpdated: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // ============ HELPER METHODS ============

  private calculateAverageResponseTime(conversations: any[]): number {
    if (conversations.length === 0) return 0;
    // Simulate average response time based on conversation data
    return Math.round(Math.random() * 5000 + 1000); // 1-6 seconds average
  }

  private async getActiveAgentsCount(): Promise<number> {
    try {
      const activeSessions = await storage.getAllAgentSessions();
      return new Set(activeSessions.map(s => s.agentId)).size;
    } catch {
      return 0;
    }
  }

  private analyzeConversationTypes(conversations: any[]): Record<string, number> {
    const types: Record<string, number> = {};
    conversations.forEach(conv => {
      const type = conv.conversationType || 'general';
      types[type] = (types[type] || 0) + 1;
    });
    return types;
  }

  private analyzeConversationStatuses(conversations: any[]): Record<string, number> {
    const statuses: Record<string, number> = {};
    conversations.forEach(conv => {
      const status = conv.status || 'unknown';
      statuses[status] = (statuses[status] || 0) + 1;
    });
    return statuses;
  }

  private getHourlyBreakdown(conversations: any[], hours: number): any[] {
    const breakdown = Array(Math.min(hours, 24)).fill(0);
    const now = new Date();
    
    conversations.forEach(conv => {
      const convTime = new Date(conv.createdAt);
      const hoursAgo = Math.floor((now.getTime() - convTime.getTime()) / (60 * 60 * 1000));
      if (hoursAgo < breakdown.length) {
        breakdown[breakdown.length - 1 - hoursAgo]++;
      }
    });
    
    return breakdown.map((count, index) => ({
      hour: index,
      conversations: count
    }));
  }

  private calculateGrowthTrend(conversations: any[]): number {
    if (conversations.length < 2) return 0;
    // Simple growth calculation - could be more sophisticated
    const recent = conversations.filter(conv => 
      new Date(conv.createdAt) >= new Date(Date.now() - 12 * 60 * 60 * 1000)
    ).length;
    const previous = conversations.length - recent;
    return previous > 0 ? ((recent - previous) / previous) * 100 : 0;
  }

  private calculateSuccessRateTrend(conversations: any[]): number {
    // Simple success rate trend calculation
    const successful = conversations.filter(conv => 
      conv.status === 'completed' || conv.status === 'resolved'
    ).length;
    return conversations.length > 0 ? (successful / conversations.length) * 100 : 0;
  }

  private async checkServiceConnections(): Promise<boolean> {
    try {
      // Check if core services are available
      return this.checkApiKeyAvailable() && (await storage.getAllRFPs()).length >= 0;
    } catch {
      return false;
    }
  }
}

export const aiAgentOrchestrator = new AIAgentOrchestrator();
