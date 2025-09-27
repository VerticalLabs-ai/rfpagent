import { ServiceRegistry } from './core/ServiceRegistry';
import { ScrapingContext, ScrapingResult, RFPOpportunity, ScrapingError } from './types';
import { ContentProcessingManager } from './extraction/ContentProcessingManager';
import { stagehandExtractTool, stagehandAuthTool } from '../../../src/mastra/tools';
import { z } from "zod";

/**
 * Main orchestrator for the refactored scraping service
 * Coordinates all scraping operations using modular services
 */
export class ScrapingOrchestrator {
  private services: ServiceRegistry;
  private contentProcessor: ContentProcessingManager;

  constructor() {
    this.services = ServiceRegistry.getInstance();
    this.contentProcessor = new ContentProcessingManager();
    console.log('🎭 Scraping Orchestrator initialized with modular services');
  }

  /**
   * Main scraping method that replaces the monolithic approach
   */
  async scrapePortal(context: ScrapingContext): Promise<ScrapingResult> {
    try {
      console.log(`🌐 Starting portal scraping for: ${context.url}`);

      // Phase 1: Validate and detect portal
      const validationResult = await this.validateAndDetectPortal(context);
      if (!validationResult.isValid) {
        throw new ScrapingError(
          validationResult.error || 'Portal validation failed',
          'VALIDATION_ERROR',
          context.portalType
        );
      }

      // Phase 2: Create browser session
      const sessionId = await this.createSession(context);

      // Phase 3: Handle authentication if required
      if (context.loginRequired && context.credentials) {
        await this.handleAuthentication(context, sessionId);
      }

      // Phase 4: Extract content
      const opportunities = await this.extractContent(context, sessionId);

      // Phase 5: Validate results
      const validatedOpportunities = await this.validateResults(opportunities, context);

      // Phase 6: Cleanup session
      await this.cleanupSession(sessionId);

      console.log(`✅ Successfully scraped ${validatedOpportunities.length} opportunities from ${context.portalType}`);

      return {
        success: true,
        opportunities: validatedOpportunities,
        documentsCount: validatedOpportunities.length,
        message: `Successfully extracted ${validatedOpportunities.length} opportunities`
      };

    } catch (error) {
      console.error(`❌ Scraping failed for ${context.url}:`, error);

      return {
        success: false,
        opportunities: [],
        documentsCount: 0,
        error: error instanceof Error ? error.message : 'Unknown scraping error'
      };
    }
  }

  /**
   * Validate context and detect portal type
   */
  private async validateAndDetectPortal(context: ScrapingContext): Promise<{
    isValid: boolean;
    error?: string;
    detectedPortalType?: string;
  }> {
    const portalDetectionService = this.services.getPortalDetectionService();
    const configurationService = this.services.getConfigurationService();

    // Validate URL and detect portal type
    const validationResult = portalDetectionService.validateAndDetectPortal(context.url);
    if (!validationResult.isValid) {
      return {
        isValid: false,
        error: validationResult.error
      };
    }

    // Update context with detected portal type if not provided
    if (!context.portalType && validationResult.portalType) {
      context.portalType = validationResult.portalType;
    }

    // Validate context with configuration service
    const contextValidation = configurationService.validateContext(context);
    if (!contextValidation.isValid) {
      return {
        isValid: false,
        error: contextValidation.errors.join(', ')
      };
    }

    // Log warnings if any
    if (contextValidation.warnings.length > 0) {
      console.warn('⚠️ Context warnings:', contextValidation.warnings);
    }

    return {
      isValid: true,
      detectedPortalType: validationResult.portalType
    };
  }

  /**
   * Create browser session for scraping
   */
  private async createSession(context: ScrapingContext): Promise<string> {
    const sessionManager = this.services.getBrowserSessionManager();

    // Use provided session ID or create new one
    if (context.sessionId) {
      try {
        await sessionManager.getSession(context.sessionId);
        console.log(`🔄 Reusing existing session: ${context.sessionId}`);
        return context.sessionId;
      } catch (error) {
        console.warn(`⚠️ Session ${context.sessionId} not found, creating new session`);
      }
    }

    const sessionId = await sessionManager.createSession(context.portalType);
    console.log(`🆕 Created new session: ${sessionId}`);
    return sessionId;
  }

