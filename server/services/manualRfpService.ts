import { randomUUID } from "crypto"
import { nanoid } from "nanoid"
import OpenAI from "openai"
import { storage } from "../storage.js"
import { AustinFinanceDocumentScraper } from "./austinFinanceDocumentScraper.js"
import { DocumentIntelligenceService } from "./documentIntelligenceService.js"
import { getMastraScrapingService } from "./mastraScrapingService.js"
import { progressTracker } from "./progressTracker.js"
import { scrapeRFPFromUrl } from "./rfpScrapingService.js"

export interface ManualRfpInput {
  url: string
  userNotes?: string
}

export interface ManualRfpResult {
  success: boolean
  sessionId: string
  rfpId?: string
  error?: string
  message: string
}

export class ManualRfpService {
  private mastraService: ReturnType<typeof getMastraScrapingService>
  private documentScraper: AustinFinanceDocumentScraper
  private documentIntelligence: DocumentIntelligenceService
  private openai: OpenAI

  constructor() {
    this.mastraService = getMastraScrapingService()
    this.documentScraper = new AustinFinanceDocumentScraper()
    this.documentIntelligence = new DocumentIntelligenceService()
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }

  async processManualRfp(input: ManualRfpInput): Promise<ManualRfpResult> {
    const sessionId = randomUUID()

    try {
      console.log(
        `[ManualRfpService] Processing manual RFP from URL: ${input.url}`
      )

      // Start progress tracking
      progressTracker.startTracking(sessionId, input.url)
      progressTracker.updateStep(
        sessionId,
        "portal_detection",
        "in_progress",
        "Analyzing portal type..."
      )

      // Use the new enhanced RFP scraping service with Mastra/Browserbase
      console.log(
        `[ManualRfpService] Using enhanced Mastra/Browserbase scraping service`
      )
      progressTracker.updateStep(
        sessionId,
        "portal_detection",
        "completed",
        "Portal type detected"
      )
      progressTracker.updateStep(
        sessionId,
        "page_navigation",
        "in_progress",
        "Navigating to RFP page..."
      )

      const scrapingResult = await scrapeRFPFromUrl(input.url, "manual")

      if (!scrapingResult || !scrapingResult.rfp) {
        progressTracker.updateStep(
          sessionId,
          "page_navigation",
          "failed",
          "Primary extraction failed, trying fallback method"
        )
        // Fallback to existing method if new scraper fails
        console.log(
          `[ManualRfpService] Falling back to legacy extraction method`
        )

        // Step 1: Analyze the URL to determine portal type and extraction strategy
        const portalAnalysis = await this.analyzePortalUrl(input.url)
        console.log(`[ManualRfpService] Portal analysis:`, portalAnalysis)

        // Step 2: Extract RFP data using appropriate method
        let rfpData
        if (portalAnalysis.isAustinFinance) {
          rfpData = await this.extractAustinFinanceRfp(input.url)
        } else {
          rfpData = await this.extractGenericRfp(input.url, portalAnalysis)
        }

        if (!rfpData) {
          progressTracker.failTracking(
            sessionId,
            "Could not extract RFP data from the provided URL"
          )
          return {
            success: false,
            sessionId,
            error: "Could not extract RFP data from the provided URL",
            message:
              "Unable to extract RFP information. Please verify the URL is correct and accessible.",
          }
        }

        // Step 3: Create RFP entry with manual tracking
        const rfpId = await this.createManualRfpEntry(rfpData, input)
        console.log(`[ManualRfpService] Created manual RFP with ID: ${rfpId}`)

        // Step 4: Trigger comprehensive processing for all manual RFPs
        await this.triggerDocumentProcessing(rfpId)

        // Step 5: Create notification
        await storage.createNotification({
          type: "info",
          title: "Manual RFP Added",
          message: `RFP "${rfpData.title}" has been added manually and is being processed.`,
          relatedEntityType: "rfp",
          relatedEntityId: rfpId,
          isRead: false,
        })

        progressTracker.setRfpId(sessionId, rfpId)
        progressTracker.completeTracking(sessionId, rfpId)

        return {
          success: true,
          sessionId,
          rfpId: rfpId,
          message: `RFP "${rfpData.title}" has been successfully added and processing has begun.`,
        }
      }

      // Enhanced scraper succeeded - use the scraped data
      progressTracker.updateStep(
        sessionId,
        "page_navigation",
        "completed",
        "Successfully navigated to RFP page"
      )
      progressTracker.updateStep(
        sessionId,
        "data_extraction",
        "completed",
        "RFP information extracted"
      )
      progressTracker.updateStep(
        sessionId,
        "document_discovery",
        "completed",
        `Found ${scrapingResult.documents?.length || 0} documents`
      )
      progressTracker.updateStep(
        sessionId,
        "document_download",
        "completed",
        "Documents downloaded"
      )
      progressTracker.updateStep(
        sessionId,
        "database_save",
        "completed",
        "RFP saved to database"
      )

      const rfpId = scrapingResult.rfp.id
      const rfpTitle = scrapingResult.rfp.title
      progressTracker.setRfpId(sessionId, rfpId)

      // Add user notes if provided
      if (input.userNotes) {
        await storage.updateRFP(rfpId, {
          description:
            scrapingResult.rfp.description +
            `\n\nUser Notes: ${input.userNotes}`,
          updatedAt: new Date(),
        })
      }

      // Log any errors that occurred during scraping
      if (scrapingResult.errors && scrapingResult.errors.length > 0) {
        console.warn(
          `[ManualRfpService] Scraping completed with warnings:`,
          scrapingResult.errors
        )
      }

      // Create notification
      await storage.createNotification({
        type: "info",
        title: "Manual RFP Added",
        message: `RFP "${rfpTitle}" has been successfully added with ${
          scrapingResult.documents?.length || 0
        } documents.`,
        relatedEntityType: "rfp",
        relatedEntityId: rfpId,
        isRead: false,
      })

      // Trigger enhanced proposal generation (this will complete the tracking when done)
      progressTracker.updateStep(
        sessionId,
        "ai_analysis",
        "in_progress",
        "Starting AI analysis and proposal generation"
      )
      this.triggerDocumentProcessingWithProgress(rfpId, sessionId)

      return {
        success: true,
        sessionId,
        rfpId: rfpId,
        message: `RFP "${rfpTitle}" has been successfully added and processing has begun. ${
          scrapingResult.documents?.length || 0
        } documents were downloaded.`,
      }
    } catch (error) {
      console.error("[ManualRfpService] Error processing manual RFP:", error)
      progressTracker.failTracking(
        sessionId,
        error instanceof Error ? error.message : "Unknown error"
      )

      return {
        success: false,
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
        message:
          "Failed to process the RFP URL. Please try again or contact support.",
      }
    }
  }

