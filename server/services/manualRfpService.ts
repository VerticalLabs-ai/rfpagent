import { MastraScrapingService } from './mastraScrapingService.js';
import { AustinFinanceDocumentScraper } from './austinFinanceDocumentScraper.js';
import { DocumentIntelligenceService } from './documentIntelligenceService.js';
import { storage } from '../storage.js';
import { nanoid } from 'nanoid';
import OpenAI from 'openai';

export interface ManualRfpInput {
  url: string;
  userNotes?: string;
}

export interface ManualRfpResult {
  success: boolean;
  rfpId?: string;
  error?: string;
  message: string;
}

export class ManualRfpService {
  private mastraService: MastraScrapingService;
  private documentScraper: AustinFinanceDocumentScraper;
  private documentIntelligence: DocumentIntelligenceService;
  private openai: OpenAI;

  constructor() {
    this.mastraService = new MastraScrapingService();
    this.documentScraper = new AustinFinanceDocumentScraper();
    this.documentIntelligence = new DocumentIntelligenceService();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async processManualRfp(input: ManualRfpInput): Promise<ManualRfpResult> {
    try {
      console.log(`[ManualRfpService] Processing manual RFP from URL: ${input.url}`);

      // Step 1: Analyze the URL to determine portal type and extraction strategy
      const portalAnalysis = await this.analyzePortalUrl(input.url);
      console.log(`[ManualRfpService] Portal analysis:`, portalAnalysis);

      // Step 2: Extract RFP data using appropriate method
      let rfpData;
      if (portalAnalysis.isAustinFinance) {
        rfpData = await this.extractAustinFinanceRfp(input.url);
      } else {
        rfpData = await this.extractGenericRfp(input.url, portalAnalysis);
      }

      if (!rfpData) {
        return {
          success: false,
          error: "Could not extract RFP data from the provided URL",
          message: "Unable to extract RFP information. Please verify the URL is correct and accessible."
        };
      }

      // Step 3: Create RFP entry with manual tracking
      const rfpId = await this.createManualRfpEntry(rfpData, input);
      console.log(`[ManualRfpService] Created manual RFP with ID: ${rfpId}`);

      // Step 4: Trigger document processing if applicable
      if (rfpData.hasDocuments) {
        await this.triggerDocumentProcessing(rfpId);
      }

      // Step 5: Create notification
      await storage.createNotification({
        type: 'info',
        title: 'Manual RFP Added',
        message: `RFP "${rfpData.title}" has been added manually and is being processed.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
        isRead: false
      });

      return {
        success: true,
        rfpId: rfpId,
        message: `RFP "${rfpData.title}" has been successfully added and processing has begun.`
      };

    } catch (error) {
      console.error('[ManualRfpService] Error processing manual RFP:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: "Failed to process the RFP URL. Please try again or contact support."
      };
    }
  }

  private async analyzePortalUrl(url: string): Promise<{
    isAustinFinance: boolean;
    portalType: string;
    confidence: number;
    extractionStrategy: string;
  }> {
    try {
      const prompt = `Analyze this RFP URL and determine the portal type and best extraction strategy:

URL: ${url}

Please analyze:
1. Is this an Austin Finance Online portal URL?
2. What type of procurement portal is this?
3. What extraction strategy would work best?

Respond with JSON only:
{
  "isAustinFinance": boolean,
  "portalType": "string (e.g., 'Austin Finance', 'Bonfire', 'FindRFP', 'Unknown')",
  "confidence": number (0-100),
  "extractionStrategy": "string (e.g., 'austin_finance_scraper', 'mastra_generic', 'document_download')"
}`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        isAustinFinance: analysis.isAustinFinance || false,
        portalType: analysis.portalType || 'Unknown',
        confidence: analysis.confidence || 50,
        extractionStrategy: analysis.extractionStrategy || 'mastra_generic'
      };

    } catch (error) {
      console.error('[ManualRfpService] Error analyzing portal URL:', error);
      return {
        isAustinFinance: false,
        portalType: 'Unknown',
        confidence: 0,
        extractionStrategy: 'mastra_generic'
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
      const documents = await this.documentScraper.scrapeRFPDocuments(rfpId, url);
      
      // Extract basic details from the page
      const rfpDetails = {
        title: `Austin Finance RFP ${rfpId}`,
        description: 'RFP from Austin Finance Online',
        agency: 'City of Austin',
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: []
      };

      return {
        title: rfpDetails.title || 'Austin Finance RFP',
        description: rfpDetails.description || '',
        agency: rfpDetails.agency || 'City of Austin',
        deadline: rfpDetails.deadline ? new Date(rfpDetails.deadline) : undefined,
        estimatedValue: rfpDetails.estimatedValue ? parseFloat(rfpDetails.estimatedValue) : undefined,
        requirements: rfpDetails.requirements || {},
        complianceItems: rfpDetails.complianceItems || [],
        riskFlags: rfpDetails.riskFlags || [],
        hasDocuments: documents && documents.length > 0,
        documents: documents || [],
        portalName: 'Austin Finance Online'
      };

    } catch (error) {
      console.error('[ManualRfpService] Error extracting Austin Finance RFP:', error);
      return null;
    }
  }

  private async extractGenericRfp(url: string, portalAnalysis: any) {
    try {
      console.log(`[ManualRfpService] Extracting generic RFP from: ${portalAnalysis.portalType}`);

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
        portalName: portalAnalysis.portalType
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
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      const extracted = JSON.parse(response.choices[0].message.content || '{}');
      
      return {
        title: extracted.title || 'Manual RFP Entry',
        description: extracted.description || '',
        agency: extracted.agency || 'Unknown Agency',
        deadline: extracted.deadline ? new Date(extracted.deadline) : undefined,
        estimatedValue: extracted.estimatedValue ? parseFloat(extracted.estimatedValue) : undefined,
        requirements: extracted.requirements || {},
        complianceItems: extracted.complianceItems || [],
        riskFlags: extracted.riskFlags || []
      };

    } catch (error) {
      console.error('[ManualRfpService] Error extracting RFP data from content:', error);
      return {
        title: 'Manual RFP Entry',
        description: 'RFP added manually from URL',
        agency: 'Unknown Agency',
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: []
      };
    }
  }

  private async createManualRfpEntry(rfpData: any, input: ManualRfpInput): Promise<string> {
    const rfpId = nanoid();
    
    // Find or create a generic portal for manual entries
    let portalId = await this.findOrCreateManualPortal(rfpData.portalName || 'Manual Entry');

    const rfp = {
      id: rfpId,
      title: rfpData.title,
      description: rfpData.description + (input.userNotes ? `\n\nUser Notes: ${input.userNotes}` : ''),
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
          parsedData: doc.parsedData
        });
      }
    }

    return rfpId;
  }

  private async findOrCreateManualPortal(portalName: string): Promise<string> {
    // Try to find existing portal
    const portals = await storage.getAllPortals();
    const existingPortal = portals.find((p: any) => p.name.toLowerCase().includes(portalName.toLowerCase()));
    
    if (existingPortal) {
      return existingPortal.id;
    }

    // Create a new portal for manual entries
    const portalId = nanoid();
    await storage.createPortal({
      name: `${portalName} (Manual)`,
      url: 'https://manual-entry.local',
      loginRequired: false,
      status: 'active',
      scanFrequency: 24,
      maxRfpsPerScan: 50,
      errorCount: 0
    });

    return portalId;
  }

  private async triggerDocumentProcessing(rfpId: string) {
    try {
      console.log(`[ManualRfpService] Triggering document processing for RFP: ${rfpId}`);
      
      // Update RFP status to indicate processing has started
      await storage.updateRFP(rfpId, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date()
      });

      // The document intelligence service will handle the processing
      // This could be enhanced to queue background jobs
      
    } catch (error) {
      console.error('[ManualRfpService] Error triggering document processing:', error);
    }
  }

  private async scrapePageContent(url: string): Promise<string> {
    try {
      // Simple fetch-based scraping for generic pages
      const response = await fetch(url);
      const html = await response.text();
      
      // Basic text extraction (could be enhanced with better parsing)
      const textContent = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                              .replace(/<[^>]*>/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim();
                              
      return textContent.slice(0, 10000); // Limit content size
    } catch (error) {
      console.error('[ManualRfpService] Error scraping page content:', error);
      return 'Unable to scrape page content';
    }
  }

  private extractRfpIdFromUrl(url: string): string | null {
    // Extract RFP ID from Austin Finance URLs
    const matches = url.match(/rfp[/_-](\d+)/i) || url.match(/id[=:](\d+)/i);
    return matches ? matches[1] : null;
  }
}