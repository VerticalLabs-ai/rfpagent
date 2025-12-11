import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { captureException, withScope } from '@sentry/node';
import type { Portal } from '@shared/schema';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { z } from 'zod';
import { storage } from '../../storage';
import { AIService } from '../core/aiService';
// Removed Puppeteer - now using unified Browserbase through Mastra
import { sessionManager, sharedMemory } from '../../../src/mastra/tools';
import { performBrowserAuthentication } from '../core/stagehandTools'; // Add missing import
import {
  createBonfireAgent,
  createFindRFPAgent,
  createGenericRFPAgent,
  createSAMGovAgent,
} from '../mastra/agents/agentFactory';
import {
  handleBrowserbaseAuthentication,
  scrapeBrowserbaseContent,
  unifiedBrowserbaseWebScrape,
  type AuthenticationContext,
  type AuthenticationResult,
  type UnifiedScrapeContext,
  type UnifiedScrapeResult,
} from '../mastra/core/browserbaseOps';
import {
  createAuthenticationTool,
  createRFPExtractionTool,
  createWebScrapingTool,
  type ToolExecutors,
} from '../mastra/tools/toolFactory';
import { validateSAMGovUrl } from '../mastra/utils/urlValidation';
import { austinFinanceDocumentScraper } from './austinFinanceDocumentScraper';
import { SAMGovDocumentDownloader } from './samGovDocumentDownloader';
import { getSAMGovStagehandScraper } from './samGovStagehandScraper';
import {
  normalizePortalType,
  shouldUseAustinPortalExtraction,
  shouldUseSAMGovExtraction,
} from './utils/portalTypeUtils';

// Enhanced scraping result type
export interface EnhancedScrapingResult {
  success: boolean;
  message?: string;
  documentsCount?: number;
  opportunities?: number;
  rfpData?: unknown;
  error?: string;
}

// Session data interface for authentication results
interface SessionData {
  authenticated: boolean;
  sessionId?: string;
  method?: string;
  [key: string]: unknown;
}

