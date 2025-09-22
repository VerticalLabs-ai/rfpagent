import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertRfpSchema, insertProposalSchema, insertPortalSchema, insertDocumentSchema,
  insertCompanyProfileSchema, insertCompanyAddressSchema, insertCompanyContactSchema,
  insertCompanyIdentifierSchema, insertCompanyCertificationSchema, insertCompanyInsuranceSchema,
  insertAiConversationSchema, insertConversationMessageSchema, insertResearchFindingSchema,
  type AiConversation, type ConversationMessage, type ResearchFinding
} from "@shared/schema";
import { ZodError } from "zod";
import { MastraScrapingService } from "./services/mastraScrapingService";
import { DocumentParsingService } from "./services/documentParsingService";
import { AIService } from "./services/aiService";
import { SubmissionService } from "./services/submissionService";
import { NotificationService } from "./services/notificationService";
import { ObjectStorageService } from "./objectStorage";
import { PortalMonitoringService } from "./services/portal-monitoring-service";
import { PortalSchedulerService } from "./services/portal-scheduler-service";
import { aiProposalService } from "./services/ai-proposal-service";
import { enhancedProposalService } from "./services/enhancedProposalService";
import { documentIntelligenceService } from "./services/documentIntelligenceService";
import { scanManager } from "./services/scan-manager";
import { ManualRfpService } from "./services/manualRfpService";
import { aiAgentOrchestrator } from "./services/aiAgentOrchestrator";
import { mastraWorkflowEngine } from "./services/mastraWorkflowEngine";
import { proposalGenerationOrchestrator } from "./services/proposalGenerationOrchestrator";
import analysisRoutes from "./routes/analysis";
import { workflowCoordinator } from "./services/workflowCoordinator";
import { PhiladelphiaDocumentDownloader } from "./services/philadelphiaDocumentDownloader";
import { z } from "zod";

// Runtime service state tracking (tracks actual running status vs environment variables)
const serviceRuntimeState = {
  portalScheduler: false,
  workDistribution: false,
  retryScheduler: false,
  dlqMonitor: false
};

// Zod schemas for AI API endpoints
const AnalyzeRFPRequestSchema = z.object({
  rfpText: z.string().min(1).max(50000),
});

const MapCompanyDataRequestSchema = z.object({
  analysis: z.object({
    requirements: z.object({
      businessType: z.array(z.string()).optional(),
      certifications: z.array(z.string()).optional(),
      insurance: z.object({
        types: z.array(z.string()),
        minimumCoverage: z.number().optional(),
      }).optional(),
      contactRoles: z.array(z.string()).optional(),
      businessSize: z.enum(['small', 'large', 'any']).optional(),
      socioEconomicPreferences: z.array(z.string()).optional(),
      geographicRequirements: z.array(z.string()).optional(),
      experienceRequirements: z.array(z.string()).optional(),
    }),
    complianceItems: z.array(z.object({
      item: z.string(),
      category: z.string(),
      required: z.boolean(),
      description: z.string(),
    })),
    riskFlags: z.array(z.object({
      type: z.enum(['deadline', 'complexity', 'requirements', 'financial']),
      severity: z.enum(['low', 'medium', 'high']),
      description: z.string(),
    })),
    keyDates: z.object({
      deadline: z.string().refine((str) => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      }, {
        message: "Invalid deadline date format"
      }).transform(str => new Date(str)),
      prebidMeeting: z.string().refine((str) => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      }, {
        message: "Invalid prebid meeting date format"
      }).transform(str => new Date(str)).optional(),
      questionsDeadline: z.string().refine((str) => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      }, {
        message: "Invalid questions deadline date format"
      }).transform(str => new Date(str)).optional(),
      sampleSubmission: z.string().refine((str) => {
        const date = new Date(str);
        return !isNaN(date.getTime());
      }, {
        message: "Invalid sample submission date format"
      }).transform(str => new Date(str)).optional(),
    }),
  }),
  companyProfileId: z.string().uuid(),
});

const GenerateProposalRequestSchema = z.object({
  rfpText: z.string().min(1).max(50000),
  companyProfileId: z.string().uuid(),
  proposalType: z.enum(['standard', 'technical', 'construction', 'professional_services']).optional(),
});

// Manual RFP Input Schema
const ManualRfpInputSchema = z.object({
  url: z.string().url("Please provide a valid URL"),
  userNotes: z.string().optional(),
});

// AI Conversation Schemas
const ProcessQueryRequestSchema = z.object({
  query: z.string().min(1).max(10000),
  conversationId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  conversationType: z.enum(['general', 'rfp_search', 'bid_crafting', 'research']).optional(),
});

const ExecuteActionRequestSchema = z.object({
  suggestionId: z.string().min(1),
  conversationId: z.string().uuid(),
  suggestion: z.object({
    id: z.string(),
    label: z.string(),
    action: z.enum(['workflow', 'agent', 'tool', 'navigation']),
    priority: z.enum(['high', 'medium', 'low']),
    estimatedTime: z.string(),
    description: z.string(),
    icon: z.string(),
    payload: z.record(z.any()).optional()
  })
});

const ProcessQueryResponseSchema = z.object({
  conversationId: z.string().uuid(),
  message: z.string(),
  messageType: z.enum(['text', 'rfp_results', 'search_results', 'analysis', 'follow_up']),
  data: z.any().optional(),
  followUpQuestions: z.array(z.string()).optional(),
  actionSuggestions: z.array(z.string()).optional(),
  relatedRfps: z.array(z.any()).optional(),
  researchFindings: z.array(z.any()).optional(),
});

const ConversationHistoryResponseSchema = z.object({
  conversation: z.object({
    id: z.string().uuid(),
    title: z.string(),
    type: z.string(),
    status: z.string(),
    createdAt: z.date(),
    updatedAt: z.date(),
  }),
  messages: z.array(z.object({
    id: z.string().uuid(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    messageType: z.string(),
    createdAt: z.date(),
  })),
});

// Portal Monitoring Validation Schemas
const PortalMonitoringConfigSchema = z.object({
  scanFrequency: z.number().int().min(1).max(168).optional(), // 1 hour to 1 week
  maxRfpsPerScan: z.number().int().min(1).max(200).optional(),
  selectors: z.object({
    rfpList: z.string(),
    rfpItem: z.string(),
    title: z.string(),
    agency: z.string().optional(),
    deadline: z.string().optional(),
    value: z.string().optional(),
    link: z.string(),
    description: z.string().optional(),
  }).optional(),
  filters: z.object({
    minValue: z.number().optional(),
    maxValue: z.number().optional(),
    businessTypes: z.array(z.string()).optional(),
    keywords: z.array(z.string()).optional(),
    excludeKeywords: z.array(z.string()).optional(),
  }).optional(),
});

// Proposal Pipeline Validation Schemas
const ProposalPipelineGenerateRequestSchema = z.object({
  rfpId: z.string().uuid("RFP ID must be a valid UUID"),
  companyProfileId: z.string().uuid("Company Profile ID must be a valid UUID").optional(),
  proposalType: z.enum(['standard', 'technical', 'construction', 'professional_services']).optional(),
  qualityThreshold: z.number().min(0).max(1).optional(),
  autoSubmit: z.boolean().optional(),
  generatePricing: z.boolean().optional(),
  generateCompliance: z.boolean().optional()
});

const ProposalPipelineWorkflowsQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'suspended', 'completed', 'failed']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const ProposalPipelineStatusParamsSchema = z.object({
  pipelineId: z.string().uuid("Pipeline ID must be a valid UUID")
});

