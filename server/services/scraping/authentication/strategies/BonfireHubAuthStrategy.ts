// @ts-nocheck
import { BaseAuthenticationStrategy } from './AuthenticationStrategy';
import { AuthContext, AuthResult } from '../../types';
import { stagehandAuthTool } from '../../../../../src/mastra/tools';
import axios from 'axios';
import * as cheerio from 'cheerio';
import {
  executeStagehandTool,
  StagehandAuthResultSchema,
} from '../../utils/stagehand';

/**
 * Bonfire Hub authentication strategy
 * Handles Ory Kratos authentication flow and ESN (Euna Supplier Network) redirects
 */
export class BonfireHubAuthStrategy extends BaseAuthenticationStrategy {
  constructor() {
    super('bonfire_hub');
  }

  canHandle(portalType: string, url: string): boolean {
    return (
      portalType === 'bonfire_hub' ||
      url.includes('bonfirehub.com') ||
      url.includes('vendor.bonfirehub.com')
    );
  }

  async authenticate(context: AuthContext): Promise<AuthResult> {
    try {
      console.log(
        `🔐 Starting Bonfire Hub authentication for: ${context.portalUrl}`
      );

      // Method 1: Try unified Stagehand authentication first
      const stagehandResult = await this.tryStagehandAuth(context);
      if (stagehandResult.success) {
        return stagehandResult;
      }

      console.log(
        `⚠️ Stagehand auth failed, trying Ory Kratos flow: ${stagehandResult.error}`
      );

      // Method 2: Fall back to manual Ory Kratos authentication
      const oryResult = await this.performOryKratosAuth(context);
      if (oryResult.success) {
        return oryResult;
      }

      // Method 3: Try browser automation as last resort
      console.log(
        `⚠️ Ory Kratos auth failed, trying browser automation: ${oryResult.error}`
      );
      return await this.performBrowserAuth(context);
    } catch (error) {
      return this.handleAuthError(error, 'BonfireHubAuthStrategy');
    }
  }

  /**
   * Try Stagehand authentication tool
   */
  private async tryStagehandAuth(context: AuthContext): Promise<AuthResult> {
    const sessionId = String(context.sessionId ?? `stagehand-${Date.now()}`);
    try {
      if (!context.username || !context.password) {
        return {
          success: false,
          sessionId,
          error: 'Missing credentials for Stagehand authentication',
        };
      }

      const authResult = await executeStagehandTool(
        stagehandAuthTool,
        {
          loginUrl: context.portalUrl,
          username: context.username,
          password: context.password,
          targetUrl: context.portalUrl,
          sessionId,
          portalType: this.portalType,
        },
        StagehandAuthResultSchema
      );

      if (authResult.success) {
        console.log(`✅ Stagehand authentication successful for Bonfire Hub`);
        return {
          success: true,
          sessionId,
          cookies: authResult.cookies,
          authToken: authResult.authToken,
        };
      } else {
        return {
          success: false,
          sessionId,
          error: authResult.message || 'Stagehand authentication failed',
        };
      }
    } catch (error) {
      return {
        success: false,
        sessionId,
        error:
          error instanceof Error
            ? error.message
            : 'Stagehand authentication error',
      };
    }
  }

  /**
   * Perform Ory Kratos authentication flow
   */
  private async performOryKratosAuth(
    context: AuthContext
  ): Promise<AuthResult> {
    try {
      console.log(
        `🔐 Starting Ory Kratos authentication flow for ${context.portalUrl}`
      );

      // Step 1: Get the login flow URL with flow ID
      const loginFlowUrl =
        'https://account-flows.bonfirehub.com/self-service/login/browser?return_to=https%3A%2F%2Fvendor.bonfirehub.com%2Fopportunities%2Fall';
      console.log(`🌐 Step 1: Getting login flow from ${loginFlowUrl}`);

      const flowResponse = await this.getWithRedirects(loginFlowUrl);

      if (!flowResponse.finalUrl.includes('/login?flow=')) {
        throw new Error(
          `Expected login flow URL with flow ID, got: ${flowResponse.finalUrl}`
        );
      }

      // Extract flow ID from URL
      const flowId = new URL(flowResponse.finalUrl).searchParams.get('flow');
      if (!flowId) {
        throw new Error('No flow ID found in login URL');
      }

      console.log(`🆔 Step 2: Extracted flow ID: ${flowId.substring(0, 8)}...`);

      // Step 2: Get the form data structure
      const flowJsonUrl = `https://account.bonfirehub.com/login?flow=${flowId}`;
      console.log(`📋 Step 2: Getting form structure from ${flowJsonUrl}`);

      const flowDataResponse = await request(flowJsonUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Cookie: flowResponse.cookieHeader,
        },
      });

      const flowData = (await flowDataResponse.body.json()) as any;
      console.log(
        `📋 Form structure received for flow ${flowId.substring(0, 8)}...`
      );

      // Extract form action and CSRF token
      const formAction = flowData.ui?.action;
      if (!formAction) {
        throw new Error('No form action found in flow data');
      }

