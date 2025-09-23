import { AuthenticationStrategy } from './strategies/AuthenticationStrategy';
import { BonfireHubAuthStrategy } from './strategies/BonfireHubAuthStrategy';
import { GenericFormAuthStrategy } from './strategies/GenericFormAuthStrategy';
import { StagehandAuthStrategy } from './strategies/StagehandAuthStrategy';
import { AuthContext, AuthResult, AuthenticationError } from '../types';

/**
 * Authentication manager that orchestrates different authentication strategies
 */
export class AuthenticationManager {
  private strategies: Map<string, AuthenticationStrategy> = new Map();
  private fallbackStrategy: AuthenticationStrategy;

  constructor() {
    this.initializeStrategies();
  }

  /**
   * Initialize all authentication strategies
   */
  private initializeStrategies(): void {
    // Register portal-specific strategies
    const bonfireStrategy = new BonfireHubAuthStrategy();
    this.strategies.set('bonfire_hub', bonfireStrategy);

    // Register generic strategies
    const genericFormStrategy = new GenericFormAuthStrategy();
    this.strategies.set('generic_form', genericFormStrategy);

    const stagehandStrategy = new StagehandAuthStrategy();
    this.strategies.set('stagehand', stagehandStrategy);

    // Set fallback strategy
    this.fallbackStrategy = stagehandStrategy;

    console.log(`🔐 Authentication manager initialized with ${this.strategies.size} strategies`);
  }

  /**
   * Authenticate using the most appropriate strategy
   */
  async authenticate(context: AuthContext): Promise<AuthResult> {
    try {
      console.log(`🔐 Starting authentication for ${context.portalType || 'unknown'} portal: ${context.portalUrl}`);

      // Validate context
      const validation = this.validateAuthContext(context);
      if (!validation.isValid) {
        throw new AuthenticationError(`Invalid authentication context: ${validation.errors.join(', ')}`);
      }

      // Select the best strategy for this context
      const strategy = this.selectStrategy(context);
      console.log(`🎯 Selected authentication strategy: ${strategy.getPortalType()}`);

      // Validate credentials with the selected strategy
      if (!strategy.validateCredentials(context)) {
        throw new AuthenticationError('Invalid credentials provided');
      }

      // Attempt authentication
      const result = await strategy.authenticate(context);

      if (result.success) {
        console.log(`✅ Authentication successful using ${strategy.getPortalType()} strategy`);
        return result;
      }

      // If primary strategy failed, try fallback strategies
      console.log(`⚠️ Primary strategy failed: ${result.error}`);
      return await this.tryFallbackStrategies(context, strategy);

    } catch (error) {
      console.error(`❌ Authentication failed for ${context.portalUrl}:`, error);

      if (error instanceof AuthenticationError) {
        return {
          success: false,
          sessionId: context.sessionId,
          error: error.message
        };
      }

      return {
        success: false,
        sessionId: context.sessionId,
        error: error instanceof Error ? error.message : 'Unknown authentication error'
      };
    }
  }

  /**
   * Select the most appropriate authentication strategy
   */
  private selectStrategy(context: AuthContext): AuthenticationStrategy {
    const { portalType, portalUrl, authContext } = context;

    // 1. Try portal-specific strategy first
    if (portalType) {
      const portalStrategy = this.strategies.get(portalType);
      if (portalStrategy && portalStrategy.canHandle(portalType, portalUrl)) {
        return portalStrategy;
      }
    }

    // 2. Check if any strategy specifically claims it can handle this URL
    for (const strategy of this.strategies.values()) {
      if (strategy.canHandle(portalType || 'unknown', portalUrl)) {
        return strategy;
      }
    }

    // 3. Use authentication context hints
    if (authContext) {
      if (authContext.includes('oauth') || authContext.includes('sso')) {
        return this.strategies.get('stagehand')!;
      }
      if (authContext.includes('form')) {
        return this.strategies.get('generic_form')!;
      }
    }

    // 4. Analyze URL for hints
    if (this.requiresBrowserAuth(portalUrl)) {
      return this.strategies.get('stagehand')!;
    }

    // 5. Default to generic form strategy
    return this.strategies.get('generic_form')!;
  }

