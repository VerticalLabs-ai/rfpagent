import {
  users, portals, rfps, proposals, documents, submissions, auditLogs, notifications,
  type User, type InsertUser, type Portal, type InsertPortal, type RFP, type InsertRFP,
  type Proposal, type InsertProposal, type Document, type InsertDocument,
  type Submission, type InsertSubmission, type AuditLog, type InsertAuditLog,
  type Notification, type InsertNotification
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, and, or, gte, lte, count, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Portals
  getAllPortals(): Promise<Portal[]>;
  getPortal(id: string): Promise<Portal | undefined>;
  createPortal(portal: InsertPortal): Promise<Portal>;
  updatePortal(id: string, updates: Partial<Portal>): Promise<Portal>;
  deletePortal(id: string): Promise<void>;

  // RFPs
  getAllRFPs(filters?: { status?: string; portalId?: string; limit?: number; offset?: number }): Promise<{ rfps: RFP[]; total: number }>;
  getRFP(id: string): Promise<RFP | undefined>;
  getRFPsWithDetails(): Promise<any[]>;
  createRFP(rfp: InsertRFP): Promise<RFP>;
  updateRFP(id: string, updates: Partial<RFP>): Promise<RFP>;
  getRFPsByStatus(status: string): Promise<RFP[]>;
  getRFPsByPortal(portalId: string): Promise<RFP[]>;

  // Proposals
  getProposal(id: string): Promise<Proposal | undefined>;
  getProposalByRFP(rfpId: string): Promise<Proposal | undefined>;
  createProposal(proposal: InsertProposal): Promise<Proposal>;
  updateProposal(id: string, updates: Partial<Proposal>): Promise<Proposal>;

  // Documents
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByRFP(rfpId: string): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, updates: Partial<Document>): Promise<Document>;

  // Submissions
  getSubmission(id: string): Promise<Submission | undefined>;
  getSubmissionsByRFP(rfpId: string): Promise<Submission[]>;
  createSubmission(submission: InsertSubmission): Promise<Submission>;
  updateSubmission(id: string, updates: Partial<Submission>): Promise<Submission>;

  // Audit Logs
  createAuditLog(log: InsertAuditLog): Promise<AuditLog>;
  getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;

  // Notifications
  getAllNotifications(limit?: number): Promise<Notification[]>;
  getUnreadNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationRead(id: string): Promise<void>;

  // Analytics
  getDashboardMetrics(): Promise<any>;
  getPortalActivity(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  // Portals
  async getAllPortals(): Promise<Portal[]> {
    return await db.select().from(portals).orderBy(asc(portals.name));
  }

  async getPortal(id: string): Promise<Portal | undefined> {
    const [portal] = await db.select().from(portals).where(eq(portals.id, id));
    return portal || undefined;
  }

  async createPortal(portal: InsertPortal): Promise<Portal> {
    const [newPortal] = await db
      .insert(portals)
      .values(portal)
      .returning();
    return newPortal;
  }

  async updatePortal(id: string, updates: Partial<Portal>): Promise<Portal> {
    const [updatedPortal] = await db
      .update(portals)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(portals.id, id))
      .returning();
    return updatedPortal;
  }

  async deletePortal(id: string): Promise<void> {
    // Check if portal exists
    const portal = await this.getPortal(id);
    if (!portal) {
      throw new Error("Portal not found");
    }

    // Get all RFPs associated with this portal
    const relatedRfps = await db.select().from(rfps).where(eq(rfps.portalId, id));
    
    // Delete in correct order to avoid foreign key constraint violations
    for (const rfp of relatedRfps) {
      // Delete submissions for this RFP
      await db.delete(submissions).where(eq(submissions.rfpId, rfp.id));
      
      // Delete documents for this RFP
      await db.delete(documents).where(eq(documents.rfpId, rfp.id));
      
      // Delete proposals for this RFP
      await db.delete(proposals).where(eq(proposals.rfpId, rfp.id));
    }
    
    // Delete all RFPs for this portal
    await db.delete(rfps).where(eq(rfps.portalId, id));
    
    // Delete submissions that directly reference the portal
    await db.delete(submissions).where(eq(submissions.portalId, id));
    
    // Finally delete the portal itself
    await db.delete(portals).where(eq(portals.id, id));
    
    // Create audit log for the deletion
    await this.createAuditLog({
      entityType: "portal",
      entityId: id,
      action: "deleted",
      details: {
        portalName: portal.name,
        portalUrl: portal.url,
        relatedRfpsCount: relatedRfps.length
      }
    });
  }

  // RFPs
  async getAllRFPs(filters?: { status?: string; portalId?: string; limit?: number; offset?: number }): Promise<{ rfps: RFP[]; total: number }> {
    let query = db.select().from(rfps);
    let countQuery = db.select({ count: count() }).from(rfps);

    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(rfps.status, filters.status));
    }
    if (filters?.portalId) {
      conditions.push(eq(rfps.portalId, filters.portalId));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
      countQuery = countQuery.where(and(...conditions));
    }

    query = query.orderBy(desc(rfps.discoveredAt));

    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.offset(filters.offset);
    }

    const [rfpData, totalData] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      rfps: rfpData,
      total: totalData[0].count
    };
  }

  async getRFP(id: string): Promise<RFP | undefined> {
    const [rfp] = await db.select().from(rfps).where(eq(rfps.id, id));
    return rfp || undefined;
  }

  async getRFPsWithDetails(): Promise<any[]> {
    return await db
      .select({
        rfp: rfps,
        portal: portals,
        proposal: proposals
      })
      .from(rfps)
      .leftJoin(portals, eq(rfps.portalId, portals.id))
      .leftJoin(proposals, eq(rfps.id, proposals.rfpId))
      .orderBy(desc(rfps.discoveredAt));
  }

  async createRFP(rfp: InsertRFP): Promise<RFP> {
    const [newRfp] = await db
      .insert(rfps)
      .values(rfp)
      .returning();
    return newRfp;
  }

  async updateRFP(id: string, updates: Partial<RFP>): Promise<RFP> {
    const [updatedRfp] = await db
      .update(rfps)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(rfps.id, id))
      .returning();
    return updatedRfp;
  }

  async getRFPsByStatus(status: string): Promise<RFP[]> {
    return await db.select().from(rfps).where(eq(rfps.status, status));
  }

  async getRFPsByPortal(portalId: string): Promise<RFP[]> {
    return await db.select().from(rfps).where(eq(rfps.portalId, portalId));
  }

  // Proposals
  async getProposal(id: string): Promise<Proposal | undefined> {
    const [proposal] = await db.select().from(proposals).where(eq(proposals.id, id));
    return proposal || undefined;
  }

  async getProposalByRFP(rfpId: string): Promise<Proposal | undefined> {
    const [proposal] = await db.select().from(proposals).where(eq(proposals.rfpId, rfpId));
    return proposal || undefined;
  }

  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    const [newProposal] = await db
      .insert(proposals)
      .values(proposal)
      .returning();
    return newProposal;
  }

  async updateProposal(id: string, updates: Partial<Proposal>): Promise<Proposal> {
    const [updatedProposal] = await db
      .update(proposals)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(proposals.id, id))
      .returning();
    return updatedProposal;
  }

  // Documents
  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByRFP(rfpId: string): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.rfpId, rfpId));
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db
      .insert(documents)
      .values(document)
      .returning();
    return newDocument;
  }

  async updateDocument(id: string, updates: Partial<Document>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set(updates)
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  // Submissions
  async getSubmission(id: string): Promise<Submission | undefined> {
    const [submission] = await db.select().from(submissions).where(eq(submissions.id, id));
    return submission || undefined;
  }

  async getSubmissionsByRFP(rfpId: string): Promise<Submission[]> {
    return await db.select().from(submissions).where(eq(submissions.rfpId, rfpId));
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    const [newSubmission] = await db
      .insert(submissions)
      .values(submission)
      .returning();
    return newSubmission;
  }

  async updateSubmission(id: string, updates: Partial<Submission>): Promise<Submission> {
    const [updatedSubmission] = await db
      .update(submissions)
      .set(updates)
      .where(eq(submissions.id, id))
      .returning();
    return updatedSubmission;
  }

  // Audit Logs
  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    const [newLog] = await db
      .insert(auditLogs)
      .values(log)
      .returning();
    return newLog;
  }

  async getAuditLogsByEntity(entityType: string, entityId: string): Promise<AuditLog[]> {
    return await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.entityType, entityType), eq(auditLogs.entityId, entityId)))
      .orderBy(desc(auditLogs.timestamp));
  }

  // Notifications
  async getAllNotifications(limit: number = 50): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async getUnreadNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.isRead, false))
      .orderBy(desc(notifications.createdAt));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.id, id));
  }

  // Analytics
  async getDashboardMetrics(): Promise<any> {
    const activeRfpsCount = await db
      .select({ count: count() })
      .from(rfps)
      .where(or(
        eq(rfps.status, "discovered"),
        eq(rfps.status, "parsing"),
        eq(rfps.status, "drafting"),
        eq(rfps.status, "review"),
        eq(rfps.status, "approved")
      ));

    const submittedCount = await db
      .select({ count: count() })
      .from(rfps)
      .where(eq(rfps.status, "submitted"));

    const totalValue = await db
      .select({ 
        total: sql`COALESCE(SUM(CAST(estimated_value AS DECIMAL)), 0)` 
      })
      .from(rfps)
      .where(or(
        eq(rfps.status, "approved"),
        eq(rfps.status, "submitted")
      ));

    const portalsCount = await db
      .select({ count: count() })
      .from(portals);

    return {
      activeRfps: activeRfpsCount[0].count,
      submittedRfps: submittedCount[0].count,
      totalValue: totalValue[0].total || 0,
      portalsTracked: portalsCount[0].count
    };
  }

  async getPortalActivity(): Promise<any> {
    return await db
      .select({
        portal: portals,
        rfpCount: count(rfps.id)
      })
      .from(portals)
      .leftJoin(rfps, eq(portals.id, rfps.portalId))
      .groupBy(portals.id)
      .orderBy(asc(portals.name));
  }
}

export const storage = new DatabaseStorage();
