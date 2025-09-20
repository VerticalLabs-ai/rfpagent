import {
  users, portals, rfps, proposals, documents, submissions, auditLogs, notifications, scans, scanEvents,
  companyProfiles, companyAddresses, companyContacts, companyIdentifiers, companyCertifications, companyInsurance,
  aiConversations, conversationMessages, researchFindings, historicalBids,
  agentMemory, agentKnowledgeBase, agentCoordinationLog, workflowState, agentPerformanceMetrics,
  agentRegistry, workItems, agentSessions,
  type User, type InsertUser, type Portal, type InsertPortal, type RFP, type InsertRFP,
  type Proposal, type InsertProposal, type Document, type InsertDocument,
  type Submission, type InsertSubmission, type AuditLog, type InsertAuditLog,
  type Notification, type InsertNotification, type Scan, type InsertScan,
  type ScanEvent, type InsertScanEvent, type CompanyProfile, type InsertCompanyProfile,
  type CompanyAddress, type InsertCompanyAddress, type CompanyContact, type InsertCompanyContact,
  type CompanyIdentifier, type InsertCompanyIdentifier, type CompanyCertification, type InsertCompanyCertification,
  type CompanyInsurance, type InsertCompanyInsurance, type AiConversation, type InsertAiConversation,
  type ConversationMessage, type InsertConversationMessage, type ResearchFinding, type InsertResearchFinding,
  type HistoricalBid, type InsertHistoricalBid,
  type AgentRegistry, type InsertAgentRegistry, type WorkItem, type InsertWorkItem, 
  type AgentSession, type InsertAgentSession,
  insertAgentMemorySchema, insertAgentKnowledgeSchema, insertAgentCoordinationLogSchema,
  insertWorkflowStateSchema, insertAgentPerformanceMetricsSchema, insertAgentRegistrySchema,
  insertWorkItemSchema, insertAgentSessionSchema
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
  getActivePortals(): Promise<Portal[]>;
  getPortal(id: string): Promise<Portal | undefined>;
  getPortalWithCredentials(id: string): Promise<Portal | undefined>; // Internal use only - includes credentials
  createPortal(portal: InsertPortal): Promise<Portal>;
  updatePortal(id: string, updates: Partial<Portal>): Promise<Portal>;
  deletePortal(id: string): Promise<void>;

  // RFPs
  getAllRFPs(filters?: { status?: string; portalId?: string; limit?: number; offset?: number }): Promise<{ rfps: RFP[]; total: number }>;
  getRFP(id: string): Promise<RFP | undefined>;
  getRFPBySourceUrl(sourceUrl: string): Promise<RFP | undefined>;
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

  // Company Profile Management
  getAllCompanyProfiles(): Promise<CompanyProfile[]>;
  getCompanyProfile(id: string): Promise<CompanyProfile | undefined>;
  getCompanyProfileWithDetails(id: string): Promise<any>;
  createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile>;
  updateCompanyProfile(id: string, updates: Partial<CompanyProfile>): Promise<CompanyProfile>;
  deleteCompanyProfile(id: string): Promise<void>;
  
  // Company Addresses
  getCompanyAddresses(companyProfileId: string): Promise<CompanyAddress[]>;
  createCompanyAddress(address: InsertCompanyAddress): Promise<CompanyAddress>;
  updateCompanyAddress(id: string, updates: Partial<CompanyAddress>): Promise<CompanyAddress>;
  deleteCompanyAddress(id: string): Promise<void>;
  
  // Company Contacts
  getCompanyContacts(companyProfileId: string): Promise<CompanyContact[]>;
  createCompanyContact(contact: InsertCompanyContact): Promise<CompanyContact>;
  updateCompanyContact(id: string, updates: Partial<CompanyContact>): Promise<CompanyContact>;
  deleteCompanyContact(id: string): Promise<void>;
  
  // Company Identifiers
  getCompanyIdentifiers(companyProfileId: string): Promise<CompanyIdentifier[]>;
  createCompanyIdentifier(identifier: InsertCompanyIdentifier): Promise<CompanyIdentifier>;
  updateCompanyIdentifier(id: string, updates: Partial<CompanyIdentifier>): Promise<CompanyIdentifier>;
  deleteCompanyIdentifier(id: string): Promise<void>;
  
  // Company Certifications
  getCompanyCertifications(companyProfileId: string): Promise<CompanyCertification[]>;
  getExpiringCertifications(days: number): Promise<CompanyCertification[]>;
  createCompanyCertification(certification: InsertCompanyCertification): Promise<CompanyCertification>;
  updateCompanyCertification(id: string, updates: Partial<CompanyCertification>): Promise<CompanyCertification>;
  deleteCompanyCertification(id: string): Promise<void>;
  
  // Company Insurance
  getCompanyInsurance(companyProfileId: string): Promise<CompanyInsurance[]>;
  getExpiringInsurance(days: number): Promise<CompanyInsurance[]>;
  createCompanyInsurance(insurance: InsertCompanyInsurance): Promise<CompanyInsurance>;
  updateCompanyInsurance(id: string, updates: Partial<CompanyInsurance>): Promise<CompanyInsurance>;
  deleteCompanyInsurance(id: string): Promise<void>;

  // Analytics
  getDashboardMetrics(): Promise<any>;
  getPortalActivity(): Promise<any>;

  // Scan Operations
  createScan(scan: InsertScan): Promise<Scan>;
  updateScan(scanId: string, updates: Partial<Scan>): Promise<Scan>;
  getScan(scanId: string): Promise<Scan | undefined>;
  getScansByPortal(portalId: string, limit?: number): Promise<Scan[]>;
  getActiveScansByPortal(portalId: string): Promise<Scan[]>;
  getActiveScans(): Promise<Scan[]>;
  appendScanEvent(event: InsertScanEvent): Promise<ScanEvent>;
  getScanEvents(scanId: string): Promise<ScanEvent[]>;
  getScanHistory(portalId: string, limit?: number): Promise<Scan[]>;

  // AI Conversation Operations
  getAiConversation(id: string): Promise<AiConversation | undefined>;
  getAiConversations(userId?: string, limit?: number): Promise<AiConversation[]>;
  createAiConversation(conversation: InsertAiConversation): Promise<AiConversation>;
  updateAiConversation(id: string, updates: Partial<AiConversation>): Promise<AiConversation>;
  deleteAiConversation(id: string): Promise<void>;

  // Conversation Messages
  getConversationMessage(id: string): Promise<ConversationMessage | undefined>;
  getConversationMessages(conversationId: string, limit?: number): Promise<ConversationMessage[]>;
  createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  updateConversationMessage(id: string, updates: Partial<ConversationMessage>): Promise<ConversationMessage>;

  // Research Findings
  getResearchFinding(id: string): Promise<ResearchFinding | undefined>;
  getResearchFindings(conversationId?: string, type?: string, limit?: number): Promise<ResearchFinding[]>;
  createResearchFinding(finding: InsertResearchFinding): Promise<ResearchFinding>;
  updateResearchFinding(id: string, updates: Partial<ResearchFinding>): Promise<ResearchFinding>;

  // Historical Bids
  getHistoricalBid(id: string): Promise<HistoricalBid | undefined>;
  getHistoricalBids(filters?: { category?: string; agency?: string; limit?: number }): Promise<HistoricalBid[]>;
  createHistoricalBid(bid: InsertHistoricalBid): Promise<HistoricalBid>;
  updateHistoricalBid(id: string, updates: Partial<HistoricalBid>): Promise<HistoricalBid>;

  // Agent Memory Operations
  getAgentMemory(id: string): Promise<any>;
  getAgentMemoryByAgent(agentId: string, memoryType?: string, limit?: number): Promise<any[]>;
  getAgentMemoryByContext(agentId: string, contextKey: string): Promise<any>;
  createAgentMemory(memory: any): Promise<any>;
  updateAgentMemory(id: string, updates: any): Promise<any>;
  deleteAgentMemory(id: string): Promise<void>;
  recordMemoryAccess(id: string): Promise<void>;

  // Agent Knowledge Base Operations
  getAgentKnowledge(id: string): Promise<any>;
  getAgentKnowledgeByAgent(agentId: string, knowledgeType?: string, domain?: string, limit?: number): Promise<any[]>;
  createAgentKnowledge(knowledge: any): Promise<any>;
  updateAgentKnowledge(id: string, updates: any): Promise<any>;
  validateKnowledge(id: string, status: string): Promise<any>;
  recordKnowledgeUsage(id: string, success: boolean): Promise<void>;

  // Agent Coordination Operations
  getAgentCoordination(id: string): Promise<any>;
  getAgentCoordinationBySession(sessionId: string): Promise<any[]>;
  createAgentCoordination(coordination: any): Promise<any>;
  updateAgentCoordination(id: string, updates: any): Promise<any>;
  getPendingCoordinations(agentId: string): Promise<any[]>;

  // Workflow State Operations
  getWorkflowState(id: string): Promise<any>;
  getWorkflowStateByWorkflowId(workflowId: string): Promise<any>;
  createWorkflowState(state: any): Promise<any>;
  updateWorkflowState(id: string, updates: any): Promise<any>;
  getActiveWorkflows(): Promise<any[]>;
  getSuspendedWorkflows(): Promise<any[]>;

  // Agent Performance Metrics Operations
  getAgentPerformanceMetrics(agentId: string, metricType?: string, period?: string): Promise<any[]>;
  recordAgentMetric(metric: any): Promise<any>;
  getAgentPerformanceSummary(agentId: string): Promise<any>;

  // Agent Monitoring and Analytics Operations
  getAllAgentPerformanceMetrics(timeRange?: string): Promise<any[]>;
  getWorkflowExecutionMetrics(): Promise<any>;
  getPortalHealthSummary(): Promise<any>;
  getAgentHealthSummary(): Promise<any>;
  getCoordinationLogs(limit?: number): Promise<any[]>;

  // Additional RFP methods needed by orchestrator
  getRFPs(filters?: { status?: string; category?: string; location?: string; limit?: number }): Promise<RFP[]>;

  // Agent Registry Operations (3-Tier Agentic System)
  registerAgent(agent: InsertAgentRegistry): Promise<AgentRegistry>;
  updateAgent(agentId: string, updates: Partial<AgentRegistry>): Promise<AgentRegistry>;
  deregisterAgent(agentId: string): Promise<void>;
  getAgent(agentId: string): Promise<AgentRegistry | undefined>;
  getAgentsByTier(tier: string): Promise<AgentRegistry[]>;
  getAgentsByCapability(capability: string): Promise<AgentRegistry[]>;
  getActiveAgents(): Promise<AgentRegistry[]>;
  updateAgentHeartbeat(agentId: string): Promise<void>;
  updateAgentStatus(agentId: string, status: string): Promise<AgentRegistry>;
  findAvailableAgents(capabilities: string[], tier?: string): Promise<AgentRegistry[]>;

  // Work Item Operations (3-Tier Agentic System)
  createWorkItem(workItem: InsertWorkItem): Promise<WorkItem>;
  updateWorkItem(id: string, updates: Partial<WorkItem>): Promise<WorkItem>;
  getWorkItem(id: string): Promise<WorkItem | undefined>;
  getWorkItemsBySession(sessionId: string): Promise<WorkItem[]>;
  getWorkItemsByAgent(agentId: string, status?: string): Promise<WorkItem[]>;
  getWorkItemsByStatus(status: string): Promise<WorkItem[]>;
  getWorkQueue(agentId?: string, taskType?: string, limit?: number): Promise<WorkItem[]>;
  assignWorkItem(workItemId: string, agentId: string): Promise<WorkItem>;
  completeWorkItem(workItemId: string, result: any): Promise<WorkItem>;
  failWorkItem(workItemId: string, error: string): Promise<WorkItem>;

  // Agent Session Operations (3-Tier Agentic System)
  createAgentSession(session: InsertAgentSession): Promise<AgentSession>;
  updateAgentSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession>;
  getAgentSession(sessionId: string): Promise<AgentSession | undefined>;
  getAgentSessionsByUser(userId: string): Promise<AgentSession[]>;
  getActiveAgentSessions(): Promise<AgentSession[]>;
  getAgentSessionsByOrchestrator(orchestratorAgentId: string): Promise<AgentSession[]>;
  completeAgentSession(sessionId: string): Promise<AgentSession>;
  updateSessionActivity(sessionId: string): Promise<void>;
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
    // Exclude sensitive credentials from public portal list
    return await db.select({
      id: portals.id,
      name: portals.name,
      url: portals.url,
      loginRequired: portals.loginRequired,
      // username and password fields excluded for security
      lastScanned: portals.lastScanned,
      status: portals.status,
      scanFrequency: portals.scanFrequency,
      maxRfpsPerScan: portals.maxRfpsPerScan,
      selectors: portals.selectors,
      filters: portals.filters,
      lastError: portals.lastError,
      errorCount: portals.errorCount,
      createdAt: portals.createdAt,
    }).from(portals).orderBy(asc(portals.name));
  }

  async getActivePortals(): Promise<Portal[]> {
    // Exclude sensitive credentials from public portal list
    return await db.select({
      id: portals.id,
      name: portals.name,
      url: portals.url,
      loginRequired: portals.loginRequired,
      // username and password fields excluded for security
      lastScanned: portals.lastScanned,
      status: portals.status,
      scanFrequency: portals.scanFrequency,
      maxRfpsPerScan: portals.maxRfpsPerScan,
      selectors: portals.selectors,
      filters: portals.filters,
      lastError: portals.lastError,
      errorCount: portals.errorCount,
      createdAt: portals.createdAt,
    }).from(portals).where(eq(portals.status, 'active')).orderBy(asc(portals.name));
  }

  async getPortal(id: string): Promise<Portal | undefined> {
    // Exclude sensitive credentials from public portal access
    const [portal] = await db.select({
      id: portals.id,
      name: portals.name,
      url: portals.url,
      loginRequired: portals.loginRequired,
      // username and password fields excluded for security
      lastScanned: portals.lastScanned,
      status: portals.status,
      scanFrequency: portals.scanFrequency,
      maxRfpsPerScan: portals.maxRfpsPerScan,
      selectors: portals.selectors,
      filters: portals.filters,
      lastError: portals.lastError,
      errorCount: portals.errorCount,
      createdAt: portals.createdAt,
    }).from(portals).where(eq(portals.id, id));
    return portal || undefined;
  }

  async getPortalWithCredentials(id: string): Promise<Portal | undefined> {
    // INTERNAL USE ONLY - includes sensitive credentials for scanning operations
    const [portal] = await db.select().from(portals).where(eq(portals.id, id));
    return portal || undefined;
  }

  async createPortal(portal: InsertPortal): Promise<Portal> {
    const [newPortal] = await db
      .insert(portals)
      .values(portal)
      .returning({
        id: portals.id,
        name: portals.name,
        url: portals.url,
        loginRequired: portals.loginRequired,
        // username and password fields excluded for security
        lastScanned: portals.lastScanned,
        status: portals.status,
        scanFrequency: portals.scanFrequency,
        maxRfpsPerScan: portals.maxRfpsPerScan,
        selectors: portals.selectors,
        filters: portals.filters,
        lastError: portals.lastError,
        errorCount: portals.errorCount,
        createdAt: portals.createdAt,
      });
    return newPortal;
  }

  async updatePortal(id: string, updates: Partial<Portal>): Promise<Portal> {
    const [updatedPortal] = await db
      .update(portals)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(portals.id, id))
      .returning({
        id: portals.id,
        name: portals.name,
        url: portals.url,
        loginRequired: portals.loginRequired,
        // username and password fields excluded for security
        lastScanned: portals.lastScanned,
        status: portals.status,
        scanFrequency: portals.scanFrequency,
        maxRfpsPerScan: portals.maxRfpsPerScan,
        selectors: portals.selectors,
        filters: portals.filters,
        lastError: portals.lastError,
        errorCount: portals.errorCount,
        createdAt: portals.createdAt,
      });
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

  async getRFPBySourceUrl(sourceUrl: string): Promise<RFP | undefined> {
    const [rfp] = await db.select().from(rfps).where(eq(rfps.sourceUrl, sourceUrl));
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

  // AGENT PERFORMANCE MONITORING METHODS

  async getAllAgentPerformanceMetrics(timeRange: string = '7d'): Promise<any[]> {
    const daysBack = timeRange === '24h' ? 1 : timeRange === '7d' ? 7 : 30;
    const since = new Date();
    since.setDate(since.getDate() - daysBack);

    return await db
      .select()
      .from(agentPerformanceMetrics)
      .where(gte(agentPerformanceMetrics.recordedAt, since))
      .orderBy(desc(agentPerformanceMetrics.recordedAt));
  }

  async getWorkflowExecutionMetrics(): Promise<any> {
    const totalWorkflows = await db
      .select({ count: count() })
      .from(workflowState);

    const suspendedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'suspended'));

    const completedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'completed'));

    const failedWorkflows = await db
      .select({ count: count() })
      .from(workflowState)
      .where(eq(workflowState.status, 'failed'));

    // Average execution time for completed workflows using correct column names
    const avgExecutionTime = await db
      .select({ 
        avg: sql`AVG(EXTRACT(EPOCH FROM (${workflowState.updatedAt} - ${workflowState.createdAt})))` 
      })
      .from(workflowState)
      .where(eq(workflowState.status, 'completed'));

    return {
      totalWorkflows: totalWorkflows[0].count,
      suspendedWorkflows: suspendedWorkflows[0].count,
      completedWorkflows: completedWorkflows[0].count,
      failedWorkflows: failedWorkflows[0].count,
      successRate: totalWorkflows[0].count > 0 ? (Number(completedWorkflows[0].count) / Number(totalWorkflows[0].count)) * 100 : 0,
      avgExecutionTimeSeconds: Number(avgExecutionTime[0].avg) || 0
    };
  }

  async getPortalHealthSummary(): Promise<any> {
    const totalPortals = await db
      .select({ count: count() })
      .from(portals);

    const activePortals = await db
      .select({ count: count() })
      .from(portals)
      .where(eq(portals.status, 'active'));

    const errorPortals = await db
      .select({ count: count() })
      .from(portals)
      .where(eq(portals.status, 'error'));

    return {
      total: totalPortals[0].count,
      active: activePortals[0].count,
      errors: errorPortals[0].count,
      healthPercentage: totalPortals[0].count > 0 ? (Number(activePortals[0].count) / Number(totalPortals[0].count)) * 100 : 0
    };
  }

  async getAgentHealthSummary(): Promise<any> {
    const totalAgents = await db
      .select({ 
        count: sql`COUNT(DISTINCT agent_id)` 
      })
      .from(agentPerformanceMetrics);

    const recentActivity = await db
      .select({ 
        count: sql`COUNT(DISTINCT agent_id)` 
      })
      .from(agentPerformanceMetrics)
      .where(gte(agentPerformanceMetrics.recordedAt, new Date(Date.now() - 24 * 60 * 60 * 1000))); // Last 24 hours

    return {
      totalAgents: Number(totalAgents[0].count),
      activeAgents: Number(recentActivity[0].count),
      healthPercentage: Number(totalAgents[0].count) > 0 ? (Number(recentActivity[0].count) / Number(totalAgents[0].count)) * 100 : 0
    };
  }

  async getCoordinationLogs(limit: number = 50): Promise<any[]> {
    return await db
      .select()
      .from(agentCoordinationLog)
      .orderBy(desc(agentCoordinationLog.startedAt))
      .limit(limit);
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

  // Company Profile Management
  async getAllCompanyProfiles(): Promise<CompanyProfile[]> {
    return await db
      .select()
      .from(companyProfiles)
      .where(eq(companyProfiles.isActive, true))
      .orderBy(asc(companyProfiles.companyName));
  }

  async getCompanyProfile(id: string): Promise<CompanyProfile | undefined> {
    const [profile] = await db
      .select()
      .from(companyProfiles)
      .where(and(eq(companyProfiles.id, id), eq(companyProfiles.isActive, true)));
    return profile || undefined;
  }

  async getCompanyProfileWithDetails(id: string): Promise<any> {
    const profile = await this.getCompanyProfile(id);
    if (!profile) return null;

    const [addresses, contacts, identifiers, certifications, insurance] = await Promise.all([
      this.getCompanyAddresses(id),
      this.getCompanyContacts(id),
      this.getCompanyIdentifiers(id),
      this.getCompanyCertifications(id),
      this.getCompanyInsurance(id)
    ]);

    return {
      ...profile,
      addresses,
      contacts,
      identifiers,
      certifications,
      insurance
    };
  }

  async createCompanyProfile(profile: InsertCompanyProfile): Promise<CompanyProfile> {
    const [newProfile] = await db
      .insert(companyProfiles)
      .values(profile)
      .returning();
    return newProfile;
  }

  async updateCompanyProfile(id: string, updates: Partial<CompanyProfile>): Promise<CompanyProfile> {
    const [updatedProfile] = await db
      .update(companyProfiles)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyProfiles.id, id))
      .returning();
    return updatedProfile;
  }

  async deleteCompanyProfile(id: string): Promise<void> {
    await db
      .update(companyProfiles)
      .set({ isActive: false, updatedAt: sql`NOW()` })
      .where(eq(companyProfiles.id, id));
  }

  // Company Addresses
  async getCompanyAddresses(companyProfileId: string): Promise<CompanyAddress[]> {
    return await db
      .select()
      .from(companyAddresses)
      .where(and(eq(companyAddresses.companyProfileId, companyProfileId), eq(companyAddresses.isActive, true)))
      .orderBy(asc(companyAddresses.addressType));
  }

  async createCompanyAddress(address: InsertCompanyAddress): Promise<CompanyAddress> {
    const [newAddress] = await db
      .insert(companyAddresses)
      .values(address)
      .returning();
    return newAddress;
  }

  async updateCompanyAddress(id: string, updates: Partial<CompanyAddress>): Promise<CompanyAddress> {
    const [updatedAddress] = await db
      .update(companyAddresses)
      .set(updates)
      .where(eq(companyAddresses.id, id))
      .returning();
    return updatedAddress;
  }

  async deleteCompanyAddress(id: string): Promise<void> {
    await db
      .update(companyAddresses)
      .set({ isActive: false })
      .where(eq(companyAddresses.id, id));
  }

  // Company Contacts
  async getCompanyContacts(companyProfileId: string): Promise<CompanyContact[]> {
    return await db
      .select()
      .from(companyContacts)
      .where(and(eq(companyContacts.companyProfileId, companyProfileId), eq(companyContacts.isActive, true)))
      .orderBy(asc(companyContacts.name));
  }

  async createCompanyContact(contact: InsertCompanyContact): Promise<CompanyContact> {
    const [newContact] = await db
      .insert(companyContacts)
      .values(contact)
      .returning();
    return newContact;
  }

  async updateCompanyContact(id: string, updates: Partial<CompanyContact>): Promise<CompanyContact> {
    const [updatedContact] = await db
      .update(companyContacts)
      .set(updates)
      .where(eq(companyContacts.id, id))
      .returning();
    return updatedContact;
  }

  async deleteCompanyContact(id: string): Promise<void> {
    await db
      .update(companyContacts)
      .set({ isActive: false })
      .where(eq(companyContacts.id, id));
  }

  // Company Identifiers
  async getCompanyIdentifiers(companyProfileId: string): Promise<CompanyIdentifier[]> {
    return await db
      .select()
      .from(companyIdentifiers)
      .where(and(eq(companyIdentifiers.companyProfileId, companyProfileId), eq(companyIdentifiers.isActive, true)))
      .orderBy(asc(companyIdentifiers.identifierType));
  }

  async createCompanyIdentifier(identifier: InsertCompanyIdentifier): Promise<CompanyIdentifier> {
    const [newIdentifier] = await db
      .insert(companyIdentifiers)
      .values(identifier)
      .returning();
    return newIdentifier;
  }

  async updateCompanyIdentifier(id: string, updates: Partial<CompanyIdentifier>): Promise<CompanyIdentifier> {
    const [updatedIdentifier] = await db
      .update(companyIdentifiers)
      .set(updates)
      .where(eq(companyIdentifiers.id, id))
      .returning();
    return updatedIdentifier;
  }

  async deleteCompanyIdentifier(id: string): Promise<void> {
    await db
      .update(companyIdentifiers)
      .set({ isActive: false })
      .where(eq(companyIdentifiers.id, id));
  }

  // Company Certifications
  async getCompanyCertifications(companyProfileId: string): Promise<CompanyCertification[]> {
    return await db
      .select()
      .from(companyCertifications)
      .where(eq(companyCertifications.companyProfileId, companyProfileId))
      .orderBy(asc(companyCertifications.certificationType));
  }

  async getExpiringCertifications(days: number): Promise<CompanyCertification[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db
      .select()
      .from(companyCertifications)
      .where(and(
        eq(companyCertifications.status, "active"),
        gte(companyCertifications.expirationDate, new Date()),
        lte(companyCertifications.expirationDate, futureDate)
      ))
      .orderBy(asc(companyCertifications.expirationDate));
  }

  async createCompanyCertification(certification: InsertCompanyCertification): Promise<CompanyCertification> {
    const [newCertification] = await db
      .insert(companyCertifications)
      .values(certification)
      .returning();
    return newCertification;
  }

  async updateCompanyCertification(id: string, updates: Partial<CompanyCertification>): Promise<CompanyCertification> {
    const [updatedCertification] = await db
      .update(companyCertifications)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyCertifications.id, id))
      .returning();
    return updatedCertification;
  }

  async deleteCompanyCertification(id: string): Promise<void> {
    await db
      .delete(companyCertifications)
      .where(eq(companyCertifications.id, id));
  }

  // Company Insurance
  async getCompanyInsurance(companyProfileId: string): Promise<CompanyInsurance[]> {
    return await db
      .select()
      .from(companyInsurance)
      .where(and(eq(companyInsurance.companyProfileId, companyProfileId), eq(companyInsurance.isActive, true)))
      .orderBy(asc(companyInsurance.insuranceType));
  }

  async getExpiringInsurance(days: number): Promise<CompanyInsurance[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return await db
      .select()
      .from(companyInsurance)
      .where(and(
        eq(companyInsurance.isActive, true),
        gte(companyInsurance.expirationDate, new Date()),
        lte(companyInsurance.expirationDate, futureDate)
      ))
      .orderBy(asc(companyInsurance.expirationDate));
  }

  async createCompanyInsurance(insurance: InsertCompanyInsurance): Promise<CompanyInsurance> {
    const [newInsurance] = await db
      .insert(companyInsurance)
      .values(insurance)
      .returning();
    return newInsurance;
  }

  async updateCompanyInsurance(id: string, updates: Partial<CompanyInsurance>): Promise<CompanyInsurance> {
    const [updatedInsurance] = await db
      .update(companyInsurance)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(companyInsurance.id, id))
      .returning();
    return updatedInsurance;
  }

  async deleteCompanyInsurance(id: string): Promise<void> {
    await db
      .update(companyInsurance)
      .set({ isActive: false })
      .where(eq(companyInsurance.id, id));
  }

  // Scan Operations
  async createScan(scan: InsertScan): Promise<Scan> {
    const [newScan] = await db
      .insert(scans)
      .values(scan)
      .returning();
    return newScan;
  }

  async updateScan(scanId: string, updates: Partial<Scan>): Promise<Scan> {
    const [updatedScan] = await db
      .update(scans)
      .set(updates)
      .where(eq(scans.id, scanId))
      .returning();
    return updatedScan;
  }

  async getScan(scanId: string): Promise<Scan | undefined> {
    const [scan] = await db
      .select()
      .from(scans)
      .where(eq(scans.id, scanId));
    return scan || undefined;
  }

  async getScansByPortal(portalId: string, limit: number = 10): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.portalId, portalId))
      .orderBy(desc(scans.startedAt))
      .limit(limit);
  }

  async getActiveScansByPortal(portalId: string): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(and(eq(scans.portalId, portalId), eq(scans.status, 'running')))
      .orderBy(desc(scans.startedAt));
  }

  async getActiveScans(): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(eq(scans.status, 'running'))
      .orderBy(desc(scans.startedAt));
  }

  async appendScanEvent(event: InsertScanEvent): Promise<ScanEvent> {
    const [newEvent] = await db
      .insert(scanEvents)
      .values(event)
      .returning();
    return newEvent;
  }

  async getScanEvents(scanId: string): Promise<ScanEvent[]> {
    return await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.scanId, scanId))
      .orderBy(asc(scanEvents.timestamp));
  }

  async getScanHistory(portalId: string, limit: number = 10): Promise<Scan[]> {
    return await db
      .select()
      .from(scans)
      .where(and(eq(scans.portalId, portalId), or(eq(scans.status, 'completed'), eq(scans.status, 'failed'))))
      .orderBy(desc(scans.startedAt))
      .limit(limit);
  }

  // AI Conversation Operations
  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(aiConversations)
      .where(eq(aiConversations.id, id))
      .limit(1);
    return conversation;
  }

  async getAiConversations(userId?: string, limit: number = 50): Promise<AiConversation[]> {
    let query = db
      .select()
      .from(aiConversations);
    
    if (userId) {
      query = query.where(eq(aiConversations.userId, userId));
    }
    
    return await query
      .orderBy(desc(aiConversations.createdAt))
      .limit(limit);
  }

  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [newConversation] = await db
      .insert(aiConversations)
      .values(conversation)
      .returning();
    return newConversation;
  }

  async updateAiConversation(id: string, updates: Partial<AiConversation>): Promise<AiConversation> {
    const [updatedConversation] = await db
      .update(aiConversations)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(aiConversations.id, id))
      .returning();
    return updatedConversation;
  }

  async deleteAiConversation(id: string): Promise<void> {
    // First delete all conversation messages
    await db
      .delete(conversationMessages)
      .where(eq(conversationMessages.conversationId, id));
    
    // Then delete the conversation
    await db
      .delete(aiConversations)
      .where(eq(aiConversations.id, id));
  }

  // Conversation Messages
  async getConversationMessage(id: string): Promise<ConversationMessage | undefined> {
    const [message] = await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.id, id))
      .limit(1);
    return message;
  }

  async getConversationMessages(conversationId: string, limit: number = 100): Promise<ConversationMessage[]> {
    return await db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(asc(conversationMessages.createdAt))
      .limit(limit);
  }

  async createConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const [newMessage] = await db
      .insert(conversationMessages)
      .values(message)
      .returning();
    return newMessage;
  }

  async updateConversationMessage(id: string, updates: Partial<ConversationMessage>): Promise<ConversationMessage> {
    const [updatedMessage] = await db
      .update(conversationMessages)
      .set(updates)
      .where(eq(conversationMessages.id, id))
      .returning();
    return updatedMessage;
  }

  // Research Findings
  async getResearchFinding(id: string): Promise<ResearchFinding | undefined> {
    const [finding] = await db
      .select()
      .from(researchFindings)
      .where(eq(researchFindings.id, id))
      .limit(1);
    return finding;
  }

  async getResearchFindings(conversationId?: string, type?: string, limit: number = 50): Promise<ResearchFinding[]> {
    let query = db
      .select()
      .from(researchFindings);
    
    const conditions = [];
    if (conversationId) {
      conditions.push(eq(researchFindings.conversationId, conversationId));
    }
    if (type) {
      conditions.push(eq(researchFindings.type, type));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query
      .orderBy(desc(researchFindings.createdAt))
      .limit(limit);
  }

  async createResearchFinding(finding: InsertResearchFinding): Promise<ResearchFinding> {
    const [newFinding] = await db
      .insert(researchFindings)
      .values(finding)
      .returning();
    return newFinding;
  }

  async updateResearchFinding(id: string, updates: Partial<ResearchFinding>): Promise<ResearchFinding> {
    const [updatedFinding] = await db
      .update(researchFindings)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(researchFindings.id, id))
      .returning();
    return updatedFinding;
  }

  // Historical Bids
  async getHistoricalBid(id: string): Promise<HistoricalBid | undefined> {
    const [bid] = await db
      .select()
      .from(historicalBids)
      .where(eq(historicalBids.id, id))
      .limit(1);
    return bid;
  }

  async getHistoricalBids(filters?: { category?: string; agency?: string; limit?: number }): Promise<HistoricalBid[]> {
    let query = db
      .select()
      .from(historicalBids);
    
    const conditions = [];
    if (filters?.category) {
      conditions.push(eq(historicalBids.category, filters.category));
    }
    if (filters?.agency) {
      conditions.push(eq(historicalBids.agency, filters.agency));
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query
      .orderBy(desc(historicalBids.createdAt))
      .limit(filters?.limit || 50);
  }

  async createHistoricalBid(bid: InsertHistoricalBid): Promise<HistoricalBid> {
    const [newBid] = await db
      .insert(historicalBids)
      .values(bid)
      .returning();
    return newBid;
  }

  async updateHistoricalBid(id: string, updates: Partial<HistoricalBid>): Promise<HistoricalBid> {
    const [updatedBid] = await db
      .update(historicalBids)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(historicalBids.id, id))
      .returning();
    return updatedBid;
  }

  // Agent Memory Operations
  async getAgentMemory(id: string): Promise<any> {
    const [memory] = await db.select().from(agentMemory).where(eq(agentMemory.id, id));
    return memory || undefined;
  }

  async getAgentMemoryByAgent(agentId: string, memoryType?: string, limit?: number): Promise<any[]> {
    let query = db.select().from(agentMemory).where(eq(agentMemory.agentId, agentId));
    
    if (memoryType) {
      query = query.where(and(eq(agentMemory.agentId, agentId), eq(agentMemory.memoryType, memoryType)));
    }
    
    return await query
      .orderBy(desc(agentMemory.importance), desc(agentMemory.lastAccessed))
      .limit(limit || 50);
  }

  async getAgentMemoryByContext(agentId: string, contextKey: string): Promise<any> {
    const [memory] = await db.select().from(agentMemory)
      .where(and(eq(agentMemory.agentId, agentId), eq(agentMemory.contextKey, contextKey)));
    return memory || undefined;
  }

  async createAgentMemory(memory: any): Promise<any> {
    const [newMemory] = await db.insert(agentMemory).values(memory).returning();
    return newMemory;
  }

  async updateAgentMemory(id: string, updates: any): Promise<any> {
    const [updatedMemory] = await db
      .update(agentMemory)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(agentMemory.id, id))
      .returning();
    return updatedMemory;
  }

  async deleteAgentMemory(id: string): Promise<void> {
    await db.delete(agentMemory).where(eq(agentMemory.id, id));
  }

  async recordMemoryAccess(id: string): Promise<void> {
    await db
      .update(agentMemory)
      .set({ 
        accessCount: sql`${agentMemory.accessCount} + 1`,
        lastAccessed: sql`NOW()`,
        updatedAt: sql`NOW()`
      })
      .where(eq(agentMemory.id, id));
  }

  // Agent Knowledge Base Operations
  async getAgentKnowledge(id: string): Promise<any> {
    const [knowledge] = await db.select().from(agentKnowledgeBase).where(eq(agentKnowledgeBase.id, id));
    return knowledge || undefined;
  }

  async getAgentKnowledgeByAgent(agentId: string, knowledgeType?: string, domain?: string, limit?: number): Promise<any[]> {
    let query = db.select().from(agentKnowledgeBase).where(eq(agentKnowledgeBase.agentId, agentId));
    
    const conditions = [eq(agentKnowledgeBase.agentId, agentId)];
    if (knowledgeType) {
      conditions.push(eq(agentKnowledgeBase.knowledgeType, knowledgeType));
    }
    if (domain) {
      conditions.push(eq(agentKnowledgeBase.domain, domain));
    }
    
    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }
    
    return await query
      .orderBy(desc(agentKnowledgeBase.confidenceScore), desc(agentKnowledgeBase.usageCount))
      .limit(limit || 50);
  }

  async createAgentKnowledge(knowledge: any): Promise<any> {
    const [newKnowledge] = await db.insert(agentKnowledgeBase).values(knowledge).returning();
    return newKnowledge;
  }

  async updateAgentKnowledge(id: string, updates: any): Promise<any> {
    const [updatedKnowledge] = await db
      .update(agentKnowledgeBase)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(agentKnowledgeBase.id, id))
      .returning();
    return updatedKnowledge;
  }

  async validateKnowledge(id: string, status: string): Promise<any> {
    const [validatedKnowledge] = await db
      .update(agentKnowledgeBase)
      .set({ validationStatus: status, updatedAt: sql`NOW()` })
      .where(eq(agentKnowledgeBase.id, id))
      .returning();
    return validatedKnowledge;
  }

  async recordKnowledgeUsage(id: string, success: boolean): Promise<void> {
    const knowledge = await this.getAgentKnowledge(id);
    if (!knowledge) return;

    const currentUsage = knowledge.usageCount || 0;
    const currentSuccess = knowledge.successRate || 0.5;
    const newUsageCount = currentUsage + 1;
    const newSuccessRate = success 
      ? (currentSuccess * currentUsage + 1) / newUsageCount
      : (currentSuccess * currentUsage) / newUsageCount;

    await db
      .update(agentKnowledgeBase)
      .set({ 
        usageCount: newUsageCount,
        successRate: newSuccessRate.toFixed(2),
        updatedAt: sql`NOW()`
      })
      .where(eq(agentKnowledgeBase.id, id));
  }

  // Agent Coordination Operations
  async getAgentCoordination(id: string): Promise<any> {
    const [coordination] = await db.select().from(agentCoordinationLog).where(eq(agentCoordinationLog.id, id));
    return coordination || undefined;
  }

  async getAgentCoordinationBySession(sessionId: string): Promise<any[]> {
    return await db.select().from(agentCoordinationLog)
      .where(eq(agentCoordinationLog.sessionId, sessionId))
      .orderBy(asc(agentCoordinationLog.startedAt));
  }

  async createAgentCoordination(coordination: any): Promise<any> {
    const [newCoordination] = await db.insert(agentCoordinationLog).values(coordination).returning();
    return newCoordination;
  }

  async updateAgentCoordination(id: string, updates: any): Promise<any> {
    const [updatedCoordination] = await db
      .update(agentCoordinationLog)
      .set(updates)
      .where(eq(agentCoordinationLog.id, id))
      .returning();
    return updatedCoordination;
  }

  async getPendingCoordinations(agentId: string): Promise<any[]> {
    return await db.select().from(agentCoordinationLog)
      .where(and(
        eq(agentCoordinationLog.targetAgentId, agentId),
        eq(agentCoordinationLog.status, 'pending')
      ))
      .orderBy(desc(agentCoordinationLog.priority), asc(agentCoordinationLog.startedAt));
  }

  // Workflow State Operations
  async getWorkflowState(id: string): Promise<any> {
    const [state] = await db.select().from(workflowState).where(eq(workflowState.id, id));
    return state || undefined;
  }

  async getWorkflowStateByWorkflowId(workflowId: string): Promise<any> {
    const [state] = await db.select().from(workflowState).where(eq(workflowState.workflowId, workflowId));
    return state || undefined;
  }

  async createWorkflowState(state: any): Promise<any> {
    const [newState] = await db.insert(workflowState).values(state).returning();
    return newState;
  }

  async updateWorkflowState(id: string, updates: any): Promise<any> {
    const [updatedState] = await db
      .update(workflowState)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(workflowState.id, id))
      .returning();
    return updatedState;
  }

  async getActiveWorkflows(): Promise<any[]> {
    return await db.select().from(workflowState)
      .where(eq(workflowState.status, 'active'))
      .orderBy(desc(workflowState.updatedAt));
  }

  async getSuspendedWorkflows(): Promise<any[]> {
    return await db.select().from(workflowState)
      .where(eq(workflowState.status, 'suspended'))
      .orderBy(desc(workflowState.updatedAt));
  }

  // Agent Performance Metrics Operations
  async getAgentPerformanceMetrics(agentId: string, metricType?: string, period?: string): Promise<any[]> {
    let query = db.select().from(agentPerformanceMetrics).where(eq(agentPerformanceMetrics.agentId, agentId));
    
    const conditions = [eq(agentPerformanceMetrics.agentId, agentId)];
    if (metricType) {
      conditions.push(eq(agentPerformanceMetrics.metricType, metricType));
    }
    if (period) {
      conditions.push(eq(agentPerformanceMetrics.aggregationPeriod, period));
    }
    
    if (conditions.length > 1) {
      query = query.where(and(...conditions));
    }
    
    return await query.orderBy(desc(agentPerformanceMetrics.recordedAt));
  }

  async recordAgentMetric(metric: any): Promise<any> {
    const [newMetric] = await db.insert(agentPerformanceMetrics).values(metric).returning();
    return newMetric;
  }

  async getAgentPerformanceSummary(agentId: string): Promise<any> {
    // Get average metrics for different types
    const metrics = await db.select().from(agentPerformanceMetrics)
      .where(eq(agentPerformanceMetrics.agentId, agentId));
    
    const summary = {
      agentId,
      totalMetrics: metrics.length,
      averageResponseTime: 0,
      averageAccuracy: 0,
      averageSatisfaction: 0,
      taskCompletionRate: 0,
    };
    
    if (metrics.length > 0) {
      const responseTimeMetrics = metrics.filter(m => m.metricType === 'response_time');
      const accuracyMetrics = metrics.filter(m => m.metricType === 'accuracy');
      const satisfactionMetrics = metrics.filter(m => m.metricType === 'user_satisfaction');
      const completionMetrics = metrics.filter(m => m.metricType === 'task_completion');
      
      if (responseTimeMetrics.length > 0) {
        summary.averageResponseTime = responseTimeMetrics.reduce((sum, m) => sum + Number(m.metricValue), 0) / responseTimeMetrics.length;
      }
      if (accuracyMetrics.length > 0) {
        summary.averageAccuracy = accuracyMetrics.reduce((sum, m) => sum + Number(m.metricValue), 0) / accuracyMetrics.length;
      }
      if (satisfactionMetrics.length > 0) {
        summary.averageSatisfaction = satisfactionMetrics.reduce((sum, m) => sum + Number(m.metricValue), 0) / satisfactionMetrics.length;
      }
      if (completionMetrics.length > 0) {
        summary.taskCompletionRate = completionMetrics.reduce((sum, m) => sum + Number(m.metricValue), 0) / completionMetrics.length;
      }
    }
    
    return summary;
  }

  // Additional RFP methods needed by orchestrator
  async getRFPs(filters?: { status?: string; category?: string; location?: string; limit?: number }): Promise<RFP[]> {
    let query = db
      .select()
      .from(rfps);
    
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(rfps.status, filters.status));
    }
    if (filters?.category) {
      const categoryTerm = `%${filters.category}%`;
      conditions.push(
        or(
          sql`${rfps.title} ILIKE ${categoryTerm}`,
          sql`${rfps.description} ILIKE ${categoryTerm}`
        )
      );
    }
    if (filters?.location) {
      const locationTerm = `%${filters.location}%`;
      conditions.push(
        or(
          sql`${rfps.title} ILIKE ${locationTerm}`,
          sql`${rfps.agency} ILIKE ${locationTerm}`
        )
      );
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    return await query
      .orderBy(desc(rfps.discoveredAt))
      .limit(filters?.limit || 50);
  }

  // Agent Registry Operations (3-Tier Agentic System)
  async registerAgent(agent: InsertAgentRegistry): Promise<AgentRegistry> {
    const [newAgent] = await db.insert(agentRegistry).values(agent).returning();
    return newAgent;
  }

  async updateAgent(agentId: string, updates: Partial<AgentRegistry>): Promise<AgentRegistry> {
    const [updatedAgent] = await db
      .update(agentRegistry)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(agentRegistry.agentId, agentId))
      .returning();
    return updatedAgent;
  }

  async deregisterAgent(agentId: string): Promise<void> {
    await db.delete(agentRegistry).where(eq(agentRegistry.agentId, agentId));
  }

  async getAgent(agentId: string): Promise<AgentRegistry | undefined> {
    const [agent] = await db.select().from(agentRegistry).where(eq(agentRegistry.agentId, agentId));
    return agent || undefined;
  }

  async getAgentsByTier(tier: string): Promise<AgentRegistry[]> {
    return await db.select().from(agentRegistry)
      .where(eq(agentRegistry.tier, tier))
      .orderBy(asc(agentRegistry.displayName));
  }

  async getAgentsByCapability(capability: string): Promise<AgentRegistry[]> {
    return await db.select().from(agentRegistry)
      .where(sql`${agentRegistry.capabilities} && ARRAY[${capability}]`)
      .orderBy(asc(agentRegistry.displayName));
  }

  async getActiveAgents(): Promise<AgentRegistry[]> {
    return await db.select().from(agentRegistry)
      .where(eq(agentRegistry.status, 'active'))
      .orderBy(asc(agentRegistry.tier), asc(agentRegistry.displayName));
  }

  async updateAgentHeartbeat(agentId: string): Promise<void> {
    await db
      .update(agentRegistry)
      .set({ lastHeartbeat: sql`NOW()`, updatedAt: sql`NOW()` })
      .where(eq(agentRegistry.agentId, agentId));
  }

  async updateAgentStatus(agentId: string, status: string): Promise<AgentRegistry> {
    const [updatedAgent] = await db
      .update(agentRegistry)
      .set({ status, updatedAt: sql`NOW()` })
      .where(eq(agentRegistry.agentId, agentId))
      .returning();
    return updatedAgent;
  }

  async findAvailableAgents(capabilities: string[], tier?: string): Promise<AgentRegistry[]> {
    // Build capability check for PostgreSQL array overlap
    const capabilityCheck = capabilities.map(cap => `'${cap}'`).join(',');
    
    const conditions = [
      eq(agentRegistry.status, 'active'),
      sql`${agentRegistry.capabilities} && ARRAY[${capabilityCheck}]`,
      // Ensure heartbeat is recent (within 5 minutes)
      sql`${agentRegistry.lastHeartbeat} > NOW() - INTERVAL '5 minutes'`
    ];

    if (tier) {
      conditions.push(eq(agentRegistry.tier, tier));
    }

    const agents = await db.select().from(agentRegistry)
      .where(and(...conditions))
      .orderBy(asc(agentRegistry.lastHeartbeat));

    // Filter by capacity - check current load vs maxConcurrency
    const availableAgents = [];
    for (const agent of agents) {
      const activeWork = await this.getWorkItemsByAgent(agent.agentId, 'in_progress');
      const assignedWork = await this.getWorkItemsByAgent(agent.agentId, 'assigned');
      const currentLoad = activeWork.length + assignedWork.length;
      
      if (currentLoad < agent.maxConcurrency) {
        availableAgents.push(agent);
      }
    }

    return availableAgents;
  }

  // Work Item Operations (3-Tier Agentic System)
  async createWorkItem(workItem: InsertWorkItem): Promise<WorkItem> {
    const [newWorkItem] = await db.insert(workItems).values(workItem).returning();
    return newWorkItem;
  }

  async updateWorkItem(id: string, updates: Partial<WorkItem>): Promise<WorkItem> {
    const [updatedWorkItem] = await db
      .update(workItems)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(workItems.id, id))
      .returning();
    return updatedWorkItem;
  }

  async getWorkItem(id: string): Promise<WorkItem | undefined> {
    const [workItem] = await db.select().from(workItems).where(eq(workItems.id, id));
    return workItem || undefined;
  }

  async getWorkItemsBySession(sessionId: string): Promise<WorkItem[]> {
    return await db.select().from(workItems)
      .where(eq(workItems.sessionId, sessionId))
      .orderBy(desc(workItems.createdAt));
  }

  async getWorkItemsByAgent(agentId: string, status?: string): Promise<WorkItem[]> {
    const conditions = [eq(workItems.assignedAgentId, agentId)];
    if (status) {
      conditions.push(eq(workItems.status, status));
    }
    
    return await db.select().from(workItems)
      .where(and(...conditions))
      .orderBy(asc(workItems.priority), asc(workItems.deadline));
  }

  async getWorkItemsByStatus(status: string): Promise<WorkItem[]> {
    return await db.select().from(workItems)
      .where(eq(workItems.status, status))
      .orderBy(asc(workItems.priority), asc(workItems.deadline));
  }

  async getWorkQueue(agentId?: string, taskType?: string, limit?: number): Promise<WorkItem[]> {
    const conditions = [eq(workItems.status, 'pending')];
    
    if (agentId) {
      conditions.push(eq(workItems.assignedAgentId, agentId));
    }
    if (taskType) {
      conditions.push(eq(workItems.taskType, taskType));
    }

    return await db.select().from(workItems)
      .where(and(...conditions))
      .orderBy(asc(workItems.priority), asc(workItems.deadline))
      .limit(limit || 10);
  }

  async assignWorkItem(workItemId: string, agentId: string): Promise<WorkItem> {
    const [assignedWorkItem] = await db
      .update(workItems)
      .set({ 
        assignedAgentId: agentId, 
        status: 'assigned',
        updatedAt: sql`NOW()` 
      })
      .where(eq(workItems.id, workItemId))
      .returning();
    return assignedWorkItem;
  }

  async completeWorkItem(workItemId: string, result: any): Promise<WorkItem> {
    const [completedWorkItem] = await db
      .update(workItems)
      .set({ 
        status: 'completed',
        result,
        completedAt: sql`NOW()`,
        updatedAt: sql`NOW()` 
      })
      .where(eq(workItems.id, workItemId))
      .returning();
    return completedWorkItem;
  }

  async failWorkItem(workItemId: string, error: string): Promise<WorkItem> {
    const [failedWorkItem] = await db
      .update(workItems)
      .set({ 
        status: 'failed',
        error,
        retries: sql`${workItems.retries} + 1`,
        updatedAt: sql`NOW()` 
      })
      .where(eq(workItems.id, workItemId))
      .returning();
    return failedWorkItem;
  }

  // Agent Session Operations (3-Tier Agentic System)
  async createAgentSession(session: InsertAgentSession): Promise<AgentSession> {
    const [newSession] = await db.insert(agentSessions).values(session).returning();
    return newSession;
  }

  async updateAgentSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession> {
    const [updatedSession] = await db
      .update(agentSessions)
      .set({ ...updates, updatedAt: sql`NOW()` })
      .where(eq(agentSessions.sessionId, sessionId))
      .returning();
    return updatedSession;
  }

  async getAgentSession(sessionId: string): Promise<AgentSession | undefined> {
    const [session] = await db.select().from(agentSessions).where(eq(agentSessions.sessionId, sessionId));
    return session || undefined;
  }

  async getAgentSessionsByUser(userId: string): Promise<AgentSession[]> {
    return await db.select().from(agentSessions)
      .where(eq(agentSessions.userId, userId))
      .orderBy(desc(agentSessions.lastActivity));
  }

  async getActiveAgentSessions(): Promise<AgentSession[]> {
    return await db.select().from(agentSessions)
      .where(eq(agentSessions.status, 'active'))
      .orderBy(desc(agentSessions.lastActivity));
  }

  async getAgentSessionsByOrchestrator(orchestratorAgentId: string): Promise<AgentSession[]> {
    return await db.select().from(agentSessions)
      .where(eq(agentSessions.orchestratorAgentId, orchestratorAgentId))
      .orderBy(desc(agentSessions.lastActivity));
  }

  async completeAgentSession(sessionId: string): Promise<AgentSession> {
    const [completedSession] = await db
      .update(agentSessions)
      .set({ 
        status: 'completed',
        completedAt: sql`NOW()`,
        updatedAt: sql`NOW()` 
      })
      .where(eq(agentSessions.sessionId, sessionId))
      .returning();
    return completedSession;
  }

  async updateSessionActivity(sessionId: string): Promise<void> {
    await db
      .update(agentSessions)
      .set({ lastActivity: sql`NOW()`, updatedAt: sql`NOW()` })
      .where(eq(agentSessions.sessionId, sessionId));
  }
}

export const storage = new DatabaseStorage();
