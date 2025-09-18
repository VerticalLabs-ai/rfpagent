import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertRfpSchema, insertProposalSchema, insertPortalSchema, insertDocumentSchema,
  insertCompanyProfileSchema, insertCompanyAddressSchema, insertCompanyContactSchema,
  insertCompanyIdentifierSchema, insertCompanyCertificationSchema, insertCompanyInsuranceSchema
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
import { z } from "zod";

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
      deadline: z.string().transform(str => new Date(str)),
      prebidMeeting: z.string().transform(str => new Date(str)).optional(),
      questionsDeadline: z.string().transform(str => new Date(str)).optional(),
      sampleSubmission: z.string().transform(str => new Date(str)).optional(),
    }),
  }),
  companyProfileId: z.string().uuid(),
});

const GenerateProposalRequestSchema = z.object({
  rfpText: z.string().min(1).max(50000),
  companyProfileId: z.string().uuid(),
  proposalType: z.enum(['standard', 'technical', 'construction', 'professional_services']).optional(),
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

  // Initialize new portal monitoring scheduler
  console.log("Initializing Portal Monitoring Scheduler...");
  portalSchedulerService.initialize().catch(console.error);

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
        portalId: rfp.portalId,
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

  // Manual portal scraping
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

      // Use new monitoring service for enhanced scanning
      portalMonitoringService.scanPortal(portal.id).catch(console.error);

      const message = searchFilter 
        ? `Portal scan started with filter: "${searchFilter}"` 
        : "Portal scan started";
      res.json({ message });
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
      const notifications = await storage.getAllNotifications(999999); // Get ALL notifications, not just 50
      await Promise.all(
        notifications.map(notification => 
          storage.markNotificationRead(notification.id)
        )
      );
      res.json({ success: true, cleared: notifications.length });
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

  return server;
}