  /**
   * Handle portal authentication
   */
  private async handleAuthentication(context: ScrapingContext, sessionId: string): Promise<void> {
    const sessionManager = this.services.getBrowserSessionManager();
    const authenticationManager = this.services.getAuthenticationManager();

    if (!context.credentials) {
      throw new ScrapingError('Credentials required for authentication', 'MISSING_CREDENTIALS', context.portalType);
    }

    console.log(`🔐 Authenticating with ${context.portalType}...`);

    // Build authentication context
    const authContext = {
      portalUrl: context.url,
      username: context.credentials.username,
      password: context.credentials.password,
      sessionId,
      portalType: context.portalType,
      authContext: `${context.portalType} portal authentication`
    };

    // Use authentication manager to handle authentication
    const authResult = await authenticationManager.authenticate(authContext);

    if (!authResult.success) {
      throw new ScrapingError(
        `Authentication failed: ${authResult.error || 'Unknown error'}`,
        'AUTH_ERROR',
        context.portalType,
        sessionId
      );
    }

    // Update session with authentication data
    await sessionManager.updateSessionAuth(sessionId, {
      isAuthenticated: true,
      cookies: authResult.cookies,
      authToken: authResult.authToken
    });

    console.log(`✅ Authentication successful for ${context.portalType}`);
  }

  /**
   * Extract content from portal using multiple strategies
   */
  private async extractContent(context: ScrapingContext, sessionId: string): Promise<RFPOpportunity[]> {
    console.log(`📊 Extracting content from ${context.portalType} using hybrid approach...`);

    // Strategy 1: Try agent orchestration first
    const agentOpportunities = await this.tryAgentExtraction(context, sessionId);
    if (agentOpportunities.length > 0) {
      console.log(`✅ Agent extraction successful: ${agentOpportunities.length} opportunities`);
      return agentOpportunities;
    }

    // Strategy 2: Try content processing with specialized extractors
    const contentOpportunities = await this.tryContentProcessing(context, sessionId);
    if (contentOpportunities.length > 0) {
      console.log(`✅ Content processing successful: ${contentOpportunities.length} opportunities`);
      return contentOpportunities;
    }

    // Strategy 3: Fallback to direct Stagehand extraction
    console.log(`⚠️ Primary strategies failed, falling back to direct extraction`);
    return await this.fallbackDirectExtraction(context, sessionId);
  }

