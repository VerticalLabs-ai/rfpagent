import { BaseAuthenticationStrategy } from './AuthenticationStrategy';
import { AuthContext, AuthResult } from '../../types';
import { stagehandAuthTool } from '../../../../../src/mastra/tools';
import {
  executeStagehandTool,
  StagehandAuthResultSchema,
} from '../../utils/stagehand';

/**
 * Stagehand-based authentication strategy
 * Uses browser automation for complex authentication flows
 */
export class StagehandAuthStrategy extends BaseAuthenticationStrategy {
  constructor() {
    super('stagehand');
  }

  canHandle(portalType: string, url: string): boolean {
    // This strategy can handle any portal but is typically used as a fallback
    // or for complex authentication flows that require browser automation
    return true;
  }

  async authenticate(context: AuthContext): Promise<AuthResult> {
    try {
      console.log(
        `🌐 Starting Stagehand browser authentication for: ${context.portalUrl}`
      );

      if (!context.username || !context.password) {
        return {
          success: false,
          sessionId: context.sessionId,
          error: 'Missing credentials for Stagehand authentication',
        };
      }

      const sessionId = String(context.sessionId ?? `stagehand-${Date.now()}`);

      const authResult = await executeStagehandTool(
        stagehandAuthTool,
        {
          loginUrl: context.portalUrl,
          username: context.username,
          password: context.password,
          targetUrl: context.portalUrl,
          sessionId,
          portalType: context.portalType || 'generic',
        },
        StagehandAuthResultSchema
      );

      if (authResult.success) {
        console.log(`✅ Stagehand authentication successful`);
        return {
          success: true,
          sessionId,
          cookies: authResult.cookies,
          authToken: authResult.authToken,
        };
      } else {
        console.log(
          `❌ Stagehand authentication failed: ${authResult.message}`
        );
        return {
          success: false,
          sessionId,
          error: authResult.message || 'Stagehand authentication failed',
        };
      }
    } catch (error) {
      return this.handleAuthError(error, 'StagehandAuthStrategy');
    }
  }

  /**
   * Enhanced validation for browser automation
   */
  validateCredentials(credentials: {
    username: string;
    password: string;
  }): boolean {
    // More strict validation for browser automation
    const isValid = !!(
      credentials.username &&
      credentials.password &&
      credentials.username.trim().length > 0 &&
      credentials.password.trim().length > 0
    );

    if (!isValid) {
      console.warn('⚠️ Invalid credentials for Stagehand authentication');
    }

    return isValid;
  }

  /**
   * Check if this strategy should be used for a specific portal
   */
  shouldUseForPortal(portalType: string, url: string): boolean {
    // Use Stagehand for known complex authentication portals
    const complexAuthPortals = [
      'bonfire_hub',
      'sam_gov', // SAM.gov can have complex flows
    ];

    // Use for OAuth/SSO indicators in URL
    const oauthIndicators = ['oauth', 'sso', 'saml', 'openid'];
    const hasOAuthIndicator = oauthIndicators.some(indicator =>
      url.toLowerCase().includes(indicator)
    );

    return complexAuthPortals.includes(portalType) || hasOAuthIndicator;
  }

  /**
   * Get portal-specific configuration for Stagehand
   */
  getPortalConfig(portalType: string): {
    timeout: number;
    waitForNavigation: boolean;
    enableJavaScript: boolean;
    customSelectors?: Record<string, string>;
  } {
    const configs: Record<string, any> = {
      bonfire_hub: {
        timeout: 90000, // Bonfire can be slow
        waitForNavigation: true,
        enableJavaScript: true,
        customSelectors: {
          usernameField: 'input[name="traits.email"], input[type="email"]',
          passwordField: 'input[name="password"], input[type="password"]',
          submitButton: 'button[type="submit"], input[type="submit"]',
        },
      },
      sam_gov: {
        timeout: 60000,
        waitForNavigation: true,
        enableJavaScript: true,
        customSelectors: {
          usernameField: 'input[name="username"], input[name="email"]',
          passwordField: 'input[name="password"]',
          submitButton: 'button[type="submit"]',
        },
      },
      generic: {
        timeout: 45000,
        waitForNavigation: true,
        enableJavaScript: true,
      },
    };

    return configs[portalType] || configs.generic;
  }

  /**
   * Handle special cases for specific portals
   */
  async handleSpecialCase(context: AuthContext): Promise<AuthResult | null> {
    if (context.portalType === 'bonfire_hub') {
      return await this.handleBonfireSpecialCase(context);
    }

    if (context.portalType === 'sam_gov') {
      return await this.handleSamGovSpecialCase(context);
    }

    return null; // No special handling needed
  }

  /**
   * Handle Bonfire Hub special authentication cases
   */
  private async handleBonfireSpecialCase(
    context: AuthContext
  ): Promise<AuthResult | null> {
    // Handle Euna Supplier Network (ESN) redirects
    if (context.portalUrl.includes('network.euna.com')) {
      console.log('🔄 Detected ESN redirect for Bonfire Hub');

      // Use extended timeout for ESN authentication
      const config = this.getPortalConfig('bonfire_hub');
      config.timeout = 120000; // 2 minutes for ESN

      return await this.authenticateWithConfig(context, config);
    }

    return null;
  }

  /**
   * Handle SAM.gov special authentication cases
   */
  private async handleSamGovSpecialCase(
    context: AuthContext
  ): Promise<AuthResult | null> {
    // SAM.gov might have PIV card authentication
    if (
      context.portalUrl.includes('sam.gov') &&
      context.authContext?.includes('piv')
    ) {
      console.log('🔄 Detected PIV card authentication for SAM.gov');

      return {
        success: false,
        sessionId: context.sessionId,
        error: 'PIV card authentication not supported in automated flows',
      };
    }

    return null;
  }

  /**
   * Authenticate with specific configuration
   */
  private async authenticateWithConfig(
    context: AuthContext,
    config: any
  ): Promise<AuthResult> {
    try {
      if (!context.username || !context.password) {
        return {
          success: false,
          sessionId: context.sessionId,
          error: 'Missing credentials for Stagehand authentication',
        };
      }

      const sessionId = String(context.sessionId ?? `stagehand-${Date.now()}`);

      const authResult = await executeStagehandTool(
        stagehandAuthTool,
        {
          loginUrl: context.portalUrl,
          username: context.username,
          password: context.password,
          targetUrl: context.portalUrl,
          sessionId,
          portalType: context.portalType || 'generic',
        },
        StagehandAuthResultSchema
      );

      return {
        success: !!authResult.success,
        sessionId,
        cookies: authResult.cookies,
        authToken: authResult.authToken,
        error: authResult.success ? undefined : authResult.message,
      };
    } catch (error) {
      return this.handleAuthError(error, 'authenticateWithConfig');
    }
  }
}
