import type { Document, RFP } from "@shared/schema"
import { storage } from "../storage"
import { agentMemoryService } from "./agentMemoryService"
import { aiService } from "./aiService"
import { analysisOrchestrator } from "./analysisOrchestrator"

export interface ComplianceAnalysisResult {
  rfpId: string
  success: boolean
  complianceData?: {
    requirements: Array<{
      type: string
      description: string
      mandatory: boolean
    }>
    complianceItems: Array<{
      field: string
      description: string
      format: string
    }>
    riskFlags: Array<{
      type: "high" | "medium" | "low"
      category: string
      description: string
    }>
  }
  error?: string
  metadata?: any
}

/**
 * Compliance Integration Service
 *
 * Provides automatic compliance analysis triggers and batch processing capabilities
 * for discovered RFPs. Ensures compliance data is structured correctly for the UI.
 */
export class ComplianceIntegrationService {
  private readonly sessionId = "compliance-integration-service"
  private processingQueue = new Set<string>()

  /**
   * Automatically trigger compliance analysis for a newly discovered RFP
   */
  async triggerComplianceAnalysisForDiscoveredRFP(
    rfpId: string
  ): Promise<ComplianceAnalysisResult> {
    console.log(`🔍 Auto-triggering compliance analysis for RFP: ${rfpId}`)

    try {
      // Check if already processing
      if (this.processingQueue.has(rfpId)) {
        console.log(`⏳ RFP ${rfpId} already in processing queue, skipping...`)
        return {
          rfpId,
          success: false,
          error: "Already in processing queue",
        }
      }

      // Add to processing queue
      this.processingQueue.add(rfpId)

      // Get RFP details
      const rfp = await storage.getRFP(rfpId)
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`)
      }

      // Check if RFP already has compliance data
      if (rfp.requirements && rfp.complianceItems && rfp.riskFlags) {
        console.log(
          `✅ RFP ${rfpId} already has compliance data, skipping analysis`
        )
        this.processingQueue.delete(rfpId)
        return {
          rfpId,
          success: true,
          complianceData: this.formatComplianceData(rfp),
        }
      }

      // Get documents for this RFP
      const documents = await storage.getDocumentsByRFP(rfpId)

      if (documents.length === 0) {
        console.log(
          `📄 No documents found for RFP ${rfpId}, performing basic compliance analysis`
        )
        return await this.performBasicComplianceAnalysis(rfp)
      }

      // Check if documents have extracted text
      const documentsWithText = documents.filter((doc) => doc.extractedText)

      if (documentsWithText.length === 0) {
        console.log(
          `📝 No extracted text found, starting full analysis workflow for RFP ${rfpId}`
        )
        return await this.startFullAnalysisWorkflow(rfp)
      }

      // Perform direct compliance analysis on existing text
      console.log(
        `⚡ Performing direct compliance analysis for RFP ${rfpId} with ${documentsWithText.length} documents`
      )
      return await this.performDirectComplianceAnalysis(rfp, documentsWithText)
    } catch (error) {
      console.error(
        `❌ Auto compliance analysis failed for RFP ${rfpId}:`,
        error
      )
      this.processingQueue.delete(rfpId)
      return {
        rfpId,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    } finally {
      // Always remove from processing queue
      this.processingQueue.delete(rfpId)
    }
  }

  /**
   * Batch process all unprocessed RFPs for compliance analysis
   */
  async batchProcessUnprocessedRFPs(
    limit: number = 50
  ): Promise<ComplianceAnalysisResult[]> {
    console.log(
      `🔄 Starting batch processing of unprocessed RFPs (limit: ${limit})`
    )

    try {
      // Get RFPs that don't have compliance data
      const { rfps: allRfps } = await storage.getAllRFPs({ limit: 1000 })

      const unprocessedRfps = allRfps
        .filter(
          (rfp) =>
            !rfp.requirements ||
            !rfp.complianceItems ||
            !rfp.riskFlags ||
            (Array.isArray(rfp.requirements) && rfp.requirements.length === 0)
        )
        .slice(0, limit)

      console.log(
        `📊 Found ${unprocessedRfps.length} unprocessed RFPs out of ${allRfps.length} total`
      )

      if (unprocessedRfps.length === 0) {
        console.log("✅ All RFPs already have compliance data")
        return []
      }

      // Process RFPs in parallel (with concurrency limit)
      const results: ComplianceAnalysisResult[] = []
      const concurrency = 3 // Process 3 at a time to avoid overwhelming the system

      for (let i = 0; i < unprocessedRfps.length; i += concurrency) {
        const batch = unprocessedRfps.slice(i, i + concurrency)
        console.log(
          `🔄 Processing batch ${
            Math.floor(i / concurrency) + 1
          } of ${Math.ceil(unprocessedRfps.length / concurrency)} (${
            batch.length
          } RFPs)`
        )

        const batchPromises = batch.map((rfp) =>
          this.triggerComplianceAnalysisForDiscoveredRFP(rfp.id)
        )

        const batchResults = await Promise.allSettled(batchPromises)

        batchResults.forEach((result, index) => {
          if (result.status === "fulfilled") {
            results.push(result.value)
          } else {
            console.error(
              `❌ Batch processing failed for RFP ${batch[index].id}:`,
              result.reason
            )
            results.push({
              rfpId: batch[index].id,
              success: false,
              error: result.reason?.message || "Batch processing failed",
            })
          }
        })

        // Small delay between batches to prevent overwhelming the system
        if (i + concurrency < unprocessedRfps.length) {
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
      }

      console.log(
        `✅ Batch processing completed: ${
          results.filter((r) => r.success).length
        }/${results.length} successful`
      )
      return results
    } catch (error) {
      console.error("❌ Batch processing failed:", error)
      throw error
    }
  }

  /**
   * Perform basic compliance analysis using RFP metadata only
   */
  private async performBasicComplianceAnalysis(
    rfp: RFP
  ): Promise<ComplianceAnalysisResult> {
    try {
      console.log(
        `📋 Performing basic compliance analysis for RFP: ${rfp.title}`
      )

      // Use AI service to analyze RFP metadata for basic compliance
      const basicAnalysis = await aiService.generateContent(`
        Analyze this RFP for basic compliance requirements and risk factors:

        Title: ${rfp.title}
        Agency: ${rfp.agency}
        Description: ${rfp.description || "No description available"}
        Estimated Value: ${rfp.estimatedValue || "Not specified"}
        Deadline: ${rfp.deadline || "Not specified"}

        Provide a JSON response with:
        1. requirements: array of {type, description, mandatory} objects
        2. complianceItems: array of {field, description, format} objects
        3. riskFlags: array of {type, category, description} objects (type: high/medium/low)

        Focus on typical government RFP requirements and common risk factors.
      `)

      let complianceData
      try {
        complianceData = JSON.parse(basicAnalysis as string)
      } catch (parseError) {
        // Fallback to structured defaults if AI response can't be parsed
        complianceData = this.generateDefaultComplianceData(rfp)
      }

      // Ensure proper structure
      const formattedData = this.formatAndValidateComplianceData(complianceData)

      // Update RFP with compliance data
      await storage.updateRFP(rfp.id, {
        requirements: formattedData.requirements,
        complianceItems: formattedData.complianceItems,
        riskFlags: formattedData.riskFlags,
      })

      // Store memory of basic analysis
      await agentMemoryService.storeMemory({
        agentId: "compliance-integration-service",
        memoryType: "semantic",
        contextKey: `basic_compliance_${rfp.id}`,
        title: `Basic Compliance Analysis: ${rfp.title}`,
        content: {
          rfpId: rfp.id,
          rfpTitle: rfp.title,
          analysisType: "basic",
          complianceData: formattedData,
          processedAt: new Date(),
        },
        importance: 7,
        metadata: {
          rfpId: rfp.id,
          analysisType: "basic",
        },
      })

      return {
        rfpId: rfp.id,
        success: true,
        complianceData: formattedData,
        metadata: {
          analysisType: "basic",
          documentsAnalyzed: 0,
        },
      }
    } catch (error) {
      console.error(
        `❌ Basic compliance analysis failed for RFP ${rfp.id}:`,
        error
      )
      return {
        rfpId: rfp.id,
        success: false,
        error: error instanceof Error ? error.message : "Basic analysis failed",
      }
    }
  }

  /**
   * Perform direct compliance analysis on documents with extracted text
   */
  private async performDirectComplianceAnalysis(
    rfp: RFP,
    documents: Document[]
  ): Promise<ComplianceAnalysisResult> {
    try {
      console.log(
        `📋 Performing direct compliance analysis for RFP: ${rfp.title} with ${documents.length} documents`
      )

      // Combine all extracted text
      const combinedText = documents
        .map((doc) => doc.extractedText)
        .filter((text) => text)
        .join("\n\n")

      if (!combinedText.trim()) {
        console.log(
          `⚠️ No meaningful text found, falling back to basic analysis`
        )
        return await this.performBasicComplianceAnalysis(rfp)
      }

      // Use AI service for comprehensive compliance analysis
      const aiAnalysis = await aiService.analyzeDocumentCompliance(
        combinedText,
        rfp
      )

      // Format the results to match UI expectations
      const formattedData = this.formatAndValidateComplianceData(aiAnalysis)

      // Update RFP with compliance data
      await storage.updateRFP(rfp.id, {
        requirements: formattedData.requirements,
        complianceItems: formattedData.complianceItems,
        riskFlags: formattedData.riskFlags,
      })

      // Store memory of direct analysis
      await agentMemoryService.storeMemory({
        agentId: "compliance-integration-service",
        memoryType: "semantic",
        contextKey: `direct_compliance_${rfp.id}`,
        title: `Direct Compliance Analysis: ${rfp.title}`,
        content: {
          rfpId: rfp.id,
          rfpTitle: rfp.title,
          analysisType: "direct",
          documentsAnalyzed: documents.length,
          complianceData: formattedData,
          processedAt: new Date(),
        },
        importance: 8,
        metadata: {
          rfpId: rfp.id,
          analysisType: "direct",
          documentsAnalyzed: documents.length,
        },
      })

      // Create notification for successful analysis
      await storage.createNotification({
        type: "compliance",
        title: "Compliance Analysis Completed",
        message: `Automated compliance analysis completed for RFP: ${rfp.title}`,
        relatedEntityType: "rfp",
        relatedEntityId: rfp.id,
      })

      return {
        rfpId: rfp.id,
        success: true,
        complianceData: formattedData,
        metadata: {
          analysisType: "direct",
          documentsAnalyzed: documents.length,
          textLength: combinedText.length,
        },
      }
    } catch (error) {
      console.error(
        `❌ Direct compliance analysis failed for RFP ${rfp.id}:`,
        error
      )
      return {
        rfpId: rfp.id,
        success: false,
        error:
          error instanceof Error ? error.message : "Direct analysis failed",
      }
    }
  }

  /**
   * Start full analysis workflow including document processing
   */
  private async startFullAnalysisWorkflow(
    rfp: RFP
  ): Promise<ComplianceAnalysisResult> {
    try {
      console.log(`🔄 Starting full analysis workflow for RFP: ${rfp.title}`)

      // Trigger the full analysis workflow
      const workflowResult = await analysisOrchestrator.executeAnalysisWorkflow(
        {
          rfpId: rfp.id,
          sessionId: this.sessionId,
          priority: 8, // High priority for compliance integration
        }
      )

      if (!workflowResult.success) {
        throw new Error(`Analysis workflow failed: ${workflowResult.error}`)
      }

      return {
        rfpId: rfp.id,
        success: true,
        metadata: {
          analysisType: "full_workflow",
          workflowId: workflowResult.metadata?.workflowId,
          message:
            "Full analysis workflow started - compliance data will be available when workflow completes",
        },
      }
    } catch (error) {
      console.error(`❌ Full workflow start failed for RFP ${rfp.id}:`, error)
      return {
        rfpId: rfp.id,
        success: false,
        error:
          error instanceof Error ? error.message : "Full workflow start failed",
      }
    }
  }

  /**
   * Format compliance data to match UI expectations
   */
  private formatComplianceData(rfp: RFP) {
    return {
      requirements: (rfp.requirements as any[]) || [],
      complianceItems: (rfp.complianceItems as any[]) || [],
      riskFlags: (rfp.riskFlags as any[]) || [],
    }
  }

  /**
   * Format and validate compliance data structure
   */
  private formatAndValidateComplianceData(rawData: any) {
    const requirements = Array.isArray(rawData.requirements)
      ? rawData.requirements
      : []
    const complianceItems = Array.isArray(rawData.complianceItems)
      ? rawData.complianceItems
      : []
    const riskFlags = Array.isArray(rawData.riskFlags) ? rawData.riskFlags : []

    return {
      requirements: requirements.map((req: any) => ({
        type: req.type || "General",
        description: req.description || "",
        mandatory: Boolean(req.mandatory),
      })),
      complianceItems: complianceItems.map((item: any) => ({
        field: item.field || "",
        description: item.description || "",
        format: item.format || "text",
      })),
      riskFlags: riskFlags.map((flag: any) => ({
        type: ["high", "medium", "low"].includes(flag.type)
          ? flag.type
          : "medium",
        category: flag.category || "General",
        description: flag.description || "",
      })),
    }
  }

  /**
   * Generate default compliance data when AI analysis fails
   */
  private generateDefaultComplianceData(rfp: RFP) {
    const requirements = [
      {
        type: "Proposal Submission",
        description: "Submit complete proposal by deadline",
        mandatory: true,
      },
      {
        type: "Company Information",
        description: "Provide company registration and contact details",
        mandatory: true,
      },
    ]

    const complianceItems = [
      {
        field: "Company Name",
        description: "Legal business name",
        format: "text",
      },
      {
        field: "Contact Information",
        description: "Primary contact details",
        format: "contact",
      },
    ]

    const riskFlags = []

    // Add deadline risk if deadline is soon
    if (rfp.deadline) {
      const daysUntilDeadline = Math.ceil(
        (new Date(rfp.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
      if (daysUntilDeadline < 7) {
        riskFlags.push({
          type: "high",
          category: "Deadline",
          description: `Proposal deadline is in ${daysUntilDeadline} days`,
        })
      } else if (daysUntilDeadline < 14) {
        riskFlags.push({
          type: "medium",
          category: "Deadline",
          description: `Proposal deadline is in ${daysUntilDeadline} days`,
        })
      }
    }

    // Add value risk if high value
    if (
      rfp.estimatedValue &&
      parseFloat(rfp.estimatedValue.toString()) > 1000000
    ) {
      riskFlags.push({
        type: "medium",
        category: "High Value",
        description: "High-value contract requires additional scrutiny",
      })
    }

    return { requirements, complianceItems, riskFlags }
  }

  /**
   * Hook to be called when RFPs are created/discovered
   */
  async onRFPDiscovered(rfpId: string): Promise<void> {
    console.log(`🔔 RFP discovered hook triggered for: ${rfpId}`)

    // Trigger compliance analysis asynchronously (don't block RFP creation)
    setImmediate(async () => {
      try {
        await this.triggerComplianceAnalysisForDiscoveredRFP(rfpId)
      } catch (error) {
        console.error(
          `❌ Auto compliance analysis hook failed for RFP ${rfpId}:`,
          error
        )
      }
    })
  }

  /**
   * Get processing status
   */
  getProcessingStatus() {
    return {
      currentlyProcessing: Array.from(this.processingQueue),
      queueSize: this.processingQueue.size,
    }
  }
}

// Export singleton instance
export const complianceIntegrationService = new ComplianceIntegrationService()
