import { repositoryManager, type RepositoryManager } from './RepositoryManager';
import type {
  User,
  InsertUser,
  Portal,
  InsertPortal,
  RFP,
  InsertRFP,
  Proposal,
  InsertProposal,
  Document,
  InsertDocument,
  Submission,
  InsertSubmission,
  SubmissionPipeline,
  InsertSubmissionPipeline,
  SubmissionEvent,
  InsertSubmissionEvent,
  SubmissionStatusHistory,
  InsertSubmissionStatusHistory,
  AuditLog,
  InsertAuditLog,
  Notification,
  InsertNotification,
  Scan,
  InsertScan,
  ScanEvent,
  InsertScanEvent,
} from '@shared/schema';

/**
 * Migration adapter that implements the legacy IStorage interface
 * using the new repository pattern under the hood
 *
 * This allows for gradual migration from the old storage pattern
 * to the new repository pattern without breaking existing code
 */
export class StorageMigrationAdapter {
  private repositories: RepositoryManager;

  constructor() {
    this.repositories = repositoryManager;
    console.log(
      '🔄 Storage Migration Adapter initialized - providing backward compatibility'
    );
  }

  // ===== USER METHODS =====
  async getUser(id: string): Promise<User | undefined> {
    return await this.repositories.users.findById(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return await this.repositories.users.findByUsername(username);
  }

  async createUser(user: InsertUser): Promise<User> {
    return await this.repositories.users.create(user);
  }

  // ===== PORTAL METHODS =====
  async getAllPortals(): Promise<Portal[]> {
    const result = await this.repositories.portals.findAllPortals();
    return result.data;
  }

  async getActivePortals(): Promise<Portal[]> {
    return await this.repositories.portals.getActivePortals();
  }

  async getPortal(id: string): Promise<Portal | undefined> {
    return await this.repositories.portals.findById(id);
  }

  async getPortalWithCredentials(id: string): Promise<Portal | undefined> {
    return await this.repositories.portals.findWithCredentials(id);
  }

  async createPortal(portal: InsertPortal): Promise<Portal> {
    return await this.repositories.portals.create(portal);
  }

  async updatePortal(
    id: string,
    updates: Partial<InsertPortal>
  ): Promise<Portal> {
    const result = await this.repositories.portals.update(id, updates);
    if (!result) {
      throw new Error(`Portal with ID ${id} not found`);
    }
    return result;
  }

  async deletePortal(id: string): Promise<void> {
    const success = await this.repositories.portals.delete(id);
    if (!success) {
      throw new Error(`Portal with ID ${id} not found`);
    }
  }

  // ===== RFP METHODS =====
  async getAllRFPs(filters?: {
    status?: string;
    portalId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ rfps: RFP[]; total: number }> {
    const result = await this.repositories.rfps.findAllRFPs(filters);
    return {
      rfps: result.data,
      total: result.total,
    };
  }

  async getRFP(id: string): Promise<RFP | undefined> {
    return await this.repositories.rfps.findById(id);
  }

  async getRFPBySourceUrl(sourceUrl: string): Promise<RFP | undefined> {
    return await this.repositories.rfps.findBySourceUrl(sourceUrl);
  }

  async getRFPsWithDetails(): Promise<any[]> {
    return await this.repositories.rfps.findWithPortalDetails();
  }

  async createRFP(rfp: InsertRFP): Promise<RFP> {
    return await this.repositories.rfps.create(rfp);
  }

  async updateRFP(id: string, updates: Partial<InsertRFP>): Promise<RFP> {
    const result = await this.repositories.rfps.update(id, updates);
    if (!result) {
      throw new Error(`RFP with ID ${id} not found`);
    }
    return result;
  }

  async deleteRFP(id: string): Promise<void> {
    const success = await this.repositories.rfps.delete(id);
    if (!success) {
      throw new Error(`RFP with ID ${id} not found`);
    }
  }

  async getRFPsByStatus(status: string): Promise<RFP[]> {
    return await this.repositories.rfps.findByStatus(status);
  }

  async getRFPsByPortal(portalId: string): Promise<RFP[]> {
    return await this.repositories.rfps.findByPortal(portalId);
  }

  // ===== PLACEHOLDER METHODS (TO BE IMPLEMENTED) =====
  // These methods maintain the interface but will throw not implemented errors
  // They should be implemented as the corresponding repositories are created

  async getProposal(id: string): Promise<Proposal | undefined> {
    throw new Error(
      'Proposal repository not yet implemented in migration adapter'
    );
  }

  async getProposalByRFP(rfpId: string): Promise<Proposal | undefined> {
    throw new Error(
      'Proposal repository not yet implemented in migration adapter'
    );
  }

  async createProposal(proposal: InsertProposal): Promise<Proposal> {
    throw new Error(
      'Proposal repository not yet implemented in migration adapter'
    );
  }

  async updateProposal(
    id: string,
    updates: Partial<Proposal>
  ): Promise<Proposal> {
    throw new Error(
      'Proposal repository not yet implemented in migration adapter'
    );
  }

  async getDocument(id: string): Promise<Document | undefined> {
    throw new Error(
      'Document repository not yet implemented in migration adapter'
    );
  }

  async getDocumentsByRFP(rfpId: string): Promise<Document[]> {
    throw new Error(
      'Document repository not yet implemented in migration adapter'
    );
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    throw new Error(
      'Document repository not yet implemented in migration adapter'
    );
  }

  async updateDocument(
    id: string,
    updates: Partial<Document>
  ): Promise<Document> {
    throw new Error(
      'Document repository not yet implemented in migration adapter'
    );
  }

  async getSubmission(id: string): Promise<Submission | undefined> {
    throw new Error(
      'Submission repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionsByRFP(rfpId: string): Promise<Submission[]> {
    throw new Error(
      'Submission repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionsByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<Submission[]> {
    throw new Error(
      'Submission repository not yet implemented in migration adapter'
    );
  }

  async createSubmission(submission: InsertSubmission): Promise<Submission> {
    throw new Error(
      'Submission repository not yet implemented in migration adapter'
    );
  }

  async updateSubmission(
    id: string,
    updates: Partial<Submission>
  ): Promise<Submission> {
    throw new Error(
      'Submission repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionPipeline(
    id: string
  ): Promise<SubmissionPipeline | undefined> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionPipelineBySubmission(
    submissionId: string
  ): Promise<SubmissionPipeline | undefined> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionPipelinesByStatus(
    status: string
  ): Promise<SubmissionPipeline[]> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionPipelinesByPhase(
    phase: string
  ): Promise<SubmissionPipeline[]> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async getActiveSubmissionPipelines(): Promise<SubmissionPipeline[]> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async createSubmissionPipeline(
    pipeline: InsertSubmissionPipeline
  ): Promise<SubmissionPipeline> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async updateSubmissionPipeline(
    id: string,
    updates: Partial<SubmissionPipeline>
  ): Promise<SubmissionPipeline> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async deleteSubmissionPipeline(id: string): Promise<void> {
    throw new Error(
      'SubmissionPipeline repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionEvent(id: string): Promise<SubmissionEvent | undefined> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionEventsByPipeline(
    pipelineId: string
  ): Promise<SubmissionEvent[]> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionEventsBySubmission(
    submissionId: string,
    limit?: number
  ): Promise<SubmissionEvent[]> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionEventsByType(
    eventType: string
  ): Promise<SubmissionEvent[]> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async getRecentSubmissionEvents(limit?: number): Promise<SubmissionEvent[]> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async createSubmissionEvent(
    event: InsertSubmissionEvent
  ): Promise<SubmissionEvent> {
    throw new Error(
      'SubmissionEvent repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionStatusHistory(
    submissionId: string
  ): Promise<SubmissionStatusHistory[]> {
    throw new Error(
      'SubmissionStatusHistory repository not yet implemented in migration adapter'
    );
  }

  async getSubmissionStatusHistoryByPipeline(
    pipelineId: string
  ): Promise<SubmissionStatusHistory[]> {
    throw new Error(
      'SubmissionStatusHistory repository not yet implemented in migration adapter'
    );
  }

  async createSubmissionStatusHistory(
    statusHistory: InsertSubmissionStatusHistory
  ): Promise<SubmissionStatusHistory> {
    throw new Error(
      'SubmissionStatusHistory repository not yet implemented in migration adapter'
    );
  }

  async createAuditLog(log: InsertAuditLog): Promise<AuditLog> {
    throw new Error(
      'AuditLog repository not yet implemented in migration adapter'
    );
  }

  async getAuditLogsByEntity(
    entityType: string,
    entityId: string
  ): Promise<AuditLog[]> {
    throw new Error(
      'AuditLog repository not yet implemented in migration adapter'
    );
  }

  // Additional methods from the original IStorage interface would be added here
  // For brevity, I'm including placeholders for the most commonly used ones

  async getNotifications(userId: string): Promise<Notification[]> {
    throw new Error(
      'Notification repository not yet implemented in migration adapter'
    );
  }

  async createNotification(
    notification: InsertNotification
  ): Promise<Notification> {
    throw new Error(
      'Notification repository not yet implemented in migration adapter'
    );
  }

  async getScans(): Promise<Scan[]> {
    throw new Error('Scan repository not yet implemented in migration adapter');
  }

  async createScan(scan: InsertScan): Promise<Scan> {
    throw new Error('Scan repository not yet implemented in migration adapter');
  }

  // Placeholder for any other methods that exist in the original IStorage interface
  [key: string]: any;

  /**
   * Get migration adapter health status
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    const repoHealth = await this.repositories.healthCheck();
    return {
      status: repoHealth.status,
      details: {
        repositories: repoHealth.repositories,
        adapter: 'migration_adapter',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

/**
 * Create singleton migration adapter instance
 */
export const storageMigrationAdapter = new StorageMigrationAdapter();
