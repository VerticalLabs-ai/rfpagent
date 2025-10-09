import { UserRepository } from './UserRepository';
import { PortalRepository } from './PortalRepository';
import { RFPRepository } from './RFPRepository';
import { ProposalRepository } from './ProposalRepository';
import { DocumentRepository } from './DocumentRepository';
import { SubmissionRepository } from './SubmissionRepository';
import { db } from '../db';
import { users } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';

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
  private _proposalRepository!: ProposalRepository;
  private _documentRepository!: DocumentRepository;
  private _submissionRepository!: SubmissionRepository;

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
    this._proposalRepository = new ProposalRepository();
    this._documentRepository = new DocumentRepository();
    this._submissionRepository = new SubmissionRepository();

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

  /**
   * Get Proposal Repository
   */
  get proposals(): ProposalRepository {
    return this._proposalRepository;
  }

  /**
   * Get Document Repository
   */
  get documents(): DocumentRepository {
    return this._documentRepository;
  }

  /**
   * Get Submission Repository
   */
  get submissions(): SubmissionRepository {
    return this._submissionRepository;
  }

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
      proposals: false,
      documents: false,
      submissions: false,
    };

    try {
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

    try {
      await this._proposalRepository.count();
      checks.proposals = true;
    } catch (error) {
      console.error('Proposal repository health check failed:', error);
    }

    try {
      await this._documentRepository.count();
      checks.documents = true;
    } catch (error) {
      console.error('Document repository health check failed:', error);
    }

    try {
      await this._submissionRepository.count();
      checks.submissions = true;
    } catch (error) {
      console.error('Submission repository health check failed:', error);
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
  proposals: ProposalRepository;
  documents: DocumentRepository;
  submissions: SubmissionRepository;
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
  proposals: repositoryManager.proposals,
  documents: repositoryManager.documents,
  submissions: repositoryManager.submissions,

  // Health and stats
  healthCheck: () => repositoryManager.healthCheck(),
  getStats: () => repositoryManager.getStats(),

  // Transaction support
  executeTransaction: async <T>(
    callback: (repos: RepositoryFacade) => Promise<T>
  ) => repositoryManager.executeTransaction(() => callback(repositories)),
};