  private async analyzePortalUrl(url: string): Promise<{
    isAustinFinance: boolean
    portalType: string
    confidence: number
    extractionStrategy: string
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
}`

      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })

      const analysis = JSON.parse(response.choices[0].message.content || "{}")

      return {
        isAustinFinance: analysis.isAustinFinance || false,
        portalType: analysis.portalType || "Unknown",
        confidence: analysis.confidence || 50,
        extractionStrategy: analysis.extractionStrategy || "mastra_generic",
      }
    } catch (error) {
      console.error("[ManualRfpService] Error analyzing portal URL:", error)
      return {
        isAustinFinance: false,
        portalType: "Unknown",
        confidence: 0,
        extractionStrategy: "mastra_generic",
      }
    }
  }

  private async extractAustinFinanceRfp(url: string) {
    try {
      // Use existing Austin Finance scraper
      const rfpId = this.extractRfpIdFromUrl(url)
      if (!rfpId) {
        throw new Error("Could not extract RFP ID from Austin Finance URL")
      }

      console.log(`[ManualRfpService] Extracting Austin Finance RFP: ${rfpId}`)

      // Use the existing document scraper to get RFP details
      const documents = await this.documentScraper.scrapeRFPDocuments(
        rfpId,
        url
      )

      // Extract basic details from the page
      const rfpDetails = {
        title: `Austin Finance RFP ${rfpId}`,
        description: "RFP from Austin Finance Online",
        agency: "City of Austin",
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: [],
      }

      return {
        title: rfpDetails.title || "Austin Finance RFP",
        description: rfpDetails.description || "",
        agency: rfpDetails.agency || "City of Austin",
        deadline: rfpDetails.deadline
          ? new Date(rfpDetails.deadline)
          : undefined,
        estimatedValue: rfpDetails.estimatedValue
          ? parseFloat(rfpDetails.estimatedValue)
          : undefined,
        requirements: rfpDetails.requirements || {},
        complianceItems: rfpDetails.complianceItems || [],
        riskFlags: rfpDetails.riskFlags || [],
        hasDocuments: documents && documents.length > 0,
        documents: documents || [],
        portalName: "Austin Finance Online",
      }
    } catch (error) {
      console.error(
        "[ManualRfpService] Error extracting Austin Finance RFP:",
        error
      )
      return null
    }
  }

  private async extractGenericRfp(url: string, portalAnalysis: any) {
    try {
      console.log(
        `[ManualRfpService] Extracting generic RFP from: ${portalAnalysis.portalType}`
      )

      // Use Mastra to scrape the page content
      const pageContent = await this.scrapePageContent(url)

      if (!pageContent) {
        throw new Error("Could not scrape page content")
      }

      // Use AI to extract RFP information from the scraped content
      const rfpData = await this.extractRfpDataFromContent(pageContent, url)

      return {
        ...rfpData,
        hasDocuments: false, // Generic RFPs may not have downloadable documents
        documents: [],
        portalName: portalAnalysis.portalType,
      }
    } catch (error) {
      console.error("[ManualRfpService] Error extracting generic RFP:", error)
      return null
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

If any field cannot be determined, use null or empty values.`

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-5",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.1,
      })

      const extracted = JSON.parse(response.choices[0].message.content || "{}")

      return {
        title: extracted.title || "Manual RFP Entry",
        description: extracted.description || "",
        agency: extracted.agency || "Unknown Agency",
        deadline: extracted.deadline ? new Date(extracted.deadline) : undefined,
        estimatedValue: extracted.estimatedValue
          ? parseFloat(extracted.estimatedValue)
          : undefined,
        requirements: extracted.requirements || {},
        complianceItems: extracted.complianceItems || [],
        riskFlags: extracted.riskFlags || [],
      }
    } catch (error) {
      console.error(
        "[ManualRfpService] Error extracting RFP data from content:",
        error
      )
      return {
        title: "Manual RFP Entry",
        description: "RFP added manually from URL",
        agency: "Unknown Agency",
        deadline: undefined,
        estimatedValue: undefined,
        requirements: {},
        complianceItems: [],
        riskFlags: [],
      }
    }
  }

  private async createManualRfpEntry(
    rfpData: any,
    input: ManualRfpInput
  ): Promise<string> {
    const rfpId = nanoid()

    // Find or create a generic portal for manual entries
    let portalId = await this.findOrCreateManualPortal(
      rfpData.portalName || "Manual Entry"
    )

    const rfp = {
      id: rfpId,
      title: rfpData.title,
      description:
        rfpData.description +
        (input.userNotes ? `\n\nUser Notes: ${input.userNotes}` : ""),
      agency: rfpData.agency,
      portalId: portalId,
      sourceUrl: input.url,
      deadline: rfpData.deadline,
      estimatedValue: rfpData.estimatedValue,
      status: "discovered" as const,
      progress: 10, // Manual entries start with some progress
      requirements: rfpData.requirements,
      complianceItems: rfpData.complianceItems,
      riskFlags: rfpData.riskFlags,
      addedBy: "manual" as const,
      manuallyAddedAt: new Date(),
      discoveredAt: new Date(),
      updatedAt: new Date(),
    }

    await storage.createRFP(rfp)

    // Store documents if available
    if (rfpData.documents && rfpData.documents.length > 0) {
      for (const doc of rfpData.documents) {
        await storage.createDocument({
          rfpId: rfpId,
          filename: doc.filename,
          fileType: doc.fileType || doc.type || "unknown",
          objectPath: doc.objectPath || doc.path || "",
          extractedText: doc.extractedText,
          parsedData: doc.parsedData,
        })
      }
    }

    return rfpId
  }

  private async findOrCreateManualPortal(portalName: string): Promise<string> {
    // Try to find existing portal
    const portals = await storage.getAllPortals()
    const existingPortal = portals.find((p: any) =>
      p.name.toLowerCase().includes(portalName.toLowerCase())
    )

    if (existingPortal) {
      return existingPortal.id
    }

    // Create a new portal for manual entries
    const portalId = nanoid()
    await storage.createPortal({
      name: `${portalName} (Manual)`,
      url: "https://manual-entry.local",
      loginRequired: false,
      status: "active",
      scanFrequency: 24,
      maxRfpsPerScan: 50,
      errorCount: 0,
    })

    return portalId
  }

  private async triggerDocumentProcessing(rfpId: string) {
    try {
      console.log(
        `[ManualRfpService] Triggering comprehensive processing for RFP: ${rfpId}`
      )

      // Update RFP status to indicate processing has started
      await storage.updateRFP(rfpId, {
        status: "parsing",
        progress: 25,
        updatedAt: new Date(),
      })

      // Trigger enhanced proposal generation workflow
      this.triggerEnhancedProposalGeneration(rfpId)
    } catch (error) {
      console.error(
        "[ManualRfpService] Error triggering document processing:",
        error
      )
    }
  }

  private async triggerDocumentProcessingWithProgress(
    rfpId: string,
    sessionId: string
  ) {
    try {
      console.log(
        `[ManualRfpService] Triggering comprehensive processing with progress for RFP: ${rfpId}`
      )

      // Update RFP status to indicate processing has started
      await storage.updateRFP(rfpId, {
        status: "parsing",
        progress: 25,
        updatedAt: new Date(),
      })

      // Trigger enhanced proposal generation workflow with progress tracking
      this.triggerEnhancedProposalGenerationWithProgress(rfpId, sessionId)
    } catch (error) {
      console.error(
        "[ManualRfpService] Error triggering document processing:",
        error
      )
      progressTracker.failTracking(
        sessionId,
        "Failed to trigger document processing"
      )
    }
  }

  private async triggerEnhancedProposalGeneration(rfpId: string) {
    try {
      console.log(
        `[ManualRfpService] Starting enhanced proposal generation for RFP: ${rfpId}`
      )

      // Import the enhanced proposal service dynamically to avoid circular dependencies
      const { enhancedProposalService } = await import(
        "./enhancedProposalService.js"
      )

      // Trigger comprehensive proposal generation in the background
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false, // Manual RFPs should not auto-submit
          companyProfileId: undefined, // Use default company profile
        })
        .then((result) => {
          console.log(
            `[ManualRfpService] Enhanced proposal generation completed for RFP: ${rfpId}`,
            result
          )

          // Create success notification
          storage.createNotification({
            type: "success",
            title: "Manual RFP Processing Complete",
            message: `RFP processing has completed. ${
              result.humanActionItems?.length || 0
            } action items require your attention.`,
            relatedEntityType: "rfp",
            relatedEntityId: rfpId,
            isRead: false,
          })
        })
        .catch((error) => {
          console.error(
            `[ManualRfpService] Enhanced proposal generation failed for RFP: ${rfpId}`,
            error
          )

          // Create error notification
          storage.createNotification({
            type: "error",
            title: "Manual RFP Processing Failed",
            message: `Processing failed for manually added RFP. Please review and try again.`,
            relatedEntityType: "rfp",
            relatedEntityId: rfpId,
            isRead: false,
          })

          // Update RFP status to indicate error
          storage.updateRFP(rfpId, {
            status: "discovered",
            progress: 10,
            updatedAt: new Date(),
          })
        })
    } catch (error) {
      console.error(
        "[ManualRfpService] Error triggering enhanced proposal generation:",
        error
      )
    }
  }

  private async triggerEnhancedProposalGenerationWithProgress(
    rfpId: string,
    sessionId: string
  ) {
    try {
      console.log(
        `[ManualRfpService] Starting enhanced proposal generation with progress for RFP: ${rfpId}`
      )

      // Import the enhanced proposal service dynamically to avoid circular dependencies
      const { enhancedProposalService } = await import(
        "./enhancedProposalService.js"
      )

      // Trigger comprehensive proposal generation in the background
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false, // Manual RFPs should not auto-submit
          companyProfileId: undefined, // Use default company profile
        })
        .then((result) => {
          console.log(
            `[ManualRfpService] Enhanced proposal generation completed for RFP: ${rfpId}`,
            result
          )

          // Complete the progress tracking
          progressTracker.completeTracking(sessionId, rfpId)

          // Create success notification
          storage.createNotification({
            type: "success",
            title: "Manual RFP Processing Complete",
            message: `RFP processing has completed. ${
              result.humanActionItems?.length || 0
            } action items require your attention.`,
            relatedEntityType: "rfp",
            relatedEntityId: rfpId,
            isRead: false,
          })
        })
        .catch((error) => {
          console.error(
            `[ManualRfpService] Enhanced proposal generation failed for RFP: ${rfpId}`,
            error
          )

          // Fail the progress tracking
          progressTracker.failTracking(
            sessionId,
            `Proposal generation failed: ${error.message}`
          )

          // Create error notification
          storage.createNotification({
            type: "error",
            title: "Manual RFP Processing Failed",
            message: `Processing failed for manually added RFP. Please review and try again.`,
            relatedEntityType: "rfp",
            relatedEntityId: rfpId,
            isRead: false,
          })

          // Update RFP status to indicate error
          storage.updateRFP(rfpId, {
            status: "discovered",
            progress: 10,
            updatedAt: new Date(),
          })
        })
    } catch (error) {
      console.error(
        "[ManualRfpService] Error triggering enhanced proposal generation:",
        error
      )
      progressTracker.failTracking(
        sessionId,
        "Failed to start proposal generation"
      )
    }
  }

  private async scrapePageContent(url: string): Promise<string> {
    try {
      // SECURITY: Validate URL and prevent SSRF attacks
      const parsedUrl = new URL(url)

      // Only allow HTTP/HTTPS protocols
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Only HTTP/HTTPS URLs are allowed")
      }

      // Block private/local IP ranges and localhost
      const hostname = parsedUrl.hostname.toLowerCase()
      const blockedHosts = [
        "localhost",
        "127.0.0.1",
        "::1",
        "10.",
        "172.16.",
        "172.17.",
        "172.18.",
        "172.19.",
        "172.20.",
        "172.21.",
        "172.22.",
        "172.23.",
        "172.24.",
        "172.25.",
        "172.26.",
        "172.27.",
        "172.28.",
        "172.29.",
        "172.30.",
        "172.31.",
        "192.168.",
        "169.254.",
      ]

      if (blockedHosts.some((blocked) => hostname.includes(blocked))) {
        throw new Error("Access to private/local networks is not allowed")
      }

      // Fetch with security restrictions
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "RFP-Agent/1.0 (Automated RFP Processing)",
        },
      })

      clearTimeout(timeoutId)

      // Check response size (limit to 5MB)
      const contentLength = response.headers.get("content-length")
      if (contentLength && parseInt(contentLength) > 5 * 1024 * 1024) {
        throw new Error("Response too large (max 5MB)")
      }

      const html = await response.text()

      // Basic text extraction with size limits
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 10000) // Limit content size

      return textContent
    } catch (error) {
      console.error("[ManualRfpService] Error scraping page content:", error)
      return "Unable to scrape page content"
    }
  }

  private extractRfpIdFromUrl(url: string): string | null {
    // Extract RFP ID from Austin Finance URLs
    const matches = url.match(/rfp[/_-](\d+)/i) || url.match(/id[=:](\d+)/i)
    return matches ? matches[1] : null
  }
}
