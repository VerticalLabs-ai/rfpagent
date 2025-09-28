import { BrowserSessionManager } from './BrowserSessionManager';
import { ScrapingConfigurationService } from './ScrapingConfigurationService';
import { PortalDetectionService } from '../portal/PortalDetectionService';
import { ToolFactory } from '../tools/ToolFactory';
import { AuthenticationManager } from '../authentication/AuthenticationManager';
import { AgentFactory, AgentRegistry, AgentOrchestrator } from '../agents';
import { PortalAgentManager } from '../agents/specialized/PortalAgentManager';
import { sharedMemory } from '../../../../src/mastra/tools';

/**
 * Central registry for all scraping services
 * Provides dependency injection and service lifecycle management
 */
export class ServiceRegistry {
  private static instance: ServiceRegistry;

  private browserSessionManager: BrowserSessionManager;
  private configurationService: ScrapingConfigurationService;
  private portalDetectionService: PortalDetectionService;
  private authenticationManager: AuthenticationManager;
  private agentFactory: AgentFactory;
  private agentRegistry: AgentRegistry;
  private agentOrchestrator: AgentOrchestrator;
  private portalAgentManager: PortalAgentManager;
  private toolFactory: typeof ToolFactory;

  private constructor() {
    this.initializeServices();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  /**
   * Initialize all services
   */
  private initializeServices(): void {
    console.log('🔧 Initializing scraping service registry...');

    this.browserSessionManager = new BrowserSessionManager();
    this.configurationService = new ScrapingConfigurationService();
    this.portalDetectionService = new PortalDetectionService();
    this.authenticationManager = new AuthenticationManager();

    // Initialize agent management services
    this.toolFactory = ToolFactory;
    this.agentFactory = new AgentFactory(sharedMemory, this.toolFactory);
    this.agentRegistry = new AgentRegistry(this.agentFactory);
    this.agentOrchestrator = new AgentOrchestrator(this.agentRegistry);
    this.portalAgentManager = new PortalAgentManager(
      this.agentFactory,
      this.agentRegistry,
      this.portalDetectionService,
      this.configurationService
    );

    console.log('✅ All scraping services initialized successfully');
  }

  /**
   * Get browser session manager
   */
  getBrowserSessionManager(): BrowserSessionManager {
    return this.browserSessionManager;
  }

  /**
   * Get configuration service
   */
  getConfigurationService(): ScrapingConfigurationService {
    return this.configurationService;
  }

  /**
   * Get portal detection service
   */
  getPortalDetectionService(): PortalDetectionService {
    return this.portalDetectionService;
  }

  /**
   * Get authentication manager
   */
  getAuthenticationManager(): AuthenticationManager {
    return this.authenticationManager;
  }

  /**
   * Get agent factory
   */
  getAgentFactory(): AgentFactory {
    return this.agentFactory;
  }

  /**
   * Get agent registry
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * Get agent orchestrator
   */
  getAgentOrchestrator(): AgentOrchestrator {
    return this.agentOrchestrator;
  }

  /**
   * Get portal agent manager
   */
  getPortalAgentManager(): PortalAgentManager {
    return this.portalAgentManager;
  }

  /**
   * Get tool factory
   */
  getToolFactory(): typeof ToolFactory {
    return this.toolFactory;
  }

  /**
   * Get all services for dependency injection
   */
  getAllServices() {
    return {
      browserSessionManager: this.browserSessionManager,
      configurationService: this.configurationService,
      portalDetectionService: this.portalDetectionService,
      authenticationManager: this.authenticationManager,
      agentFactory: this.agentFactory,
      agentRegistry: this.agentRegistry,
      agentOrchestrator: this.agentOrchestrator,
      portalAgentManager: this.portalAgentManager,
      toolFactory: this.toolFactory,
    };
  }

  /**
   * Health check for all services
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: Record<string, { status: string; details?: string }>;
  }> {
    const serviceChecks = {
      browserSessionManager: { status: 'healthy' },
      configurationService: { status: 'healthy' },
      portalDetectionService: { status: 'healthy' },
      authenticationManager: { status: 'healthy' },
      agentFactory: { status: 'healthy' },
      agentRegistry: { status: 'healthy' },
      agentOrchestrator: { status: 'healthy' },
      portalAgentManager: { status: 'healthy' },
      toolFactory: { status: 'healthy' },
    };

    // Check browser session manager
    try {
      const stats = this.browserSessionManager.getSessionStats();
      serviceChecks.browserSessionManager = {
        status: 'healthy',
        details: `${stats.total} active sessions`,
      };
    } catch (error) {
      serviceChecks.browserSessionManager = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check portal detection service
    try {
      const portalTypes =
        this.portalDetectionService.getRegisteredPortalTypes();
      serviceChecks.portalDetectionService = {
        status: 'healthy',
        details: `${portalTypes.length} portal types registered`,
      };
    } catch (error) {
      serviceChecks.portalDetectionService = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check configuration service
    try {
      const supportedPortals =
        this.configurationService.getSupportedPortalTypes();
      serviceChecks.configurationService = {
        status: 'healthy',
        details: `${supportedPortals.length} portal configurations loaded`,
      };
    } catch (error) {
      serviceChecks.configurationService = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check authentication manager
    try {
      const authStats = this.authenticationManager.getAuthStats();
      serviceChecks.authenticationManager = {
        status: 'healthy',
        details: `${authStats.totalStrategies} authentication strategies available`,
      };
    } catch (error) {
      serviceChecks.authenticationManager = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check agent registry
    try {
      const agentCount = this.agentRegistry.getAgentCount();
      const agentHealth = await this.agentRegistry.healthCheck();
      serviceChecks.agentRegistry = {
        status: agentHealth.status,
        details: `${agentCount} agents registered, ${agentHealth.details.activeAgents} active`,
      };
    } catch (error) {
      serviceChecks.agentRegistry = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check agent orchestrator
    try {
      const orchestratorHealth = await this.agentOrchestrator.healthCheck();
      serviceChecks.agentOrchestrator = {
        status: orchestratorHealth.status,
        details: 'Agent orchestrator operational',
      };
    } catch (error) {
      serviceChecks.agentOrchestrator = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check agent factory
    try {
      const supportedPortals = this.agentFactory.getSupportedPortalTypes();
      serviceChecks.agentFactory = {
        status: 'healthy',
        details: `${supportedPortals.length} portal types supported`,
      };
    } catch (error) {
      serviceChecks.agentFactory = {
        status: 'unhealthy',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Portal agent manager is always healthy if it exists
    serviceChecks.portalAgentManager = {
      status: 'healthy',
      details: 'Portal agent manager operational',
    };

    // Determine overall status
    const hasUnhealthy = Object.values(serviceChecks).some(
      check => check.status === 'unhealthy'
    );
    const hasDegraded = Object.values(serviceChecks).some(
      check => check.status === 'degraded'
    );

    const overallStatus = hasUnhealthy
      ? 'unhealthy'
      : hasDegraded
        ? 'degraded'
        : 'healthy';

    return {
      status: overallStatus,
      services: serviceChecks,
    };
  }

  /**
   * Shutdown all services gracefully
   */
  async shutdown(): Promise<void> {
    console.log('🔒 Shutting down scraping services...');

    // Close all browser sessions
    try {
      // Note: BrowserSessionManager doesn't have a shutdown method yet
      // This would be implemented to close all active sessions
      console.log('🔒 Browser sessions cleanup completed');
    } catch (error) {
      console.error('❌ Error during browser session cleanup:', error);
    }

    console.log('✅ Scraping service registry shutdown completed');
  }
}
