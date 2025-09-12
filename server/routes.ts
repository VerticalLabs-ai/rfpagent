import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertRfpSchema, insertProposalSchema, insertPortalSchema, insertDocumentSchema } from "@shared/schema";
import { ScrapingService } from "./services/scrapingService";
import { DocumentParsingService } from "./services/documentParsingService";
import { AIService } from "./services/aiService";
import { SubmissionService } from "./services/submissionService";
import { NotificationService } from "./services/notificationService";
import { ObjectStorageService } from "./objectStorage";
import { setupScrapingScheduler } from "./jobs/scrapingScheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  const scrapingService = new ScrapingService();
  const documentService = new DocumentParsingService();
  const aiService = new AIService();
  const submissionService = new SubmissionService();
  const notificationService = new NotificationService();
  const objectStorageService = new ObjectStorageService();

  // Initialize scheduled scraping
  setupScrapingScheduler();

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
      const portal = await storage.getPortal(id);
      
      if (!portal) {
        return res.status(404).json({ error: "Portal not found" });
      }

      // Start scraping asynchronously
      scrapingService.scrapePortal(portal).catch(console.error);

      res.json({ message: "Portal scan started" });
    } catch (error) {
      console.error("Error starting portal scan:", error);
      res.status(500).json({ error: "Failed to start portal scan" });
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

  const httpServer = createServer(app);

  return httpServer;
}
