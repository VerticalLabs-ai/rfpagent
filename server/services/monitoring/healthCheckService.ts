import { storage } from '../../storage';
import { agentRegistryService } from '../agents/agentRegistryService';
import { getMastraScrapingService } from '../scrapers/mastraScrapingService';

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    database: ServiceHealth;
    storage: ServiceHealth;
    agents: ServiceHealth;
    scraping: ServiceHealth;
    memory: ServiceHealth;
  };
  metrics: {
    cpuUsage: number;
    memoryUsage: number;
    memoryTotal: number;
    activeConnections: number;
  };
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  lastCheck: string;
  details?: Record<string, any>;
  error?: string;
}

export class HealthCheckService {
  private startTime: number;
  private healthCache: Map<
    string,
    { result: ServiceHealth; timestamp: number }
  > = new Map();
  private readonly CACHE_TTL = 5000; // 5 seconds cache

  constructor() {
    this.startTime = Date.now();
  }

  /**
   * Comprehensive health check
   */
  async checkHealth(): Promise<HealthCheckResult> {
    const [database, storage, agents, scraping, memory] = await Promise.all([
      this.checkDatabase(),
      this.checkStorage(),
      this.checkAgents(),
      this.checkScrapingService(),
      this.checkMemory(),
    ]);

    const allHealthy = [database, storage, agents, scraping, memory].every(
      s => s.status === 'up'
    );
    const anyDegraded = [database, storage, agents, scraping, memory].some(
      s => s.status === 'degraded'
    );

    return {
      status: allHealthy ? 'healthy' : anyDegraded ? 'degraded' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database,
        storage,
        agents,
        scraping,
        memory,
      },
      metrics: this.getMetrics(),
    };
  }

  /**
   * Quick health check (cached)
   */
  async quickCheck(): Promise<{ status: string; uptime: number }> {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }

  /**
   * Check database connectivity
   */
  private async checkDatabase(): Promise<ServiceHealth> {
    const cached = this.getCached('database');
    if (cached) return cached;

    const start = Date.now();
    try {
      // Test database connection by querying portals
      const portals = await storage.getAllPortals();
      const responseTime = Date.now() - start;

      const result: ServiceHealth = {
        status: responseTime < 1000 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          portalsCount: portals?.length || 0,
        },
      };

      this.setCached('database', result);
      return result;
    } catch (error) {
      const result: ServiceHealth = {
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Database connection failed',
      };

      this.setCached('database', result);
      return result;
    }
  }

  /**
   * Check storage service
   */
  private async checkStorage(): Promise<ServiceHealth> {
    const cached = this.getCached('storage');
    if (cached) return cached;

    const start = Date.now();
    try {
      // Test basic storage operations
      const portals = await storage.getAllPortals();
      const responseTime = Date.now() - start;

      const result: ServiceHealth = {
        status: 'up',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          operational: true,
        },
      };

      this.setCached('storage', result);
      return result;
    } catch (error) {
      const result: ServiceHealth = {
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error:
          error instanceof Error ? error.message : 'Storage service failed',
      };

      this.setCached('storage', result);
      return result;
    }
  }

  /**
   * Check agent registry service
   */
  private async checkAgents(): Promise<ServiceHealth> {
    const cached = this.getCached('agents');
    if (cached) return cached;

    const start = Date.now();
    try {
      const agents = await agentRegistryService.getActiveAgents();
      const responseTime = Date.now() - start;

      const activeAgents = agents.filter(
        (a: any) => a.status === 'active' || a.status === 'idle'
      );

      const result: ServiceHealth = {
        status: activeAgents.length > 0 ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          totalAgents: agents.length,
          activeAgents: activeAgents.length,
        },
      };

      this.setCached('agents', result);
      return result;
    } catch (error) {
      const result: ServiceHealth = {
        status: 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Agent registry failed',
      };

      this.setCached('agents', result);
      return result;
    }
  }

  /**
   * Check scraping service
   */
  private async checkScrapingService(): Promise<ServiceHealth> {
    const cached = this.getCached('scraping');
    if (cached) return cached;

    const start = Date.now();
    try {
      const scrapingService = getMastraScrapingService();
      const responseTime = Date.now() - start;

      const result: ServiceHealth = {
        status: scrapingService ? 'up' : 'degraded',
        responseTime,
        lastCheck: new Date().toISOString(),
        details: {
          operational: !!scrapingService,
        },
      };

      this.setCached('scraping', result);
      return result;
    } catch (error) {
      const result: ServiceHealth = {
        status: 'degraded',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : 'Scraping service check failed',
      };

      this.setCached('scraping', result);
      return result;
    }
  }

  /**
   * Check memory usage
   */
  private async checkMemory(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const memoryUsage = process.memoryUsage();
      const usagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

      return {
        status:
          usagePercent < 80 ? 'up' : usagePercent < 95 ? 'degraded' : 'down',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        details: {
          heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
          usagePercent: Math.round(usagePercent),
        },
      };
    } catch (error) {
      return {
        status: 'degraded',
        responseTime: Date.now() - start,
        lastCheck: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Memory check failed',
      };
    }
  }

  /**
   * Get system metrics
   */
  private getMetrics(): HealthCheckResult['metrics'] {
    const memoryUsage = process.memoryUsage();

    return {
      cpuUsage: Math.round((process.cpuUsage().user / 1000000) * 100) / 100,
      memoryUsage: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      memoryTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      activeConnections: 0, // Could be tracked if needed
    };
  }

  /**
   * Cache helpers
   */
  private getCached(key: string): ServiceHealth | null {
    const cached = this.healthCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }
    return null;
  }

  private setCached(key: string, result: ServiceHealth): void {
    this.healthCache.set(key, { result, timestamp: Date.now() });
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }
}

export const healthCheckService = new HealthCheckService();
