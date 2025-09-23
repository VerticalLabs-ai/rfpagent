// Authentication manager
export { AuthenticationManager } from './AuthenticationManager';

// Base strategy interface and abstract class
export { AuthenticationStrategy, BaseAuthenticationStrategy } from './strategies/AuthenticationStrategy';

// Concrete strategy implementations
export { BonfireHubAuthStrategy } from './strategies/BonfireHubAuthStrategy';
export { GenericFormAuthStrategy } from './strategies/GenericFormAuthStrategy';
export { StagehandAuthStrategy } from './strategies/StagehandAuthStrategy';

// Default export for convenience
export { AuthenticationManager as default } from './AuthenticationManager';