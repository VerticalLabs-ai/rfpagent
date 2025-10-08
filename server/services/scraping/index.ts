// Core services
export { BrowserSessionManager } from './core/BrowserSessionManager';
export { ScrapingConfigurationService } from './core/ScrapingConfigurationService';
export { ServiceRegistry } from './core/ServiceRegistry';

// Portal services
export { PortalDetectionService } from './portal/PortalDetectionService';

// Authentication services
export {
  AuthenticationManager,
  BaseAuthenticationStrategy,
  BonfireHubAuthStrategy,
  GenericFormAuthStrategy,
  StagehandAuthStrategy,
} from './authentication';

// Agent management services
export * from './agents';

// Tools
export { ToolFactory } from './tools/ToolFactory';

// Content processing services
export { ContentProcessingManager } from './extraction/ContentProcessingManager';
export { AIContentExtractor } from './extraction/extractors/AIContentExtractor';
export { BonfireContentExtractor } from './extraction/extractors/BonfireContentExtractor';
export { SAMGovContentExtractor } from './extraction/extractors/SAMGovContentExtractor';
export { AustinFinanceContentExtractor } from './extraction/extractors/AustinFinanceContentExtractor';
export { HTMLContentExtractor } from './extraction/extractors/HTMLContentExtractor';
export { JSONContentExtractor } from './extraction/extractors/JSONContentExtractor';

// Main orchestrator
export { ScrapingOrchestrator } from './ScrapingOrchestrator';

// Migration adapter for backward compatibility
export { MigrationAdapter, MigrationAdapterFactory } from './MigrationAdapter';

// Types and interfaces
export * from './types';

// Default export for backward compatibility
export { ScrapingOrchestrator as default } from './ScrapingOrchestrator';
