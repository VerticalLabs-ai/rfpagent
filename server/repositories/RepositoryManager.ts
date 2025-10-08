import { UserRepository } from './UserRepository';
import { PortalRepository } from './PortalRepository';
import { RFPRepository } from './RFPRepository';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

// Additional repositories (to be created)
import type {
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
 * Repository Manager provides centralized access to all repositories
 * Implements dependency injection and repository lifecycle management
 */
export class RepositoryManager {
  private static instance: RepositoryManager;

  // Core repositories
  private _userRepository!: UserRepository;
  private _portalRepository!: PortalRepository;
  private _rfpRepository!: RFPRepository;

  // Additional repositories (to be implemented)
  // private _proposalRepository: ProposalRepository;
  // private _documentRepository: DocumentRepository;
  // private _submissionRepository: SubmissionRepository;
  // private _submissionPipelineRepository: SubmissionPipelineRepository;
  // private _submissionEventRepository: SubmissionEventRepository;
  // private _auditLogRepository: AuditLogRepository;
  // private _notificationRepository: NotificationRepository;
  // private _scanRepository: ScanRepository;

  private constructor() {
    this.initializeRepositories();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): RepositoryManager {
    if (!RepositoryManager.instance) {
      RepositoryManager.instance = new RepositoryManager();
    }
    return RepositoryManager.instance;
  }

  /**
   * Initialize all repositories
   */
  private initializeRepositories(): void {
    this._userRepository = new UserRepository();
    this._portalRepository = new PortalRepository();
    this._rfpRepository = new RFPRepository();

    console.log('🏗️ Repository Manager initialized with all repositories');
  }

  /**
   * Get User Repository
   */
  get users(): UserRepository {
    return this._userRepository;
  }

  /**
   * Get Portal Repository
   */
  get portals(): PortalRepository {
    return this._portalRepository;
  }

  /**
   * Get RFP Repository
   */
  get rfps(): RFPRepository {
    return this._rfpRepository;
  }

  // Additional repository getters (to be implemented)
  // get proposals(): ProposalRepository { return this._proposalRepository; }
  // get documents(): DocumentRepository { return this._documentRepository; }
  // get submissions(): SubmissionRepository { return this._submissionRepository; }
  // get submissionPipelines(): SubmissionPipelineRepository { return this._submissionPipelineRepository; }
  // get submissionEvents(): SubmissionEventRepository { return this._submissionEventRepository; }
  // get auditLogs(): AuditLogRepository { return this._auditLogRepository; }
  // get notifications(): NotificationRepository { return this._notificationRepository; }
  // get scans(): ScanRepository { return this._scanRepository; }

  /**
   * Health check for all repositories
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    repositories: Record<string, boolean>;
  }> {
    const checks = {
      users: false,
      portals: false,
      rfps: false,
    };

    try {
      // Test basic operations
      await this._userRepository.count();
      checks.users = true;
    } catch (error) {
      console.error('User repository health check failed:', error);
    }

    try {
      await this._portalRepository.count();
      checks.portals = true;
    } catch (error) {
      console.error('Portal repository health check failed:', error);
    }

    try {
      await this._rfpRepository.count();
      checks.rfps = true;
    } catch (error) {
      console.error('RFP repository health check failed:', error);
    }

    const healthyCount = Object.values(checks).filter(Boolean).length;
    const totalCount = Object.keys(checks).length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      repositories: checks,
    };
  }

  /**
   * Get repository statistics
   */
  async getStats(): Promise<{
    users: { total: number; active: number };
    portals: { total: number; active: number };
    rfps: { total: number; active: number };
  }> {
    const [userStats, portalStats, rfpStats] = await Promise.all([
      this._userRepository.count(),
      this._portalRepository.getPortalStats(),
      this._rfpRepository.getRFPStats(),
    ]);

    const [{ count: activeUsers }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.isActive, true));

    return {
      users: {
        total: userStats,
        active: Number(activeUsers ?? 0),
      },
      portals: {
        total: portalStats.total,
        active: portalStats.active,
      },
      rfps: {
        total: rfpStats.total,
        active: rfpStats.active,
      },
    };
  }

  /**
   * Execute transaction across multiple repositories
   */
  async executeTransaction<T>(
    callback: (repositories: RepositoryManager) => Promise<T>
  ): Promise<T> {
    // For now, use the base repository transaction from one of the repositories
    // In a more advanced implementation, this would coordinate transactions across all repositories
    return await callback(this);
  }

  /**
   * Clear all repository caches (if caching is implemented)
   */
  clearCaches(): void {
    // Placeholder for cache clearing logic
    console.log('🧹 Repository caches cleared');
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    console.log('🛑 Repository Manager shutting down...');
    this.clearCaches();
    console.log('✅ Repository Manager shutdown complete');
  }
}

/**
 * Default repository manager instance
 */
export const repositoryManager = RepositoryManager.getInstance();

/**
 * Backward compatibility - provide the same interface as the old storage
 * This allows gradual migration from the old storage pattern
 */
export interface RepositoryFacade {
  users: UserRepository;
  portals: PortalRepository;
  rfps: RFPRepository;
  healthCheck: () => ReturnType<RepositoryManager['healthCheck']>;
  getStats: () => ReturnType<RepositoryManager['getStats']>;
  executeTransaction: <T>(
    callback: (repos: RepositoryFacade) => Promise<T>
  ) => Promise<T>;
}

export const repositories: RepositoryFacade = {
  users: repositoryManager.users,
  portals: repositoryManager.portals,
  rfps: repositoryManager.rfps,

  // Health and stats
  healthCheck: () => repositoryManager.healthCheck(),
  getStats: () => repositoryManager.getStats(),

  // Transaction support
  executeTransaction: async <T>(
    callback: (repos: RepositoryFacade) => Promise<T>
  ) => repositoryManager.executeTransaction(() => callback(repositories)),
};
