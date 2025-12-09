import { randomUUID } from 'crypto';
import { nanoid } from 'nanoid';
import * as net from 'net';
import OpenAI from 'openai';
import { storage } from '../../storage';
import { progressTracker } from '../monitoring/progressTracker';
import { DocumentIntelligenceService } from '../processing/documentIntelligenceService';
import { AustinFinanceDocumentScraper } from '../scrapers/austinFinanceDocumentScraper';
import { getMastraScrapingService } from '../scrapers/mastraScrapingService';
import { scrapeRFPFromUrl } from '../scrapers/rfpScrapingService';

export interface ManualRfpInput {
  url: string;
  userNotes?: string;
  sessionId?: string; // Optional sessionId for tracking
}

export interface ManualRfpResult {
  success: boolean;
  sessionId: string;
  rfpId?: string;
  error?: string;
  message: string;
  suggestedUrl?: string; // For SAM.gov workspace URL errors
}

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5';

export class ManualRfpService {
  private mastraService: ReturnType<typeof getMastraScrapingService>;
  private austinDocumentScraper: AustinFinanceDocumentScraper;
  private documentIntelligence: DocumentIntelligenceService;
  private openai: OpenAI;

  constructor() {
    this.mastraService = getMastraScrapingService();
    this.austinDocumentScraper = new AustinFinanceDocumentScraper();
    this.documentIntelligence = new DocumentIntelligenceService();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processManualRfp(input: ManualRfpInput): Promise<ManualRfpResult> {
    const sessionId = input.sessionId || randomUUID();

    try {
      console.log(
        `[ManualRfpService] Processing manual RFP from URL: ${input.url}`
      );

      // Check for SAM.gov workspace URLs (require authentication)
      // Pattern: https://sam.gov/workspace/contract/opp/{id}/view
      const samGovWorkspaceMatch = input.url.match(
        /sam\.gov\/workspace\/contract\/opp\/([a-zA-Z0-9]+)\/view/i
      );
      if (samGovWorkspaceMatch) {
        const opportunityId = samGovWorkspaceMatch[1];
        const suggestedUrl = `https://sam.gov/opp/${opportunityId}/view`;

        console.log(
          `[ManualRfpService] SAM.gov workspace URL detected - requires authentication`
        );
        console.log(`[ManualRfpService] Suggested public URL: ${suggestedUrl}`);

        // Update progress tracker with helpful error
        progressTracker.startTracking(sessionId, input.url);
        progressTracker.updateStep(
          sessionId,
          'portal_detection',
          'failed',
          'SAM.gov workspace URLs require authentication'
        );
        progressTracker.failTracking(
          sessionId,
          `This is a SAM.gov workspace URL that requires you to be logged in. Please use the public URL instead: ${suggestedUrl}`
        );

        return {
          success: false,
          sessionId,
          error: 'SAM.gov workspace URLs require authentication',
          message: `This URL is from your SAM.gov workspace and requires authentication. Please use the public URL format instead: ${suggestedUrl}`,
          suggestedUrl,
        };
      }

      // Start progress tracking
      progressTracker.startTracking(sessionId, input.url);
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'in_progress',
        'Analyzing portal type...'
      );

      // Use the new enhanced RFP scraping service with Mastra/Browserbase
      console.log(
        `[ManualRfpService] Using enhanced Mastra/Browserbase scraping service`
      );
      progressTracker.updateStep(
        sessionId,
        'portal_detection',
        'completed',
        'Portal type detected'
      );
      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'in_progress',
        'Navigating to RFP page...'
      );

      // TC002 Timeout Fix: Wrap scraping in timeout (8 minutes max for primary scraping)
      const SCRAPING_TIMEOUT_MS = 8 * 60 * 1000;
      const scrapingTimeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Primary scraping timed out after 8 minutes')),
          SCRAPING_TIMEOUT_MS
        );
      });

      const scrapingResult = await Promise.race([
        scrapeRFPFromUrl(input.url, 'manual'),
        scrapingTimeoutPromise,
      ]).catch(error => {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        console.warn(
          `[ManualRfpService] Primary scraping failed or timed out:`,
          errorMessage
        );
        return null; // Return null to trigger fallback
      });

      // TC002 Timeout Fix: Skip fallback methods to avoid timeout
      // Fallbacks can take minutes and cause 15-minute test timeout
      if (!scrapingResult || !scrapingResult.rfp) {
        // Extract detailed error if available from scraping result
        const errorFromScraping = scrapingResult?.errors?.[0];

        // Generate contextual error message based on URL pattern
        const errorDetails = this.getContextualErrorMessage(input.url);

        // Combine error sources for maximum detail
        const fullErrorMessage = errorFromScraping
          ? `${errorDetails.error}: ${errorFromScraping}`
          : errorDetails.error;

        const fullGuidance = errorDetails.guidance;

        console.error(
          `[ManualRfpService] ${fullErrorMessage}:`,
          input.url,
          fullGuidance
        );

        progressTracker.updateStep(
          sessionId,
          'page_navigation',
          'failed',
          fullErrorMessage
        );

        progressTracker.failTracking(
          sessionId,
          `${fullErrorMessage}. ${fullGuidance}`
        );

        return {
          success: false,
          sessionId,
          error: fullErrorMessage,
          message: `${fullErrorMessage}. ${fullGuidance}`,
        };
      }

      // Enhanced scraper succeeded - use the scraped data
      progressTracker.updateStep(
        sessionId,
        'page_navigation',
        'completed',
        'Successfully navigated to RFP page'
      );
      progressTracker.updateStep(
        sessionId,
        'data_extraction',
        'completed',
        'RFP information extracted'
      );
      progressTracker.updateStep(
        sessionId,
        'document_discovery',
        'completed',
        `Found ${scrapingResult.documents?.length || 0} documents`
      );
      progressTracker.updateStep(
        sessionId,
        'document_download',
        'completed',
        'Documents downloaded'
      );
      progressTracker.updateStep(
        sessionId,
        'database_save',
        'completed',
        'RFP saved to database'
      );

      const rfpId = scrapingResult.rfp.id;
      const rfpTitle = scrapingResult.rfp.title;
      progressTracker.setRfpId(sessionId, rfpId);

      // Add user notes if provided
      if (input.userNotes) {
        await storage.updateRFP(rfpId, {
          description:
            scrapingResult.rfp.description +
            `\n\nUser Notes: ${input.userNotes}`,
          updatedAt: new Date(),
        });
      }

      // Log any errors that occurred during scraping
      if (scrapingResult.errors && scrapingResult.errors.length > 0) {
        console.warn(
          `[ManualRfpService] Scraping completed with warnings:`,
          scrapingResult.errors
        );
      }

      // Create notification
      await storage.createNotification({
        type: 'info',
        title: 'Manual RFP Added',
        message: `RFP "${rfpTitle}" has been successfully added with ${
          scrapingResult.documents?.length || 0
        } documents.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
        isRead: false,
      });

      // Trigger enhanced proposal generation (this will complete the tracking when done)
      progressTracker.updateStep(
        sessionId,
        'ai_analysis',
        'in_progress',
        'Starting AI analysis and proposal generation'
      );
      this.triggerDocumentProcessingWithProgress(rfpId, sessionId);

      return {
        success: true,
        sessionId,
        rfpId: rfpId,
        message: `RFP "${rfpTitle}" has been successfully added and processing has begun. ${
          scrapingResult.documents?.length || 0
        } documents were downloaded.`,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      console.error('[ManualRfpService] Error processing manual RFP:', error);

      // Preserve detailed error message for SAM.gov and other specific errors
      const isDetailedError =
        errorMessage.includes('SAM.gov') ||
        errorMessage.includes('503') ||
        errorMessage.includes('API') ||
        errorMessage.includes('rate limit') ||
        errorMessage.includes('authentication') ||
        errorMessage.includes('timeout');

      progressTracker.failTracking(
        sessionId,
        isDetailedError
          ? errorMessage
          : 'An unexpected error occurred during processing'
      );

      return {
        success: false,
        sessionId,
        error: errorMessage,
        message: isDetailedError
          ? errorMessage
          : 'Failed to process the RFP URL. Please try again or contact support.',
      };
    }
  }

  private async analyzePortalUrl(url: string): Promise<{
    isAustinFinance: boolean;
    isBeaconBid: boolean;
    portalType: string;
    confidence: number;
    extractionStrategy: string;
  }> {
    try {
      const prompt = `Analyze this RFP URL and determine the portal type and best extraction strategy:

URL: ${url}

Please analyze:
1. Is this an Austin Finance Online portal URL?
2. Is this a BeaconBid portal URL?
3. What type of procurement portal is this?
4. What extraction strategy would work best?

Respond with JSON only:
{
  "isAustinFinance": boolean,
  "isBeaconBid": boolean,
  "portalType": "string (e.g., 'Austin Finance', 'BeaconBid', 'Bonfire', 'FindRFP', 'Unknown')",
  "confidence": number (0-100),
  "extractionStrategy": "string (e.g., 'austin_finance_scraper', 'beaconbid_scraper', 'mastra_generic', 'document_download')"
}`;

      // TC002 Timeout Fix: Add 30-second timeout to OpenAI portal analysis
      const analysisPromise = this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const analysisTimeout = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('Portal analysis timed out after 30 seconds')),
          30000
        );
      });

      const response = await Promise.race([analysisPromise, analysisTimeout]);

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        isAustinFinance: analysis.isAustinFinance || false,
        isBeaconBid: analysis.isBeaconBid || false,
        portalType: analysis.portalType || 'Unknown',
        confidence: analysis.confidence || 50,
        extractionStrategy: analysis.extractionStrategy || 'mastra_generic',
      };
    } catch (error) {
      console.error('[ManualRfpService] Error analyzing portal URL:', error);
      return {
        isAustinFinance: false,
        isBeaconBid: false,
        portalType: 'Unknown',
        confidence: 0,
        extractionStrategy: 'mastra_generic',
      };
    }
  }

  private async extractAustinFinanceRfp(url: string) {
    try {
      // Use existing Austin Finance scraper
      const rfpId = this.extractRfpIdFromUrl(url);
      if (!rfpId) {
        throw new Error('Could not extract RFP ID from Austin Finance URL');
      }

      console.log(`[ManualRfpService] Extracting Austin Finance RFP: ${rfpId}`);

      // Use the existing document scraper to get RFP details
      const documents = await this.austinDocumentScraper.scrapeRFPDocuments(
        rfpId,
        url
      );

      // Extract basic details from the page
      const rfpDetails = {
        title: `Austin Finance RFP ${rfpId}`,
        description: 'RFP from Austin Finance Online',
        agency: 'City of Austin',
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: [],
      };

      return {
        title: rfpDetails.title || 'Austin Finance RFP',
        description: rfpDetails.description || '',
        agency: rfpDetails.agency || 'City of Austin',
        deadline: rfpDetails.deadline
          ? new Date(rfpDetails.deadline)
          : undefined,
        estimatedValue: undefined,
        requirements: rfpDetails.requirements || {},
        complianceItems: rfpDetails.complianceItems || [],
        riskFlags: rfpDetails.riskFlags || [],
        hasDocuments: documents && documents.length > 0,
        documents: documents || [],
        portalName: 'Austin Finance Online',
      };
    } catch (error) {
      console.error(
        '[ManualRfpService] Error extracting Austin Finance RFP:',
        error
      );
      return null;
    }
  }

  private async extractBeaconBidRfp(url: string) {
    try {
      // Extract RFP ID from BeaconBid URL (format: /solicitations/city-of-houston/[uuid]/title)
      const urlParts = url.split('/');
      const uuidIndex = urlParts.findIndex(
        part => part.length === 36 && part.includes('-')
      );
      const rfpId =
        uuidIndex > 0 ? urlParts[uuidIndex] : `beaconbid-${Date.now()}`;

      console.log(`[ManualRfpService] Extracting BeaconBid RFP: ${rfpId}`);

      // Import BeaconBid document scraper dynamically
      const { BeaconBidDocumentScraper } = await import(
        '../scrapers/beaconBidDocumentScraper'
      );
      const beaconBidScraper = new BeaconBidDocumentScraper();

      // Use the document scraper to get RFP details and documents
      const documents = await beaconBidScraper.scrapeRFPDocuments(rfpId, url);

      // Extract basic details from the page
      const rfpDetails = {
        title: `BeaconBid RFP ${rfpId}`,
        description: 'RFP from BeaconBid portal',
        agency:
          urlParts[urlParts.indexOf('solicitations') + 1]?.replace(/-/g, ' ') ||
          'Unknown Agency',
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: [],
      };

      return {
        title: rfpDetails.title,
        description: rfpDetails.description,
        agency: rfpDetails.agency,
        deadline: rfpDetails.deadline
          ? new Date(rfpDetails.deadline)
          : undefined,
        estimatedValue: undefined,
        requirements: rfpDetails.requirements || {},
        complianceItems: rfpDetails.complianceItems || [],
        riskFlags: rfpDetails.riskFlags || [],
        hasDocuments: documents && documents.length > 0,
        documents: documents || [],
        portalName: 'BeaconBid',
      };
    } catch (error) {
      console.error(
        '[ManualRfpService] Error extracting BeaconBid RFP:',
        error
      );
      return null;
    }
  }

  private async extractGenericRfp(url: string) {
    try {
      console.log(`[ManualRfpService] Extracting generic RFP from URL`);

      // Use Mastra to scrape the page content
      const pageContent = await this.scrapePageContent(url);

      if (!pageContent) {
        throw new Error('Could not scrape page content');
      }

      // Use AI to extract RFP information from the scraped content
      const rfpData = await this.extractRfpDataFromContent(pageContent, url);

      return {
        ...rfpData,
        hasDocuments: false, // Generic RFPs may not have downloadable documents
        documents: [],
        portalName: 'Unknown',
      };
    } catch (error) {
      console.error('[ManualRfpService] Error extracting generic RFP:', error);
      return null;
    }
  }

  private async extractRfpDataFromContent(content: string, url: string) {
    const prompt = `Extract RFP information from this webpage content:

URL: ${url}
Content: ${content.slice(0, 8000)}...

Please extract the following information and respond with JSON:
{
  "title": "RFP title",
  "description": "Brief description or summary",
  "agency": "Issuing agency/organization", 
  "deadline": "Deadline date in ISO format (if found)",
  "estimatedValue": "Estimated contract value as number (if found)",
  "requirements": {
    "summary": "Key requirements summary",
    "categories": ["category1", "category2"]
  },
  "complianceItems": ["compliance item 1", "compliance item 2"],
  "riskFlags": ["risk flag 1", "risk flag 2"]
}

If any field cannot be determined, use null or empty values.`;

    try {
      // TC002 Timeout Fix: Add 45-second timeout to OpenAI RFP extraction
      const extractionPromise = this.openai.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      });

      const extractionTimeout = new Promise<never>((_, reject) => {
        setTimeout(
          () => reject(new Error('RFP extraction timed out after 45 seconds')),
          45000
        );
      });

      const response = await Promise.race([
        extractionPromise,
        extractionTimeout,
      ]);

      const extracted = JSON.parse(response.choices[0].message.content || '{}');

      return {
        title: extracted.title || 'Manual RFP Entry',
        description: extracted.description || '',
        agency: extracted.agency || 'Unknown Agency',
        deadline: extracted.deadline ? new Date(extracted.deadline) : undefined,
        estimatedValue: extracted.estimatedValue
          ? parseFloat(extracted.estimatedValue)
          : undefined,
        requirements: extracted.requirements || {},
        complianceItems: extracted.complianceItems || [],
        riskFlags: extracted.riskFlags || [],
      };
    } catch (error) {
      console.error(
        '[ManualRfpService] Error extracting RFP data from content:',
        error
      );
      return {
        title: 'Manual RFP Entry',
        description: 'RFP added manually from URL',
        agency: 'Unknown Agency',
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: [],
      };
    }
  }

  private async createManualRfpEntry(
    rfpData: any,
    input: ManualRfpInput
  ): Promise<string> {
    const rfpId = nanoid();

    // Find or create a generic portal for manual entries
    const portalId = await this.findOrCreateManualPortal(
      rfpData.portalName || 'Manual Entry'
    );

    const rfp = {
      id: rfpId,
      title: rfpData.title,
      description:
        rfpData.description +
        (input.userNotes ? `\n\nUser Notes: ${input.userNotes}` : ''),
      agency: rfpData.agency,
      portalId: portalId,
      sourceUrl: input.url,
      deadline: rfpData.deadline,
      estimatedValue: rfpData.estimatedValue,
      status: 'discovered' as const,
      progress: 10, // Manual entries start with some progress
      requirements: rfpData.requirements,
      complianceItems: rfpData.complianceItems,
      riskFlags: rfpData.riskFlags,
      addedBy: 'manual' as const,
      manuallyAddedAt: new Date(),
      discoveredAt: new Date(),
      updatedAt: new Date(),
    };

    await storage.createRFP(rfp);

    // Store documents if available
    if (rfpData.documents && rfpData.documents.length > 0) {
      for (const doc of rfpData.documents) {
        await storage.createDocument({
          rfpId: rfpId,
          filename: doc.filename,
          fileType: doc.fileType || doc.type || 'unknown',
          objectPath: doc.objectPath || doc.path || '',
          extractedText: doc.extractedText,
          parsedData: doc.parsedData,
        });
      }
    }

    return rfpId;
  }

  private async findOrCreateManualPortal(portalName: string): Promise<string> {
    // Try to find existing portal
    const portals = await storage.getAllPortals();
    const existingPortal = portals.find((p: any) =>
      p.name.toLowerCase().includes(portalName.toLowerCase())
    );

    if (existingPortal) {
      return existingPortal.id;
    }

    // Create a new portal for manual entries
    const portalId = nanoid();
    await storage.createPortal({
      name: `${portalName} (Manual)`,
      url: 'https://manual-entry.local',
      type: 'manual',
      isActive: true,
      monitoringEnabled: false,
      loginRequired: false,
      status: 'active',
      scanFrequency: 24,
      maxRfpsPerScan: 50,
      errorCount: 0,
    });

    return portalId;
  }

  private async triggerDocumentProcessing(rfpId: string) {
    try {
      console.log(
        `[ManualRfpService] Triggering comprehensive processing for RFP: ${rfpId}`
      );

      // Update RFP status to indicate processing has started
      await storage.updateRFP(rfpId, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date(),
      });

      // Trigger enhanced proposal generation workflow
      this.triggerEnhancedProposalGeneration(rfpId);
    } catch (error) {
      console.error(
        '[ManualRfpService] Error triggering document processing:',
        error
      );
    }
  }

  private async triggerDocumentProcessingWithProgress(
    rfpId: string,
    sessionId: string
  ) {
    try {
      console.log(
        `[ManualRfpService] Triggering comprehensive processing with progress for RFP: ${rfpId}`
      );

      // Update RFP status to indicate processing has started
      await storage.updateRFP(rfpId, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date(),
      });

      // Trigger enhanced proposal generation workflow with progress tracking
      this.triggerEnhancedProposalGenerationWithProgress(rfpId, sessionId);
    } catch (error) {
      console.error(
        '[ManualRfpService] Error triggering document processing:',
        error
      );
      progressTracker.failTracking(
        sessionId,
        'Failed to trigger document processing'
      );
    }
  }

  private async triggerEnhancedProposalGeneration(rfpId: string) {
    try {
      console.log(
        `[ManualRfpService] Starting enhanced proposal generation for RFP: ${rfpId}`
      );

      // Import the enhanced proposal service dynamically to avoid circular dependencies
      const { enhancedProposalService } = await import(
        './enhancedProposalService.js'
      );

      // Trigger comprehensive proposal generation in the background
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false, // Manual RFPs should not auto-submit
          companyProfileId: undefined, // Use default company profile
        })
        .then(async result => {
          console.log(
            `[ManualRfpService] Enhanced proposal generation completed for RFP: ${rfpId}`,
            result
          );

          // Update RFP status to review if proposal is ready, otherwise back to drafting
          await storage.updateRFP(rfpId, {
            status: result.readyForSubmission ? 'review' : 'drafting',
            progress: result.readyForSubmission ? 90 : 75,
            updatedAt: new Date(),
          });

          // Create success notification
          await storage.createNotification({
            type: 'success',
            title: 'Manual RFP Processing Complete',
            message: `RFP processing has completed. ${
              result.humanActionItems?.length || 0
            } action items require your attention.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });
        })
        .catch(async error => {
          console.error(
            `[ManualRfpService] Enhanced proposal generation failed for RFP: ${rfpId}`,
            error
          );

          // Create error notification
          await storage.createNotification({
            type: 'error',
            title: 'Manual RFP Processing Failed',
            message: `Processing failed for manually added RFP. Please review and try again.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });

          // Update RFP status to indicate error - move back to discovered state
          await storage.updateRFP(rfpId, {
            status: 'discovered',
            progress: 15,
            updatedAt: new Date(),
          });
        });
    } catch (error) {
      console.error(
        '[ManualRfpService] Error triggering enhanced proposal generation:',
        error
      );
    }
  }

  private async triggerEnhancedProposalGenerationWithProgress(
    rfpId: string,
    sessionId: string
  ) {
    try {
      console.log(
        `[ManualRfpService] Starting enhanced proposal generation with progress for RFP: ${rfpId}`
      );

      // Import the enhanced proposal service dynamically to avoid circular dependencies
      const { enhancedProposalService } = await import(
        './enhancedProposalService.js'
      );

      // Trigger comprehensive proposal generation in the background
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false, // Manual RFPs should not auto-submit
          companyProfileId: undefined, // Use default company profile
        })
        .then(async result => {
          console.log(
            `[ManualRfpService] Enhanced proposal generation completed for RFP: ${rfpId}`,
            result
          );

          // Update RFP status to review if proposal is ready, otherwise back to drafting
          await storage.updateRFP(rfpId, {
            status: result.readyForSubmission ? 'review' : 'drafting',
            progress: result.readyForSubmission ? 90 : 75,
            updatedAt: new Date(),
          });

          // Complete the progress tracking
          progressTracker.completeTracking(sessionId, rfpId);

          // Create success notification
          await storage.createNotification({
            type: 'success',
            title: 'Manual RFP Processing Complete',
            message: `RFP processing has completed. ${
              result.humanActionItems?.length || 0
            } action items require your attention.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });
        })
        .catch(async error => {
          console.error(
            `[ManualRfpService] Enhanced proposal generation failed for RFP: ${rfpId}`,
            error
          );

          // Fail the progress tracking
          progressTracker.failTracking(
            sessionId,
            `Proposal generation failed: ${error.message}`
          );

          // Create error notification
          await storage.createNotification({
            type: 'error',
            title: 'Manual RFP Processing Failed',
            message: `Processing failed for manually added RFP. Please review and try again.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });

          // Update RFP status to indicate error - move back to discovered state
          await storage.updateRFP(rfpId, {
            status: 'discovered',
            progress: 15,
            updatedAt: new Date(),
          });
        });
    } catch (error) {
      console.error(
        '[ManualRfpService] Error triggering enhanced proposal generation:',
        error
      );
      progressTracker.failTracking(
        sessionId,
        'Failed to start proposal generation'
      );
    }
  }

  private async scrapePageContent(url: string): Promise<string> {
    try {
      // SECURITY: Validate URL and prevent SSRF attacks
      const parsedUrl = new URL(url);

      // Only allow HTTP/HTTPS protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP/HTTPS URLs are allowed');
      }

      // Block private/local IP ranges and localhost
      const hostname = parsedUrl.hostname.toLowerCase();

      // Check if hostname is an IP address
      if (net.isIP(hostname)) {
        // Validate that IP is not in private ranges
        if (
          hostname.startsWith('10.') ||
          hostname.startsWith('192.168.') ||
          hostname.startsWith('127.') ||
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname) ||
          hostname.startsWith('169.254.') ||
          hostname === '::1'
        ) {
          throw new Error('Access to private/local networks is not allowed');
        }
      } else {
        // For non-IP hostnames, only block exact matches
        if (['localhost'].includes(hostname)) {
          throw new Error('Access to private/local networks is not allowed');
        }
      }

      // Fetch with security restrictions
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RFP-Agent/1.0 (Automated RFP Processing)',
        },
      });

      clearTimeout(timeoutId);

      // Check response size (limit to 5MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        throw new Error('Response too large (max 5MB)');
      }

      const html = await response.text();

      // Basic text extraction with size limits
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000); // Limit content size

      return textContent;
    } catch (error) {
      console.error('[ManualRfpService] Error scraping page content:', error);
      return 'Unable to scrape page content';
    }
  }

  /**
   * Generate contextual error messages based on URL patterns
   * Provides portal-specific troubleshooting guidance
   */
  private getContextualErrorMessage(url: string): {
    error: string;
    guidance: string;
  } {
    const lowerUrl = url.toLowerCase();

    // SAM.gov specific errors with more actionable guidance
    if (lowerUrl.includes('sam.gov')) {
      if (lowerUrl.includes('/search') || lowerUrl.includes('searchcriteria')) {
        return {
          error: 'SAM.gov search page URL detected',
          guidance:
            'Search URLs cannot be imported. Please: 1) Click on a specific opportunity from the search results, 2) Copy the URL which should look like "sam.gov/opp/{id}/view", 3) Paste that URL here.',
        };
      }
      if (lowerUrl.includes('/workspace')) {
        return {
          error: 'SAM.gov workspace URL requires authentication',
          guidance:
            'Workspace URLs require you to be logged in to SAM.gov. Please use the public URL format: sam.gov/opp/{opportunityId}/view. You can find this by searching for the opportunity while not logged in.',
        };
      }

      // Check if it looks like a valid opportunity URL but extraction failed
      if (lowerUrl.includes('/opp/')) {
        return {
          error: 'Failed to extract SAM.gov opportunity',
          guidance:
            'The opportunity URL appears correct but extraction failed. Possible causes: 1) The opportunity has been archived or withdrawn, 2) The opportunity ID is invalid, 3) SAM.gov may be experiencing issues. Please verify the opportunity is still active on sam.gov.',
        };
      }

      return {
        error: 'Invalid SAM.gov URL format',
        guidance:
          'Please use a direct opportunity URL in format: sam.gov/opp/{opportunity-id}/view. You can find this URL by clicking on a specific opportunity in SAM.gov search results.',
      };
    }

    // BeaconBid specific errors
    if (lowerUrl.includes('beaconbid.com')) {
      if (!lowerUrl.includes('/solicitations/')) {
        return {
          error: 'Invalid BeaconBid URL format',
          guidance:
            'Please use a direct solicitation URL (format: beaconbid.com/solicitations/{agency}/{id}/{title}). Search pages and dashboard URLs are not supported.',
        };
      }
      return {
        error: 'Could not extract RFP information from BeaconBid',
        guidance:
          'Verify the solicitation is still active. The URL should contain a UUID-style ID in the path. Some solicitations may require registration to access.',
      };
    }

    // Austin Finance specific errors
    if (
      lowerUrl.includes('austintexas.gov') ||
      lowerUrl.includes('austin.gov')
    ) {
      if (!lowerUrl.includes('solicitation_details.cfm')) {
        return {
          error: 'Invalid Austin Finance URL format',
          guidance:
            'Please use a direct solicitation details URL (format: financeonline.austintexas.gov/.../solicitation_details.cfm?sid={id}). List pages are not supported.',
        };
      }
      return {
        error: 'Could not extract RFP information from Austin Finance',
        guidance:
          'Verify the solicitation number (sid parameter) is correct and the opportunity is still active.',
      };
    }

    // FindRFP specific errors
    if (lowerUrl.includes('findrfp.com')) {
      if (!lowerUrl.includes('rfpid=')) {
        return {
          error: 'Invalid FindRFP URL format',
          guidance:
            'Please use a direct RFP detail URL (format: findrfp.com/service/detail.aspx?rfpid={id}). Category and search pages are not supported.',
        };
      }
      return {
        error: 'Could not extract RFP information from FindRFP',
        guidance:
          'Verify the rfpid parameter is valid and the RFP has not been closed or removed.',
      };
    }

    // Bonfire specific errors
    if (lowerUrl.includes('gobonfire.com') || lowerUrl.includes('bonfire')) {
      return {
        error: 'Could not extract RFP information from Bonfire portal',
        guidance:
          'Bonfire portals often require registration. Please ensure you are using a public opportunity URL and the opportunity is open for submissions.',
      };
    }

    // Generic portal error
    return {
      error: 'RFP extraction failed for this portal',
      guidance:
        'This portal may not be fully supported yet. Supported portals include: SAM.gov, BeaconBid, Austin Finance, and FindRFP. Please verify the URL points to a specific RFP/opportunity page, not a search or list page.',
    };
  }

  private extractRfpIdFromUrl(url: string): string | null {
    // Extract RFP ID from Austin Finance URLs
    const matches = url.match(/rfp[/_-](\d+)/i) || url.match(/id[=:](\d+)/i);
    return matches ? matches[1] : null;
  }
}