  /**
   * Try fallback strategies if the primary strategy fails
   */
  private async tryFallbackStrategies(
    context: AuthContext,
    primaryStrategy: AuthenticationStrategy
  ): Promise<AuthResult> {
    const fallbackOrder = this.getFallbackOrder(primaryStrategy);

    for (const strategyName of fallbackOrder) {
      const strategy = this.strategies.get(strategyName);
      if (!strategy || strategy === primaryStrategy) {
        continue;
      }

      console.log(`🔄 Trying fallback strategy: ${strategyName}`);

      try {
        const result = await strategy.authenticate(context);
        if (result.success) {
          console.log(`✅ Fallback authentication successful using ${strategyName}`);
          return result;
        }
        console.log(`⚠️ Fallback strategy ${strategyName} failed: ${result.error}`);
      } catch (error) {
        console.warn(`⚠️ Error in fallback strategy ${strategyName}:`, error);
      }
    }

    // All strategies failed
    return {
      success: false,
      sessionId: context.sessionId,
      error: 'All authentication strategies failed'
    };
  }

  /**
   * Get fallback strategy order based on primary strategy
   */
  private getFallbackOrder(primaryStrategy: AuthenticationStrategy): string[] {
    const primaryType = primaryStrategy.getPortalType();

    // Define fallback order based on primary strategy
    const fallbackMap: Record<string, string[]> = {
      'bonfire_hub': ['stagehand', 'generic_form'],
      'generic_form': ['stagehand'],
      'stagehand': ['generic_form'],
      'generic': ['stagehand', 'generic_form']
    };

    return fallbackMap[primaryType] || ['stagehand'];
  }

  /**
   * Check if URL requires browser authentication
   */
  private requiresBrowserAuth(url: string): boolean {
    const browserAuthIndicators = [
      'oauth',
      'sso',
      'saml',
      'openid',
      'microsoft',
      'google',
      'login.gov'
    ];

    const lowerUrl = url.toLowerCase();
    return browserAuthIndicators.some(indicator => lowerUrl.includes(indicator));
  }

  /**
   * Validate authentication context
   */
  private validateAuthContext(context: AuthContext): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!context.portalUrl) {
      errors.push('Portal URL is required');
    }

    if (!context.username) {
      errors.push('Username is required');
    }

    if (!context.password) {
      errors.push('Password is required');
    }

    if (!context.sessionId) {
      errors.push('Session ID is required');
    }

    // Validate URL format
    if (context.portalUrl) {
      try {
        new URL(context.portalUrl);
      } catch {
        errors.push('Invalid portal URL format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Register a new authentication strategy
   */
  registerStrategy(name: string, strategy: AuthenticationStrategy): void {
    this.strategies.set(name, strategy);
    console.log(`🔐 Registered authentication strategy: ${name}`);
  }

  /**
   * Get available authentication strategies
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Check if a strategy is available
   */
  hasStrategy(name: string): boolean {
    return this.strategies.has(name);
  }

  /**
   * Get strategy by name
   */
  getStrategy(name: string): AuthenticationStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Test authentication without storing session
   */
  async testAuthentication(context: AuthContext): Promise<{
    success: boolean;
    strategy: string;
    error?: string;
    duration: number;
  }> {
    const startTime = Date.now();

    try {
      const strategy = this.selectStrategy(context);
      const result = await strategy.authenticate({
        ...context,
        sessionId: `test_${Date.now()}`
      });

      return {
        success: result.success,
        strategy: strategy.getPortalType(),
        error: result.error,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        strategy: 'unknown',
        error: error instanceof Error ? error.message : 'Test authentication failed',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Get authentication statistics
   */
  getAuthStats(): {
    totalStrategies: number;
    availableStrategies: string[];
    fallbackStrategy: string;
  } {
    return {
      totalStrategies: this.strategies.size,
      availableStrategies: Array.from(this.strategies.keys()),
      fallbackStrategy: this.fallbackStrategy.getPortalType()
    };
  }
}