  /**
   * Try agent-based extraction
   */
  private async tryAgentExtraction(context: ScrapingContext, sessionId: string): Promise<RFPOpportunity[]> {
    try {
      const agentOrchestrator = this.services.getAgentOrchestrator();

      console.log(`🤖 Trying agent extraction for ${context.portalType}...`);

      // Create a mock portal object from context for agent selection
      const portal = {
        id: 'temp',
        name: context.portalType,
        url: context.url,
        loginRequired: context.loginRequired || false,
        status: 'active' as const,
        lastScanned: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Use agent orchestrator to extract content
      const agentResult = await agentOrchestrator.executeAgentForPortal(portal, {
        ...context,
        sessionId
      });

      if (agentResult.success) {
        console.log(`📄 Agent extracted ${agentResult.opportunities.length} opportunities using ${agentResult.agentUsed}`);
        return agentResult.opportunities;
      } else {
        console.log(`⚠️ Agent extraction failed: ${agentResult.error}`);
        return [];
      }
    } catch (error) {
      console.error(`❌ Agent extraction error:`, error);
      return [];
    }
  }

  /**
   * Try content processing with specialized extractors
   */
  private async tryContentProcessing(context: ScrapingContext, sessionId: string): Promise<RFPOpportunity[]> {
    try {
      console.log(`🔄 Trying content processing for ${context.portalType}...`);

      // Get page content using browser session
      const sessionManager = this.services.getBrowserSessionManager();
      const session = await sessionManager.getSession(sessionId);

      // For now, we need to get the page content somehow
      // This would typically come from the browser session or a separate content fetching step
      // For this implementation, we'll use a placeholder and let the content processor
      // work with what it can extract from the URL and context

      const mockContent = await this.fetchPageContent(context.url, session);

      if (!mockContent) {
        console.log(`⚠️ No content available for processing`);
        return [];
      }

      // Process content using specialized extractors
      const processingResult = await this.contentProcessor.processContent(
        mockContent,
        context.url,
        context.portalType,
        {
          useParallelExtraction: true,
          maxExtractors: 3
        }
      );

      if (processingResult.success && processingResult.opportunities.length > 0) {
        console.log(`📊 Content processing extracted ${processingResult.opportunities.length} opportunities using: ${processingResult.extractorsUsed.join(', ')}`);
        return processingResult.opportunities;
      } else {
        console.log(`⚠️ Content processing failed: ${processingResult.error || 'No opportunities found'}`);
        return [];
      }
    } catch (error) {
      console.error(`❌ Content processing error:`, error);
      return [];
    }
  }

  /**
   * Fetch page content (placeholder implementation)
   * In a real implementation, this would get content from the browser session
   */
  private async fetchPageContent(url: string, session: any): Promise<string | null> {
    // This is a placeholder - in the real implementation, this would:
    // 1. Use the browser session to navigate to the URL
    // 2. Extract the page content (HTML)
    // 3. Return the content for processing

    // For now, return null to indicate content fetching is not implemented
    console.log(`📄 Content fetching not implemented for ${url}`);
    return null;
  }

  /**
   * Fallback to direct extraction when agent fails
   */
  private async fallbackDirectExtraction(context: ScrapingContext, sessionId: string): Promise<RFPOpportunity[]> {
    const configurationService = this.services.getConfigurationService();

    console.log(`🔄 Performing fallback direct extraction...`);

    // Get extraction instructions for the portal type
    const instruction = configurationService.getExtractionInstructions(context.portalType, context.searchFilter);

    // Extract content using Stagehand directly
    const extractionResult = await stagehandExtractTool.execute({
      context: {
        instruction,
        sessionId,
        schema: {
          opportunities: z.array(z.object({
            title: z.string().describe('RFP title or opportunity name'),
            description: z.string().optional().describe('Description or summary'),
            agency: z.string().optional().describe('Issuing agency'),
            deadline: z.string().optional().describe('Submission deadline'),
            estimatedValue: z.string().optional().describe('Contract value'),
            url: z.string().optional().describe('Direct URL to opportunity'),
            link: z.string().optional().describe('Link to opportunity'),
            category: z.string().optional().describe('Category or type'),
            confidence: z.number().min(0).max(1).default(0.5)
          }))
        }
      }
    });

    if (!extractionResult.success) {
      throw new ScrapingError(
        `Content extraction failed: ${extractionResult.message || 'Unknown error'}`,
        'EXTRACTION_ERROR',
        context.portalType,
        sessionId
      );
    }

    const opportunities = extractionResult.data?.opportunities || [];
    console.log(`📄 Fallback extraction yielded ${opportunities.length} opportunities`);

    return opportunities;
  }

  /**
   * Validate extracted results
   */
  private async validateResults(opportunities: RFPOpportunity[], context: ScrapingContext): Promise<RFPOpportunity[]> {
    const toolFactory = this.services.getToolFactory();

    console.log(`🔍 Validating extracted results...`);

    // Use content validation tool
    const validationTool = toolFactory.createContentValidationTool();
    const validationResult = await validationTool.execute({
      content: opportunities,
      portalType: context.portalType,
      minOpportunities: 1
    });

    if (!validationResult.isValid) {
      console.warn(`⚠️ Content validation issues:`, validationResult.issues);
    }

    if (validationResult.suggestions.length > 0) {
      console.info(`💡 Suggestions:`, validationResult.suggestions);
    }

    console.log(`✅ Content validation score: ${(validationResult.score * 100).toFixed(1)}%`);

    return opportunities;
  }

  /**
   * Cleanup browser session
   */
  private async cleanupSession(sessionId: string): Promise<void> {
    const sessionManager = this.services.getBrowserSessionManager();

    try {
      await sessionManager.closeSession(sessionId);
      console.log(`🧹 Session ${sessionId} cleaned up successfully`);
    } catch (error) {
      console.warn(`⚠️ Failed to cleanup session ${sessionId}:`, error);
    }
  }

  /**
   * Get scraping statistics
   */
  async getScrapingStats(): Promise<{
    activeSessions: number;
    sessionsByPortal: Record<string, number>;
    supportedPortals: string[];
    healthStatus: any;
  }> {
    const sessionManager = this.services.getBrowserSessionManager();
    const configurationService = this.services.getConfigurationService();

    const sessionStats = sessionManager.getSessionStats();
    const supportedPortals = configurationService.getSupportedPortalTypes();
    const healthStatus = await this.services.healthCheck();

    return {
      activeSessions: sessionStats.total,
      sessionsByPortal: sessionStats.byPortalType,
      supportedPortals,
      healthStatus
    };
  }

  /**
   * Health check for the orchestrator
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  }> {
    try {
      const healthStatus = await this.services.healthCheck();
      return {
        status: healthStatus.status,
        details: {
          services: healthStatus.services,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }
}