      // Build form payload
      const loginPayload: any = {
        'traits.email': context.username,
        password: context.password,
        method: 'password',
      };

      // Add CSRF token if present
      const csrfNode = flowData.ui?.nodes?.find(
        (node: any) => node.attributes?.name === 'csrf_token'
      );
      if (csrfNode) {
        loginPayload['csrf_token'] = csrfNode.attributes.value;
      }

      const redactedPayload = this.redactSensitiveInfo(loginPayload);
      console.log(`📤 Step 3: Submitting credentials`, redactedPayload);

      // Step 3: Submit credentials to form action
      const loginSubmitResponse = await request(formAction, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Cookie: flowResponse.cookieHeader,
        },
        body: new URLSearchParams(loginPayload).toString(),
      });

      console.log(
        `📡 Step 3: Login submit response: HTTP ${loginSubmitResponse.statusCode}`
      );

      // Step 4: Follow redirects to complete authentication
      if ([302, 303, 307, 308].includes(loginSubmitResponse.statusCode)) {
        console.log(
          `🔄 Step 4: Following redirects to complete authentication`
        );

        const locationHeader = Array.isArray(
          loginSubmitResponse.headers.location
        )
          ? loginSubmitResponse.headers.location[0]
          : loginSubmitResponse.headers.location;
        if (!locationHeader) {
          throw new Error('No location header in redirect response');
        }

        // Merge cookies from login response
        const loginCookies = this.extractCookies(loginSubmitResponse);
        const allCookies = this.mergeCookies(
          flowResponse.cookieHeader,
          loginCookies
        );

        const finalResponse = await this.getWithRedirects(
          locationHeader,
          allCookies
        );

        // Check if we're authenticated (should be on vendor.bonfirehub.com)
        if (
          finalResponse.finalUrl.includes('vendor.bonfirehub.com') &&
          !finalResponse.finalUrl.includes('login')
        ) {
          console.log(`🎉 Ory Kratos authentication successful!`);

          return {
            success: true,
            sessionId: context.sessionId,
            cookies: finalResponse.cookieHeader,
            authToken: flowId,
          };
        } else {
          return {
            success: false,
            sessionId: context.sessionId,
            error: 'Authentication failed - not redirected to vendor portal',
          };
        }
      } else if (loginSubmitResponse.statusCode === 200) {
        const responseText = await loginSubmitResponse.body.text();

        if (
          responseText.includes('Invalid credentials') ||
          responseText.includes('error')
        ) {
          return {
            success: false,
            sessionId: context.sessionId,
            error: 'Invalid credentials or login error',
          };
        } else {
          // Success without redirect
          return {
            success: true,
            sessionId: context.sessionId,
            cookies: this.extractCookies(loginSubmitResponse),
            authToken: flowId,
          };
        }
      } else {
        throw new Error(
          `Unexpected login response: HTTP ${loginSubmitResponse.statusCode}`
        );
      }
    } catch (error) {
      console.error(`❌ Ory Kratos authentication failed:`, error);
      return {
        success: false,
        sessionId: context.sessionId,
        error:
          error instanceof Error
            ? error.message
            : 'Ory Kratos authentication failed',
      };
    }
  }

  /**
   * Perform browser-based authentication as fallback
   */
  private async performBrowserAuth(context: AuthContext): Promise<AuthResult> {
    // This would integrate with browser automation tools
    // For now, return a placeholder implementation
    console.log(
      `🌐 Browser authentication for Bonfire Hub not yet implemented`
    );

    return {
      success: false,
      sessionId: context.sessionId,
      error: 'Browser authentication not yet implemented for Bonfire Hub',
    };
  }

  /**
   * Helper to handle redirects and extract cookies
   */
  private async getWithRedirects(
    url: string,
    initialCookies?: string,
    maxRedirects = 10
  ): Promise<{
    finalResponse: any;
    finalUrl: string;
    cookieHeader: string;
  }> {
    let currentUrl = url;
    let cookieHeader = initialCookies || '';
    let redirectCount = 0;
    let finalResponse: any;

    while (redirectCount < maxRedirects) {
      console.log(`🔄 Following redirect ${redirectCount + 1}: ${currentUrl}`);

      const response = await request(currentUrl, {
        method: 'GET',
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Cookie: cookieHeader,
        },
      });

      finalResponse = response;

      // Merge cookies from this response
      const responseCookies = this.extractCookies(response);
      if (responseCookies) {
        cookieHeader = this.mergeCookies(cookieHeader, responseCookies);
      }

      // Check for redirect
      if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
        const locationHeader = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location;
        if (!locationHeader) {
          throw new Error(
            `Redirect response without location header: ${response.statusCode}`
          );
        }

        // Handle relative URLs
        currentUrl = locationHeader.startsWith('http')
          ? locationHeader
          : new URL(locationHeader, currentUrl).toString();
        redirectCount++;
      } else {
        // No more redirects
        break;
      }
    }

    if (redirectCount >= maxRedirects) {
      throw new Error(`Too many redirects (${maxRedirects})`);
    }

    return {
      finalResponse,
      finalUrl: currentUrl,
      cookieHeader,
    };
  }
}