// Submission Pipeline Validation Schemas
const SubmissionPipelineStartRequestSchema = z.object({
  submissionId: z.string().uuid("Submission ID must be a valid UUID"),
  sessionId: z.string().optional(),
  portalCredentials: z.object({
    username: z.string().optional(),
    password: z.string().optional(),
    mfaMethod: z.string().optional(),
  }).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  deadline: z.string().refine((str) => {
    const date = new Date(str);
    return !isNaN(date.getTime());
  }, {
    message: "Invalid deadline date format"
  }).transform(str => new Date(str)).optional(),
  retryOptions: z.object({
    maxRetries: z.number().int().min(1).max(10).optional(),
    retryDelay: z.number().int().min(1000).max(300000).optional(),
  }).optional(),
  browserOptions: z.object({
    headless: z.boolean().optional(),
    timeout: z.number().int().min(30000).max(600000).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional()
});

const SubmissionPipelineStatusParamsSchema = z.object({
  pipelineId: z.string().uuid("Pipeline ID must be a valid UUID")
});

const SubmissionPipelineWorkflowsQuerySchema = z.object({
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']).optional(),
  submissionId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional()
});

const SubmissionRetryRequestSchema = z.object({
  submissionId: z.string().uuid("Submission ID must be a valid UUID"),
  sessionId: z.string().optional(),
  retryOptions: z.object({
    maxRetries: z.number().int().min(1).max(10).optional(),
    retryDelay: z.number().int().min(1000).max(300000).optional(),
  }).optional(),
  metadata: z.record(z.any()).optional()
});

export async function registerRoutes(app: Express): Promise<Server> {
  const server = createServer(app);
  const scrapingService = new MastraScrapingService(); // Keep for legacy support
  const documentService = new DocumentParsingService();
  const aiService = new AIService();
  const submissionService = new SubmissionService();
  const notificationService = new NotificationService();
  const objectStorageService = new ObjectStorageService();
  
  // Initialize new portal monitoring services
  const portalMonitoringService = new PortalMonitoringService(storage);
  const portalSchedulerService = new PortalSchedulerService(storage, portalMonitoringService);

  // Check environment variable to enable automatic portal scheduling
  const autoPortalScheduler = process.env.AUTO_PORTAL_SCHEDULER === 'true';
  if (autoPortalScheduler) {
    console.log("🔄 Auto-starting portal scheduler (enabled via AUTO_PORTAL_SCHEDULER=true)");
    portalSchedulerService.initialize().catch(console.error);
  } else {
    console.log("⏸️ Portal scheduler disabled by default (set AUTO_PORTAL_SCHEDULER=true to enable)");
  }

  // System configuration endpoint for monitoring background services  
  app.get("/api/system/config", async (req, res) => {
    try {
      const config = {
        backgroundServices: {
          workDistribution: serviceRuntimeState.workDistribution || process.env.AUTO_WORK_DISTRIBUTION === 'true',
          retryScheduler: serviceRuntimeState.retryScheduler || process.env.AUTO_RETRY_SCHEDULER === 'true', 
          dlqMonitor: serviceRuntimeState.dlqMonitor || process.env.AUTO_DLQ_MONITOR === 'true',
          portalScheduler: serviceRuntimeState.portalScheduler || process.env.AUTO_PORTAL_SCHEDULER === 'true'
        },
        manualOperationMode: !(
          serviceRuntimeState.workDistribution || process.env.AUTO_WORK_DISTRIBUTION === 'true' ||
          serviceRuntimeState.retryScheduler || process.env.AUTO_RETRY_SCHEDULER === 'true' ||
          serviceRuntimeState.dlqMonitor || process.env.AUTO_DLQ_MONITOR === 'true' ||
          serviceRuntimeState.portalScheduler || process.env.AUTO_PORTAL_SCHEDULER === 'true'
        )
      };
      res.json(config);
    } catch (error) {
      console.error("Error fetching system config:", error);
      res.status(500).json({ error: "Failed to fetch system config" });
    }
  });

  // Background service control endpoints - ADMIN ONLY
  app.post("/api/system/services/:service/:action", async (req, res) => {
    try {
      // Basic auth check - in production this should use proper authentication
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== 'Bearer admin-token-change-in-production') {
        return res.status(401).json({ error: 'Unauthorized - admin access required' });
      }

      const { service, action } = req.params;
      
      if (!['enable', 'disable'].includes(action)) {
        return res.status(400).json({ error: "Action must be 'enable' or 'disable'" });
      }

      const response = { service, action, success: false, message: '' };
      
      switch (service) {
        case 'portal-scheduler':
          if (action === 'enable') {
            await portalSchedulerService.initialize();
            serviceRuntimeState.portalScheduler = true;
            response.success = true;
            response.message = 'Portal scheduler enabled and initialized';
          } else {
            // Properly shutdown the portal scheduler and update runtime state
            portalSchedulerService.shutdown();
            serviceRuntimeState.portalScheduler = false;
            response.success = true;
            response.message = 'Portal scheduler shutdown and disabled';
          }
          break;
          
        case 'work-distribution':
          if (action === 'enable') {
            workflowCoordinator.startWorkItemProcessing();
            serviceRuntimeState.workDistribution = true;
            response.success = true;
            response.message = 'Work distribution enabled and processing started';
          } else {
            workflowCoordinator.stopWorkItemProcessing();
            serviceRuntimeState.workDistribution = false;
            response.success = true;
            response.message = 'Work distribution stopped and disabled';
          }
          break;
          
        case 'retry-scheduler':
        case 'dlq-monitor':
          // These services are currently managed by RetryBackoffDlqService 
          // and don't have individual start/stop methods in current implementation
          response.success = false;
          response.message = `${service} control not yet implemented - requires service restart to change`;
          break;
          
        default:
          return res.status(400).json({ error: `Unknown service: ${service}` });
      }

      res.json(response);
    } catch (error) {
      console.error(`Error controlling service:`, error);
      res.status(500).json({ error: "Failed to control service" });
    }
  });

  // Mount Analysis Routes (Phase 7: Analysis Pipeline Integration)
  console.log("Mounting Analysis Routes...");
  app.use('/api/analysis', analysisRoutes);

  // Dashboard metrics
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching dashboard metrics:", error);
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  // Portal management
  app.get("/api/portals", async (req, res) => {
    try {
      const portals = await storage.getAllPortals();
      res.json(portals);
    } catch (error) {
      console.error("Error fetching portals:", error);
      res.status(500).json({ error: "Failed to fetch portals" });
    }
  });

  app.get("/api/portals/activity", async (req, res) => {
    try {
      const activity = await storage.getPortalActivity();
      res.json(activity);
    } catch (error) {
      console.error("Error fetching portal activity:", error);
      res.status(500).json({ error: "Failed to fetch portal activity" });
    }
  });

  app.post("/api/portals", async (req, res) => {
    try {
      const portalData = insertPortalSchema.parse(req.body);
      const portal = await storage.createPortal(portalData);
      res.status(201).json(portal);
    } catch (error) {
      console.error("Error creating portal:", error);
      res.status(400).json({ error: "Failed to create portal" });
    }
  });

  app.put("/api/portals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const portal = await storage.updatePortal(id, updates);
      res.json(portal);
    } catch (error) {
      console.error("Error updating portal:", error);
      res.status(400).json({ error: "Failed to update portal" });
    }
  });

  app.delete("/api/portals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deletePortal(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting portal:", error);
      if (error instanceof Error && error.message === "Portal not found") {
        return res.status(404).json({ error: "Portal not found" });
      }
      res.status(500).json({ error: "Failed to delete portal" });
    }
  });

  // RFP management
  app.get("/api/rfps", async (req, res) => {
    try {
      const { status, portalId, page = "1", limit = "20" } = req.query;
      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);
      
      const result = await storage.getAllRFPs({
        status: status as string,
        portalId: portalId as string,
        limit: parseInt(limit as string),
        offset
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error fetching RFPs:", error);
      res.status(500).json({ error: "Failed to fetch RFPs" });
    }
  });

  app.get("/api/rfps/detailed", async (req, res) => {
    try {
      const rfps = await storage.getRFPsWithDetails();
      res.json(rfps);
    } catch (error) {
      console.error("Error fetching detailed RFPs:", error);
      res.status(500).json({ error: "Failed to fetch detailed RFPs" });
    }
  });

  app.get("/api/rfps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const rfp = await storage.getRFP(id);
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }
      res.json(rfp);
    } catch (error) {
      console.error("Error fetching RFP:", error);
      res.status(500).json({ error: "Failed to fetch RFP" });
    }
  });
  
  // Get documents for a specific RFP
  app.get("/api/rfps/:id/documents", async (req, res) => {
    try {
      const { id } = req.params;
      const documents = await storage.getDocumentsByRFP(id);
      res.json(documents);
    } catch (error) {
      console.error("Error getting RFP documents:", error);
      res.status(500).json({ error: "Failed to get RFP documents" });
    }
  });

  app.post("/api/rfps", async (req, res) => {
    try {
      const rfpData = insertRfpSchema.parse(req.body);
      const rfp = await storage.createRFP(rfpData);
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: rfp.id,
        action: "created",
        details: { source: "manual" }
      });

      res.status(201).json(rfp);
    } catch (error) {
      console.error("Error creating RFP:", error);
      res.status(400).json({ error: "Failed to create RFP" });
    }
  });

  app.put("/api/rfps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const rfp = await storage.updateRFP(id, updates);
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: id,
        action: "updated",
        details: { updates }
      });

      res.json(rfp);
    } catch (error) {
      console.error("Error updating RFP:", error);
      res.status(400).json({ error: "Failed to update RFP" });
    }
  });

  app.delete("/api/rfps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteRFP(id);
      res.json({ success: true, message: "RFP deleted successfully" });
    } catch (error) {
      console.error("Error deleting RFP:", error);
      if (error.message === "RFP not found") {
        res.status(404).json({ error: "RFP not found" });
      } else {
        res.status(500).json({ error: "Failed to delete RFP" });
      }
    }
  });

  // RFP document upload
  app.post("/api/rfps/:id/documents/upload", async (req, res) => {
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/rfps/:id/documents", async (req, res) => {
    try {
      const { id } = req.params;
      const { documentURL, filename, fileType } = req.body;

      if (!documentURL || !filename || !fileType) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const objectPath = objectStorageService.normalizeObjectEntityPath(documentURL);
      
      const document = await storage.createDocument({
        rfpId: id,
        filename,
        fileType,
        objectPath
      });

      // Parse document asynchronously
      documentService.parseDocument(document.id).catch(console.error);

      res.status(201).json({ document, objectPath });
    } catch (error) {
      console.error("Error creating document:", error);
      res.status(500).json({ error: "Failed to create document" });
    }
  });

  // Manual RFP Processing
  const manualRfpService = new ManualRfpService();

  app.post("/api/rfps/manual", async (req, res) => {
    try {
      const validationResult = ManualRfpInputSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid input data",
          details: validationResult.error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        });
      }

      console.log(`📝 Processing manual RFP submission: ${validationResult.data.url}`);
      
      const result = await manualRfpService.processManualRfp(validationResult.data);
      
      if (result.success) {
        // Create audit log for manual RFP addition
        await storage.createAuditLog({
          entityType: "rfp",
          entityId: result.rfpId!,
          action: "created_manually",
          details: { 
            url: validationResult.data.url,
            userNotes: validationResult.data.userNotes 
          }
        });

        res.status(201).json(result);
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      console.error("Error processing manual RFP:", error);
      res.status(500).json({ 
        success: false,
        error: "Internal server error",
        message: "Failed to process the manual RFP. Please try again." 
      });
    }
  });

  app.get("/api/rfps/manual/status/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }

      // Check if it's a manually added RFP
      if (rfp.addedBy !== 'manual') {
        return res.status(400).json({ error: "Not a manually added RFP" });
      }

      const documents = await storage.getDocumentsByRFP(rfpId);
      const proposal = await storage.getProposalByRFP(rfpId);

      res.json({
        rfp,
        documentsCount: documents.length,
        hasProposal: !!proposal,
        processingStatus: rfp.status,
        progress: rfp.progress,
        manuallyAddedAt: rfp.manuallyAddedAt
      });

    } catch (error) {
      console.error("Error fetching manual RFP status:", error);
      res.status(500).json({ error: "Failed to fetch RFP status" });
    }
  });

  // Philadelphia Document Download endpoint
  app.post("/api/rfps/:id/download-documents", async (req, res) => {
    try {
      const { id } = req.params;
      const { documentNames } = req.body;
      
      // Get the RFP
      const rfp = await storage.getRFP(id);
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }
      
      // Validate it's a Philadelphia RFP
      if (!rfp.sourceUrl || !rfp.sourceUrl.includes('phlcontracts.phila.gov')) {
        return res.status(400).json({ 
          error: "This endpoint only supports Philadelphia portal RFPs" 
        });
      }
      
      console.log(`📥 Starting document download for RFP ${id}`);
      console.log(`📄 Documents to download: ${documentNames.length}`);
      
      // Use Philadelphia document downloader
      const downloader = new PhiladelphiaDocumentDownloader();
      const results = await downloader.downloadRFPDocuments(
        rfp.sourceUrl,
        id,
        documentNames
      );
      
      // Save successful downloads to database
      const savedDocuments = [];
      for (const doc of results) {
        if (doc.downloadStatus === 'completed' && doc.storagePath) {
          try {
            const savedDoc = await storage.createDocument({
              rfpId: id,
              filename: doc.name,
              fileType: 'application/pdf',
              objectPath: doc.storagePath
            });
            savedDocuments.push(savedDoc);
          } catch (error) {
            console.error(`Failed to save document ${doc.name} to database:`, error);
          }
        }
      }
      
      // Update RFP status
      const successCount = results.filter(d => d.downloadStatus === 'completed').length;
      await storage.updateRFP(id, {
        status: successCount > 0 ? 'parsing' : 'open',
        progress: successCount > 0 ? 40 : 20
      });
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: id,
        action: "documents_downloaded",
        details: { 
          totalRequested: documentNames.length,
          successfulDownloads: successCount,
          failedDownloads: documentNames.length - successCount
        }
      });
      
      res.json({
        success: true,
        rfpId: id,
        results: results,
        savedDocuments: savedDocuments,
        summary: {
          total: documentNames.length,
          successful: successCount,
          failed: documentNames.length - successCount
        }
      });
      
    } catch (error) {
      console.error("Error downloading RFP documents:", error);
      res.status(500).json({ 
        error: "Failed to download documents",
        message: error.message 
      });
    }
  });

  // RFP Re-scraping endpoint  
  app.post("/api/rfps/:id/rescrape", async (req, res) => {
    try {
      const { id } = req.params;
      const { url, userNotes } = req.body;
      
      console.log(`🔄 Re-scraping RFP ${id} from URL: ${url}`);
      
      // Get existing RFP
      const existingRfp = await storage.getRFP(id);
      if (!existingRfp) {
        return res.status(404).json({ error: "RFP not found" });
      }

      const targetUrl = url || existingRfp.sourceUrl;
      
      // Enhanced URL validation for security (prevent SSRF attacks)
      try {
        const parsedUrl = new URL(targetUrl);
        
        // Require HTTPS for security
        if (parsedUrl.protocol !== 'https:') {
          return res.status(400).json({
            success: false,
            error: "Invalid URL protocol",
            message: "Only HTTPS URLs are allowed for security"
          });
        }
        
        // Block private/localhost IPs 
        const hostname = parsedUrl.hostname.toLowerCase();
        const privateIpRegex = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost$|0\.0\.0\.0$)/;
        if (privateIpRegex.test(hostname)) {
          return res.status(400).json({
            success: false,
            error: "Invalid URL target",
            message: "Private IP addresses and localhost are not allowed"
          });
        }
        
        // Safe domain allowlist with exact matching
        const allowedDomains = [
          'financeonline.austintexas.gov',
          'austintexas.gov',
          'bonfirehub.com',
          'vendor.bonfirehub.com',
          'sam.gov',
          'governmentjobs.com',
          'find-rfp.com',
          'findrfp.com'
        ];
        
        const isAllowed = allowedDomains.some(domain => 
          hostname === domain || hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          return res.status(400).json({
            success: false,
            error: "Invalid URL domain",
            message: "URL must be from an approved government portal"
          });
        }
      } catch {
        return res.status(400).json({
          success: false,
          error: "Invalid URL format", 
          message: "Please provide a valid URL"
        });
      }

      // Use Mastra scraping service directly for proper integration
      const mastraService = new MastraScrapingService();
      
      console.log(`🤖 Using Mastra service for re-scraping RFP ${id}`);
      
      // Use enhanced scraping with proper RFP ID preservation
      const scrapingResult = await mastraService.enhancedScrapeFromUrl(targetUrl, id);
      
      if (!scrapingResult || !scrapingResult.success) {
        return res.status(400).json({ 
          success: false,
          error: "Failed to re-scrape RFP",
          message: scrapingResult?.message || "Could not extract updated data from the URL. Please check the URL and try again."
        });
      }

      // Update RFP status to indicate re-processing
      await storage.updateRFP(id, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date()
      });

      // Add user notes if provided
      if (userNotes) {
        const currentRfp = await storage.getRFP(id);
        await storage.updateRFP(id, {
          description: `${currentRfp?.description || ''}\n\nRe-scrape Notes (${new Date().toISOString()}): ${userNotes}`,
          updatedAt: new Date()
        });
      }

      // Create audit log for re-scraping
      await storage.createAuditLog({
        entityType: "rfp",
        entityId: id,
        action: "re_scraped",
        details: { 
          url: targetUrl,
          documentsFound: scrapingResult.documentsCount || 0,
          userNotes: userNotes,
          mastraService: true
        }
      });

      // Create notification
      await storage.createNotification({
        type: 'info',
        title: 'RFP Re-scraped',
        message: `RFP has been re-scraped using Mastra service. ${scrapingResult.documentsCount || 0} documents were captured.`,
        relatedEntityType: 'rfp',
        relatedEntityId: id,
        isRead: false
      });

      res.json({
        success: true,
        rfpId: id,
        documentsFound: scrapingResult.documentsCount || 0,
        message: scrapingResult.message || `RFP re-scraped successfully with ${scrapingResult.documentsCount || 0} documents captured using Mastra service.`
      });

    } catch (error) {
      console.error("Error re-scraping RFP:", error);
      res.status(500).json({ 
        success: false,
        error: "Internal server error",
        message: "Failed to re-scrape the RFP. Please try again.",
        documentsFound: 0
      });
    }
  });

  // Proposal management
  app.get("/api/proposals/rfp/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      const proposal = await storage.getProposalByRFP(rfpId);
      res.json(proposal);
    } catch (error) {
      console.error("Error fetching proposal:", error);
      res.status(500).json({ error: "Failed to fetch proposal" });
    }
  });

  app.post("/api/proposals/:id/generate", async (req, res) => {
    try {
      const { id } = req.params;
      const rfp = await storage.getRFP(id);
      
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }

      // Update RFP status to drafting
      await storage.updateRFP(id, { status: "drafting", progress: 50 });

      // Generate proposal asynchronously
      aiService.generateProposal(rfp).catch(console.error);

      res.json({ message: "Proposal generation started" });
    } catch (error) {
      console.error("Error starting proposal generation:", error);
      res.status(500).json({ error: "Failed to start proposal generation" });
    }
  });

  app.put("/api/proposals/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const proposal = await storage.updateProposal(id, updates);
      
      // Create audit log
      await storage.createAuditLog({
        entityType: "proposal",
        entityId: id,
        action: "updated",
        details: { updates }
      });

      res.json(proposal);
    } catch (error) {
      console.error("Error updating proposal:", error);
      res.status(400).json({ error: "Failed to update proposal" });
    }
  });

  app.post("/api/proposals/:id/approve", async (req, res) => {
    try {
      const { id } = req.params;
      const proposal = await storage.updateProposal(id, { status: "approved" });
      
      // Update RFP status
      await storage.updateRFP(proposal.rfpId, { status: "approved", progress: 100 });

      // Create audit log
      await storage.createAuditLog({
        entityType: "proposal",
        entityId: id,
        action: "approved",
        details: {}
      });

      // Create notification
      await storage.createNotification({
        type: "approval",
        title: "Proposal Approved",
        message: `Proposal for RFP has been approved and is ready for submission`,
        relatedEntityType: "proposal",
        relatedEntityId: id
      });

      res.json(proposal);
    } catch (error) {
      console.error("Error approving proposal:", error);
      res.status(500).json({ error: "Failed to approve proposal" });
    }
  });

  // Enhanced Proposal Generation Endpoints
  app.post("/api/proposals/enhanced/generate", async (req, res) => {
    try {
      const { rfpId, companyProfileId, generatePricing = true, autoSubmit = false } = req.body;

      if (!rfpId) {
        return res.status(400).json({ error: "RFP ID is required" });
      }

      console.log(`🚀 Starting enhanced proposal generation for RFP: ${rfpId}`);

      // Generate proposal using enhanced service
      const result = await enhancedProposalService.generateProposal({
        rfpId,
        companyProfileId,
        generatePricing,
        autoSubmit
      });

      res.json({
        message: "Enhanced proposal generation completed",
        result
      });
    } catch (error) {
      console.error("Error in enhanced proposal generation:", error);
      res.status(500).json({ 
        error: "Failed to generate enhanced proposal", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get("/api/proposals/enhanced/status/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      const status = await enhancedProposalService.getGenerationStatus(rfpId);
      res.json(status);
    } catch (error) {
      console.error("Error getting proposal generation status:", error);
      res.status(500).json({ error: "Failed to get proposal generation status" });
    }
  });

  // ============ PROPOSAL GENERATION PIPELINE ENDPOINTS ============

  /**
   * Start complete proposal generation pipeline
   */
  app.post("/api/proposals/pipeline/generate", async (req, res) => {
    try {
      // Validate request body with Zod
      const validationResult = ProposalPipelineGenerateRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { 
        rfpId, 
        companyProfileId, 
        proposalType = 'standard',
        qualityThreshold = 0.8,
        autoSubmit = false,
        generatePricing = true,
        generateCompliance = true 
      } = validationResult.data;

      // Verify RFP exists
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        return res.status(404).json({ 
          success: false, 
          error: 'RFP not found' 
        });
      }

      console.log(`🚀 Starting proposal generation pipeline for RFP: ${rfpId}`);

      // Start the complete proposal generation pipeline
      const pipelineResult = await proposalGenerationOrchestrator.createProposalGenerationPipeline({
        rfpId,
        companyProfileId,
        proposalType,
        qualityThreshold,
        autoSubmit,
        generatePricing,
        generateCompliance
      });

      if (!pipelineResult.success) {
        return res.status(500).json({
          success: false,
          error: pipelineResult.error || 'Failed to start proposal generation pipeline'
        });
      }

      res.json({
        success: true,
        data: {
          pipelineId: pipelineResult.pipelineId,
          currentPhase: pipelineResult.currentPhase,
          totalPhases: pipelineResult.totalPhases,
          workItemsCreated: pipelineResult.workItemsCreated,
          estimatedDuration: pipelineResult.estimatedDuration,
          message: 'Proposal generation pipeline started successfully'
        }
      });

    } catch (error) {
      console.error('❌ Proposal pipeline generation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start proposal generation pipeline' 
      });
    }
  });

  /**
   * Get proposal generation pipeline status
   */
  app.get("/api/proposals/pipeline/status/:pipelineId", async (req, res) => {
    try {
      // Validate path parameters with Zod
      const validationResult = ProposalPipelineStatusParamsSchema.safeParse(req.params);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pipeline ID',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { pipelineId } = validationResult.data;

      const status = await proposalGenerationOrchestrator.getPipelineStatus(pipelineId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Pipeline not found'
        });
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('❌ Pipeline status error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get pipeline status' 
      });
    }
  });

  /**
   * Cancel proposal generation pipeline
   */
  app.delete("/api/proposals/pipeline/:pipelineId", async (req, res) => {
    try {
      // Validate path parameters with Zod
      const validationResult = ProposalPipelineStatusParamsSchema.safeParse(req.params);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pipeline ID',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { pipelineId } = validationResult.data;

      const cancelResult = await proposalGenerationOrchestrator.cancelPipeline(pipelineId);

      if (!cancelResult.success) {
        return res.status(500).json({
          success: false,
          error: cancelResult.error || 'Failed to cancel pipeline'
        });
      }

      res.json({
        success: true,
        data: {
          pipelineId,
          message: 'Pipeline cancelled successfully'
        }
      });

    } catch (error) {
      console.error('❌ Pipeline cancellation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel pipeline' 
      });
    }
  });

  /**
   * Get all active proposal generation workflows
   */
  app.get("/api/proposals/pipeline/workflows", async (req, res) => {
    try {
      // Validate query parameters with Zod
      const validationResult = ProposalPipelineWorkflowsQuerySchema.safeParse(req.query);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { status, limit = 50, offset = 0 } = validationResult.data;

      const workflows = await proposalGenerationOrchestrator.getActiveWorkflows({
        status,
        limit,
        offset
      });

      res.json({
        success: true,
        data: {
          workflows,
          total: workflows.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });

    } catch (error) {
      console.error('❌ Get workflows error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get active workflows' 
      });
    }
  });

  // ============ SUBMISSION PIPELINE ENDPOINTS ============

  /**
   * Start automated submission pipeline for a proposal
   */
  app.post("/api/submissions/pipeline/start", async (req, res) => {
    try {
      // Validate request body with Zod
      const validationResult = SubmissionPipelineStartRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { 
        submissionId,
        sessionId,
        portalCredentials,
        priority = 5,
        deadline,
        retryOptions,
        browserOptions,
        metadata
      } = validationResult.data;

      // Verify submission exists
      const submission = await storage.getSubmission(submissionId);
      if (!submission) {
        return res.status(404).json({ 
          success: false, 
          error: 'Submission not found' 
        });
      }

      console.log(`🚀 Starting automated submission pipeline for submission: ${submissionId}`);

      // Start submission pipeline through the submission service
      const result = await submissionService.submitProposal(submissionId, {
        sessionId,
        portalCredentials,
        priority,
        deadline,
        retryOptions,
        browserOptions,
        metadata
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to start submission pipeline'
        });
      }

      res.json({
        success: true,
        data: {
          submissionId: result.submissionId,
          pipelineId: result.pipelineId,
          message: 'Submission pipeline started successfully'
        }
      });

    } catch (error) {
      console.error('❌ Submission pipeline start error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to start submission pipeline' 
      });
    }
  });

  /**
   * Get submission pipeline status
   */
  app.get("/api/submissions/pipeline/status/:pipelineId", async (req, res) => {
    try {
      // Validate path parameters with Zod
      const validationResult = SubmissionPipelineStatusParamsSchema.safeParse(req.params);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pipeline ID',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { pipelineId } = validationResult.data;

      // Import submission orchestrator to get status
      const { submissionOrchestrator } = await import("./services/submissionOrchestrator");
      const status = await submissionOrchestrator.getPipelineStatus(pipelineId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Pipeline not found'
        });
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('❌ Submission pipeline status error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get pipeline status' 
      });
    }
  });

  /**
   * Get submission status by submission ID
   */
  app.get("/api/submissions/:submissionId/status", async (req, res) => {
    try {
      const { submissionId } = req.params;

      // Validate submission ID
      if (!submissionId) {
        return res.status(400).json({
          success: false,
          error: 'Submission ID is required'
        });
      }

      const status = await submissionService.getSubmissionStatus(submissionId);

      if (!status) {
        return res.status(404).json({
          success: false,
          error: 'Submission not found'
        });
      }

      res.json({
        success: true,
        data: status
      });

    } catch (error) {
      console.error('❌ Get submission status error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get submission status' 
      });
    }
  });

  /**
   * Cancel submission pipeline
   */
  app.delete("/api/submissions/pipeline/:pipelineId", async (req, res) => {
    try {
      // Validate path parameters with Zod
      const validationResult = SubmissionPipelineStatusParamsSchema.safeParse(req.params);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid pipeline ID',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { pipelineId } = validationResult.data;

      // Import submission orchestrator to cancel pipeline
      const { submissionOrchestrator } = await import("./services/submissionOrchestrator");
      const cancelResult = await submissionOrchestrator.cancelPipeline(pipelineId);

      if (!cancelResult) {
        return res.status(500).json({
          success: false,
          error: 'Failed to cancel pipeline'
        });
      }

      res.json({
        success: true,
        data: {
          pipelineId,
          cancelled: true,
          message: 'Pipeline cancelled successfully'
        }
      });

    } catch (error) {
      console.error('❌ Submission pipeline cancellation error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel pipeline' 
      });
    }
  });

  /**
   * Cancel submission by submission ID
   */
  app.delete("/api/submissions/:submissionId", async (req, res) => {
    try {
      const { submissionId } = req.params;

      // Validate submission ID
      if (!submissionId) {
        return res.status(400).json({
          success: false,
          error: 'Submission ID is required'
        });
      }

      const cancelResult = await submissionService.cancelSubmission(submissionId);

      if (!cancelResult) {
        return res.status(500).json({
          success: false,
          error: 'Failed to cancel submission'
        });
      }

      res.json({
        success: true,
        data: {
          submissionId,
          cancelled: true,
          message: 'Submission cancelled successfully'
        }
      });

    } catch (error) {
      console.error('❌ Cancel submission error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to cancel submission' 
      });
    }
  });

  /**
   * Retry failed submission
   */
  app.post("/api/submissions/retry", async (req, res) => {
    try {
      // Validate request body with Zod
      const validationResult = SubmissionRetryRequestSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid request data',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { submissionId, sessionId, retryOptions, metadata } = validationResult.data;

      console.log(`🔄 Retrying submission pipeline for submission: ${submissionId}`);

      const result = await submissionService.retrySubmission(submissionId, {
        sessionId,
        retryOptions,
        metadata
      });

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error || 'Failed to retry submission'
        });
      }

      res.json({
        success: true,
        data: {
          submissionId: result.submissionId,
          pipelineId: result.pipelineId,
          message: 'Submission retry initiated successfully'
        }
      });

    } catch (error) {
      console.error('❌ Submission retry error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to retry submission' 
      });
    }
  });

  /**
   * Get all active submission workflows
   */
  app.get("/api/submissions/pipeline/workflows", async (req, res) => {
    try {
      // Validate query parameters with Zod
      const validationResult = SubmissionPipelineWorkflowsQuerySchema.safeParse(req.query);
      
      if (!validationResult.success) {
        return res.status(400).json({
          success: false,
          error: 'Invalid query parameters',
          details: validationResult.error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ')
        });
      }

      const { status, submissionId, limit = 50, offset = 0 } = validationResult.data;

      // Get active submissions from submission service
      const activeSubmissions = submissionService.getActiveSubmissions();
      
      // Filter by status if provided
      let filteredSubmissions = activeSubmissions;
      if (status) {
        filteredSubmissions = activeSubmissions.filter(s => s.status === status);
      }

      // Filter by submission ID if provided
      if (submissionId) {
        filteredSubmissions = filteredSubmissions.filter(s => s.submissionId === submissionId);
      }

      // Apply pagination
      const paginatedSubmissions = filteredSubmissions
        .slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          workflows: paginatedSubmissions,
          total: filteredSubmissions.length,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string)
        }
      });

    } catch (error) {
      console.error('❌ Get submission workflows error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get submission workflows' 
      });
    }
  });

  /**
   * Get submission metrics and analytics
   */
  app.get("/api/submissions/metrics", async (req, res) => {
    try {
      const { timeframe = 'week' } = req.query;
      
      const metrics = await submissionService.getSubmissionMetrics(timeframe as 'day' | 'week' | 'month');

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('❌ Get submission metrics error:', error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get submission metrics' 
      });
    }
  });

  // Document Intelligence Analysis Endpoints
  app.post("/api/documents/analyze/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      
      console.log(`📊 Analyzing documents for RFP: ${rfpId}`);
      const analysis = await documentIntelligenceService.analyzeRFPDocuments(rfpId);
      
      res.json({
        message: "Document analysis completed",
        analysis
      });
    } catch (error) {
      console.error("Error analyzing RFP documents:", error);
      res.status(500).json({ 
        error: "Failed to analyze documents", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post("/api/documents/autofill/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      const { formFields, companyProfileId } = req.body;

      if (!formFields || !Array.isArray(formFields)) {
        return res.status(400).json({ error: "Form fields array is required" });
      }

      console.log(`🏢 Auto-filling ${formFields.length} form fields for RFP: ${rfpId}`);
      const filledFields = await documentIntelligenceService.autoFillFormFields(
        rfpId, 
        formFields, 
        companyProfileId
      );

      res.json({
        message: "Form fields auto-filled",
        filledFields
      });
    } catch (error) {
      console.error("Error auto-filling form fields:", error);
      res.status(500).json({ 
        error: "Failed to auto-fill form fields", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Submission management
  app.post("/api/submissions/:proposalId/submit", async (req, res) => {
    try {
      const { proposalId } = req.params;
      const proposal = await storage.getProposal(proposalId);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const rfp = await storage.getRFP(proposal.rfpId);
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }

      // Create submission record
      const submission = await storage.createSubmission({
        rfpId: rfp.id,
        proposalId,
        portalId: rfp.portalId || "", // Handle null portalId
        status: "pending"
      });

      // Start submission process asynchronously
      submissionService.submitProposal(submission.id).catch(console.error);

      res.status(201).json(submission);
    } catch (error) {
      console.error("Error starting submission:", error);
      res.status(500).json({ error: "Failed to start submission" });
    }
  });

  // Manual portal scraping with real-time monitoring
  app.post("/api/portals/:id/scan", async (req, res) => {
    try {
      const { id } = req.params;
      let { searchFilter } = req.body || {};
      
      // Validate and sanitize search filter
      if (searchFilter) {
        searchFilter = searchFilter.trim();
        if (searchFilter.length === 0 || searchFilter.length > 100) {
          return res.status(400).json({ error: "Search filter must be between 1-100 characters" });
        }
      }
      
      const portal = await storage.getPortal(id);
      
      if (!portal) {
        return res.status(404).json({ error: "Portal not found" });
      }

      // Check if portal is already being scanned
      if (scanManager.isPortalScanning(id)) {
        return res.status(409).json({ error: "Portal is already being scanned" });
      }

      // Start scan with ScanManager for real-time monitoring
      const scanId = scanManager.startScan(id, portal.name);

      // Use new monitoring service for enhanced scanning with scan context
      portalMonitoringService.scanPortalWithEvents(portal.id, scanId).catch(console.error);

      res.status(202).json({ 
        scanId,
        message: "Portal scan started"
      });
    } catch (error) {
      console.error("Error starting portal scan:", error);
      res.status(500).json({ error: "Failed to start portal scan" });
    }
  });

  // Enhanced Portal Monitoring Endpoints
  
  // Get monitoring status for all portals
  app.get("/api/portals/monitoring/status", async (req, res) => {
    try {
      const portals = await storage.getAllPortals();
      const monitoringStatus = portals.map(portal => ({
        portalId: portal.id,
        portalName: portal.name,
        status: portal.status,
        lastScanned: portal.lastScanned,
        scanFrequency: portal.scanFrequency,
        lastError: portal.lastError,
        errorCount: portal.errorCount,
      }));
      
      res.json(monitoringStatus);
    } catch (error) {
      console.error("Error fetching portal monitoring status:", error);
      res.status(500).json({ error: "Failed to fetch monitoring status" });
    }
  });

  // SSE endpoint for real-time scan streaming
  app.get("/api/portals/:id/scan/stream", async (req, res) => {
    try {
      const { id: portalId } = req.params;
      const { scanId } = req.query;

      if (!scanId) {
        return res.status(400).json({ error: "scanId query parameter is required" });
      }

      const scan = scanManager.getScan(scanId as string);
      if (!scan || scan.portalId !== portalId) {
        return res.status(404).json({ error: "Scan not found" });
      }

      // Set SSE headers
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      });

      // Send initial scan state
      res.write(`data: ${JSON.stringify({
        type: 'initial_state',
        data: {
          scanId: scan.scanId,
          portalId: scan.portalId,
          portalName: scan.portalName,
          status: scan.status,
          currentStep: scan.currentStep,
          discoveredRFPs: scan.discoveredRFPs,
          errors: scan.errors,
          startedAt: scan.startedAt
        }
      })}\n\n`);

      // Get event emitter for this scan
      const emitter = scanManager.getScanEmitter(scanId as string);
      if (!emitter) {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          message: 'Scan event stream not available'
        })}\n\n`);
        res.end();
        return;
      }

      // Listen for scan events
      const eventHandler = (event: any) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        
        // Close connection if scan is completed or failed
        if (event.type === 'scan_completed' || event.type === 'scan_failed') {
          res.end();
        }
      };

      emitter.on('event', eventHandler);

      // Keep connection alive with heartbeat
      const keepAlive = setInterval(() => {
        res.write(`: keep-alive\n\n`);
      }, 15000);

      // Handle client disconnect - clean up everything
      const cleanup = () => {
        emitter.off('event', eventHandler);
        clearInterval(keepAlive);
        res.end();
        console.log(`SSE connection closed for scan ${scanId}`);
      };

      req.on('close', cleanup);
      req.on('error', cleanup);

    } catch (error) {
      console.error("Error setting up SSE stream:", error);
      res.status(500).json({ error: "Failed to setup scan stream" });
    }
  });

  // Get current scan status
  app.get("/api/scans/:scanId/status", async (req, res) => {
    try {
      const { scanId } = req.params;
      const scan = scanManager.getScan(scanId);
      
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      res.json({
        scanId: scan.scanId,
        portalId: scan.portalId,
        portalName: scan.portalName,
        status: scan.status,
        startedAt: scan.startedAt,
        completedAt: scan.completedAt,
        currentStep: scan.currentStep,
        discoveredRFPs: scan.discoveredRFPs,
        errors: scan.errors,
        duration: scan.completedAt ? scan.completedAt.getTime() - scan.startedAt.getTime() : Date.now() - scan.startedAt.getTime()
      });
    } catch (error) {
      console.error("Error fetching scan status:", error);
      res.status(500).json({ error: "Failed to fetch scan status" });
    }
  });

  // Get scan history for a portal
  app.get("/api/portals/:id/scans/history", async (req, res) => {
    try {
      const { id: portalId } = req.params;
      const { limit = "10" } = req.query;
      
      const history = scanManager.getScanHistory(portalId, parseInt(limit as string));
      res.json(history);
    } catch (error) {
      console.error("Error fetching scan history:", error);
      res.status(500).json({ error: "Failed to fetch scan history" });
    }
  });

  // Get all active scans across all portals
  app.get("/api/scans/active", async (req, res) => {
    try {
      const activeScans = scanManager.getActiveScans().map(scan => ({
        scanId: scan.scanId,
        portalId: scan.portalId,
        portalName: scan.portalName,
        status: scan.status,
        startedAt: scan.startedAt,
        currentStep: scan.currentStep,
        discoveredRFPs: scan.discoveredRFPs.length,
        errors: scan.errors.length
      }));

      res.json(activeScans);
    } catch (error) {
      console.error("Error fetching active scans:", error);
      res.status(500).json({ error: "Failed to fetch active scans" });
    }
  });

  // Get scan details with events
  app.get("/api/scans/:scanId/details", async (req, res) => {
    try {
      const { scanId } = req.params;

      // First check active scans in ScanManager (for running scans)
      const activeScan = scanManager.getScan(scanId);
      if (activeScan) {
        // Return active scan data with events
        res.json({
          ...activeScan,
          id: activeScan.scanId,
          portalId: activeScan.portalId,
          portalName: activeScan.portalName,
          status: activeScan.status,
          startedAt: activeScan.startedAt,
          completedAt: activeScan.completedAt,
          currentStep: activeScan.currentStep.step,
          currentProgress: activeScan.currentStep.progress,
          currentMessage: activeScan.currentStep.message,
          discoveredRfpsCount: activeScan.discoveredRFPs.length,
          errorCount: activeScan.errors.length,
          errors: activeScan.errors,
          discoveredRfps: activeScan.discoveredRFPs,
          events: activeScan.events
        });
        return;
      }

      // If not in active scans, try database (for historical scans)
      const scan = await storage.getScan(scanId);
      if (!scan) {
        return res.status(404).json({ error: "Scan not found" });
      }

      const events = await storage.getScanEvents(scanId);
      res.json({ ...scan, events });
    } catch (error) {
      console.error("Failed to get scan details:", error);
      res.status(500).json({ error: "Failed to get scan details" });
    }
  });

  // Get recent RFP discoveries
  app.get("/api/portals/discoveries/recent", async (req, res) => {
    try {
      const { limit = "10", hours = "24" } = req.query;
      const hoursAgo = new Date(Date.now() - (parseInt(hours as string) * 60 * 60 * 1000));
      
      // Get RFPs discovered in the last N hours
      const { rfps } = await storage.getAllRFPs({
        limit: parseInt(limit as string),
        status: 'discovered'
      });
      
      // Filter by discovery time (simplified - in production, add discoveredAfter filter to storage)
      const recentRFPs = rfps.filter(rfp => 
        rfp.discoveredAt && new Date(rfp.discoveredAt) > hoursAgo
      );

      res.json(recentRFPs);
    } catch (error) {
      console.error("Error fetching recent discoveries:", error);
      res.status(500).json({ error: "Failed to fetch recent discoveries" });
    }
  });

  // Update portal monitoring configuration
  app.put("/api/portals/:id/monitoring", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Validate request body with Zod
      const validationResult = PortalMonitoringConfigSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid monitoring configuration", 
          details: validationResult.error.issues 
        });
      }

      const { scanFrequency, maxRfpsPerScan, selectors, filters } = validationResult.data;

      const updates: any = {};
      if (scanFrequency !== undefined) updates.scanFrequency = scanFrequency;
      if (maxRfpsPerScan !== undefined) updates.maxRfpsPerScan = maxRfpsPerScan;
      if (selectors) updates.selectors = selectors;
      if (filters) updates.filters = filters;

      const updatedPortal = await storage.updatePortal(id, updates);
      
      // Update scheduler if scan frequency changed
      if (scanFrequency !== undefined) {
        await portalSchedulerService.updatePortalSchedule(id);
      }
      
      res.json(updatedPortal);
    } catch (error) {
      console.error("Error updating portal monitoring config:", error);
      res.status(500).json({ error: "Failed to update monitoring configuration" });
    }
  });

  // Get portal performance metrics
  app.get("/api/portals/:id/metrics", async (req, res) => {
    try {
      const { id } = req.params;
      const { days = "7" } = req.query;

      const portal = await storage.getPortal(id);
      if (!portal) {
        return res.status(404).json({ error: "Portal not found" });
      }

      // Get RFPs discovered from this portal in the last N days
      const daysAgo = new Date(Date.now() - (parseInt(days as string) * 24 * 60 * 60 * 1000));
      const portalRFPs = await storage.getRFPsByPortal(id);
      const recentRFPs = portalRFPs.filter(rfp => 
        rfp.discoveredAt && new Date(rfp.discoveredAt) > daysAgo
      );

      const metrics = {
        portalId: id,
        portalName: portal.name,
        period: `Last ${days} days`,
        totalRFPs: recentRFPs.length,
        averageValue: recentRFPs.reduce((sum, rfp) => {
          const value = rfp.estimatedValue ? parseFloat(rfp.estimatedValue) : 0;
          return sum + value;
        }, 0) / (recentRFPs.length || 1),
        statusBreakdown: recentRFPs.reduce((acc: any, rfp) => {
          acc[rfp.status] = (acc[rfp.status] || 0) + 1;
          return acc;
        }, {}),
        lastScanned: portal.lastScanned,
        errorCount: portal.errorCount,
        successfulScans: Math.max(0, (portalRFPs.length / Math.max(1, portal.maxRfpsPerScan)) - portal.errorCount),
      };

      res.json(metrics);
    } catch (error) {
      console.error("Error fetching portal metrics:", error);
      res.status(500).json({ error: "Failed to fetch portal metrics" });
    }
  });

  // ============ DISCOVERY PIPELINE ENDPOINTS ============

  // Trigger a complete discovery workflow for portals
  app.post("/api/discovery/workflow", async (req, res) => {
    try {
      const { discoveryOrchestrator } = await import("./services/discoveryOrchestrator");
      
      const {
        portalIds,
        sessionId,
        workflowId,
        priority = 5,
        deadline,
        options = {}
      } = req.body;

      if (!portalIds || !Array.isArray(portalIds) || portalIds.length === 0) {
        return res.status(400).json({ 
          error: "portalIds array is required and must not be empty" 
        });
      }

      // Validate portal IDs exist
      const portals = await Promise.all(
        portalIds.map((id: string) => storage.getPortal(id))
      );
      
      const invalidPortalIds = portalIds.filter((id: string, index: number) => !portals[index]);
      if (invalidPortalIds.length > 0) {
        return res.status(400).json({ 
          error: "Invalid portal IDs", 
          invalidIds: invalidPortalIds 
        });
      }

      console.log(`🚀 Triggering discovery workflow for portals: ${portalIds.join(', ')}`);
      
      const workflowResult = await discoveryOrchestrator.createDiscoveryWorkflow({
        portalIds,
        sessionId: sessionId || `discovery-${Date.now()}`,
        workflowId,
        priority,
        deadline: deadline ? new Date(deadline) : undefined,
        options
      });

      res.json({
        success: true,
        workflowId: workflowResult.workflowId,
        sequences: workflowResult.sequences.length,
        workItems: workflowResult.workItems.length,
        assignedAgents: workflowResult.assignedAgents.length,
        message: `Discovery workflow created successfully for ${portalIds.length} portals`
      });

    } catch (error) {
      console.error("❌ Failed to create discovery workflow:", error);
      res.status(500).json({
        success: false,
        error: "Failed to create discovery workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get discovery workflow status
  app.get("/api/discovery/workflow/:workflowId/status", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { discoveryOrchestrator } = await import("./services/discoveryOrchestrator");
      
      const status = await discoveryOrchestrator.getWorkflowStatus(workflowId);
      
      if (status) {
        res.json(status);
      } else {
        res.status(404).json({ error: "Workflow not found" });
      }
    } catch (error) {
      console.error("❌ Failed to get workflow status:", error);
      res.status(500).json({
        error: "Failed to get workflow status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Notifications
  app.get("/api/notifications", async (req, res) => {
    try {
      const { limit = "50" } = req.query;
      const notifications = await storage.getAllNotifications(parseInt(limit as string));
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/unread", async (req, res) => {
    try {
      const notifications = await storage.getUnreadNotifications();
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching unread notifications:", error);
      res.status(500).json({ error: "Failed to fetch unread notifications" });
    }
  });

  app.post("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  app.post("/api/notifications/clear-all", async (req, res) => {
    try {
      const unreadNotifications = await storage.getUnreadNotifications(); // Only get unread notifications
      await Promise.all(
        unreadNotifications.map(notification => 
          storage.markNotificationRead(notification.id)
        )
      );
      res.json({ success: true, cleared: unreadNotifications.length });
    } catch (error) {
      console.error("Error clearing all notifications:", error);
      res.status(500).json({ error: "Failed to clear notifications" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ error: "Failed to mark notification as read" });
    }
  });

  // Audit logs
  app.get("/api/audit-logs/:entityType/:entityId", async (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getAuditLogsByEntity(entityType, entityId);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      res.status(500).json({ error: "Failed to fetch audit logs" });
    }
  });

  // Company Profile Management Routes
  
  // Company Profiles
  app.get("/api/company-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllCompanyProfiles();
      res.json(profiles);
    } catch (error) {
      console.error("Error fetching company profiles:", error);
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  app.get("/api/company-profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getCompanyProfile(id);
      if (!profile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching company profile:", error);
      res.status(500).json({ error: "Failed to fetch company profile" });
    }
  });

  app.get("/api/company-profiles/:id/details", async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getCompanyProfileWithDetails(id);
      if (!profile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Error fetching company profile details:", error);
      res.status(500).json({ error: "Failed to fetch company profile details" });
    }
  });

  app.post("/api/company-profiles", async (req, res) => {
    try {
      console.log("POST /api/company-profiles - Request body:", req.body);
      const profileData = insertCompanyProfileSchema.parse(req.body);
      console.log("Parsed profile data:", profileData);
      const profile = await storage.createCompanyProfile(profileData);
      console.log("Created profile:", profile);
      res.status(201).json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        console.error("Validation error creating company profile:", error.errors);
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company profile:", error);
      res.status(500).json({ error: "Failed to create company profile" });
    }
  });

  app.put("/api/company-profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      // Validate updates using partial schema
      const updateSchema = insertCompanyProfileSchema.partial();
      const updates = updateSchema.parse(req.body);
      const profile = await storage.updateCompanyProfile(id, updates);
      if (!profile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      res.json(profile);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company profile:", error);
      res.status(500).json({ error: "Failed to update company profile" });
    }
  });

  app.delete("/api/company-profiles/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const profile = await storage.getCompanyProfile(id);
      if (!profile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      await storage.deleteCompanyProfile(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting company profile:", error);
      res.status(500).json({ error: "Failed to delete company profile" });
    }
  });

  // Company Addresses
  app.get("/api/company-profiles/:companyProfileId/addresses", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      const addresses = await storage.getCompanyAddresses(companyProfileId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching company addresses:", error);
      res.status(500).json({ error: "Failed to fetch company addresses" });
    }
  });

  app.post("/api/company-profiles/:companyProfileId/addresses", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      // Check if parent company profile exists
      const parentProfile = await storage.getCompanyProfile(companyProfileId);
      if (!parentProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      const addressData = insertCompanyAddressSchema.parse({
        ...req.body,
        companyProfileId
      });
      const address = await storage.createCompanyAddress(addressData);
      res.status(201).json(address);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company address:", error);
      res.status(500).json({ error: "Failed to create company address" });
    }
  });

  app.put("/api/company-addresses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertCompanyAddressSchema.partial().omit({ companyProfileId: true });
      const updates = updateSchema.parse(req.body);
      const address = await storage.updateCompanyAddress(id, updates);
      if (!address) {
        return res.status(404).json({ error: "Company address not found" });
      }
      res.json(address);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company address:", error);
      res.status(500).json({ error: "Failed to update company address" });
    }
  });

  app.delete("/api/company-addresses/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanyAddress(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company address:", error);
      res.status(500).json({ error: "Failed to delete company address" });
    }
  });

  // Company Contacts
  app.get("/api/company-profiles/:companyProfileId/contacts", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      const contacts = await storage.getCompanyContacts(companyProfileId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching company contacts:", error);
      res.status(500).json({ error: "Failed to fetch company contacts" });
    }
  });

  app.post("/api/company-profiles/:companyProfileId/contacts", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      // Check if parent company profile exists
      const parentProfile = await storage.getCompanyProfile(companyProfileId);
      if (!parentProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      const contactData = insertCompanyContactSchema.parse({
        ...req.body,
        companyProfileId
      });
      const contact = await storage.createCompanyContact(contactData);
      res.status(201).json(contact);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company contact:", error);
      res.status(500).json({ error: "Failed to create company contact" });
    }
  });

  app.put("/api/company-contacts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertCompanyContactSchema.partial().omit({ companyProfileId: true });
      const updates = updateSchema.parse(req.body);
      const contact = await storage.updateCompanyContact(id, updates);
      if (!contact) {
        return res.status(404).json({ error: "Company contact not found" });
      }
      res.json(contact);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company contact:", error);
      res.status(500).json({ error: "Failed to update company contact" });
    }
  });

  app.delete("/api/company-contacts/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanyContact(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company contact:", error);
      res.status(500).json({ error: "Failed to delete company contact" });
    }
  });

  // Company Identifiers
  app.get("/api/company-profiles/:companyProfileId/identifiers", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      const identifiers = await storage.getCompanyIdentifiers(companyProfileId);
      res.json(identifiers);
    } catch (error) {
      console.error("Error fetching company identifiers:", error);
      res.status(500).json({ error: "Failed to fetch company identifiers" });
    }
  });

  app.post("/api/company-profiles/:companyProfileId/identifiers", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      // Check if parent company profile exists
      const parentProfile = await storage.getCompanyProfile(companyProfileId);
      if (!parentProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      const identifierData = insertCompanyIdentifierSchema.parse({
        ...req.body,
        companyProfileId
      });
      const identifier = await storage.createCompanyIdentifier(identifierData);
      res.status(201).json(identifier);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company identifier:", error);
      res.status(500).json({ error: "Failed to create company identifier" });
    }
  });

  app.put("/api/company-identifiers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertCompanyIdentifierSchema.partial().omit({ companyProfileId: true });
      const updates = updateSchema.parse(req.body);
      const identifier = await storage.updateCompanyIdentifier(id, updates);
      if (!identifier) {
        return res.status(404).json({ error: "Company identifier not found" });
      }
      res.json(identifier);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company identifier:", error);
      res.status(500).json({ error: "Failed to update company identifier" });
    }
  });

  app.delete("/api/company-identifiers/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanyIdentifier(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company identifier:", error);
      res.status(500).json({ error: "Failed to delete company identifier" });
    }
  });

  // Company Certifications
  app.get("/api/company-profiles/:companyProfileId/certifications", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      const certifications = await storage.getCompanyCertifications(companyProfileId);
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching company certifications:", error);
      res.status(500).json({ error: "Failed to fetch company certifications" });
    }
  });

  app.get("/api/certifications/expiring", async (req, res) => {
    try {
      const daysParam = req.query.days as string;
      const days = daysParam ? parseInt(daysParam) : 90;
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: "Days parameter must be a number between 1 and 365" });
      }
      const certifications = await storage.getExpiringCertifications(days);
      res.json(certifications);
    } catch (error) {
      console.error("Error fetching expiring certifications:", error);
      res.status(500).json({ error: "Failed to fetch expiring certifications" });
    }
  });

  app.post("/api/company-profiles/:companyProfileId/certifications", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      // Check if parent company profile exists
      const parentProfile = await storage.getCompanyProfile(companyProfileId);
      if (!parentProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      const certificationData = insertCompanyCertificationSchema.parse({
        ...req.body,
        companyProfileId
      });
      const certification = await storage.createCompanyCertification(certificationData);
      res.status(201).json(certification);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company certification:", error);
      res.status(500).json({ error: "Failed to create company certification" });
    }
  });

  app.put("/api/company-certifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertCompanyCertificationSchema.partial().omit({ companyProfileId: true });
      const updates = updateSchema.parse(req.body);
      const certification = await storage.updateCompanyCertification(id, updates);
      if (!certification) {
        return res.status(404).json({ error: "Company certification not found" });
      }
      res.json(certification);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company certification:", error);
      res.status(500).json({ error: "Failed to update company certification" });
    }
  });

  app.delete("/api/company-certifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanyCertification(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company certification:", error);
      res.status(500).json({ error: "Failed to delete company certification" });
    }
  });

  // Company Insurance
  app.get("/api/company-profiles/:companyProfileId/insurance", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      const insurance = await storage.getCompanyInsurance(companyProfileId);
      res.json(insurance);
    } catch (error) {
      console.error("Error fetching company insurance:", error);
      res.status(500).json({ error: "Failed to fetch company insurance" });
    }
  });

  app.get("/api/insurance/expiring", async (req, res) => {
    try {
      const daysParam = req.query.days as string;
      const days = daysParam ? parseInt(daysParam) : 30;
      if (isNaN(days) || days < 1 || days > 365) {
        return res.status(400).json({ error: "Days parameter must be a number between 1 and 365" });
      }
      const insurance = await storage.getExpiringInsurance(days);
      res.json(insurance);
    } catch (error) {
      console.error("Error fetching expiring insurance:", error);
      res.status(500).json({ error: "Failed to fetch expiring insurance" });
    }
  });

  app.post("/api/company-profiles/:companyProfileId/insurance", async (req, res) => {
    try {
      const { companyProfileId } = req.params;
      // Check if parent company profile exists
      const parentProfile = await storage.getCompanyProfile(companyProfileId);
      if (!parentProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }
      const insuranceData = insertCompanyInsuranceSchema.parse({
        ...req.body,
        companyProfileId
      });
      const insurance = await storage.createCompanyInsurance(insuranceData);
      res.status(201).json(insurance);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error creating company insurance:", error);
      res.status(500).json({ error: "Failed to create company insurance" });
    }
  });

  app.put("/api/company-insurance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = insertCompanyInsuranceSchema.partial().omit({ companyProfileId: true });
      const updates = updateSchema.parse(req.body);
      const insurance = await storage.updateCompanyInsurance(id, updates);
      if (!insurance) {
        return res.status(404).json({ error: "Company insurance not found" });
      }
      res.json(insurance);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({ error: "Invalid input data", details: error.errors });
      }
      console.error("Error updating company insurance:", error);
      res.status(500).json({ error: "Failed to update company insurance" });
    }
  });

  app.delete("/api/company-insurance/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCompanyInsurance(id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting company insurance:", error);
      res.status(500).json({ error: "Failed to delete company insurance" });
    }
  });

  // AI-Powered Proposal Generation Service (Phase 2.1)
  
  // Analyze RFP document using AI to extract requirements
  app.post("/api/ai/analyze-rfp", async (req, res) => {
    try {
      const validationResult = AnalyzeRFPRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }

      const { rfpText } = validationResult.data;
      const analysis = await aiProposalService.analyzeRFPDocument(rfpText);
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing RFP document:", error);
      res.status(500).json({ 
        error: "Failed to analyze RFP document", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Map company profile data to RFP requirements
  app.post("/api/ai/map-company-data", async (req, res) => {
    try {
      const validationResult = MapCompanyDataRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }

      const { analysis, companyProfileId } = validationResult.data;

      // Get company profile and related data
      const companyProfile = await storage.getCompanyProfile(companyProfileId);
      if (!companyProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const certifications = await storage.getCompanyCertifications(companyProfileId);
      const insurance = await storage.getCompanyInsurance(companyProfileId);
      const contacts = await storage.getCompanyContacts(companyProfileId);

      const companyMapping = await aiProposalService.mapCompanyDataToRequirements(
        analysis,
        companyProfile,
        certifications,
        insurance,
        contacts
      );

      res.json(companyMapping);
    } catch (error) {
      console.error("Error mapping company data:", error);
      res.status(500).json({ 
        error: "Failed to map company data", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Generate comprehensive proposal content using AI
  app.post("/api/ai/generate-proposal", async (req, res) => {
    try {
      const validationResult = GenerateProposalRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }

      const { rfpText, companyProfileId, proposalType } = validationResult.data;

      // Step 1: Analyze RFP document
      const analysis = await aiProposalService.analyzeRFPDocument(rfpText);

      // Step 2: Get company profile and related data
      const companyProfile = await storage.getCompanyProfile(companyProfileId);
      if (!companyProfile) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const certifications = await storage.getCompanyCertifications(companyProfileId);
      const insurance = await storage.getCompanyInsurance(companyProfileId);
      const contacts = await storage.getCompanyContacts(companyProfileId);

      // Step 3: Map company data to requirements
      const companyMapping = await aiProposalService.mapCompanyDataToRequirements(
        analysis,
        companyProfile,
        certifications,
        insurance,
        contacts
      );

      // Step 4: Generate proposal content
      const proposalContent = await aiProposalService.generateProposalContent(
        analysis,
        companyMapping,
        rfpText
      );

      // Response includes both the analysis and generated content
      res.json({
        rfpAnalysis: analysis,
        companyMapping,
        proposalContent,
        metadata: {
          generatedAt: new Date().toISOString(),
          companyProfileId,
          proposalType: proposalType || 'standard',
          certificationCount: certifications.length,
          contactCount: contacts.length,
        }
      });

    } catch (error) {
      console.error("Error generating proposal:", error);
      res.status(500).json({ 
        error: "Failed to generate proposal", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get available company profiles for proposal generation
  app.get("/api/ai/company-profiles", async (req, res) => {
    try {
      const profiles = await storage.getAllCompanyProfiles();
      
      // Return simplified profile data for AI service selection
      const simplifiedProfiles = profiles.map(profile => ({
        id: profile.id,
        companyName: profile.companyName,
        dba: profile.dba,
        primaryBusinessCategory: profile.primaryBusinessCategory,
        isActive: profile.isActive,
      }));

      res.json(simplifiedProfiles);
    } catch (error) {
      console.error("Error fetching company profiles:", error);
      res.status(500).json({ error: "Failed to fetch company profiles" });
    }
  });

  // Get detailed company profile for proposal context
  app.get("/api/ai/company-profiles/:id/details", async (req, res) => {
    try {
      const { id } = req.params;
      
      const profile = await storage.getCompanyProfile(id);
      if (!profile) {
        return res.status(404).json({ error: "Company profile not found" });
      }

      const certifications = await storage.getCompanyCertifications(id);
      const insurance = await storage.getCompanyInsurance(id);
      const contacts = await storage.getCompanyContacts(id);
      const addresses = await storage.getCompanyAddresses(id);
      const identifiers = await storage.getCompanyIdentifiers(id);

      res.json({
        profile,
        certifications,
        insurance,
        contacts,
        addresses,
        identifiers,
        stats: {
          totalCertifications: certifications.length,
          activeCertifications: certifications.filter((c: any) => c.status === 'active').length,
          totalContacts: contacts.length,
          decisionMakers: contacts.filter((c: any) => c.contactType === 'decision_maker').length,
        }
      });
    } catch (error) {
      console.error("Error fetching company profile details:", error);
      res.status(500).json({ error: "Failed to fetch company profile details" });
    }
  });

  // AI Agent Conversation Endpoints
  
  // Process user query and get AI response
  app.post("/api/ai/chat", async (req, res) => {
    try {
      const validationResult = ProcessQueryRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }

      const { query, conversationId, userId, conversationType } = validationResult.data;
      
      const context = {
        userId,
        currentQuery: query,
        conversationType: conversationType || 'general'
      };

      const response = await aiAgentOrchestrator.processUserQuery(
        query,
        conversationId,
        context
      );

      // Ensure response includes conversationId as per architect feedback
      const formattedResponse = {
        conversationId: (response as any).conversationId || conversationId,
        message: response.message,
        messageType: response.messageType,
        data: response.data,
        followUpQuestions: response.followUpQuestions,
        actionSuggestions: response.actionSuggestions,
        relatedRfps: response.relatedRfps,
        researchFindings: response.researchFindings,
      };

      res.json(formattedResponse);
    } catch (error) {
      console.error("Error processing AI chat query:", error);
      res.status(500).json({ 
        error: "Failed to process chat query", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute action suggestion
  app.post("/api/ai/execute-action", async (req, res) => {
    try {
      const validationResult = ExecuteActionRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid request data", 
          details: validationResult.error.issues 
        });
      }

      const { suggestionId, conversationId, suggestion } = validationResult.data;
      
      console.log(`🚀 Executing action suggestion: ${suggestion.label} (${suggestion.action})`);
      
      // Execute the action using the workflow engine
      const result = await mastraWorkflowEngine.executeActionSuggestion(suggestion, conversationId);
      
      // Create a conversation message to record the action execution
      await storage.createConversationMessage({
        conversationId,
        role: 'system',
        content: `Executed action: ${suggestion.label}`,
        messageType: 'action_executed',
        metadata: { 
          suggestionId,
          suggestion,
          result
        }
      });

      res.json({
        success: true,
        message: `Action "${suggestion.label}" executed successfully`,
        result
      });
    } catch (error) {
      console.error("Error executing action suggestion:", error);
      res.status(500).json({ 
        error: "Failed to execute action", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get conversation history
  app.get("/api/ai/conversations/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      const conversation = await storage.getAiConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const messages = await storage.getConversationMessages(conversationId);

      res.json({
        conversation: {
          id: conversation.id,
          title: conversation.title,
          type: conversation.type,
          status: conversation.status,
          createdAt: conversation.createdAt,
          updatedAt: conversation.updatedAt,
        },
        messages: messages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          messageType: msg.messageType,
          createdAt: msg.createdAt,
        }))
      });
    } catch (error) {
      console.error("Error fetching conversation history:", error);
      res.status(500).json({ 
        error: "Failed to fetch conversation history", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user's conversations list
  app.get("/api/ai/conversations", async (req, res) => {
    try {
      const { userId, limit = "50" } = req.query;
      
      const conversations = await storage.getAiConversations(
        userId as string,
        parseInt(limit as string)
      );

      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ 
        error: "Failed to fetch conversations", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Delete conversation
  app.delete("/api/ai/conversations/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      
      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      // Check if conversation exists
      const conversation = await storage.getAiConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      // Basic authorization check - in production, this should validate actual user ownership
      // For now, we'll allow deletion but log it for security auditing
      console.log(`🔒 Conversation delete requested: ${conversationId} (userId: ${conversation.userId || 'anonymous'})`);
      
      // TODO: Add proper user authentication and ownership validation
      // Example: if (req.user?.id !== conversation.userId) { return res.status(403).json({ error: "Unauthorized" }); }

      // Delete the conversation (this should cascade delete messages)
      await storage.deleteAiConversation(conversationId);
      
      res.json({ success: true, message: "Conversation deleted successfully" });
    } catch (error) {
      console.error("Error deleting conversation:", error);
      res.status(500).json({ 
        error: "Failed to delete conversation", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Update conversation status
  app.patch("/api/ai/conversations/:conversationId", async (req, res) => {
    try {
      const { conversationId } = req.params;
      const { status } = req.body;
      
      if (!conversationId) {
        return res.status(400).json({ error: "Conversation ID is required" });
      }

      if (!status || !['active', 'completed', 'archived'].includes(status)) {
        return res.status(400).json({ error: "Valid status is required (active, completed, archived)" });
      }

      await aiAgentOrchestrator.updateConversationStatus(conversationId, status);
      
      res.json({ success: true, message: "Conversation status updated" });
    } catch (error) {
      console.error("Error updating conversation status:", error);
      res.status(500).json({ 
        error: "Failed to update conversation status", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get research findings
  app.get("/api/ai/research-findings", async (req, res) => {
    try {
      const { conversationId, type, limit = "50" } = req.query;
      
      const findings = await storage.getResearchFindings(
        conversationId as string,
        type as string,
        parseInt(limit as string)
      );

      res.json(findings);
    } catch (error) {
      console.error("Error fetching research findings:", error);
      res.status(500).json({ 
        error: "Failed to fetch research findings", 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Workflow suspension/resume management routes
  
  // Get all suspended workflows
  app.get("/api/workflows/suspended", async (req, res) => {
    try {
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      const suspendedWorkflows = await workflowCoordinator.getSuspendedWorkflows();
      
      res.json(suspendedWorkflows);
    } catch (error) {
      console.error("Error fetching suspended workflows:", error);
      res.status(500).json({
        error: "Failed to fetch suspended workflows",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get workflow status
  app.get("/api/workflows/:workflowId/status", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      
      const activeWorkflow = workflowCoordinator.getWorkflowStatus(workflowId);
      
      if (activeWorkflow) {
        res.json(activeWorkflow);
      } else {
        // Check database for workflow state
        const workflowState = await storage.getWorkflowStateByWorkflowId(workflowId);
        if (workflowState) {
          res.json(workflowState);
        } else {
          res.status(404).json({ error: "Workflow not found" });
        }
      }
    } catch (error) {
      console.error("Error fetching workflow status:", error);
      res.status(500).json({
        error: "Failed to fetch workflow status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AGENT PERFORMANCE MONITORING ENDPOINTS
  
  // Get all agent activity for monitoring dashboard  
  app.get("/api/agent-activity", async (req, res) => {
    try {
      const agentMemoryService = await import("./services/agentMemoryService");
      const activities = await agentMemoryService.AgentMemoryService.getInstance().getRecentAgentActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching agent activities:", error);
      res.status(500).json({ error: "Failed to fetch agent activities" });
    }
  });

  // Get agent performance metrics
  app.get("/api/agent-performance", async (req, res) => {
    try {
      const { agentId, timeRange = '7d' } = req.query;
      const agentMemoryService = await import("./services/agentMemoryService");
      
      if (agentId) {
        const summary = await agentMemoryService.AgentMemoryService.getInstance().getAgentPerformanceSummary(agentId as string);
        res.json(summary);
      } else {
        // Get all agent performance metrics
        const allMetrics = await storage.getAllAgentPerformanceMetrics(timeRange as string);
        res.json(allMetrics);
      }
    } catch (error) {
      console.error("Error fetching agent performance:", error);
      res.status(500).json({ error: "Failed to fetch agent performance" });
    }
  });

  // Get workflow execution metrics
  app.get("/api/workflow-metrics", async (req, res) => {
    try {
      const metrics = await storage.getWorkflowExecutionMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching workflow metrics:", error);
      res.status(500).json({ error: "Failed to fetch workflow metrics" });
    }
  });

  // Get agent coordination logs for monitoring
  app.get("/api/agent-coordination", async (req, res) => {
    try {
      const { limit = 50 } = req.query;
      const agentMemoryService = await import("./services/agentMemoryService");
      const coordinationLogs = await agentMemoryService.AgentMemoryService.getInstance().getCoordinationLogs(parseInt(limit as string));
      res.json(coordinationLogs);
    } catch (error) {
      console.error("Error fetching coordination logs:", error);
      res.status(500).json({ error: "Failed to fetch coordination logs" });
    }
  });

  // Get real-time system health metrics  
  app.get("/api/system-health", async (req, res) => {
    try {
      // Get workflow metrics for comprehensive health data
      const workflowMetrics = await storage.getWorkflowExecutionMetrics();
      const agentHealthSummary = await storage.getAgentHealthSummary();
      const portalHealthSummary = await storage.getPortalHealthSummary();
      
      // Get active agents for enhanced agent status
      const activeAgents = await storage.getActiveAgents();
      
      const health = {
        systemStatus: 'healthy',
        activeWorkflows: workflowMetrics.total || 0,
        suspendedWorkflows: workflowMetrics.suspended || 0,
        completedWorkflows: workflowMetrics.completed || 0,
        failedWorkflows: workflowMetrics.failed || 0,
        successRate: workflowMetrics.total > 0 ? 
          ((workflowMetrics.completed / workflowMetrics.total) * 100) : 0,
        avgExecutionTimeSeconds: workflowMetrics.avgExecutionTimeSeconds || 0,
        agentStatus: {
          total: activeAgents.length,
          active: activeAgents.filter(a => a.status === 'active').length,
          orchestrators: activeAgents.filter(a => a.tier === 'orchestrator').length,
          managers: activeAgents.filter(a => a.tier === 'manager').length,
          specialists: activeAgents.filter(a => a.tier === 'specialist').length,
          ...agentHealthSummary
        },
        portalStatus: portalHealthSummary,
        timestamp: new Date(),
      };
      
      res.json(health);
    } catch (error) {
      console.error("Error fetching system health:", error);
      res.status(500).json({ error: "Failed to fetch system health" });
    }
  });

  // Get agent registry status for 3-tier system monitoring
  app.get("/api/agent-registry", async (req, res) => {
    try {
      const agents = await storage.getActiveAgents();
      const agentsByTier = {
        orchestrator: agents.filter(a => a.tier === 'orchestrator'),
        manager: agents.filter(a => a.tier === 'manager'), 
        specialist: agents.filter(a => a.tier === 'specialist'),
      };

      res.json({
        agents,
        agentsByTier,
        summary: {
          total: agents.length,
          active: agents.filter(a => a.status === 'active').length,
          byTier: {
            orchestrator: agentsByTier.orchestrator.length,
            manager: agentsByTier.manager.length,
            specialist: agentsByTier.specialist.length,
          }
        }
      });
    } catch (error) {
      console.error("Error fetching agent registry status:", error);
      res.status(500).json({ error: "Failed to fetch agent registry status" });
    }
  });

  // Get work items status for 3-tier system monitoring
  app.get("/api/work-items", async (req, res) => {
    try {
      const { status, agentId, limit = 50 } = req.query;
      
      let workItems = [];
      const summary = {
        pending: await storage.getWorkItemsByStatus('pending'),
        inProgress: await storage.getWorkItemsByStatus('in_progress'), 
        completed: await storage.getWorkItemsByStatus('completed'),
        failed: await storage.getWorkItemsByStatus('failed'),
      };

      if (status) {
        workItems = await storage.getWorkItemsByStatus(status as string);
      } else if (agentId) {
        workItems = await storage.getWorkItemsByAgent(agentId as string);
      } else {
        workItems = [...summary.pending, ...summary.inProgress, ...summary.completed, ...summary.failed]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, Number(limit));
      }

      res.json({
        workItems,
        summary: {
          pending: summary.pending.length,
          inProgress: summary.inProgress.length,
          completed: summary.completed.length,
          failed: summary.failed.length,
          total: summary.pending.length + summary.inProgress.length + 
                 summary.completed.length + summary.failed.length,
        }
      });
    } catch (error) {
      console.error("Error fetching work items:", error);
      res.status(500).json({ error: "Failed to fetch work items" });
    }
  });

  // ============ MASTRA WORKFLOW EXECUTION ENDPOINTS ============
  
  /**
   * Execute document processing workflow
   */
  app.post("/api/workflows/document-processing/execute", async (req, res) => {
    try {
      const { rfpId, documentUrl, forceReprocess = false } = req.body;
      
      if (!rfpId || !documentUrl) {
        return res.status(400).json({ 
          error: "RFP ID and document URL are required" 
        });
      }
      
      // Import Mastra instance
      const { mastra } = await import("../src/mastra/index");
      
      // Execute the document processing workflow
      const result = await mastra.workflows.documentProcessing.execute({
        rfpId,
        documentUrl,
        forceReprocess
      });
      
      res.json({
        success: true,
        workflowId: result.id,
        status: result.status,
        data: result.data
      });
      
    } catch (error) {
      console.error("Error executing document processing workflow:", error);
      res.status(500).json({ 
        error: "Failed to execute document processing workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Execute RFP discovery workflow
   */
  app.post("/api/workflows/rfp-discovery/execute", async (req, res) => {
    try {
      const { portalIds, deepScan = true } = req.body;
      
      if (!portalIds || !Array.isArray(portalIds)) {
        return res.status(400).json({ 
          error: "Portal IDs array is required" 
        });
      }
      
      // Import Mastra instance
      const { mastra } = await import("../src/mastra/index");
      
      // Execute the RFP discovery workflow
      const result = await mastra.workflows.rfpDiscovery.execute({
        portalIds,
        deepScan
      });
      
      res.json({
        success: true,
        workflowId: result.id,
        status: result.status,
        data: result.data
      });
      
    } catch (error) {
      console.error("Error executing RFP discovery workflow:", error);
      res.status(500).json({ 
        error: "Failed to execute RFP discovery workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Execute proposal generation workflow
   */
  app.post("/api/workflows/proposal-generation/execute", async (req, res) => {
    try {
      const { rfpId, companyProfileId, proposalType = 'standard' } = req.body;
      
      if (!rfpId || !companyProfileId) {
        return res.status(400).json({ 
          error: "RFP ID and company profile ID are required" 
        });
      }
      
      // Import Mastra instance
      const { mastra } = await import("../src/mastra/index");
      
      // Execute the proposal generation workflow
      const result = await mastra.workflows.proposalGeneration.execute({
        rfpId,
        companyProfileId,
        proposalType
      });
      
      res.json({
        success: true,
        workflowId: result.id,
        status: result.status,
        data: result.data
      });
      
    } catch (error) {
      console.error("Error executing proposal generation workflow:", error);
      res.status(500).json({ 
        error: "Failed to execute proposal generation workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  
  /**
   * Get workflow status
   */
  app.get("/api/workflows/:workflowId", async (req, res) => {
    try {
      const { workflowId } = req.params;
      
      // Import Mastra instance
      const { mastra } = await import("../src/mastra/index");
      
      // Get workflow status (this would require Mastra's workflow tracking API)
      // For now, return from our coordinator
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      const status = workflowCoordinator.getWorkflowStatus(workflowId);
      
      if (!status) {
        return res.status(404).json({ error: "Workflow not found" });
      }
      
      res.json(status);
      
    } catch (error) {
      console.error("Error fetching workflow status:", error);
      res.status(500).json({ 
        error: "Failed to fetch workflow status",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Suspend a workflow
  app.post("/api/workflows/:workflowId/suspend", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { reason, data, instructions } = req.body;
      
      if (!reason) {
        return res.status(400).json({ error: "Suspension reason is required" });
      }
      
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      const success = await workflowCoordinator.suspendWorkflow(workflowId, reason, data, instructions);
      
      if (success) {
        res.json({ success: true, message: "Workflow suspended successfully" });
      } else {
        res.status(404).json({ error: "Workflow not found or already suspended" });
      }
    } catch (error) {
      console.error("Error suspending workflow:", error);
      res.status(500).json({
        error: "Failed to suspend workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Resume a workflow with optional human input
  app.post("/api/workflows/:workflowId/resume", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { humanInput } = req.body;
      
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      const result = await workflowCoordinator.resumeWorkflow(workflowId, humanInput);
      
      res.json(result);
    } catch (error) {
      console.error("Error resuming workflow:", error);
      res.status(500).json({
        error: "Failed to resume workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Cancel a workflow
  app.post("/api/workflows/:workflowId/cancel", async (req, res) => {
    try {
      const { workflowId } = req.params;
      
      const { workflowCoordinator } = await import("./services/workflowCoordinator");
      const success = await workflowCoordinator.cancelWorkflow(workflowId);
      
      if (success) {
        res.json({ success: true, message: "Workflow cancelled successfully" });
      } else {
        res.status(404).json({ error: "Workflow not found" });
      }
    } catch (error) {
      console.error("Error cancelling workflow:", error);
      res.status(500).json({
        error: "Failed to cancel workflow",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============ PHASE 11: E2E WORKFLOW STATE OBSERVABILITY ENDPOINTS ============
  
  // Get comprehensive workflow state for all RFPs with phase visibility
  app.get("/api/workflows/state", async (req, res) => {
    try {
      const { status, phase, limit = 50 } = req.query;
      
      // Get active workflows from storage
      const activeWorkflows = await storage.getActiveWorkflows();
      const suspendedWorkflows = await storage.getSuspendedWorkflows();
      
      // Get all RFPs with their current status as workflow state proxy
      const allRFPs = await storage.getAllRFPs({ 
        status: status as string, 
        limit: Number(limit) 
      });
      
      // Map RFPs to workflow state format
      const workflowStates = allRFPs.rfps.map(rfp => ({
        workflowId: `rfp-workflow-${rfp.id}`,
        rfpId: rfp.id,
        currentPhase: determinePhaseFromStatus(rfp.status),
        status: mapRFPStatusToWorkflowStatus(rfp.status),
        progress: rfp.progress || 0,
        title: rfp.title,
        agency: rfp.agency,
        deadline: rfp.deadline,
        estimatedValue: rfp.estimatedValue,
        portalId: rfp.portalId,
        lastUpdated: rfp.updatedAt,
        phaseHistory: [] // TODO: Get from phase transition records
      }));
      
      // Filter by phase if requested
      const filteredWorkflows = phase ? 
        workflowStates.filter(w => w.currentPhase === phase) : 
        workflowStates;
      
      // Get phase distribution
      const phaseDistribution = {
        discovery: workflowStates.filter(w => w.currentPhase === 'discovery').length,
        analysis: workflowStates.filter(w => w.currentPhase === 'analysis').length,
        generation: workflowStates.filter(w => w.currentPhase === 'generation').length,
        submission: workflowStates.filter(w => w.currentPhase === 'submission').length,
        completed: workflowStates.filter(w => w.currentPhase === 'completed').length
      };
      
      res.json({
        success: true,
        workflows: filteredWorkflows,
        summary: {
          total: workflowStates.length,
          active: workflowStates.filter(w => ['pending', 'in_progress'].includes(w.status)).length,
          completed: workflowStates.filter(w => w.status === 'completed').length,
          failed: workflowStates.filter(w => w.status === 'failed').length,
          suspended: workflowStates.filter(w => w.status === 'suspended').length,
          phaseDistribution
        }
      });
    } catch (error) {
      console.error("Error fetching workflow state:", error);
      res.status(500).json({ error: "Failed to fetch workflow state" });
    }
  });
  
  // Get detailed workflow state for specific RFP
  app.get("/api/workflows/state/:rfpId", async (req, res) => {
    try {
      const { rfpId } = req.params;
      
      // Get RFP details
      const rfp = await storage.getRFP(rfpId);
      if (!rfp) {
        return res.status(404).json({ error: "RFP not found" });
      }
      
      // Get related entities
      const documents = await storage.getDocumentsByRFP(rfpId);
      const proposals = await storage.getProposalByRFP(rfpId);
      const submissions = await storage.getSubmissionsByRFP(rfpId);
      const workItems = await storage.getWorkItemsByWorkflow(`rfp-workflow-${rfpId}`);
      
      // Get workflow state from storage
      const workflowState = await storage.getWorkflowStateByWorkflowId(`rfp-workflow-${rfpId}`);
      
      // Get phase transitions
      const phaseTransitions = await storage.getPhaseStateTransitions(`rfp-workflow-${rfpId}`);
      
      // Determine current phase and status
      const currentPhase = determinePhaseFromStatus(rfp.status);
      const workflowStatus = mapRFPStatusToWorkflowStatus(rfp.status);
      
      // Build comprehensive workflow state
      const detailedState = {
        workflowId: `rfp-workflow-${rfpId}`,
        rfp: {
          id: rfp.id,
          title: rfp.title,
          description: rfp.description,
          agency: rfp.agency,
          status: rfp.status,
          progress: rfp.progress || 0,
          deadline: rfp.deadline,
          estimatedValue: rfp.estimatedValue,
          requirements: rfp.requirements,
          complianceItems: rfp.complianceItems,
          riskFlags: rfp.riskFlags
        },
        currentPhase,
        status: workflowStatus,
        progress: rfp.progress || 0,
        phaseHistory: phaseTransitions || [],
        entities: {
          documents: documents.length,
          proposals: proposals ? 1 : 0,
          submissions: submissions.length,
          workItems: workItems.length
        },
        workItems: workItems.slice(0, 10), // Recent work items
        canTransitionTo: getValidPhaseTransitions(currentPhase, workflowStatus),
        estimatedCompletion: calculateEstimatedCompletion(currentPhase, rfp.deadline),
        healthStatus: assessWorkflowHealth(rfp, documents, workItems),
        lastActivity: rfp.updatedAt,
        metadata: workflowState || {}
      };
      
      res.json({
        success: true,
        workflowState: detailedState
      });
    } catch (error) {
      console.error("Error fetching detailed workflow state:", error);
      res.status(500).json({ error: "Failed to fetch workflow state" });
    }
  });
  
  // Get workflow phase statistics for monitoring dashboard
  app.get("/api/workflows/phase-stats", async (req, res) => {
    try {
      const { timeRange = '24h' } = req.query;
      
      // Get all RFPs
      const allRFPs = await storage.getAllRFPs({ limit: 1000 });
      
      // Get phase transitions within time range  
      const recentTransitions = await storage.getRecentPhaseTransitions(100);
      
      // Calculate phase statistics with real data
      const phases = ['discovery', 'analysis', 'generation', 'submission', 'completed'];
      const phaseStats: any = {};
      
      for (const phase of phases) {
        if (phase === 'completed') {
          const completedRFPs = allRFPs.rfps.filter(r => r.status === 'submitted' || r.status === 'closed');
          const phaseTransitions = recentTransitions.filter(t => t.toPhase === phase);
          
          phaseStats[phase] = {
            count: completedRFPs.length,
            avgTotalDuration: calculateAverageTransitionTime(phaseTransitions) || 0,
            successRate: completedRFPs.length > 0 ? completedRFPs.length / allRFPs.rfps.length : 0,
            common_issues: []
          };
        } else {
          const activeRFPs = allRFPs.rfps.filter(r => determinePhaseFromStatus(r.status) === phase);
          const phaseTransitions = recentTransitions.filter(t => t.toPhase === phase);
          const successfulTransitions = phaseTransitions.filter(t => t.toStatus !== 'failed' && t.toStatus !== 'error');
          
          phaseStats[phase] = {
            active: activeRFPs.length,
            avgDuration: calculateAverageTransitionTime(phaseTransitions) || 0,
            successRate: phaseTransitions.length > 0 ? successfulTransitions.length / phaseTransitions.length : 1.0,
            common_issues: []
          };
        }
      }
      
      // Calculate transition metrics
      const transitionMetrics = {
        totalTransitions: recentTransitions.length,
        successfulTransitions: recentTransitions.filter(t => t.toStatus !== 'failed').length,
        failedTransitions: recentTransitions.filter(t => t.toStatus === 'failed').length,
        averageTransitionTime: calculateAverageTransitionTime(recentTransitions)
      };
      
      res.json({
        success: true,
        phaseStats,
        transitionMetrics,
        timeRange,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching phase statistics:", error);
      res.status(500).json({ error: "Failed to fetch phase statistics" });
    }
  });
  
  // Trigger phase transition for workflow
  app.post("/api/workflows/:workflowId/transition", async (req, res) => {
    try {
      const { workflowId } = req.params;
      const { toPhase, reason, metadata } = req.body;
      
      if (!toPhase) {
        return res.status(400).json({ error: "Target phase is required" });
      }
      
      // Extract RFP ID from workflow ID
      const rfpId = workflowId.replace('rfp-workflow-', '');
      const rfp = await storage.getRFP(rfpId);
      
      if (!rfp) {
        return res.status(404).json({ error: "RFP workflow not found" });
      }
      
      const currentPhase = determinePhaseFromStatus(rfp.status);
      
      // Validate transition
      const validTransitions = getValidPhaseTransitions(currentPhase, rfp.status);
      if (!validTransitions.includes(toPhase)) {
        return res.status(400).json({ 
          error: "Invalid phase transition",
          current: currentPhase,
          requested: toPhase,
          valid: validTransitions
        });
      }
      
      // Execute phase transition
      const newStatus = mapPhaseToRFPStatus(toPhase);
      const newProgress = calculatePhaseProgress(toPhase);
      
      // Update RFP status
      const updatedRFP = await storage.updateRFP(rfpId, {
        status: newStatus,
        progress: newProgress
      });
      
      // Record phase transition
      await storage.createPhaseStateTransition({
        workflowId,
        fromPhase: currentPhase,
        toPhase,
        fromStatus: rfp.status,
        toStatus: newStatus,
        transitionType: 'manual',
        triggeredBy: 'api_request',
        reason: reason || 'Manual transition',
        metadata: metadata || {},
        timestamp: new Date()
      });
      
      res.json({
        success: true,
        workflowId,
        transition: {
          from: currentPhase,
          to: toPhase,
          status: newStatus,
          progress: newProgress
        },
        rfp: updatedRFP
      });
    } catch (error) {
      console.error("Error executing phase transition:", error);
      res.status(500).json({ 
        error: "Failed to execute phase transition",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ============ PHASE 11: E2E TESTING ORCHESTRATOR ENDPOINTS ============

  // Initialize E2E Test Orchestrator (lazy loading to avoid circular dependencies)
  let e2eOrchestrator: any = null;
  const initE2EOrchestrator = async () => {
    if (!e2eOrchestrator) {
      const { E2ETestOrchestrator } = await import('./services/e2eTestOrchestrator.js');
      const { WorkflowCoordinator } = await import('./services/workflowCoordinator.js');
      const { DiscoveryOrchestrator } = await import('./services/discoveryOrchestrator.js');
      const { SubmissionOrchestrator } = await import('./services/submissionOrchestrator.js');
      const { AgentRegistryService } = await import('./services/agentRegistryService.js');
      const { MastraWorkflowEngine } = await import('./services/mastraWorkflowEngine.js');

      const workflowCoordinator = new WorkflowCoordinator(storage);
      const discoveryOrchestrator = new DiscoveryOrchestrator(storage);
      const submissionOrchestrator = new SubmissionOrchestrator(storage);
      const agentRegistry = new AgentRegistryService(storage);
      const mastraEngine = new MastraWorkflowEngine(storage);

      e2eOrchestrator = new E2ETestOrchestrator(
        storage,
        workflowCoordinator,
        discoveryOrchestrator,
        submissionOrchestrator,
        agentRegistry,
        mastraEngine
      );
    }
    return e2eOrchestrator;
  };

  // Get available E2E test scenarios
  app.get("/api/e2e/scenarios", async (req, res) => {
    try {
      const orchestrator = await initE2EOrchestrator();
      const scenarios = orchestrator.getTestScenarios();
      
      res.json({
        success: true,
        scenarios: scenarios.map(scenario => ({
          id: scenario.id,
          name: scenario.name,
          description: scenario.description,
          phases: scenario.phases,
          expectedDuration: scenario.expectedDuration
        }))
      });
    } catch (error) {
      console.error("Error fetching E2E test scenarios:", error);
      res.status(500).json({ error: "Failed to fetch test scenarios" });
    }
  });

  // Execute E2E test scenario
  app.post("/api/e2e/tests/:scenarioId/execute", async (req, res) => {
    try {
      const { scenarioId } = req.params;
      const orchestrator = await initE2EOrchestrator();
      
      const testId = await orchestrator.executeTestScenario(scenarioId);
      
      res.json({
        success: true,
        testId,
        message: `E2E test scenario '${scenarioId}' started`,
        status: 'running'
      });
    } catch (error) {
      console.error("Error executing E2E test scenario:", error);
      res.status(500).json({ 
        error: "Failed to execute test scenario",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get E2E test result
  app.get("/api/e2e/tests/:testId", async (req, res) => {
    try {
      const { testId } = req.params;
      const orchestrator = await initE2EOrchestrator();
      
      const testResult = orchestrator.getTestResult(testId);
      
      if (!testResult) {
        return res.status(404).json({ error: "Test result not found" });
      }
      
      res.json({
        success: true,
        testResult
      });
    } catch (error) {
      console.error("Error fetching E2E test result:", error);
      res.status(500).json({ error: "Failed to fetch test result" });
    }
  });

  // Get all active E2E tests
  app.get("/api/e2e/tests", async (req, res) => {
    try {
      const orchestrator = await initE2EOrchestrator();
      const activeTests = orchestrator.getAllActiveTests();
      
      res.json({
        success: true,
        tests: activeTests.map(test => ({
          scenarioId: test.scenarioId,
          status: test.status,
          startTime: test.startTime,
          endTime: test.endTime,
          duration: test.duration,
          overallResults: {
            systemHealthScore: test.overallResults.systemHealthScore,
            totalValidations: test.overallResults.totalValidations,
            passedValidations: test.overallResults.passedValidations,
            failedValidations: test.overallResults.failedValidations
          }
        }))
      });
    } catch (error) {
      console.error("Error fetching active E2E tests:", error);
      res.status(500).json({ error: "Failed to fetch active tests" });
    }
  });

  // Cancel E2E test
  app.post("/api/e2e/tests/:testId/cancel", async (req, res) => {
    try {
      const { testId } = req.params;
      const orchestrator = await initE2EOrchestrator();
      
      const cancelled = await orchestrator.cancelTest(testId);
      
      if (!cancelled) {
        return res.status(400).json({ error: "Test not found or cannot be cancelled" });
      }
      
      res.json({
        success: true,
        message: "Test cancelled successfully"
      });
    } catch (error) {
      console.error("Error cancelling E2E test:", error);
      res.status(500).json({ error: "Failed to cancel test" });
    }
  });

  // Clean up test data
  app.post("/api/e2e/tests/:testId/cleanup", async (req, res) => {
    try {
      const { testId } = req.params;
      const orchestrator = await initE2EOrchestrator();
      
      await orchestrator.cleanupTestData(testId);
      
      res.json({
        success: true,
        message: "Test data cleaned up successfully"
      });
    } catch (error) {
      console.error("Error cleaning up test data:", error);
      res.status(500).json({ error: "Failed to clean up test data" });
    }
  });

  // Get system readiness assessment
  app.get("/api/e2e/system-readiness", async (req, res) => {
    try {
      const orchestrator = await initE2EOrchestrator();
      const assessment = orchestrator.getSystemReadinessAssessment();
      
      res.json({
        success: true,
        assessment: {
          overallReadiness: assessment.overallReadiness,
          score: assessment.score,
          details: assessment.details,
          timestamp: new Date().toISOString(),
          recommendations: assessment.details.recommendations || []
        }
      });
    } catch (error) {
      console.error("Error fetching system readiness assessment:", error);
      res.status(500).json({ error: "Failed to fetch system readiness" });
    }
  });

  // Execute comprehensive E2E validation suite
  app.post("/api/e2e/validate-all", async (req, res) => {
    try {
      const orchestrator = await initE2EOrchestrator();
      const scenarios = orchestrator.getTestScenarios();
      
      // Execute all test scenarios
      const testPromises = scenarios.map(scenario => 
        orchestrator.executeTestScenario(scenario.id)
      );
      
      const testIds = await Promise.all(testPromises);
      
      res.json({
        success: true,
        message: "Comprehensive E2E validation suite started",
        testIds,
        scenariosCount: scenarios.length,
        estimatedDuration: Math.max(...scenarios.map(s => s.expectedDuration)) + ' minutes'
      });
    } catch (error) {
      console.error("Error executing comprehensive E2E validation:", error);
      res.status(500).json({ 
        error: "Failed to execute comprehensive validation",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Execute comprehensive data persistence validation
  app.post("/api/e2e/validate-data-persistence", async (req, res) => {
    try {
      const orchestrator = await initE2EOrchestrator();
      const validation = await orchestrator.executeComprehensiveDataValidation();
      
      res.json({
        success: true,
        validation: {
          overallStatus: validation.overallStatus,
          dataIntegrityScore: validation.dataIntegrityScore,
          totalValidations: validation.validations.length,
          passedValidations: validation.validations.filter(v => v.status === 'passed').length,
          failedValidations: validation.validations.filter(v => v.status === 'failed').length,
          validations: validation.validations,
          issues: validation.issues,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error("Error executing data persistence validation:", error);
      res.status(500).json({ 
        error: "Failed to execute data persistence validation",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return server;
}

// Helper functions for workflow state mapping
export function determinePhaseFromStatus(status: string): string {
  const phaseMap: { [key: string]: string } = {
    'discovered': 'discovery',
    'parsing': 'analysis', 
    'analyzing': 'analysis',
    'drafting': 'generation',
    'generating': 'generation',
    'review': 'generation',
    'approved': 'submission',
    'submitting': 'submission',
    'submitted': 'completed',
    'closed': 'completed'
  };
  
  return phaseMap[status] || 'discovery';
}

export function mapRFPStatusToWorkflowStatus(status: string): string {
  const statusMap: { [key: string]: string } = {
    'discovered': 'pending',
    'parsing': 'in_progress',
    'analyzing': 'in_progress', 
    'drafting': 'in_progress',
    'generating': 'in_progress',
    'review': 'pending',
    'approved': 'pending',
    'submitting': 'in_progress',
    'submitted': 'completed',
    'closed': 'completed',
    'error': 'failed'
  };
  
  return statusMap[status] || 'pending';
}

function mapPhaseToRFPStatus(phase: string): string {
  const phaseMap: { [key: string]: string } = {
    'discovery': 'discovered',
    'analysis': 'analyzing',
    'generation': 'generating', 
    'submission': 'submitting',
    'completed': 'submitted'
  };
  
  return phaseMap[phase] || 'discovered';
}

function calculatePhaseProgress(phase: string): number {
  const progressMap: { [key: string]: number } = {
    'discovery': 20,
    'analysis': 40,
    'generation': 70,
    'submission': 90,
    'completed': 100
  };
  
  return progressMap[phase] || 0;
}

function getValidPhaseTransitions(currentPhase: string, currentStatus: string): string[] {
  const transitions: { [key: string]: string[] } = {
    'discovery': ['analysis'],
    'analysis': ['generation', 'discovery'], // Can go back if analysis fails
    'generation': ['submission', 'analysis'], // Can go back for revision  
    'submission': ['completed', 'generation'], // Can go back if submission fails
    'completed': [] // Terminal state
  };
  
  return transitions[currentPhase] || [];
}

function calculateEstimatedCompletion(phase: string, deadline: Date | null): Date | null {
  if (!deadline) return null;
  
  const avgDurations: { [key: string]: number } = {
    'discovery': 2, // days
    'analysis': 3,
    'generation': 5, 
    'submission': 1,
    'completed': 0
  };
  
  const remainingPhases = getValidPhaseTransitions(phase, '');
  const totalDays = remainingPhases.reduce((sum, p) => sum + (avgDurations[p] || 0), 0);
  
  const estimated = new Date();
  estimated.setDate(estimated.getDate() + totalDays);
  
  return estimated;
}

function calculateAverageTransitionTime(transitions: any[]): number {
  if (transitions.length === 0) return 0;
  
  const durations = transitions
    .filter(t => t.duration)
    .map(t => t.duration);
    
  return durations.length > 0 
    ? durations.reduce((sum, d) => sum + d, 0) / durations.length 
    : 0;
}

function assessWorkflowHealth(rfp: any, documents: any[], workItems: any[]): string {
  const now = new Date();
  const updated = new Date(rfp.updatedAt);
  const hoursSinceUpdate = (now.getTime() - updated.getTime()) / (1000 * 60 * 60);
  
  // Check for stalled workflow
  if (hoursSinceUpdate > 24 && rfp.status !== 'submitted' && rfp.status !== 'closed') {
    return 'warning';
  }
  
  // Check for failed work items
  const failedItems = workItems.filter(w => w.status === 'failed');
  if (failedItems.length > 0) {
    return 'error';
  }
  
  // Check deadline proximity
  if (rfp.deadline) {
    const deadline = new Date(rfp.deadline);
    const daysUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    if (daysUntilDeadline < 3 && rfp.status !== 'submitted') {
      return 'critical';
    }
  }
  
  return 'healthy';
}