// Structured data from scraping
interface StructuredScrapingData {
  opportunities?: Array<{
    title?: string;
    description?: string;
    agency?: string;
    deadline?: string;
    estimatedValue?: string;
    url?: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// Extracted content from HTML parsing
interface ExtractedContent {
  title: string;
  headings: string[];
  links: Array<{ url: string; text: string }>;
  text: string;
  opportunities: Array<{
    title: string;
    description?: string;
    agency?: string;
    deadline?: string;
    estimatedValue?: string;
    url?: string;
    [key: string]: unknown;
  }>;
}

// Context for RFP data extraction
interface ExtractRFPDataContext {
  content: string;
  url: string;
}

// HTTP response wrapper for redirect handling
interface HttpResponseWrapper {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: {
    text: () => Promise<string>;
  };
}

// Authentication method detection result
interface AuthenticationMethod {
  type: 'form' | 'browser_required' | 'none' | 'unknown';
  details: string;
  formData?: Record<string, string>;
}

// Opportunity details result
interface OpportunityDetails {
  title: string;
  description?: string;
  agency?: string;
  deadline?: string;
  estimatedValue?: string;
  url?: string;
  extractedAt: string;
}

// Zod schema for agent response validation
const OpportunitySchema = z.object({
  title: z.string(), // Project name/description
  solicitationId: z.string().optional(), // RFP/IFB/IFQ number
  description: z.string(),
  agency: z.string().optional(),
  deadline: z.string().optional(),
  estimatedValue: z.string().optional(),
  url: z.string().url().optional(),
  link: z.string().url().optional(),
  category: z.string().optional(),
  confidence: z.number().min(0).max(1).optional().default(0.5),
});

const AgentResponseSchema = z
  .object({
    opportunities: z.array(OpportunitySchema).optional(),
    results: z.array(OpportunitySchema).optional(),
    status: z.string().optional(),
    error: z.string().optional(),
  })
  .or(OpportunitySchema);

export class MastraScrapingService {
  private aiService = new AIService();
  private memory: Memory | undefined = sharedMemory; // Using centralized shared memory with credential security
  private agents: Map<string, Agent> = new Map();
  private requestLimiter = pLimit(3); // Limit concurrent requests
  private aiLimiter = pLimit(2); // Limit concurrent AI calls
  private activeCoordinationIds: Map<string, string> = new Map(); // portalId -> coordinationId
  private samGovDownloader = new SAMGovDocumentDownloader(); // SAM.gov document downloader
  private readonly DOCUMENT_RETRY_TIMEOUT_SECONDS = 30;

  constructor() {
    // Memory now enabled with shared, secure memory provider
    console.log(
      '🧠 Shared memory with credential security enabled for Mastra scraping service'
    );
    this.initializeAgents();
  }

  /**
   * Unified content scraping using Browserbase through Mastra
   * Replaces both Puppeteer and direct Stagehand approaches
   */
  /**
   * Unified Browserbase web scraping method using official Mastra integration
   * Replaces the old hybrid approach with consistent Browserbase automation
   */
  private async unifiedBrowserbaseWebScrape(
    context: UnifiedScrapeContext
  ): Promise<UnifiedScrapeResult> {
    return await unifiedBrowserbaseWebScrape(context);
  }

  /**
   * Handle portal authentication using unified Browserbase automation
   */
  private async handleBrowserbaseAuthentication(
    context: AuthenticationContext
  ): Promise<AuthenticationResult> {
    return await handleBrowserbaseAuthentication(context);
  }

  private async scrapeBrowserbaseContent(
    url: string,
    sessionId: string,
    instruction?: string
  ): Promise<string> {
    return await scrapeBrowserbaseContent(url, sessionId, instruction);
  }

  private initializeAgents(): void {
    // Generic RFP scraper agent
    const genericAgent = this.createGenericRFPAgent();
    this.agents.set('generic', genericAgent);

    // Specialized agents for major portals
    const bonfireAgent = this.createBonfireAgent();
    this.agents.set('bonfire_hub', bonfireAgent);

    const samGovAgent = this.createSAMGovAgent();
    this.agents.set('sam.gov', samGovAgent);

    const findRFPAgent = this.createFindRFPAgent();
    this.agents.set('findrfp', findRFPAgent);
  }

  private createWebScrapingTool() {
    const executors: ToolExecutors = {
      unifiedBrowserbaseWebScrape: context =>
        this.unifiedBrowserbaseWebScrape(context),
      extractRFPData: context => this.extractRFPData(context),
      handleBrowserbaseAuthentication: context =>
        this.handleBrowserbaseAuthentication(context),
    };
    return createWebScrapingTool(executors);
  }

  private createRFPExtractionTool() {
    const executors: ToolExecutors = {
      unifiedBrowserbaseWebScrape: context =>
        this.unifiedBrowserbaseWebScrape(context),
      extractRFPData: context => this.extractRFPData(context),
      handleBrowserbaseAuthentication: context =>
        this.handleBrowserbaseAuthentication(context),
    };
    return createRFPExtractionTool(executors);
  }

  private createAuthenticationTool() {
    const executors: ToolExecutors = {
      unifiedBrowserbaseWebScrape: context =>
        this.unifiedBrowserbaseWebScrape(context),
      extractRFPData: context => this.extractRFPData(context),
      handleBrowserbaseAuthentication: context =>
        this.handleBrowserbaseAuthentication(context),
    };
    return createAuthenticationTool(executors);
  }

  private createGenericRFPAgent(): Agent {
    const tools = {
      webScrape: this.createWebScrapingTool(),
      extractRFP: this.createRFPExtractionTool(),
      authenticate: this.createAuthenticationTool(),
    };
    return createGenericRFPAgent(this.memory, tools);
  }

  private createBonfireAgent(): Agent {
    const tools = {
      webScrape: this.createWebScrapingTool(),
      extractRFP: this.createRFPExtractionTool(),
      authenticate: this.createAuthenticationTool(),
    };
    return createBonfireAgent(this.memory, tools);
  }

  private createSAMGovAgent(): Agent {
    const tools = {
      webScrape: this.createWebScrapingTool(),
      extractRFP: this.createRFPExtractionTool(),
      authenticate: this.createAuthenticationTool(),
    };
    return createSAMGovAgent(this.memory, tools);
  }

  private createFindRFPAgent(): Agent {
    const tools = {
      webScrape: this.createWebScrapingTool(),
      extractRFP: this.createRFPExtractionTool(),
      authenticate: this.createAuthenticationTool(),
    };
    return createFindRFPAgent(this.memory, tools);
  }

  async scrapeAllPortals(): Promise<void> {
    try {
      const publicPortals = await storage.getAllPortals();

      // Process portals in parallel with controlled concurrency
      const activePublicPortals = publicPortals.filter(
        portal => portal.status === 'active'
      );

      // Fetch portals with credentials
      const portalsWithCredentials = await Promise.all(
        activePublicPortals.map(p => storage.getPortalWithCredentials(p.id))
      );
      const activePortals = portalsWithCredentials.filter(
        (p): p is Portal => p !== undefined
      );

      const results = await Promise.allSettled(
        activePortals.map(portal => this.scrapePortal(portal))
      );

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(
            `Portal scraping failed for ${activePortals[index].name}:`,
            result.reason
          );
        }
      });
    } catch (error) {
      console.error(
        'Error in scrapeAllPortals:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Enhanced scraping method for individual RFP re-scraping
   * Uses Mastra/Browserbase integration with proper RFP ID preservation
   */
  async enhancedScrapeFromUrl(
    url: string,
    existingRfpId?: string
  ): Promise<EnhancedScrapingResult> {
    console.log(
      `🔄 Enhanced re-scraping of ${url}${
        existingRfpId ? ` for RFP ID: ${existingRfpId}` : ''
      }`
    );

    try {
      // Detect portal type from URL for specialized handling
      let portalType = 'generic';
      if (
        url.includes('financeonline.austintexas.gov') ||
        (url.includes('austin') && url.includes('finance'))
      ) {
        portalType = 'austin finance';
      } else if (url.includes('bonfire')) {
        portalType = 'bonfire';
      } else if (url.includes('sam.gov')) {
        portalType = 'sam.gov';
      }

      console.log(`🎯 Detected portal type: ${portalType}`);

      // Use intelligent web scraping for proper Mastra integration
      let documentsCount = 0;

      // Special handling for Austin Finance URLs
      if (portalType === 'austin finance') {
        console.log(
          `🎯 Austin Finance detected: Using specialized Austin Finance scraper`
        );
        try {
          // Use Austin Finance document scraper (already imported)
          const austinResult =
            await austinFinanceDocumentScraper.scrapeRFPDocuments(
              existingRfpId || '',
              url
            );

          if (austinResult && Array.isArray(austinResult)) {
            documentsCount = austinResult.length;
            console.log(
              `✅ Austin Finance scraper captured ${documentsCount} documents`
            );

            return {
              success: true,
              message: `Austin Finance RFP re-scraped successfully using specialized scraper`,
              documentsCount,
              opportunities: 1,
            };
          }
        } catch (austinError) {
          console.error(`❌ Austin Finance scraper failed:`, austinError);
          // Fall back to general scraping
        }
      }

      // Special handling for SAM.gov URLs - use Stagehand scraper (director.ai pattern)
      if (portalType === 'sam.gov') {
        console.log(
          `🎯 SAM.gov detected: Using Stagehand browser automation (director.ai pattern)`
        );
        try {
          // Primary approach: Use Stagehand scraper with page.extract() and page.act()
          const samGovScraper = getSAMGovStagehandScraper();
          const stagehandResult = await samGovScraper.scrapeOpportunity(url);

          if (stagehandResult.success && stagehandResult.rfpData) {
            console.log(
              `✅ SAM.gov Stagehand extraction successful: ${stagehandResult.rfpData.title}`
            );

            // Update existing RFP with extracted data if we have an RFP ID
            if (existingRfpId) {
              const rfpData = stagehandResult.rfpData;
              await storage.updateRFP(existingRfpId, {
                title: rfpData.title || undefined,
                description: rfpData.description || undefined,
                agency: rfpData.department || rfpData.office || undefined,
                deadline: rfpData.dateOffersDue
                  ? (() => {
                      const parsed = new Date(rfpData.dateOffersDue);
                      return isNaN(parsed.getTime()) ? undefined : parsed;
                    })()
                  : undefined,
                estimatedValue: rfpData.estimatedValue || undefined,
                naicsCode: rfpData.naicsCode || undefined,
                setAsideType: rfpData.setAside || undefined,
                pscCode: rfpData.productServiceCode || undefined,
                placeOfPerformance: rfpData.placeOfPerformance || undefined,
                solicitationNumber: rfpData.noticeId || undefined,
                status: 'parsing',
                progress: 25,
                updatedAt: new Date(),
                analysis: {
                  noticeId: rfpData.noticeId,
                  opportunityType: rfpData.opportunityType,
                  primaryContact: rfpData.primaryContact,
                  primaryContactEmail: rfpData.primaryContactEmail,
                  scrapedAt: new Date().toISOString(),
                  scraperVersion: 'stagehand-v1',
                },
              });
            }

            // Process downloaded documents if download was triggered
            if (
              stagehandResult.downloadTriggered &&
              stagehandResult.browserbaseSessionId &&
              existingRfpId
            ) {
              try {
                const { documentDownloadOrchestrator } = await import(
                  '../downloads/documentDownloadOrchestrator'
                );

                const docsResult =
                  await documentDownloadOrchestrator.processRfpDocuments({
                    rfpId: existingRfpId,
                    browserbaseSessionId: stagehandResult.browserbaseSessionId,
                    expectedDocuments: [],
                    retryForSeconds: this.DOCUMENT_RETRY_TIMEOUT_SECONDS,
                  });

                documentsCount = docsResult.totalDownloaded;
                console.log(
                  `✅ SAM.gov documents downloaded: ${documentsCount}`
                );
              } catch (docError) {
                console.warn(
                  `⚠️ Document download processing failed:`,
                  docError
                );
              }
            }

            return {
              success: true,
              message: `SAM.gov RFP scraped successfully using Stagehand automation`,
              documentsCount,
              opportunities: 1,
              rfpData: stagehandResult.rfpData,
            };
          }
        } catch (stagehandError) {
          console.warn(
            `⚠️ SAM.gov Stagehand scraper failed, trying API fallback:`,
            stagehandError
          );
        }

        // Fallback: Try API-based document downloader
        try {
          const noticeIdMatch = url.match(
            /opp\/([^/]+)|opp-([^/]+)|opportunity\/([^/]+)|workspace\/contract\/opp\/([^/]+)/i
          );
          const noticeId = noticeIdMatch
            ? noticeIdMatch[1] ||
              noticeIdMatch[2] ||
              noticeIdMatch[3] ||
              noticeIdMatch[4]
            : null;

          if (noticeId && existingRfpId) {
            console.log(
              `🔄 Trying SAM.gov API downloader for notice: ${noticeId}`
            );
            const samGovDocs = await this.samGovDownloader.downloadRFPDocuments(
              noticeId,
              existingRfpId
            );

            if (samGovDocs && Array.isArray(samGovDocs)) {
              documentsCount = samGovDocs.length;
              console.log(
                `✅ SAM.gov API downloader captured ${documentsCount} documents`
              );

              return {
                success: true,
                message: `SAM.gov RFP re-scraped successfully using API document downloader`,
                documentsCount,
                opportunities: 1,
              };
            }
          } else {
            console.log(
              `⚠️ Could not extract notice ID from SAM.gov URL: ${url}`
            );
          }
        } catch (samGovError) {
          console.error(`❌ SAM.gov API downloader also failed:`, samGovError);
          // Fall back to general scraping
        }
      }

      const scrapingResult = await this.intelligentWebScrape({
        url,
        portalType,
        loginRequired: false, // Assume public access for re-scraping
        searchFilter: undefined,
      });

      if (scrapingResult.error) {
        return {
          success: false,
          message: `Scraping failed: ${scrapingResult.error}`,
          documentsCount: 0,
        };
      }

      // Extract opportunities from the scraping result
      let opportunities: UnifiedScrapeResult['opportunities'] = [];
      if (
        scrapingResult.opportunities &&
        Array.isArray(scrapingResult.opportunities)
      ) {
        opportunities = scrapingResult.opportunities;
      }

      if (opportunities.length === 0) {
        console.log(
          `⚠️ No opportunities found from ${url}, attempting Browserbase fallback`
        );

        // Fallback: use Browserbase content scraping directly
        try {
          const sessionId = `rescrape-${Date.now()}`;
          const content = await this.scrapeBrowserbaseContent(
            url,
            sessionId,
            'extract RFP details, documents, and procurement information from this page'
          );

          // Create a basic opportunity from the extracted content - avoid overwriting existing data
          opportunities = [
            {
              title: '', // Will be preserved from existing RFP
              description: content.substring(0, 1000), // Limit description length
              url: url,
              agency: '', // Will be preserved from existing RFP
              deadline: undefined,
              estimatedValue: undefined,
            },
          ];

          console.log(`✅ Browserbase fallback successful`);
        } catch (fallbackError) {
          console.error(`❌ Browserbase fallback failed:`, fallbackError);
          return {
            success: false,
            message: `Both primary and fallback scraping failed`,
            documentsCount: 0,
          };
        }
      }

      // Process the first opportunity (should be the RFP we're re-scraping)
      if (opportunities.length > 0 && existingRfpId) {
        const opportunity = opportunities[0];

        console.log(
          `🔄 Updating existing RFP ${existingRfpId} with fresh data`
        );

        // Update the existing RFP with fresh data - preserve original title/agency if new data is generic
        const existingRfp = await storage.getRFP(existingRfpId);
        if (!existingRfp) {
          throw new Error(`RFP ${existingRfpId} not found`);
        }

        const shouldPreserveTitle =
          !opportunity.title ||
          opportunity.title === 'Re-scraped RFP' ||
          opportunity.title.length < 5;
        const shouldPreserveAgency =
          !opportunity.agency ||
          opportunity.agency === 'Unknown' ||
          opportunity.agency === 'Agency Information Being Updated';

        await storage.updateRFP(existingRfpId, {
          title: shouldPreserveTitle ? existingRfp.title : opportunity.title,
          description: opportunity.description || existingRfp.description,
          agency: shouldPreserveAgency
            ? existingRfp.agency
            : opportunity.agency,
          deadline: opportunity.deadline
            ? new Date(opportunity.deadline)
            : existingRfp.deadline,
          estimatedValue:
            opportunity.estimatedValue || existingRfp.estimatedValue,
          requirements: existingRfp.requirements || [],
          status: 'parsing',
          progress: 25,
          updatedAt: new Date(),
        });

        // Enhanced document detection and deduplication
        const existingDocs = await storage.getDocumentsByRFP(existingRfpId);
        console.log(
          `📄 Found ${existingDocs.length} existing documents for RFP ${existingRfpId}`
        );

        // Documents are processed separately through document download orchestrator
        // The opportunity object from UnifiedScrapeResult doesn't include documents
        // Document processing happens via browserbaseSessionId and documentDownloadOrchestrator
        // (see lines 350-380 for document download orchestration)
      }

      return {
        success: true,
        message: `Re-scraping completed successfully using Mastra/Browserbase`,
        documentsCount,
        opportunities: opportunities.length,
      };
    } catch (error) {
      console.error(`❌ Enhanced scraping failed for ${url}:`, error);
      return {
        success: false,
        message: `Enhanced scraping failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        documentsCount: 0,
      };
    }
  }

  /**
   * Helper method to detect file type from filename extension
   */
  private detectFileType(filename: string): string {
    const extension = filename.toLowerCase().split('.').pop();
    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'doc':
      case 'docx':
        return 'doc';
      case 'xls':
      case 'xlsx':
        return 'excel';
      case 'ppt':
      case 'pptx':
        return 'powerpoint';
      case 'txt':
        return 'txt';
      case 'rtf':
        return 'rtf';
      default:
        return 'unknown';
    }
  }

  async scrapePortal(
    portal: Portal,
    searchFilter?: string,
    incrementalScan?: boolean
  ): Promise<void> {
    const filterMessage = searchFilter ? ` with filter: "${searchFilter}"` : '';
    console.log(
      `Starting intelligent scrape of ${portal.name} using Mastra agents${filterMessage}`
    );

    try {
      // Update last scanned timestamp
      await storage.updatePortal(portal.id, {
        lastScanned: new Date(),
        status: 'active',
      });

      // SAM.gov special handling - use REST API directly instead of browser automation
      if (this.isSAMGovPortal(portal)) {
        console.log(
          `🏛️ SAM.gov detected: Using REST API for discovery (faster, more reliable)`
        );
        try {
          const opportunities = await this.scrapeViaSAMGovApi(
            portal,
            searchFilter
          );

          // Process discovered opportunities
          for (const opportunity of opportunities) {
            await this.processOpportunity(opportunity, portal, null);
          }

          console.log(
            `✅ SAM.gov API scrape completed: found ${opportunities.length} opportunities`
          );
          return;
        } catch (apiError) {
          console.error(
            `⚠️ SAM.gov API failed, falling back to browser automation:`,
            apiError
          );
          // Continue to browser automation as fallback
        }
      }

      // Select appropriate agent based on portal type
      const agent = this.selectAgent(portal);

      // Create scraping context with portal-specific knowledge and search filter
      const context = await this.buildPortalContext(portal, searchFilter);

      // Create coordination record for tracking agent performance
      let opportunities: UnifiedScrapeResult['opportunities'] = [];
      let coordinationId: string | null = null;

      try {
        // Create coordination request for this portal scraping session
        const sessionId = `portal-scrape-${portal.id}-${Date.now()}`;
        const agentId = this.getAgentIdForPortal(portal);

        console.log(
          `🤝 Creating coordination request for portal ${portal.name} with agent ${agentId}`
        );
        const coordinationRecord = await storage.createAgentCoordination({
          sessionId: sessionId,
          initiatorAgentId: 'mastra-scraping-service',
          targetAgentId: agentId,
          coordinationType: 'portal_scraping',
          context: context,
          request: {
            action: 'scrape_portal',
            portalId: portal.id,
            portalName: portal.name,
            searchFilter: searchFilter,
          },
          priority: 5,
          status: 'pending',
          metadata: {
            portalUrl: portal.url,
            requiresAuth: portal.loginRequired,
            startTime: new Date().toISOString(),
          },
        });

        coordinationId = coordinationRecord.id;
        if (coordinationId) {
          this.activeCoordinationIds.set(portal.id, coordinationId);
        }
        console.log(
          `✅ Coordination request created with ID: ${coordinationId}`
        );
      } catch (coordError) {
        console.error(
          `❌ Failed to create coordination request for ${portal.name}:`,
          coordError
        );
        // Continue without coordination tracking
      }

      if (portal.url.includes('austintexas.gov')) {
        console.log(
          `🎯 Austin Finance detected: Bypassing agent, using direct scraping only`
        );
        opportunities = []; // Force direct scraping path
      } else {
        // Execute intelligent scraping with enhanced coordination tracking
        try {
          console.log(`🚀 Using specialized agent for ${portal.name}`);
          const scrapingPrompt = this.buildScrapingPrompt(
            portal,
            context,
            searchFilter
          );
          const response = await agent.generate(scrapingPrompt, {
            resourceId: portal.id,
            threadId: `portal-${portal.id}-${Date.now()}`,
          });

          // Parse agent response and extract opportunities
          console.log(
            `🤖 Raw agent response (first 500 chars):`,
            response.text.substring(0, 500)
          );
          opportunities = this.parseAgentResponse(response.text);
          console.log(
            `🤖 parseAgentResponse returned ${opportunities.length} opportunities`
          );

          // Track successful agent execution
          console.log(
            `📊 Agent execution successful for ${portal.name}, ${opportunities.length} opportunities found`
          );
        } catch (agentError) {
          console.error(
            `🚨 Agent execution failed for ${portal.name}:`,
            agentError
          );
          console.log(`🔄 Falling back to direct scraping due to agent error`);

          // Update coordination with agent failure
          if (coordinationId) {
            try {
              await storage.updateAgentCoordination(coordinationId, {
                status: 'failed',
                response: JSON.stringify({
                  success: false,
                  error:
                    agentError instanceof Error
                      ? agentError.message
                      : String(agentError),
                  fallbackUsed: true,
                }),
                completedAt: new Date(),
              });
            } catch (updateError) {
              console.error(
                `❌ Failed to update coordination with agent failure:`,
                updateError
              );
            }
          }

          opportunities = []; // Force fallback to unified Browserbase scrape
        }
      }

      // If agent didn't call tools or returned no opportunities, call intelligentWebScrape directly
      if (opportunities.length === 0) {
        console.log(
          `🔄 Agent returned no opportunities, calling unified Browserbase scrape directly for ${portal.name}`
        );
        try {
          console.log(
            `🔄 Calling unifiedBrowserbaseWebScrape for ${portal.name}...`
          );
          const directScrapeResult = await this.unifiedBrowserbaseWebScrape({
            url: portal.url,
            loginRequired: portal.loginRequired,
            credentials: portal.loginRequired
              ? {
                  username: portal.username || undefined,
                  password: portal.password || undefined,
                }
              : undefined,
            portalType: portal.name.toLowerCase(),
            sessionId: `portal-${portal.id}-${Date.now()}`,
            searchFilter: searchFilter,
          });

          console.log(
            `🔄 unifiedBrowserbaseWebScrape completed. Result type:`,
            typeof directScrapeResult
          );
          console.log(
            `🔄 directScrapeResult has opportunities?`,
            directScrapeResult && 'opportunities' in directScrapeResult
          );
          console.log(
            `🔄 directScrapeResult.opportunities length:`,
            directScrapeResult?.opportunities?.length || 'undefined'
          );

          if (directScrapeResult && directScrapeResult.opportunities) {
            opportunities = directScrapeResult.opportunities;
            console.log(
              `✅ Direct scrape found ${opportunities.length} opportunities`
            );
          } else {
            console.log(
              `❌ No opportunities found in directScrapeResult:`,
              directScrapeResult
                ? Object.keys(directScrapeResult)
                : 'null/undefined'
            );
          }
        } catch (directScrapeError) {
          console.error(
            `Direct scrape failed for ${portal.name}:`,
            directScrapeError
          );
        }
      }

      // Process discovered opportunities with coordination tracking
      console.log(
        `🔧 Processing ${opportunities.length} opportunities for ${portal.name}`
      );
      for (let i = 0; i < opportunities.length; i++) {
        const opportunity = opportunities[i];
        console.log(
          `🔧 Processing opportunity ${i + 1}/${opportunities.length}: ${
            opportunity.title || 'Unknown'
          }`
        );
        try {
          // Ensure description is a string and confidence is a number for processOpportunity
          const processedOpportunity: z.infer<typeof OpportunitySchema> = {
            title: opportunity.title,
            description: opportunity.description || '',
            confidence: opportunity.confidence ?? 0.5,
            agency: opportunity.agency,
            deadline: opportunity.deadline,
            estimatedValue: opportunity.estimatedValue,
            url: opportunity.url,
            category: opportunity.category,
            solicitationId:
              'solicitationId' in opportunity &&
              typeof (opportunity as Record<string, unknown>).solicitationId ===
                'string'
                ? ((opportunity as Record<string, unknown>)
                    .solicitationId as string)
                : undefined,
          };
          await this.processOpportunity(
            processedOpportunity,
            portal,
            coordinationId
          );
          console.log(
            `✅ Successfully processed opportunity: ${opportunity.title}`
          );
        } catch (error) {
          console.error(
            `❌ Error processing opportunity ${opportunity.title}:`,
            error
          );
        }
      }

      // Finalize coordination with overall results
      if (coordinationId) {
        try {
          // Update coordination with final scraping results
          await storage.updateAgentCoordination(coordinationId, {
            status: 'completed',
            response: JSON.stringify({
              success: true,
              totalOpportunities: opportunities.length,
              portalName: portal.name,
              portalId: portal.id,
              searchFilter: searchFilter,
              agentUsed:
                opportunities.length > 0
                  ? 'specialized_agent'
                  : 'direct_scraping',
              scrapingMethod: portal.url.includes('austintexas.gov')
                ? 'direct_scraping'
                : 'agent_coordination',
              completedAt: new Date().toISOString(),
            }),
            completedAt: new Date(),
          });
          console.log(
            `🔗 Coordination ${coordinationId} completed with ${opportunities.length} opportunities`
          );
        } catch (finalizeError) {
          console.error(
            `❌ Failed to finalize coordination ${coordinationId}:`,
            finalizeError
          );
        } finally {
          this.activeCoordinationIds.delete(portal.id);
        }
      }

      console.log(
        `Completed intelligent scrape of ${portal.name}: found ${opportunities.length} opportunities`
      );
    } catch (error) {
      console.error(`Error in intelligent scraping ${portal.name}:`, error);

      // Capture to Sentry with detailed context
      withScope(scope => {
        scope.setTag('service', 'portal-scraping');
        scope.setTag('portal_id', portal.id);
        scope.setTag('portal_name', portal.name);
        scope.setTag('portal_url', portal.url);
        scope.setContext('portal_details', {
          portalId: portal.id,
          portalName: portal.name,
          portalUrl: portal.url,
          searchFilter: searchFilter,
          incrementalScan: incrementalScan ?? false,
        });
        scope.setLevel('error');
        captureException(error);
      });

      // Update portal status to indicate error
      await storage.updatePortal(portal.id, {
        status: 'error',
        lastScanned: new Date(),
      });

      // Create notification about scraping error
      await storage.createNotification({
        type: 'discovery',
        title: 'Portal Scraping Error',
        message: `Intelligent scraping failed for ${portal.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        relatedEntityType: 'portal',
        relatedEntityId: portal.id,
      });

      // Re-throw error to propagate to scan manager
      throw error;
    }
  }

  /**
   * Get agent ID string for coordination tracking based on portal type
   */
  private getAgentIdForPortal(portal: Portal): string {
    const portalName = portal.name.toLowerCase().replace(/\s+/g, '_');

    // Map portal names to agent IDs for coordination tracking
    if (portalName.includes('bonfire')) return 'bonfire_hub';
    if (portalName.includes('sam.gov') || portalName.includes('sam_gov'))
      return 'sam.gov';
    if (portalName.includes('findrfp')) return 'findrfp';
    if (portalName.includes('austin')) return 'generic'; // Austin uses direct scraping

    return 'generic';
  }

  private selectAgent(portal: Portal): Agent {
    const portalName = portal.name.toLowerCase().replace(/\s+/g, '_');

    // Try to find specialized agent first
    const specializedAgent = this.agents.get(portalName);
    if (specializedAgent) {
      return specializedAgent;
    }

    // Check for partial matches
    for (const [key, agent] of Array.from(this.agents.entries())) {
      if (key !== 'generic' && portalName.includes(key.split('_')[0])) {
        return agent;
      }
    }

    // Fall back to generic agent
    const genericAgent = this.agents.get('generic');
    if (!genericAgent) {
      throw new Error(
        'Generic agent not found. Agents must be initialized before use.'
      );
    }
    return genericAgent;
  }

  private async buildPortalContext(
    portal: Portal,
    searchFilter?: string
  ): Promise<string> {
    // Get historical context from memory and previous scrapes
    const recentRfps = await storage.getRFPsByPortal(portal.id);
    const recentCount = recentRfps.filter(rfp => {
      const daysSinceCreated =
        (Date.now() - new Date(rfp.updatedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      return daysSinceCreated <= 30;
    }).length;

    const searchFilterInfo = searchFilter
      ? `
    - Search Filter: "${searchFilter}" - Focus only on opportunities related to this term`
      : '';

    return `Portal Context:
    - Name: ${portal.name}
    - URL: ${portal.url}
    - Requires Login: ${portal.loginRequired}
    - Recent RFPs Found: ${recentCount} in last 30 days
    - Portal Status: ${portal.status}
    - Last Successful Scan: ${portal.lastScanned || 'Never'}${searchFilterInfo}`;
  }

  private buildScrapingPrompt(
    portal: Portal,
    context: string,
    searchFilter?: string
  ): string {
    // Build specialized prompt based on portal type
    const isAustinFinance = portal.name
      .toLowerCase()
      .includes('austin finance');

    const austinFinanceFilterInstructions = searchFilter
      ? `

🔍 SEARCH FILTER ACTIVE: Only extract solicitations related to "${searchFilter}"
- Filter results to only include RFPs with titles/descriptions containing or related to "${searchFilter}"
- Ignore solicitations that are not related to this search term
- If no results match the filter, return an empty array`
      : '';

    if (isAustinFinance) {
      return `Please scrape the Austin Finance Online portal for procurement opportunities:

${context}

IMPORTANT: You are analyzing the ACTIVE SOLICITATIONS page which contains a table/list of current RFPs.${austinFinanceFilterInstructions}

Your task:
1. Look for the "ACTIVE SOLICITATIONS" table or list on the page
2. Each row contains solicitation information in this pattern:
   - Solicitation ID (e.g. "IFQ 1100 BAS1065", "RFP 8100 SAR3013")
   - Due Date (e.g. "09/12/2025 at 2PM") 
   - Title/Description (e.g. "Gearbox, Unit 6 & 7 Cooling Tower Fan")
   - Detailed description paragraph
3. Extract ALL solicitations from the table/list${
        searchFilter ? ` that match the search filter "${searchFilter}"` : ''
      }
4. For each opportunity, extract:
   - Title (from the bold title line)
   - Solicitation ID (the code like IFQ/IFB/RFP + numbers)
   - Due Date (convert to ISO format)
   - Description (full description text)
   - Agency: "City of Austin"
   - Source URL: Construct detail URL if provided (e.g. solicitation_details.cfm?sid=XXXXX)
   - Category: Based on solicitation type (IFQ=Quote, IFB=Bid, RFP=Proposal)

Look specifically for table rows or list items that contain solicitation codes like "IFQ", "IFB", "RFP", "RFQS" followed by numbers.

Return results as structured JSON array with all found solicitations.`;
    }

    const generalFilterInstructions = searchFilter
      ? `

🔍 SEARCH FILTER ACTIVE: Only look for opportunities related to "${searchFilter}"
- If the portal has a search function, use it to search for "${searchFilter}"
- Filter results to only include RFPs that contain or are related to "${searchFilter}"
- Ignore opportunities that are not related to this search term
- If no results match the filter, return an empty array`
      : '';

    return `Please scrape the following RFP portal for procurement opportunities:

${context}${generalFilterInstructions}

Your task:
1. Navigate to the portal URL: ${portal.url}
${
  portal.loginRequired
    ? `2. Authenticate using provided credentials`
    : '2. Access public listings'
}
3. Find all available RFP/procurement opportunities${
      searchFilter ? ` related to "${searchFilter}"` : ''
    }
4. Extract key information for each opportunity:
   - Title
   - Agency/Organization
   - Deadline/Due Date
   - Estimated Value (if available)
   - Description/Summary
   - Source URL/Link - **CRITICAL: Extract the SPECIFIC detail page URL for each RFP, not category/listing page URLs**
   - Category/Type

IMPORTANT URL EXTRACTION RULES:
- For FindRFP: Look for specific RFP detail URLs like "detail.aspx?rfpid=" or "service/detail.aspx?rfpid=" 
- For Bonfire: Extract direct solicitation URLs with specific IDs
- For SAM.gov: Get specific opportunity detail URLs with opportunity IDs
- NEVER use generic category URLs like "/construction-contracts/", "/services/", or listing page URLs
- If only a category URL is found, try to navigate to the specific opportunity detail page and get that URL
- Each RFP must have a unique, specific detail page URL that leads directly to that opportunity

Focus on active, open opportunities only. Return results as structured JSON with confidence scores.

Use your specialized knowledge of this portal type to navigate efficiently and extract accurate data.`;
  }

  private parseAgentResponse(
    response: string
  ): z.infer<typeof OpportunitySchema>[] {
    try {
      console.log('🤖 Parsing AI agent response...');
      console.log(`📝 Agent response length: ${response.length} characters`);

      // First, try to extract JSON blocks from the response
      const jsonBlocks = this.extractJsonBlocks(response);
      console.log(`🔍 Found ${jsonBlocks.length} JSON blocks in response`);

      for (const jsonBlock of jsonBlocks) {
        try {
          const parsedData = JSON.parse(jsonBlock);

          // Validate against our schema
          const validationResult = AgentResponseSchema.safeParse(parsedData);

          if (validationResult.success) {
            const data = validationResult.data;

            // Handle different response formats
            if ('opportunities' in data && Array.isArray(data.opportunities)) {
              return data.opportunities;
            }
            if ('results' in data && Array.isArray(data.results)) {
              return data.results;
            }
            // Single opportunity object
            if ('title' in data) {
              return [data];
            }
          } else {
            console.warn(
              'JSON validation failed:',
              validationResult.error.issues
            );
          }
        } catch (parseError) {
          console.warn('Failed to parse JSON block:', parseError);
          continue;
        }
      }

      console.warn('No valid JSON opportunities found in agent response');
      console.log(
        `🚨 Agent response (first 1000 chars):`,
        response.substring(0, 1000)
      );
      return [];
    } catch (error) {
      console.error('Error parsing agent response:', error);
      return [];
    }
  }

  private async intelligentWebScrape(
    context: UnifiedScrapeContext
  ): Promise<UnifiedScrapeResult> {
    return await this.requestLimiter(async () => {
      try {
        const { url, loginRequired, credentials, searchFilter } = context;

        // Auto-detect portal type based on URL if not provided or unclear
        let portalType = context.portalType;
        if (!portalType || portalType === 'generic') {
          if (
            url.includes('financeonline.austintexas.gov') ||
            (url.includes('austin') && url.includes('finance'))
          ) {
            portalType = 'austin finance';
          } else if (url.includes('bonfire')) {
            portalType = 'bonfire';
          } else if (url.includes('sam.gov')) {
            portalType = 'sam.gov';
          } else if (url.includes('findrfp')) {
            portalType = 'findrfp';
          }
        }

        // Ensure portalType is never undefined to prevent toLowerCase() errors
        portalType = portalType || 'generic';

        console.log(`🔍 Portal type detected: ${portalType} for ${url}`);
        const filterMessage = searchFilter
          ? ` with search filter: "${searchFilter}"`
          : '';
        console.log(
          `🔍 Starting intelligent scrape of ${url} (portal type: ${portalType})${filterMessage}`
        );

        // Step 1: Fetch the page content
        let sessionData: SessionData | null = null;
        if (loginRequired && credentials) {
          sessionData = await this.handleAuthentication({
            portalUrl: url,
            username: credentials.username || '',
            password: credentials.password || '',
            sessionId: 'default',
            portalType: portalType || 'generic',
          });

          if (!sessionData.authenticated) {
            throw new Error(`Authentication failed for ${url}`);
          }
        }

        // Step 2: Fetch main portal page with optimized session handling
        let html: string;
        let structuredData: StructuredScrapingData | null = null;

        if (
          portalType.toLowerCase().includes('austin') &&
          portalType.toLowerCase().includes('finance')
        ) {
          console.log(
            `🌐 Austin Finance detected: Using enhanced Browserbase scraping`
          );
          const sessionId = `austin-finance-${Date.now()}`;
          html = await this.scrapeBrowserbaseContent(
            url,
            sessionId,
            'extract Austin Finance RFP content and document links'
          );
        } else if (
          sessionData?.sessionId &&
          sessionData?.method === 'browser_authentication'
        ) {
          // Use authenticated browser session for content extraction instead of falling back to HTTP
          console.log(
            `🌐 Using authenticated browser session for content extraction: ${sessionData.sessionId}`
          );
          const sessionResult = await this.scrapeWithAuthenticatedSession(
            url,
            sessionData.sessionId
          );

          if (sessionResult.isStructured && sessionResult.opportunities) {
            console.log(
              `🎯 Using structured data from Stagehand extraction: ${sessionResult.opportunities.length} opportunities`
            );
            structuredData = { opportunities: sessionResult.opportunities };
            html = ''; // No HTML needed for structured data
          } else {
            html = sessionResult.html || '';
          }
        } else {
          // Use Browserbase for reliable portal scraping
          // HTTP with undici can hang indefinitely on response.body.text() for certain portals
          console.log(`🌐 Using Browserbase for reliable portal scraping`);
          const sessionId = `scrape-${Date.now()}`;
          html = await this.scrapeBrowserbaseContent(
            url,
            sessionId,
            'extract all page content including RFP details, documents, and links'
          );
        }

        console.log(`📄 Fetched ${html.length} characters of HTML content`);

        // Step 3: Parse HTML content with Cheerio (skip if we have structured data)
        let $: cheerio.CheerioAPI | null = null;
        let extractedContent: ExtractedContent | null = null;

        if (structuredData && structuredData.opportunities) {
          // Use structured data directly from Stagehand extraction
          console.log(
            `🎯 Using structured data directly: ${structuredData.opportunities.length} opportunities`
          );
          extractedContent = {
            title: '',
            headings: [],
            links: [],
            text: '',
            opportunities:
              structuredData.opportunities?.map(opp => ({
                title: opp.title || '',
                description: opp.description,
                agency: opp.agency,
                deadline: opp.deadline,
                estimatedValue: opp.estimatedValue,
                url: opp.url,
              })) || [],
          };
        } else if (html) {
          // Parse HTML content with Cheerio for traditional extraction
          $ = cheerio.load(html);
          console.log(
            `🔧 Parsed HTML with Cheerio, found ${$('*').length} elements`
          );

          // Step 4: Extract structured content based on portal type
          console.log(`🎯 Extracting content for portal type: ${portalType}`);
          extractedContent = this.extractContentByPortalType(
            $,
            portalType,
            url
          );
        } else {
          // No data available
          console.log(`⚠️ No HTML content or structured data available`);
          extractedContent = {
            title: '',
            headings: [],
            links: [],
            text: '',
            opportunities: [],
          };
        }

        console.log(
          `📊 Extracted ${
            extractedContent?.opportunities?.length || 0
          } opportunities from content`
        );

        // Step 5: Look for RFP/opportunity links to fetch additional details (skip if we have structured data)
        let opportunityLinks: Array<{
          url: string;
          text?: string;
          title?: string;
          type?: string;
        }> = [];
        if (structuredData && structuredData.opportunities) {
          // Extract links from structured opportunities if available
          console.log(`🔗 Extracting links from structured data...`);
          opportunityLinks = structuredData.opportunities
            .map(opp => ({
              url: (opp.link || opp.url || '') as string,
              title: opp.title,
              type: 'opportunity',
            }))
            .filter(link => link.url && typeof link.url === 'string');
        } else if ($) {
          // Traditional HTML link extraction
          console.log(`🔗 Looking for opportunity links...`);
          // Legacy opportunity link finding replaced by enhanced Stagehand extraction
          opportunityLinks = [];
        }
        console.log(
          `🎯 Found ${
            opportunityLinks?.length || 0
          } potential opportunity links`
        );

        // Step 6: Fetch additional opportunity details (skip if we have structured data with sufficient detail)
        let detailedOpportunities: UnifiedScrapeResult['opportunities'] = [];
        if (structuredData && structuredData.opportunities) {
          // Skip fetching additional details for structured data since Stagehand extraction is comprehensive
          console.log(
            `⏭️ Skipping detail fetching - structured data from Stagehand is comprehensive`
          );
          detailedOpportunities = [];
        } else {
          // Fetch additional opportunity details for traditional HTML extraction
          console.log(
            `📥 Fetching details for ${Math.min(
              opportunityLinks?.length || 0,
              10
            )} opportunities...`
          );
          const detailFetches = await Promise.allSettled(
            (opportunityLinks || []).slice(0, 10).map(
              (
                link // Limit to 10 opportunities per scrape
              ) => this.fetchOpportunityDetails(link.url, sessionData)
            )
          );
          detailedOpportunities = detailFetches
            .filter(result => result.status === 'fulfilled')
            .map(
              result =>
                (
                  result as PromiseFulfilledResult<
                    UnifiedScrapeResult['opportunities'][0]
                  >
                ).value
            )
            .filter(
              (opp): opp is UnifiedScrapeResult['opportunities'][0] =>
                opp !== null
            );
        }

        console.log(
          `✅ Successfully fetched ${detailedOpportunities.length} detailed opportunities`
        );

        // Merge detailed opportunities with extracted opportunities - critical fix!
        const extractedOpportunities = extractedContent?.opportunities || [];
        const allOpportunities = [
          ...detailedOpportunities,
          ...extractedOpportunities,
        ];

        // Remove duplicates based on solicitationId or title first, then link/url
        // This prevents collapsing multiple opportunities due to shared generic list URLs
        const uniqueOpportunities = allOpportunities.filter(
          (opportunity, index, arr) => {
            const identifier = opportunity.title || opportunity.url;
            return (
              arr.findIndex(o => (o.title || o.url) === identifier) === index
            );
          }
        );

        // Apply search filter if provided (post-processing filtering)
        let finalOpportunities = uniqueOpportunities;
        if (searchFilter && searchFilter.trim()) {
          const filterTerm = searchFilter.toLowerCase().trim();
          const beforeFilterCount = finalOpportunities.length;

          finalOpportunities = uniqueOpportunities.filter(opportunity => {
            const title = (opportunity.title || '').toLowerCase();
            const description = (opportunity.description || '').toLowerCase();
            const agency = (opportunity.agency || '').toLowerCase();
            const category = String(opportunity.category || '').toLowerCase();

            return (
              title.includes(filterTerm) ||
              description.includes(filterTerm) ||
              agency.includes(filterTerm) ||
              category.includes(filterTerm)
            );
          });

          console.log(
            `🔍 Search filter "${searchFilter}" applied: ${beforeFilterCount} → ${finalOpportunities.length} opportunities`
          );
        }

        console.log(
          `🔄 intelligentWebScrape returning ${
            finalOpportunities.length
          } opportunities (${detailedOpportunities.length} detailed + ${
            extractedOpportunities.length
          } extracted, ${
            allOpportunities.length - uniqueOpportunities.length
          } duplicates removed${
            searchFilter ? `, filtered from ${uniqueOpportunities.length}` : ''
          })`
        );

        return {
          opportunities: finalOpportunities.map(opp => ({
            title: opp.title || '',
            description: opp.description,
            agency: opp.agency,
            deadline: opp.deadline,
            estimatedValue: opp.estimatedValue,
            url: opp.url,
            category:
              typeof opp.category === 'string' ? opp.category : undefined,
            confidence:
              typeof opp.confidence === 'number' ? opp.confidence : undefined,
          })),
          status: 'success',
          portalType,
          scrapedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error(
          `Error in intelligentWebScrape for ${context.url}:`,
          error
        );
        return {
          opportunities: [],
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
          portalType: context.portalType,
        };
      }
    });
  }

  private async extractRFPData(
    context: ExtractRFPDataContext
  ): Promise<unknown> {
    // Use AI to extract structured RFP data from content with rate limiting
    return await this.aiLimiter(async () => {
      try {
        return await this.aiService.extractRFPDetails(
          context.content,
          context.url
        );
      } catch (error) {
        console.error('AI extraction error:', error);
        throw error;
      }
    });
  }

  // Removed duplicate getWithRedirects method - using the improved version with loop detection

  private async handleAuthentication(
    context: AuthenticationContext
  ): Promise<SessionData> {
    return await this.requestLimiter(async () => {
      try {
        const { portalUrl, username, password, authContext } = context;

        console.log(`Attempting authentication for ${portalUrl}`);

        // Step 1: Let all portals go through standard detection to route browser automation properly

        // Step 1: Determine the actual login page URL for other portals
        const loginUrl = portalUrl;

        // Step 2: Fetch login page with proper redirect and cookie handling
        const { finalResponse, finalUrl, cookieHeader } =
          await this.getWithRedirects(loginUrl);

        // Check final response status
        if (finalResponse.statusCode !== 200) {
          // HTTP 403 or 401 typically indicates authentication is required - route to browser automation
          if (
            finalResponse.statusCode === 403 ||
            finalResponse.statusCode === 401
          ) {
            console.log(
              `🌐 Browser authentication required: HTTP ${finalResponse.statusCode} - portal requires authentication`
            );
            return await this.handleBrowserAuthentication({
              portalUrl: finalUrl,
              username,
              password,
              sessionId: 'default',
              portalType:
                typeof authContext === 'string' ? authContext : undefined,
            });
          }
          throw new Error(
            `Login page fetch failed after following redirects: HTTP ${finalResponse.statusCode} from ${finalUrl}`
          );
        }

        const loginPageHtml = await finalResponse.body.text();
        const $ = cheerio.load(loginPageHtml);

        // Step 2: Analyze authentication method
        const authMethod = this.detectAuthenticationMethod($, portalUrl);

        if (authMethod.type === 'none') {
          return {
            authenticated: true,
            method: 'no_auth_required',
            portalUrl,
          };
        }

        if (authMethod.type === 'unknown') {
          return {
            authenticated: false,
            error: 'Unsupported authentication method detected',
            method: authMethod.details,
            portalUrl,
          };
        }

        // Step 3: Handle form-based authentication
        if (authMethod.type === 'form') {
          return await this.handleFormAuthentication({
            $,
            portalUrl: finalUrl, // Use final URL after redirects
            username,
            password,
            formData: authMethod.formData,
            loginPageResponse: finalResponse, // Use final response after redirects
            cookieHeader, // Pass accumulated cookies from redirect chain
          });
        }

        // Step 4: Handle browser-based authentication (OAuth/SSO/Complex forms)
        if (authMethod.type === 'browser_required') {
          console.log(
            `🌐 Browser authentication required: ${authMethod.details}`
          );
          return await this.handleBrowserAuthentication({
            portalUrl: finalUrl,
            username,
            password,
            sessionId: 'default',
            portalType:
              typeof authContext === 'string' ? authContext : undefined,
          });
        }

        // Step 5: Handle other authentication types
        return {
          authenticated: false,
          error: `Authentication type '${authMethod.type}' not yet implemented`,
          method: authMethod.type,
          portalUrl,
        };
      } catch (error) {
        console.error(`Authentication error for ${context.portalUrl}:`, error);
        return {
          authenticated: false,
          error: error instanceof Error ? error.message : String(error),
          method: 'error',
          portalUrl: context.portalUrl,
        };
      }
    });
  }

  private async processOpportunity(
    opportunity: z.infer<typeof OpportunitySchema>,
    portal: Portal,
    coordinationId?: string | null
  ): Promise<void> {
    console.log(
      `🎯 Starting processOpportunity for: ${
        opportunity.title || opportunity.solicitationId
      } from ${portal.name}`
    );
    try {
      // Enhanced AI analysis with confidence scoring
      console.log(`🤖 Calling AI analysis for: ${opportunity.title}`);
      const rfpDetails = await this.aiService.extractRFPDetails(
        opportunity.description || '',
        opportunity.url || ''
      );
      console.log(
        `🤖 AI analysis completed. Result:`,
        rfpDetails
          ? `Confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%`
          : 'NULL'
      );

      // Lower confidence threshold for Austin Finance and FindRFP portals
      // FindRFP opportunities are already validated by Stagehand AI extraction
      const confidenceThreshold = portal.name.toLowerCase().includes('austin')
        ? 0.4
        : portal.url.includes('findrfp')
          ? 0.3 // Lower threshold for FindRFP since Stagehand already validated
          : 0.7;

      if (!rfpDetails) {
        console.log(
          `🚫 Skipping opportunity - AI returned null: ${opportunity.title}`
        );
        return;
      }

      if (rfpDetails.confidence < confidenceThreshold) {
        console.log(
          `🚫 Skipping low-confidence opportunity: ${opportunity.title} (confidence: ${(
            rfpDetails.confidence * 100
          ).toFixed(
            1
          )}%, threshold: ${(confidenceThreshold * 100).toFixed(1)}%)`
        );
        return;
      }

      console.log(
        `✅ AI analysis passed: ${opportunity.title} (confidence: ${(rfpDetails.confidence * 100).toFixed(1)}%)`
      );

      // Validate and fix sourceUrl - ensure it points to specific RFP detail page
      const sourceUrl = this.validateAndFixSourceUrl(
        opportunity.url || '',
        portal,
        opportunity
      );
      if (!sourceUrl) {
        console.log(
          `🚫 Skipping opportunity - invalid or generic URL: ${opportunity.url || 'missing'}`
        );
        return;
      }

      // Check for duplicates
      const existingRfps = await storage.getRFPsByPortal(portal.id);
      const exists = existingRfps.some(
        rfp => rfp.title === rfpDetails.title || rfp.sourceUrl === sourceUrl
      );

      if (exists) {
        return;
      }

      // Create new RFP with enhanced data
      const rfp = await storage.createRFP({
        title: rfpDetails.title,
        description: rfpDetails.description,
        agency: rfpDetails.agency || opportunity.agency,
        portalId: portal.id,
        sourceUrl: sourceUrl,
        deadline: rfpDetails.deadline ? new Date(rfpDetails.deadline) : null,
        estimatedValue: rfpDetails.estimatedValue?.toString(),
        status: 'discovered',
        progress: 0,
      });

      // Link RFP to coordination log if coordination ID was provided
      if (coordinationId) {
        try {
          await storage.updateAgentCoordination(coordinationId, {
            status: 'completed',
            response: JSON.stringify({
              success: true,
              rfpCreated: true,
              rfpId: rfp.id,
              rfpTitle: rfp.title,
              confidence: rfpDetails.confidence,
            }),
            completedAt: new Date(),
          });
          console.log(
            `🔗 Linked RFP ${rfp.id} to coordination log ${coordinationId}`
          );
        } catch (linkError) {
          console.error(
            `❌ Failed to link RFP to coordination log:`,
            linkError
          );
          // Continue with RFP creation even if linking fails
        }
      }

      // Download documents for Austin Finance RFPs
      if (portal.url.includes('austintexas.gov') && sourceUrl) {
        try {
          console.log(
            `📄 Downloading documents for Austin Finance RFP: ${rfp.title}`
          );
          const documents =
            await austinFinanceDocumentScraper.scrapeRFPDocuments(
              rfp.id,
              sourceUrl
            );
          console.log(
            `✅ Downloaded ${documents.length} documents for RFP ${rfp.id}`
          );

          // Analyze documents to identify what needs to be filled out
          const analysis =
            await austinFinanceDocumentScraper.analyzeDocumentsForFillOut(
              rfp.id
            );
          console.log(`📊 Document analysis complete:\n${analysis.summary}`);
        } catch (error) {
          console.error(
            `❌ Failed to download documents for RFP ${rfp.id}:`,
            error
          );
          // Continue with RFP creation even if document download fails
        }
      }

      // Download documents for SAM.gov RFPs
      // Extract notice ID from URL or use solicitationNumber from rfpDetails
      const noticeId =
        rfpDetails.solicitationNumber ||
        (opportunity.url ? this.extractSAMGovNoticeId(opportunity.url) : null);
      if (
        (portal.url.includes('sam.gov') ||
          shouldUseSAMGovExtraction(portal.type, portal.url)) &&
        noticeId
      ) {
        try {
          console.log(
            `📄 Downloading documents for SAM.gov RFP: ${rfp.title} (Notice ID: ${noticeId})`
          );
          const documents = await this.samGovDownloader.downloadRFPDocuments(
            noticeId,
            rfp.id
          );
          console.log(
            `✅ Downloaded ${documents.length} documents for SAM.gov RFP ${rfp.id}`
          );
        } catch (error) {
          console.error(
            `❌ Failed to download SAM.gov documents for RFP ${rfp.id}:`,
            error
          );
          // Continue with RFP creation even if document download fails
        }
      }

      // Create audit log
      await storage.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'discovered',
        details: {
          portal: portal.name,
          sourceUrl: sourceUrl,
          confidence: rfpDetails.confidence,
          agent: this.selectAgent(portal).name,
        },
      });

      // Create notification
      await storage.createNotification({
        type: 'discovery',
        title: 'New RFP Discovered',
        message: `AI agent found: ${rfp.title} from ${rfp.agency}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      console.log(`🎉 AI agent created new RFP: ${rfp.title} (ID: ${rfp.id})`);
      console.log(`💾 Successfully saved RFP to database with ID: ${rfp.id}`);
    } catch (error) {
      console.error('Error processing opportunity:', error);
    }
  }

  /**
   * Validate and fix source URLs to ensure they point to specific RFP detail pages
   * instead of generic category or listing pages
   */
  private validateAndFixSourceUrl(
    url: string,
    portal: Portal,
    opportunity: z.infer<typeof OpportunitySchema>
  ): string | null {
    if (!url) {
      console.log(`🚫 No URL provided for opportunity: ${opportunity.title}`);
      return null;
    }

    console.log(`🔍 Validating URL for ${portal.name}: ${url}`);

    // List of generic/category URL patterns that should be rejected
    const genericPatterns = [
      '/construction-contracts/',
      '/services/',
      '/bids/',
      '/rfps/',
      '/opportunities/',
      '/solicitations/',
      'bid.aspx$', // Generic bid page without specific ID
      'rfp.aspx$', // Generic RFP page without specific ID
      'search.aspx', // Search result pages
      'category.aspx', // Category pages
      'browse.aspx', // Browse pages
    ];

    // Check if URL is a generic category URL
    for (const pattern of genericPatterns) {
      if (url.match(new RegExp(pattern, 'i'))) {
        console.log(`🚫 Rejecting generic URL pattern "${pattern}": ${url}`);
        return null;
      }
    }

    // Portal-specific URL validation and fixing
    if (portal.url.includes('findrfp.com')) {
      return this.validateFindRFPUrl(url, opportunity);
    } else if (portal.url.includes('austintexas.gov')) {
      return this.validateAustinFinanceUrl(url, opportunity);
    } else if (portal.url.includes('bonfire')) {
      return this.validateBonfireUrl(url, opportunity);
    } else if (portal.url.includes('sam.gov')) {
      return this.validateSAMGovUrl(url, opportunity);
    }

    // For other portals, basic validation
    return this.validateGenericUrl(url, opportunity);
  }

  private validateFindRFPUrl(
    url: string,
    opportunity: z.infer<typeof OpportunitySchema>
  ): string | null {
    // FindRFP specific URLs must contain detail pages with rfpid parameter
    if (
      url.includes('detail.aspx?rfpid=') ||
      url.includes('service/detail.aspx?rfpid=')
    ) {
      console.log(`✅ Valid FindRFP detail URL: ${url}`);
      return url;
    }

    // Try to construct a proper URL if we have an RFP ID
    const rfpId = this.extractRFPId(opportunity);
    if (rfpId && url.includes('findrfp.com')) {
      const baseUrl = 'https://findrfp.com/service/detail.aspx';
      const constructedUrl = `${baseUrl}?rfpid=${rfpId}&s=${encodeURIComponent(
        opportunity.title || 'RFP'
      )}&t=CA&ID=${Date.now()}`;
      console.log(`🔧 Constructed FindRFP URL: ${constructedUrl}`);
      return constructedUrl;
    }

    console.log(`🚫 Invalid FindRFP URL (missing rfpid): ${url}`);
    return null;
  }

  private validateAustinFinanceUrl(
    url: string,
    opportunity: z.infer<typeof OpportunitySchema>
  ): string | null {
    // Austin Finance URLs must contain solicitation_details.cfm with sid parameter
    if (url.includes('solicitation_details.cfm?sid=')) {
      console.log(`✅ Valid Austin Finance detail URL: ${url}`);
      return url;
    }

    // Try to construct a proper URL if we have a solicitation ID
    const solicitationId = this.extractSolicitationId(opportunity);
    if (solicitationId) {
      const baseUrl =
        'https://financeonline.austintexas.gov/afo/account_services/solicitation/solicitation_details.cfm';
      const constructedUrl = `${baseUrl}?sid=${solicitationId}`;
      console.log(`🔧 Constructed Austin Finance URL: ${constructedUrl}`);
      return constructedUrl;
    }

    console.log(`🚫 Invalid Austin Finance URL (missing sid): ${url}`);
    return null;
  }

  private validateBonfireUrl(
    url: string,
    _opportunity?: z.infer<typeof OpportunitySchema>
  ): string | null {
    // Bonfire URLs typically contain opportunity or bid IDs
    if (
      url.includes('/opportunities/') ||
      url.includes('/bids/') ||
      url.includes('opportunity_id=') ||
      url.includes('bid_id=')
    ) {
      console.log(`✅ Valid Bonfire detail URL: ${url}`);
      return url;
    }

    console.log(`🚫 Invalid Bonfire URL (missing specific ID): ${url}`);
    return null;
  }

  private validateSAMGovUrl(
    url: string,
    _opportunity?: z.infer<typeof OpportunitySchema>
  ): string | null {
    const result = validateSAMGovUrl(url);
    // Handle workspace URL error - treat as invalid for automated scanning
    if (result && typeof result === 'object' && 'error' in result) {
      console.log(`🚫 SAM.gov workspace URL detected (requires auth): ${url}`);
      console.log(`💡 Suggested public URL: ${result.suggestedUrl}`);
      return null;
    }
    return result;
  }

  private validateGenericUrl(
    url: string,
    _opportunity?: z.infer<typeof OpportunitySchema>
  ): string | null {
    // For generic portals, ensure URL contains some form of ID or specific identifier
    const hasId =
      /[?&](id|rfp|bid|opp|solicitation)=/i.test(url) ||
      /\/\d+\/?$/.test(url) || // Ends with numeric ID
      /[?&]\w+id=\w+/i.test(url); // Contains some form of ID parameter

    if (hasId) {
      console.log(`✅ Valid generic detail URL: ${url}`);
      return url;
    }

    console.log(`🚫 Invalid generic URL (no specific ID found): ${url}`);
    return null;
  }

  private extractRFPId(
    opportunity: z.infer<typeof OpportunitySchema> & { [key: string]: unknown }
  ): string | null {
    // Try to extract RFP ID from various fields
    const opp = opportunity as { [key: string]: unknown };
    const idSources = [
      opp.rfpId as string | undefined,
      opp.id as string | undefined,
      opportunity.solicitationId,
      opp.opportunityId as string | undefined,
    ];

    for (const id of idSources) {
      if (id && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }

    // Try to extract from title or description
    const text = `${opportunity.title || ''} ${opportunity.description || ''}`;
    const idMatch = text.match(/(?:RFP|ID|rfpid)[:\s]*([A-Z0-9-]+)/i);
    if (idMatch) {
      return idMatch[1];
    }

    return null;
  }

  private extractSolicitationId(
    opportunity: z.infer<typeof OpportunitySchema> & { [key: string]: unknown }
  ): string | null {
    // Try to extract solicitation ID from various fields
    const opp = opportunity as { [key: string]: unknown };
    const idSources = [
      opportunity.solicitationId,
      opp.sid as string | undefined,
      opp.id as string | undefined,
      opp.rfpId as string | undefined,
    ];

    for (const id of idSources) {
      if (id && typeof id === 'string' && id.trim()) {
        return id.trim();
      }
    }

    // Try to extract from title (Austin Finance format: IFQ 1100 BAS1065)
    const title = opportunity.title || '';
    const solicitationMatch = title.match(/(?:IFQ|IFB|RFP|RFQS)\s+\d+\s+\w+/i);
    if (solicitationMatch) {
      // Look for a numeric ID that might be the solicitation ID
      const numericMatch = title.match(/\b\d{5,}\b/);
      if (numericMatch) {
        return numericMatch[0];
      }
    }

    return null;
  }

  private redactSensitiveCookies(cookies: string | null): string {
    if (!cookies) return 'None';

    // Redact sensitive cookie values but keep structure for debugging
    return cookies.replace(
      /(csrf[^=]*|session[^=]*|bm[^=]*)=([^;]+)/gi,
      '$1=[REDACTED]'
    );
  }

  private mergeCookies(
    existingCookies: string | null,
    newCookies: string | null
  ): string | null {
    if (!existingCookies && !newCookies) return null;
    if (!existingCookies) return newCookies;
    if (!newCookies) return existingCookies;

    // Parse existing cookies
    const cookieMap = new Map<string, string>();

    existingCookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap.set(name, value);
      }
    });

    // Add/update with new cookies
    newCookies.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookieMap.set(name, value);
      }
    });

    // Convert back to string
    return Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  private async getWithRedirects(
    url: string,
    maxRedirects: number = 10,
    initialCookies?: string | null
  ): Promise<{
    finalResponse: HttpResponseWrapper;
    finalUrl: string;
    cookieHeader: string | null;
  }> {
    let currentUrl = url;
    let redirectCount = 0;
    let currentResponse: HttpResponseWrapper | undefined;
    const cookies = new Map<string, string>();
    const visitedUrls = new Set<string>();

    // Initialize with any existing cookies
    if (initialCookies) {
      initialCookies.split(';').forEach(cookie => {
        const [name, value] = cookie.trim().split('=');
        if (name && value) {
          cookies.set(name.trim(), value.trim());
        }
      });
    }

    while (redirectCount < maxRedirects) {
      // Loop detection
      if (visitedUrls.has(currentUrl)) {
        throw new Error(
          `Redirect loop detected: URL ${currentUrl} visited before`
        );
      }
      visitedUrls.add(currentUrl);

      console.log(`🌐 Request ${redirectCount + 1}: ${currentUrl}`);

      // Build cookie header from accumulated cookies
      const cookieHeader = Array.from(cookies.entries())
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      const requestHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        Connection: 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      };

      const axiosResponse = await axios.get(currentUrl, {
        headers: requestHeaders,
        timeout: 30000,
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400,
      });

      currentResponse = {
        statusCode: axiosResponse.status,
        headers: axiosResponse.headers as Record<string, string | string[]>,
        body: { text: async () => String(axiosResponse.data) },
      };

      // Update cookies from response
      const setCookieHeaders = currentResponse.headers['set-cookie'];
      if (setCookieHeaders) {
        const cookieArray = Array.isArray(setCookieHeaders)
          ? setCookieHeaders
          : [setCookieHeaders];
        cookieArray.forEach(cookieHeader => {
          const [nameValue] = cookieHeader.split(';');
          if (nameValue) {
            const [name, value] = nameValue.split('=');
            if (name && value) {
              cookies.set(name.trim(), value.trim());
              console.log(`🍪 Cookie captured: ${name.trim()}`);
            }
          }
        });
      }

      console.log(
        `📡 Response ${redirectCount + 1}: HTTP ${currentResponse.statusCode}`
      );

      // Check if this is a redirect status code
      const isRedirect = [301, 302, 303, 307, 308].includes(
        currentResponse.statusCode
      );

      if (!isRedirect) {
        // Not a redirect, we're done
        const finalCookieHeader = Array.from(cookies.entries())
          .map(([name, value]) => `${name}=${value}`)
          .join('; ');

        console.log(
          `✅ Redirect chain complete: ${redirectCount + 1} requests, ${
            cookies.size
          } cookies`
        );
        return {
          finalResponse: currentResponse,
          finalUrl: currentUrl,
          cookieHeader: finalCookieHeader,
        };
      }

      // Handle redirect
      const location = currentResponse.headers.location;
      if (!location) {
        throw new Error(
          `Redirect response missing Location header: HTTP ${currentResponse.statusCode} from ${currentUrl}`
        );
      }

      const locationString = Array.isArray(location) ? location[0] : location;
      const nextUrl = new URL(locationString, currentUrl).toString();

      console.log(
        `🔄 Redirect ${redirectCount + 1}: ${
          currentResponse.statusCode
        } → ${nextUrl}`
      );

      currentUrl = nextUrl;
      redirectCount++;
    }

    throw new Error(
      `Too many redirects: exceeded ${maxRedirects} redirects starting from ${url}`
    );
  }

  // Supporting utility methods for real web scraping
  private extractContentByPortalType(
    $: cheerio.CheerioAPI,
    portalType: string,
    url: string
  ): ExtractedContent {
    const content: ExtractedContent = {
      title: $('title').text(),
      headings: [],
      links: [],
      text: '',
      opportunities: [],
    };

    try {
      const canonicalPortalType = normalizePortalType(portalType);
      const useAustinPortalExtraction = shouldUseAustinPortalExtraction(
        portalType,
        url
      );

      // Extract headings
      $('h1, h2, h3, h4').each((_, element) => {
        const text = $(element).text().trim();
        if (text) content.headings.push(text);
      });

      // Portal-specific extraction patterns
      if (useAustinPortalExtraction) {
        content.opportunities = this.extractAustinFinanceOpportunities($, url);
      } else {
        switch (canonicalPortalType) {
          case 'bonfire':
          case 'bonfire hub':
            content.opportunities = this.extractBonfireOpportunities($, url);
            break;
          case 'sam.gov':
          case 'sam':
            content.opportunities = this.extractSAMGovOpportunities($, url);
            break;
          case 'findrfp':
            // FindRFP now uses enhanced Stagehand extraction in authenticated browser sessions
            content.opportunities = [];
            break;
          default:
            content.opportunities = this.extractGenericOpportunities($, url);
        }
      }

      // Extract all links for further analysis
      $('a[href]').each((_, element) => {
        const href = $(element).attr('href');
        const text = $(element).text().trim();
        if (href && text) {
          content.links.push({ url: href, text });
        }
      });

      // Extract main text content
      content.text = $('body').text().replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error(
        `Error extracting content for ${portalType}:`,
        error instanceof Error ? error.message : String(error)
      );
    }

    return content;
  }

  private extractBonfireOpportunities(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): z.infer<typeof OpportunitySchema>[] {
    const opportunities: z.infer<typeof OpportunitySchema>[] = [];
    console.log(`🔍 Analyzing Bonfire Hub HTML structure...`);

    // Debug: Log the page structure to understand what we're working with
    const pageTitle = $('title').text();
    console.log(`📄 Bonfire page title: ${pageTitle}`);

    // Debug: Check for common table/list structures
    const tables = $('table').length;
    const rows = $('tr').length;
    const lists = $('ul, ol').length;
    const listItems = $('li').length;
    const divs = $('div').length;
    console.log(
      `🔢 Bonfire structure: ${tables} tables, ${rows} rows, ${lists} lists, ${listItems} list items, ${divs} divs`
    );

    // Enhanced Bonfire selectors - try multiple approaches
    const selectors = [
      'table tr', // Common table structure for opportunity listings
      'tbody tr', // Table body rows
      '.opportunity, [class*="opportunity"]', // Opportunity classes
      '.bid, [class*="bid"]', // Bid classes
      '.rfp, [class*="rfp"]', // RFP classes
      '.listing, [class*="listing"]', // Listing classes
      '.row, [class*="row"]', // Row classes
      'li', // List items that might contain opportunities
      '[data-id]', // Elements with data IDs
      'a[href*="opportunity"]', // Links containing "opportunity"
      'a[href*="bid"]', // Links containing "bid"
      'a[href*="rfp"]', // Links containing "rfp"
    ];

    selectors.forEach(selector => {
      const elements = $(selector);
      console.log(
        `🎯 Bonfire selector "${selector}" found ${elements.length} elements`
      );

      elements.each((index, element) => {
        if (index >= 5) return; // Limit logging to first 5 elements per selector

        const $element = $(element);
        const text = $element.text().trim();
        const links = $element.find('a').length;
        const hasHref = $element.attr('href') ? 'has href' : 'no href';

        console.log(
          `  📋 Element ${index + 1}: ${text.substring(
            0,
            100
          )}... (${links} links, ${hasHref})`
        );
      });
    });

    // Try table-based extraction first (common for government portals)
    $('table tr').each((index, element) => {
      if (index === 0) return; // Skip header row

      const $row = $(element);
      const cells = $row.find('td');

      if (cells.length >= 2) {
        const title = cells.eq(0).text().trim();
        const description = cells.eq(1).text().trim();
        const deadline = cells.length > 2 ? cells.eq(2).text().trim() : '';
        const agency = cells.length > 3 ? cells.eq(3).text().trim() : '';

        // Look for links in any cell
        const link = $row.find('a').first().attr('href');

        if (
          title &&
          title.length > 5 &&
          (link ||
            title.toLowerCase().includes('rfp') ||
            title.toLowerCase().includes('bid'))
        ) {
          opportunities.push({
            title,
            description,
            deadline,
            agency,
            url: link ? new URL(link, baseUrl).toString() : undefined,
            confidence: 0.6,
          });
          console.log(`✅ Bonfire table opportunity found: ${title}`);
        }
      }
    });

    // Try list-based extraction
    $('li').each((_, element) => {
      const $item = $(element);
      const text = $item.text().trim();
      const link =
        $item.find('a').first().attr('href') || $item.closest('a').attr('href');

      if (
        text.length > 10 &&
        (text.toLowerCase().includes('rfp') ||
          text.toLowerCase().includes('bid') ||
          text.toLowerCase().includes('opportunity'))
      ) {
        const title =
          $item.find('h1, h2, h3, h4, h5, h6').first().text().trim() ||
          text.substring(0, 100);

        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description: text,
            deadline: undefined,
            agency: undefined,
            url: link ? new URL(link, baseUrl).toString() : undefined,
            confidence: 0.5,
          });
          console.log(`✅ Bonfire list opportunity found: ${title}`);
        }
      }
    });

    // Try div-based extraction with RFP keywords
    $('div').each((_, element) => {
      const $div = $(element);
      const text = $div.text().trim();
      const link = $div.find('a').first().attr('href');

      if (
        text.length > 20 &&
        text.length < 500 &&
        (text.toLowerCase().includes('rfp') ||
          text.toLowerCase().includes('bid') ||
          text.toLowerCase().includes('opportunity')) &&
        !text.toLowerCase().includes('footer') &&
        !text.toLowerCase().includes('header')
      ) {
        const title =
          $div.find('h1, h2, h3, h4, h5, h6').first().text().trim() ||
          text.substring(0, 100);

        if (title && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description: text,
            deadline: undefined,
            agency: undefined,
            url: link ? new URL(link, baseUrl).toString() : undefined,
            confidence: 0.5,
          });
          console.log(`✅ Bonfire div opportunity found: ${title}`);
        }
      }
    });

    return opportunities;
  }

  private extractSAMGovOpportunities(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): z.infer<typeof OpportunitySchema>[] {
    const opportunities: z.infer<typeof OpportunitySchema>[] = [];

    // SAM.gov specific selectors
    $('.opportunity-row, .search-result, [class*="opportunity"]').each(
      (_, element) => {
        const $row = $(element);

        const title = $row
          .find('.opportunity-title, h3, h4')
          .first()
          .text()
          .trim();
        const description = $row
          .find('.opportunity-description, .description')
          .first()
          .text()
          .trim();
        const agency = $row.find('.agency, .department').first().text().trim();
        const deadline = $row
          .find('.response-date, .due-date, .deadline')
          .first()
          .text()
          .trim();
        const link = $row.find('a').first().attr('href');

        if (title && link) {
          opportunities.push({
            title,
            description: description || '',
            agency: agency || undefined,
            deadline: deadline || undefined,
            url: new URL(link, baseUrl).toString(),
            confidence: 0.7,
          });
        }
      }
    );

    return opportunities;
  }

  // Legacy extractFindRFPOpportunities function removed - replaced by enhanced Stagehand extraction

  private extractAustinFinanceOpportunities(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): z.infer<typeof OpportunitySchema>[] {
    const opportunities: z.infer<typeof OpportunitySchema>[] = [];

    console.log(`🔍 Austin Finance: Starting extraction from ${baseUrl}`);

    // Target solicitation detail links directly
    const detailLinks = $('a[href*="solicitation_details.cfm"]');
    console.log(`🔗 Austin Finance: Found ${detailLinks.length} detail links`);

    detailLinks.each((_, linkElement) => {
      const $link = $(linkElement);
      const href = $link.attr('href');

      if (!href) return;

      // Find the container element (tr, li, div, etc.) that holds this link
      const $container = $link.closest('tr, li, div, td').length
        ? $link.closest('tr, li, div, td')
        : $link.parent();
      let text = $container.text();

      // Normalize text - replace NBSP and collapse whitespace
      text = text
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (text.length < 10) {
        // If container is too small, try a larger parent
        text = $container
          .parent()
          .text()
          .replace(/\u00A0/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }

      console.log(
        `📄 Austin Finance: Processing container text (${
          text.length
        } chars): ${text.substring(0, 100)}...`
      );

      // Use more tolerant ID regex patterns
      const tolerantPattern =
        /\b(?:IFQ|IFB|RFP|RFQS)\s*[#:.-]?\s*\d{3,5}(?:\s+[A-Z]{2,}\d{3,5})?\b/i;
      const fallbackPattern = /\b(?:IFQ|IFB|RFP|RFQS)\s*\d+\b/i;

      const idMatch =
        text.match(tolerantPattern) || text.match(fallbackPattern);

      if (!idMatch) {
        console.log(
          `⚠️ Austin Finance: No solicitation ID found in: ${text.substring(
            0,
            50
          )}...`
        );
        return;
      }

      const solicitationId = idMatch[0].trim();
      console.log(
        `✅ Austin Finance: Found solicitation ID: ${solicitationId}`
      );

      // Extract title (usually in bold/strong or after ID)
      let title = $container.find('strong, b').first().text().trim();
      if (!title) {
        // Try to find title after the ID
        const afterId = text
          .substring(text.indexOf(solicitationId) + solicitationId.length)
          .trim();
        const lines = afterId.split(/\n|Due Date|View Details/i);
        title = lines[0] ? lines[0].trim() : '';
      }

      // Extract due date
      const dueDateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
      const dueDate = dueDateMatch ? dueDateMatch[1] : '';

      // Extract description (text between title and due date)
      let description = text;
      if (title) description = description.replace(title, '');
      description = description.replace(solicitationId, '');
      if (dueDate) description = description.replace(dueDate, '');
      description = description
        .replace(/due date:?/i, '')
        .replace(/view details/i, '')
        .trim();
      description = description.substring(0, 500); // Limit length

      if (solicitationId && title) {
        const opportunity: z.infer<typeof OpportunitySchema> = {
          title: title,
          description: description || '',
          solicitationId: solicitationId,
          agency: 'City of Austin',
          deadline: dueDate || undefined,
          url: new URL(href, baseUrl).toString(),
          category: solicitationId.toUpperCase().startsWith('IFQ')
            ? 'Quote'
            : solicitationId.toUpperCase().startsWith('IFB')
              ? 'Bid'
              : solicitationId.toUpperCase().startsWith('RFP')
                ? 'Proposal'
                : 'Other',
          confidence: 0.8,
        };

        opportunities.push(opportunity);
        console.log(
          `🎯 Austin Finance: Created opportunity: ${solicitationId} - ${title}`
        );
      }
    });

    // Remove duplicates based on title
    const unique = opportunities.filter(
      (opp, index, self) => index === self.findIndex(o => o.title === opp.title)
    );

    console.log(
      `🏛️ Austin Finance: Extracted ${unique.length} opportunities from ${opportunities.length} raw matches`
    );
    if (unique.length > 0) {
      console.log(`🎯 Austin Finance sample opportunity:`, unique[0]);
    } else {
      console.log(
        `❌ Austin Finance: No opportunities found. HTML elements: ${
          $('*').length
        }, detail links: ${detailLinks.length}`
      );
    }

    return unique;
  }

  private extractGenericOpportunities(
    $: cheerio.CheerioAPI,
    baseUrl: string
  ): z.infer<typeof OpportunitySchema>[] {
    const opportunities: z.infer<typeof OpportunitySchema>[] = [];

    // Generic selectors for various portal types
    const selectors = [
      '.opportunity',
      '.rfp',
      '.bid',
      '.procurement',
      '.solicitation',
      '[class*="opportunity"]',
      '[class*="rfp"]',
      '[class*="bid"]',
      '[class*="procurement"]',
      '[class*="solicitation"]',
    ];

    selectors.forEach(selector => {
      $(selector).each((_, element) => {
        const $el = $(element);

        const title = $el
          .find('h1, h2, h3, h4, .title, [class*="title"]')
          .first()
          .text()
          .trim();
        const description = $el
          .find('.description, .summary, p')
          .first()
          .text()
          .trim();
        const link = $el.find('a').first().attr('href');

        if (title && link && !opportunities.some(opp => opp.title === title)) {
          opportunities.push({
            title,
            description: description || '',
            url: new URL(link, baseUrl).toString(),
            confidence: 0.5,
          });
        }
      });
    });

    return opportunities;
  }

  // Legacy findOpportunityLinks function removed - replaced by enhanced Stagehand extraction

  private async fetchOpportunityDetails(
    url: string,
    sessionData: SessionData | null
  ): Promise<OpportunityDetails | null> {
    return await this.requestLimiter(async () => {
      try {
        const response = await axios.get(url, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            ...(sessionData?.cookies
              ? { Cookie: String(sessionData.cookies) }
              : {}),
            ...(sessionData?.headers
              ? (sessionData.headers as Record<string, string>)
              : {}),
          },
          timeout: 20000,
          validateStatus: status => status === 200,
        });

        if (response.status !== 200) {
          return null;
        }

        const html = response.data;
        const $ = cheerio.load(html);

        // Extract detailed information
        const title = $('h1, h2, .title, [class*="title"]')
          .first()
          .text()
          .trim();
        const description = $(
          '.description, .summary, .content, [class*="description"]'
        )
          .first()
          .text()
          .trim();
        const deadline = $(
          '[class*="deadline"], [class*="due"], .date, [class*="date"]'
        )
          .first()
          .text()
          .trim();
        const agency = $(
          '[class*="agency"], [class*="department"], [class*="organization"]'
        )
          .first()
          .text()
          .trim();
        const value = $(
          '[class*="value"], [class*="amount"], [class*="budget"]'
        )
          .first()
          .text()
          .trim();

        return {
          title,
          description,
          deadline,
          agency,
          estimatedValue: value,
          url,
          content: html,
          extractedAt: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`Error fetching opportunity details from ${url}:`, error);
        return null;
      }
    });
  }

  private detectAuthenticationMethod(
    $: cheerio.CheerioAPI,
    portalUrl: string
  ): AuthenticationMethod {
    // Check for common authentication patterns
    const forms = $('form');

    if (forms.length === 0) {
      return { type: 'none', details: 'No forms detected' };
    }

    // Look for login forms
    const loginForm = forms.filter((_, form) => {
      const $form = $(form);
      const action = $form.attr('action')?.toLowerCase() || '';
      const id = $form.attr('id')?.toLowerCase() || '';
      const className = $form.attr('class')?.toLowerCase() || '';

      return (
        action.includes('login') ||
        action.includes('auth') ||
        id.includes('login') ||
        id.includes('auth') ||
        className.includes('login') ||
        className.includes('auth')
      );
    });

    if (loginForm.length > 0) {
      const $form = loginForm.first();
      const action = $form.attr('action') || '';
      const method = $form.attr('method')?.toUpperCase() || 'GET';

      // Extract form fields
      const fields: any = {};
      $form.find('input, select, textarea').each((_, input) => {
        const $input = $(input);
        const name = $input.attr('name');
        const type = $input.attr('type') || 'text';
        const value = $input.attr('value') || '';

        if (name) {
          fields[name] = { type, value };
        }
      });

      return {
        type: 'form',
        details: 'Form-based authentication detected',
        formData: {
          action: new URL(action || portalUrl, portalUrl).toString(),
          method,
          fields,
        },
      };
    }

    // Check for OAuth or other authentication methods that require browser automation
    if ($('a[href*="oauth"], a[href*="sso"], a[href*="saml"]').length > 0) {
      return {
        type: 'browser_required',
        details:
          'OAuth/SSO authentication detected - requires browser automation',
      };
    }

    // Check for complex authentication indicators that suggest browser automation is needed
    const complexAuthIndicators = [
      'data-sitekey', // reCAPTCHA
      'g-recaptcha', // Google reCAPTCHA
      'captcha', // Generic CAPTCHA
      'microsoft',
      'google',
      'azure', // SSO providers
      'okta',
      'saml',
      'adfs', // Enterprise SSO
    ];

    const pageText = $('body').text().toLowerCase();
    const hasComplexAuth = complexAuthIndicators.some(
      indicator =>
        pageText.includes(indicator) ||
        $(`[class*="${indicator}"], [id*="${indicator}"]`).length > 0
    );

    if (hasComplexAuth) {
      return {
        type: 'browser_required',
        details:
          'Complex authentication detected - requires browser automation',
      };
    }

    // Check for specific portals that we know require browser automation
    const browserRequiredDomains = ['findrfp.com', 'bonfirehub.com'];
    const requiresBrowser = browserRequiredDomains.some(domain =>
      portalUrl.includes(domain)
    );

    if (requiresBrowser) {
      return {
        type: 'browser_required',
        details: 'Portal requires browser automation for authentication',
      };
    }

    return {
      type: 'unknown',
      details: 'Authentication method could not be determined',
    };
  }

  private async handleFormAuthentication(context: any): Promise<any> {
    const { portalUrl } = context;

    try {
      // Let all portals go through standard browser automation detection

      // Generic form authentication for other portals
      return await this.handleGenericFormAuthentication(context);
    } catch (error) {
      console.error('Form authentication error:', error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'form_authentication_error',
        portalUrl,
      };
    }
  }

  private async handleOryKratosAuthentication(context: any): Promise<any> {
    const { portalUrl, username, password } = context;

    try {
      console.log(
        `🔐 Starting Ory Kratos authentication flow for ${portalUrl}`
      );

      // Step 1: Get the login flow URL with flow ID
      const loginFlowUrl =
        'https://account-flows.bonfirehub.com/self-service/login/browser?return_to=https%3A%2F%2Fvendor.bonfirehub.com%2Fopportunities%2Fall';
      console.log(`🌐 Step 1: Getting login flow from ${loginFlowUrl}`);

      const { finalUrl: flowFinalUrl, cookieHeader: flowCookies } =
        await this.getWithRedirects(loginFlowUrl, 10);

      if (!flowFinalUrl.includes('/login?flow=')) {
        throw new Error(
          `Expected login flow URL with flow ID, got: ${flowFinalUrl}`
        );
      }

      // Extract flow ID from URL
      const flowId = new URL(flowFinalUrl).searchParams.get('flow');
      if (!flowId) {
        throw new Error(`Could not extract flow ID from ${flowFinalUrl}`);
      }

      console.log(`🎯 Step 1 Complete: Flow ID extracted: ${flowId}`);

      // Step 2: Fetch flow JSON to get form action and CSRF token
      const flowJsonUrl = `https://account.bonfirehub.com/login?flow=${flowId}`;
      console.log(`📋 Step 2: Fetching flow JSON from ${flowJsonUrl}`);

      const flowJsonAxiosResponse = await axios.get(flowJsonUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          ...(flowCookies ? { Cookie: flowCookies } : {}),
        },
        timeout: 30000,
        validateStatus: status => status === 200,
      });

      const flowJsonResponse = {
        statusCode: flowJsonAxiosResponse.status,
        headers: flowJsonAxiosResponse.headers as any,
        body: { json: async () => flowJsonAxiosResponse.data },
      };

      if (flowJsonResponse.statusCode !== 200) {
        throw new Error(
          `Failed to fetch flow JSON: HTTP ${flowJsonResponse.statusCode}`
        );
      }

      const flowData = (await flowJsonResponse.body.json()) as any;
      console.log(
        `🎯 Step 2 Complete: Flow JSON fetched, action: ${flowData.ui?.action}`
      );

      // Extract form action URL and CSRF token
      const formAction = flowData.ui?.action;
      if (!formAction) {
        throw new Error(`No form action found in flow JSON`);
      }

      // Find CSRF token in hidden fields
      let csrfToken = null;
      const hiddenFields: any = {};

      if (flowData.ui?.nodes) {
        for (const node of flowData.ui.nodes) {
          if (node.attributes?.name && node.attributes?.type === 'hidden') {
            hiddenFields[node.attributes.name] = node.attributes.value;
            if (node.attributes.name.includes('csrf')) {
              csrfToken = node.attributes.value;
            }
          }
        }
      }

      console.log(`🔒 CSRF token found: ${csrfToken ? 'Yes' : 'No'}`);
      console.log(
        `📝 Hidden fields found: ${Object.keys(hiddenFields).length}`
      );

      // Step 3: Submit credentials to form action
      console.log(`📤 Step 3: Submitting credentials to ${formAction}`);

      const loginPayload: any = {
        method: 'password',
        identifier: username,
        password: password,
        ...hiddenFields, // Include all hidden fields including CSRF token
      };

      // Get fresh cookies from flow response
      const formCookies = this.extractCookies(flowJsonResponse) || flowCookies;
      const redactedCookies = this.redactSensitiveCookies(formCookies);
      console.log(`🍪 Using cookies for login: ${redactedCookies}`);

      const loginSubmitAxiosResponse = await axios.post(
        formAction,
        new URLSearchParams(loginPayload).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            Referer: flowFinalUrl,
            ...(formCookies ? { Cookie: formCookies } : {}),
          },
          timeout: 30000,
          maxRedirects: 0,
          validateStatus: status => status >= 200 && status < 400,
        }
      );

      const loginSubmitResponse = {
        statusCode: loginSubmitAxiosResponse.status,
        headers: loginSubmitAxiosResponse.headers as any,
      };

      console.log(
        `📡 Step 3: Login submit response: HTTP ${loginSubmitResponse.statusCode}`
      );

      // Step 4: Follow redirects to complete authentication
      if ([302, 303, 307, 308].includes(loginSubmitResponse.statusCode)) {
        console.log(
          `🔄 Step 4: Following redirects to complete authentication`
        );

        const location = loginSubmitResponse.headers.location;
        const redirectUrl = Array.isArray(location) ? location[0] : location;

        if (!redirectUrl) {
          throw new Error(
            'Login response had redirect status but no Location header'
          );
        }

        const fullRedirectUrl = new URL(redirectUrl, formAction).toString();
        console.log(`🌐 Following redirect to: ${fullRedirectUrl}`);

        // Merge cookies from login response
        const loginCookies = this.extractCookies(loginSubmitResponse);
        const allCookies = this.mergeCookies(formCookies, loginCookies);

        // Follow the redirect chain
        const {
          finalResponse,
          finalUrl,
          cookieHeader: finalCookies,
        } = await this.getWithRedirects(fullRedirectUrl, 10, allCookies);

        console.log(`✅ Step 4 Complete: Final URL: ${finalUrl}`);
        console.log(`📡 Final response: HTTP ${finalResponse.statusCode}`);

        // Verify we ended up at the target page or a success page
        const isSuccess =
          finalUrl.includes('vendor.bonfirehub.com') ||
          finalUrl.includes('opportunities') ||
          finalResponse.statusCode === 200;

        if (isSuccess) {
          console.log(`🎉 Ory Kratos authentication successful!`);
          return {
            authenticated: true,
            cookies: finalCookies,
            headers: {
              Referer: finalUrl,
            },
            method: 'ory_kratos',
            portalUrl: finalUrl,
            flowId,
          };
        } else {
          console.log(
            `❌ Authentication may have failed - unexpected final URL: ${finalUrl}`
          );
          return {
            authenticated: false,
            error: `Unexpected redirect destination: ${finalUrl}`,
            method: 'ory_kratos_redirect_failed',
            portalUrl,
            flowId,
          };
        }
      } else if (loginSubmitResponse.statusCode === 200) {
        // Check if we got an error response
        const responseText = await (loginSubmitResponse as any).body.text();
        if (
          responseText.toLowerCase().includes('error') ||
          responseText.toLowerCase().includes('invalid')
        ) {
          console.log(`❌ Login failed - error response received`);
          return {
            authenticated: false,
            error: 'Invalid credentials or login error',
            method: 'ory_kratos_error',
            portalUrl,
            flowId,
          };
        }

        // If no redirect and no error, consider it successful
        return {
          authenticated: true,
          cookies: this.extractCookies(loginSubmitResponse),
          method: 'ory_kratos_direct',
          portalUrl,
          flowId,
        };
      } else {
        throw new Error(
          `Unexpected login response: HTTP ${loginSubmitResponse.statusCode}`
        );
      }
    } catch (error) {
      console.error(`❌ Ory Kratos authentication failed:`, error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'ory_kratos_error',
        portalUrl,
      };
    }
  }

  private async handleGenericFormAuthentication(context: any): Promise<any> {
    const {
      portalUrl,
      username,
      password,
      formData,
      loginPageResponse,
      cookieHeader,
    } = context;

    try {
      // Build form payload
      const payload: any = {};

      Object.keys(formData.fields).forEach(fieldName => {
        const field = formData.fields[fieldName];

        // Map common field names to credentials
        const lowerFieldName = fieldName.toLowerCase();
        if (
          lowerFieldName.includes('user') ||
          lowerFieldName.includes('email') ||
          lowerFieldName.includes('login')
        ) {
          payload[fieldName] = username;
        } else if (
          lowerFieldName.includes('pass') ||
          lowerFieldName.includes('pwd')
        ) {
          payload[fieldName] = password;
        } else {
          // Keep existing value for hidden fields, tokens, etc.
          payload[fieldName] = field.value;
        }
      });

      // Use accumulated cookies from redirect chain, fallback to extracting from final response
      const cookies = cookieHeader || this.extractCookies(loginPageResponse);
      const redactedCookies = this.redactSensitiveCookies(cookies);
      console.log(`🍪 Using cookies for form submission: ${redactedCookies}`);

      // Submit login form
      const loginAxiosResponse = await axios({
        method: formData.method,
        url: formData.action,
        data: new URLSearchParams(payload).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          Referer: portalUrl,
          ...(cookies ? { Cookie: cookies } : {}),
        },
        timeout: 30000,
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400,
      });

      const loginResponse = {
        statusCode: loginAxiosResponse.status,
        headers: loginAxiosResponse.headers as any,
        body: { text: async () => loginAxiosResponse.data },
      };

      // Extract new cookies from login response
      const sessionCookies = this.extractCookies(loginResponse);

      // Check if login was successful (look for redirect or absence of login form)
      const loginResponseHtml = await loginResponse.body.text();
      const $loginResponse = cheerio.load(loginResponseHtml);

      const hasLoginForm =
        $loginResponse('form').filter((_, form) => {
          const $form = $loginResponse(form);
          const action = $form.attr('action')?.toLowerCase() || '';
          return action.includes('login') || action.includes('auth');
        }).length > 0;

      const isSuccessful =
        loginResponse.statusCode === 302 || // Redirect after successful login
        (loginResponse.statusCode === 200 && !hasLoginForm); // No login form means we're logged in

      return {
        authenticated: isSuccessful,
        cookies: sessionCookies,
        headers: isSuccessful
          ? {
              Referer: portalUrl,
            }
          : undefined,
        method: 'generic_form_authentication',
        portalUrl,
        statusCode: loginResponse.statusCode,
      };
    } catch (error) {
      console.error('Generic form authentication error:', error);
      return {
        authenticated: false,
        error: error instanceof Error ? error.message : String(error),
        method: 'generic_form_authentication_error',
        portalUrl,
      };
    }
  }

  /**
   * Extract content using an authenticated browser session with adaptive timeouts
   * Returns structured data when Stagehand extraction succeeds, HTML when falling back
   */
  private async scrapeWithAuthenticatedSession(
    url: string,
    sessionId: string
  ): Promise<{ opportunities?: any[]; html?: string; isStructured: boolean }> {
    try {
      console.log(
        `🌐 Extracting content from authenticated session ${sessionId} for ${url}`
      );

      // Get the existing authenticated session
      await sessionManager.ensureStagehand(sessionId);
      const page = await sessionManager.getPage(sessionId);

      console.log(`🎯 Navigating authenticated session to: ${url}`);

      // Adaptive navigation strategy for heavy JavaScript pages
      let html: string | null = null;

      // Strategy 1: Try domcontentloaded first (faster)
      try {
        console.log(`📄 Trying 'domcontentloaded' navigation...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(3000); // Wait for initial JS execution
        console.log(`✅ 'domcontentloaded' navigation successful`);
      } catch {
        console.log(`⚠️ 'domcontentloaded' failed, trying 'load' fallback...`);

        // Strategy 2: Fall back to 'load'
        try {
          await page.goto(url, { waitUntil: 'load', timeout: 60000 });
          await page.waitForTimeout(3000);
          console.log(`✅ 'load' navigation successful`);
        } catch {
          console.log(`⚠️ 'load' failed, trying basic navigation...`);

          // Strategy 3: Basic navigation without wait conditions
          try {
            await page.goto(url, { timeout: 90000 });
            await page.waitForTimeout(5000); // Give more time for heavy JS
            console.log(`✅ Basic navigation successful`);
          } catch {
            console.log(
              `⚠️ All navigation strategies failed, attempting content extraction anyway...`
            );
            // Continue to try content extraction even if navigation partially failed
          }
        }
      }

      // Handle Cloudflare protection and wait for portal content
      try {
        console.log(`🔍 Waiting for portal content to load...`);

        // Check for Cloudflare protection first
        const pageTitle = await page.title();
        console.log(`📄 Page title: "${pageTitle}"`);

        if (
          pageTitle.includes('Just a moment') ||
          pageTitle.includes('Please wait')
        ) {
          console.log(
            `🛡️ Cloudflare protection detected, waiting for bypass...`
          );

          // Wait for Cloudflare to complete (can take 5-15 seconds)
          try {
            await page.waitForFunction(
              () =>
                !document.title.includes('Just a moment') &&
                !document.title.includes('Please wait'),
              { timeout: 30000 }
            );
            console.log(`✅ Cloudflare protection bypassed`);

            // Give additional time for the real page to load
            await page.waitForTimeout(3000);
          } catch {
            console.log(`⚠️ Cloudflare bypass timeout, proceeding anyway...`);
          }
        }

        // Now wait for portal-specific elements
        await Promise.race([
          page.waitForSelector(
            'table, .opportunity, .listing, .rfp, .bid, .content, main, [data-testid]',
            { timeout: 15000 }
          ),
          page.waitForTimeout(15000), // Maximum wait
        ]);
        console.log(`✅ Portal content elements detected`);
      } catch {
        console.log(
          `⚠️ Portal content wait timeout, proceeding with extraction...`
        );
      }

      // Add deterministic post-auth navigation for Bonfire Hub to reach opportunities listing
      // Get current page URL for robust domain detection
      const currentUrl = await page.url();
      const targetDomain = currentUrl || url;

      if (targetDomain.includes('bonfirehub')) {
        try {
          console.log(
            `🎯 Implementing deterministic post-auth navigation for Bonfire Hub...`
          );
          console.log(`🌐 Target URL: ${url}, Current URL: ${currentUrl}`);

          // Check if we're on a dashboard instead of opportunities listing
          const pageContent = await page.content();

          console.log(`🌐 Current URL: ${currentUrl}`);

          // Detect dashboard state via "Welcome Back!" or dashboard indicators
          const isDashboard =
            pageContent.includes('Welcome Back!') ||
            pageContent.includes('Dashboard') ||
            !currentUrl.includes('/opportunities') ||
            currentUrl.includes('dashboard');

          if (isDashboard) {
            console.log(
              `🔄 Dashboard detected, forcing navigation to opportunities listing...`
            );

            // Build domain-agnostic opportunities URL
            const urlObj = new URL(currentUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

            // Try multiple opportunities URL patterns
            const opportunityUrls = [
              `${baseUrl}/opportunities/all`,
              `${baseUrl}/opportunities`,
              `${baseUrl}/opportunities?open=1`,
              `${baseUrl}/open-opportunities`,
              `${baseUrl}/bids/open`,
            ];

            let navigationSuccess = false;

            for (const oppUrl of opportunityUrls) {
              try {
                console.log(`🎯 Trying opportunities URL: ${oppUrl}`);

                await page.goto(oppUrl, {
                  waitUntil: 'domcontentloaded',
                  timeout: 30000,
                });
                await page.waitForTimeout(3000);

                // Check if we reached an opportunities page (look for opportunity-related content)
                const newContent = await page.content();
                const hasOpportunityContent =
                  newContent.includes('opportunity') ||
                  newContent.includes('bid') ||
                  newContent.includes('rfp') ||
                  (await page.$(
                    'table tbody tr, .opportunity-item, .bid-item'
                  ));

                if (
                  hasOpportunityContent &&
                  !newContent.includes('Welcome Back!')
                ) {
                  console.log(
                    `✅ Successfully navigated to opportunities listing: ${oppUrl}`
                  );
                  navigationSuccess = true;
                  break;
                }
              } catch (navError: any) {
                console.log(
                  `⚠️ Failed to navigate to ${oppUrl}: ${navError.message}`
                );
                continue;
              }
            }

            // If URL navigation failed, try programmatic navigation via UI
            if (!navigationSuccess) {
              console.log(
                `🔄 URL navigation failed, trying programmatic UI navigation...`
              );

              try {
                // Go back to the authenticated dashboard and click opportunities link
                await page.goto(currentUrl, {
                  waitUntil: 'domcontentloaded',
                  timeout: 20000,
                });
                await page.waitForTimeout(2000);

                // Find and click opportunities navigation link
                const opportunitiesLinkClicked = await page.evaluate(() => {
                  const selectors = [
                    'a[href*="/opportunities"]',
                    'a[href*="/open-opportunities"]',
                    'a[href*="/bids"]',
                    'button:contains("Opportunities")',
                    'a:contains("Opportunities")',
                    'a:contains("Open Opportunities")',
                    'a:contains("Bids")',
                    '[data-testid*="opportunities"]',
                    'nav a:contains("Opportunities")',
                    '.nav a:contains("Opportunities")',
                  ];

                  for (const selector of selectors) {
                    try {
                      const elements = document.querySelectorAll(selector);
                      for (let i = 0; i < elements.length; i++) {
                        const element = elements[i];
                        const text = element.textContent?.toLowerCase() || '';
                        if (
                          text.includes('opportunit') ||
                          text.includes('bid') ||
                          text.includes('open')
                        ) {
                          (element as HTMLElement).click();
                          console.log(
                            `🖱️ Clicked opportunities link: ${selector}`
                          );
                          return true;
                        }
                      }
                    } catch {
                      continue;
                    }
                  }
                  return false;
                });

                if (opportunitiesLinkClicked) {
                  console.log(
                    `🖱️ Opportunities link clicked, waiting for navigation...`
                  );
                  await page.waitForTimeout(5000);

                  // Wait for opportunities content to load
                  await Promise.race([
                    page.waitForSelector(
                      'table tbody tr, .opportunity-item, .bid-item, [data-testid*="opportunity"]',
                      { timeout: 15000 }
                    ),
                    page.waitForTimeout(15000),
                  ]);

                  console.log(`✅ UI navigation to opportunities completed`);
                  navigationSuccess = true;
                }
              } catch (uiNavError: any) {
                console.log(`⚠️ UI navigation failed: ${uiNavError.message}`);
              }
            }

            if (!navigationSuccess) {
              console.log(
                `⚠️ All navigation attempts failed, proceeding with current page content...`
              );
            }
          } else {
            console.log(
              `✅ Already on opportunities listing page, proceeding with extraction...`
            );
          }
        } catch (navError: any) {
          console.log(
            `⚠️ Post-auth navigation error: ${navError.message}, proceeding anyway...`
          );
        }
      }

      // Extract content regardless of navigation success
      try {
        // For Bonfire Hub, use clean Stagehand extraction with AI-powered parsing
        if (targetDomain.includes('bonfirehub')) {
          console.log(`🔧 Using clean Stagehand extraction for Bonfire Hub...`);

          // Wait for opportunities content to load
          try {
            console.log(`⏳ Waiting for opportunities to render...`);
            await Promise.race([
              page.waitForSelector(
                'table, .opportunity, .bid, .rfp, .listing, [data-testid]',
                { timeout: 15000 }
              ),
              page.waitForTimeout(15000),
            ]);
            console.log(`✅ Content detected, proceeding with AI extraction`);
          } catch {
            console.log(
              `⚠️ Content wait timeout, proceeding with extraction anyway...`
            );
          }

          // Use clean Stagehand page.extract() with Zod schema
          try {
            console.log(
              `🤖 Extracting opportunities using AI-powered Stagehand extraction...`
            );

            const extractionResult = (await page.extract({
              instruction: `Extract all RFP opportunities, bids, and procurement opportunities from this page.
                           Look for opportunities in tables, cards, lists, or any other format.

                           IMPORTANT FIELD MAPPINGS (especially for Austin portals):
                           - title: The PROJECT NAME or DESCRIPTION (e.g., "1\\" River Rock", "Distribution Getaway Duct Bank Bore")
                             NOT the RFP number (IFB/IFQ/RFP codes should go in solicitationId field)
                           - solicitationId: The RFP/bid NUMBER or ID (e.g., "IFB 2200 DCG1024", "IFQ 6100 CLMC1099")
                           - description: Brief description or summary of the project (if available and different from title)
                           - agency: The agency or organization posting the opportunity
                           - deadline: Deadline or due date (if mentioned)
                           - estimatedValue: Contract value or budget (if mentioned, NOT the project name)
                           - url: The ACTUAL URL/link to opportunity details (NOT "View Details" link text)
                           - link: Same as url, the actual href attribute
                           - category: Type of opportunity (construction, services, goods, etc.)

                           Ignore welcome messages, navigation menus, or non-opportunity content.
                           Only extract actual procurement opportunities or RFPs.`,

              schema: z.object({
                opportunities: z.array(
                  OpportunitySchema.extend({
                    solicitationId: z.string().optional(),
                  })
                ),
              }),
            } as any)) as { opportunities: any[] };

            console.log(
              `🎯 Stagehand extraction found ${
                extractionResult.opportunities?.length || 0
              } opportunities`
            );

            if (
              extractionResult.opportunities &&
              extractionResult.opportunities.length > 0
            ) {
              console.log(`✅ Using Stagehand-extracted opportunities`);
              return {
                opportunities: extractionResult.opportunities,
                isStructured: true,
              };
            } else {
              console.log(
                `⚠️ No opportunities found with Stagehand extraction, checking for dashboard content...`
              );

              // Check if we're on a dashboard page
              const pageContent = await page.content();
              if (
                pageContent.includes('Welcome Back') ||
                pageContent.includes('Dashboard')
              ) {
                console.log(
                  `⚠️ Detected dashboard page - opportunities extraction should only run after successful navigation to opportunities listing`
                );
              }
            }
          } catch (extractionError) {
            console.log(
              `⚠️ Stagehand extraction error: ${
                extractionError instanceof Error
                  ? extractionError.message
                  : String(extractionError)
              }`
            );
            console.log(`🔄 Falling back to static HTML extraction...`);
          }
        }

        // For FindRFP, use clean Stagehand extraction with AI-powered parsing
        if (targetDomain.includes('findrfp')) {
          console.log(`🔧 Using clean Stagehand extraction for FindRFP...`);

          // Wait for search results and opportunities to load
          try {
            console.log(`⏳ Waiting for FindRFP opportunities to render...`);
            await Promise.race([
              page.waitForSelector(
                'table, .result, .opportunity, .listing, [data-testid], .search-results',
                { timeout: 15000 }
              ),
              page.waitForTimeout(15000),
            ]);
            console.log(
              `✅ FindRFP content detected, proceeding with AI extraction`
            );
          } catch {
            console.log(
              `⚠️ FindRFP content wait timeout, proceeding with extraction anyway...`
            );
          }

          // Use clean Stagehand page.extract() with Zod schema
          try {
            console.log(
              `🤖 Extracting FindRFP opportunities using AI-powered Stagehand extraction...`
            );

            const extractionResult = (await page.extract({
              instruction: `Extract all RFP opportunities and procurement opportunities from this FindRFP.com page.
                           FindRFP.com is an aggregation platform that displays opportunities from multiple government sources.
                           Look for opportunities in search results, tables, listings, or any other format.

                           For each opportunity, extract:
                           - title: The RFP or opportunity title/name
                           - description: Brief description or summary of the opportunity
                           - agency: The government agency or organization posting (e.g., "City of Austin", "Department of Defense")
                           - deadline: Application deadline or due date (if mentioned)
                           - estimatedValue: Contract value, budget, or project value (if mentioned)
                           - link: Direct link to the detailed opportunity page or application
                           - category: Type of opportunity (construction, services, goods, IT, consulting, etc.)

                           Focus on actual procurement opportunities and RFPs.
                           Ignore promotional content, navigation menus, ads, or non-opportunity content.
                           Extract as many opportunities as possible from this page to exceed the previous count of 6.`,

              schema: z.object({
                opportunities: z.array(OpportunitySchema),
              }),
            } as any)) as { opportunities: any[] };

            console.log(
              `🎯 FindRFP Stagehand extraction found ${
                extractionResult.opportunities?.length || 0
              } opportunities`
            );

            if (
              extractionResult.opportunities &&
              extractionResult.opportunities.length > 0
            ) {
              console.log(
                `✅ Using FindRFP Stagehand-extracted opportunities (${extractionResult.opportunities.length} found)`
              );
              return {
                opportunities: extractionResult.opportunities,
                isStructured: true,
              };
            } else {
              console.log(
                `⚠️ No opportunities found with FindRFP Stagehand extraction`
              );
            }
          } catch (extractionError) {
            console.log(
              `⚠️ FindRFP Stagehand extraction error: ${
                extractionError instanceof Error
                  ? extractionError.message
                  : String(extractionError)
              }`
            );
            console.log(
              `🔄 Falling back to static HTML extraction for FindRFP...`
            );
          }
        }

        // Fallback to static HTML extraction
        html = await page.content();
        console.log(
          `✅ Successfully extracted ${html?.length ?? 0} characters using authenticated session`
        );

        if (html && html.length < 1000) {
          console.log(
            `⚠️ Warning: Extracted content is suspiciously small (${html.length} chars)`
          );
        }

        return {
          html: html ?? undefined,
          isStructured: false,
        };
      } catch (extractError) {
        console.error(`❌ Failed to extract content:`, extractError);
        throw new Error(
          `Content extraction failed: ${
            extractError instanceof Error
              ? extractError.message
              : String(extractError)
          }`
        );
      }
    } catch (error) {
      console.error(
        `❌ Error extracting content with authenticated session:`,
        error
      );
      throw error;
    }
  }

  /**
   * Handle browser-based authentication using Stagehand for OAuth/SSO/Complex forms
   */
  private async handleBrowserAuthentication(context: any): Promise<any> {
    const { loginUrl, targetUrl, username, password, portal } = context;

    try {
      console.log(`🌐 Starting browser authentication for ${loginUrl}`);

      // Generate a unique session ID for this portal
      const sessionId = `portal_${portal?.id || 'unknown'}_${Date.now()}`;

      // Perform browser authentication using Stagehand
      const authResult = await performBrowserAuthentication(
        loginUrl,
        username,
        password,
        targetUrl,
        sessionId
      );

      if (authResult.success) {
        console.log(`✅ Browser authentication successful for ${loginUrl}`);

        return {
          authenticated: true,
          method: 'browser_authentication',
          sessionData: authResult.sessionData,
          sessionId: sessionId,
          portalUrl: targetUrl,
          loginUrl: loginUrl,
          targetUrl: authResult.targetUrl,
        };
      } else {
        console.log(`❌ Browser authentication failed for ${loginUrl}`);

        return {
          authenticated: false,
          error: 'Browser authentication failed',
          method: 'browser_authentication_failed',
          portalUrl: targetUrl,
        };
      }
    } catch (error: any) {
      console.error(`Browser authentication error for ${loginUrl}:`, error);

      return {
        authenticated: false,
        error: error.message || 'Browser authentication failed',
        method: 'browser_authentication_error',
        portalUrl: targetUrl,
      };
    }
  }

  private extractCookies(
    response:
      | HttpResponseWrapper
      | { headers: Record<string, string | string[]> }
  ): string | null {
    const setCookieHeaders = response.headers['set-cookie'];
    if (!setCookieHeaders) return null;

    const cookies = Array.isArray(setCookieHeaders)
      ? setCookieHeaders
      : [setCookieHeaders];

    return cookies
      .map(cookie => cookie.split(';')[0]) // Take only the name=value part
      .join('; ');
  }

  /**
   * Extract SAM.gov notice ID from URL
   */
  private extractSAMGovNoticeId(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // SAM.gov URLs typically have notice ID in path or query params
      const pathMatch = urlObj.pathname.match(/\/view\/([A-Z0-9]+)/i);
      if (pathMatch) return pathMatch[1];

      const noticeIdParam =
        urlObj.searchParams.get('noticeId') ||
        urlObj.searchParams.get('notice_id') ||
        urlObj.searchParams.get('id');
      if (noticeIdParam) return noticeIdParam;

      return null;
    } catch {
      return null;
    }
  }

  private extractJsonBlocks(text: string): string[] {
    const jsonBlocks: string[] = [];

    // Look for JSON-like structures in the text
    const patterns = [
      /\{[^{}]*"opportunities"[^{}]*\[[\s\S]*?\][^{}]*\}/g,
      /\{[^{}]*"results"[^{}]*\[[\s\S]*?\][^{}]*\}/g,
      /\{[\s\S]*?\}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        jsonBlocks.push(...matches);
      }
    }

    // Also try to find JSON code blocks
    const codeBlockPattern = /```(?:json)?([\s\S]*?)```/g;
    let match;
    while ((match = codeBlockPattern.exec(text)) !== null) {
      const content = match[1].trim();
      if (content.startsWith('{') && content.endsWith('}')) {
        jsonBlocks.push(content);
      }
    }

    return Array.from(new Set(jsonBlocks)); // Remove duplicates
  }

  /**
   * Check if portal is SAM.gov
   */
  private isSAMGovPortal(portal: Portal): boolean {
    const url = portal.url.toLowerCase();
    const name = portal.name.toLowerCase();
    return (
      url.includes('sam.gov') ||
      name.includes('sam.gov') ||
      name.includes('sam_gov')
    );
  }

  /**
   * Scan portal and automatically download discovered documents
   *
   * This method combines portal scraping with document downloading:
   * 1. Navigates to the RFP detail page
   * 2. Discovers and clicks download links for attachments
   * 3. Retrieves downloaded files from Browserbase cloud storage
   * 4. Verifies file sizes and stores in database
   */
  async scanPortalWithDocuments(input: {
    rfpId: string;
    portalUrl: string;
    sessionId?: string;
    expectedDocuments?: Array<{
      name: string;
      expectedSize?: number;
      sourceUrl?: string;
    }>;
  }): Promise<{
    scrapedData: any;
    documentsResult: any;
  }> {
    const {
      rfpId,
      portalUrl,
      sessionId = 'default',
      expectedDocuments = [],
    } = input;
    const log = console;

    log.log('🚀 Starting portal scan with document downloads', {
      rfpId,
      portalUrl,
    });

    try {
      // Step 1: Navigate to RFP page and discover documents
      const { stagehand, page } =
        await sessionManager.getStagehandAndPage(sessionId);

      await page.goto(portalUrl, { waitUntil: 'domcontentloaded' });
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for dynamic content

      // Step 2: Discover document download links
      log.log('🔍 Discovering document download links');
      const documentLinks = await stagehand.extract(
        'Find all document download links, attachment links, or file download buttons on this page',
        {
          documents: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Document filename or description',
                },
                url: {
                  type: 'string',
                  optional: true,
                  description: 'Download URL if visible',
                },
                size: {
                  type: 'string',
                  optional: true,
                  description: 'File size if shown',
                },
              },
            },
          },
        } as any
      );

      const documentsArray = (documentLinks as any).documents || [];
      log.log('📋 Document links discovered', { count: documentsArray.length });

      // Step 3: Click each download link to trigger downloads
      for (const doc of documentsArray) {
        try {
          log.log('⬇️ Triggering download', { document: doc.name });
          await stagehand.act(
            `Click the download link or button for "${doc.name}"`
          );
          // Small delay between downloads to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          log.log('⚠️ Failed to click download for document', {
            document: doc.name,
            error: (e as Error).message,
          });
        }
      }

      // Step 4: Wait for downloads to complete in Browserbase cloud
      log.log('⏳ Waiting for downloads to sync to Browserbase cloud storage');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Step 5: Retrieve and process downloads
      const browserbaseSessionId =
        sessionManager.getBrowserbaseSessionId(sessionId);
      if (!browserbaseSessionId) {
        throw new Error(
          'Browserbase session ID not found - cannot retrieve downloads'
        );
      }

      // Import the orchestrator dynamically to avoid circular dependencies
      const { documentDownloadOrchestrator } = await import(
        '../downloads/documentDownloadOrchestrator'
      );

      // Merge discovered documents with expected documents for verification
      const allExpectedDocs = [
        ...expectedDocuments,
        ...documentsArray.map((d: any) => ({
          name: d.name,
          expectedSize: d.size ? this.parseSizeString(d.size) : undefined,
        })),
      ];

      const documentsResult =
        await documentDownloadOrchestrator.processRfpDocuments({
          rfpId,
          browserbaseSessionId,
          expectedDocuments: allExpectedDocs,
          retryForSeconds: this.DOCUMENT_RETRY_TIMEOUT_SECONDS,
        });

      log.log('✅ Document download orchestration complete', {
        processed: documentsResult.totalDownloaded,
        failed: documentsResult.totalFailed,
      });

      return {
        scrapedData: documentLinks,
        documentsResult,
      };
    } catch (error) {
      log.error('❌ Portal scan with documents failed', error);
      throw error;
    }
  }

  /**
   * Parse size string like "279.93 KB" to bytes
   */
  private parseSizeString(sizeStr: string): number | undefined {
    const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB)$/i);
    if (!match) return undefined;

    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();

    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 * 1024,
      GB: 1024 * 1024 * 1024,
    };

    return Math.round(value * (multipliers[unit] || 1));
  }

  /**
   * Scrape SAM.gov using REST API (faster, more reliable than browser automation)
   */
  private async scrapeViaSAMGovApi(
    portal: Portal,
    searchFilter?: string
  ): Promise<any[]> {
    const { SAMGovApiClient } = await import(
      '../scraping/utils/samGovApiClient'
    );
    const client = new SAMGovApiClient();

    // Build search filters
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Format dates as MM/dd/yyyy for SAM.gov API
    const formatDate = (date: Date): string => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    };

    const filters: any = {
      postedFrom: formatDate(thirtyDaysAgo),
      postedTo: formatDate(today),
      limit: portal.maxRfpsPerScan || 50,
    };

    if (searchFilter) {
      filters.keywords = searchFilter;
    }

    console.log(`🔍 Searching SAM.gov API with filters:`, filters);

    // Use the API client with retry logic
    const results = await client.searchWithRetry(filters);

    console.log(
      `📦 SAM.gov API returned ${results.opportunitiesData?.length || 0} opportunities`
    );

    // Convert to opportunity format
    return (results.opportunitiesData || []).map((opp: any) => ({
      title: opp.title || opp.solicitationNumber || 'Untitled Opportunity',
      solicitationId: opp.solicitationNumber,
      description: opp.description || opp.additionalInfoLink || '',
      agency:
        opp.department ||
        opp.subTier ||
        opp.fullParentPathName ||
        'Federal Government',
      deadline: opp.responseDeadLine,
      estimatedValue: opp.award?.amount?.toString(),
      url: opp.noticeId
        ? `https://sam.gov/opp/${opp.noticeId}/view`
        : `https://sam.gov`,
      category: opp.type || 'Solicitation',
      confidence: 0.95, // High confidence from official API
    }));
  }
}

// Singleton instance to prevent duplicate initialization messages
let mastraScrapingInstance: MastraScrapingService | null = null;

export function getMastraScrapingService(): MastraScrapingService {
  if (!mastraScrapingInstance) {
    mastraScrapingInstance = new MastraScrapingService();
  }
  return mastraScrapingInstance;
}
