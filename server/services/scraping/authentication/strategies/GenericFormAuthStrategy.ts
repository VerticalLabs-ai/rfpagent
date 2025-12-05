import { BaseAuthenticationStrategy } from './AuthenticationStrategy';
import type { AuthContext, AuthResult } from '../../types';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Generic form-based authentication strategy
 * Handles standard login forms for most portals
 */
export class GenericFormAuthStrategy extends BaseAuthenticationStrategy {
  constructor() {
    super('generic');
  }

  canHandle(): boolean {
    // This is the fallback strategy for any portal that's not specifically handled
    return true;
  }

  async authenticate(context: AuthContext): Promise<AuthResult> {
    try {
      console.log(
        `🔐 Starting generic form authentication for: ${context.portalUrl}`
      );

      // Step 1: Analyze the login page
      const loginPageAnalysis = await this.analyzeLoginPage(context.portalUrl);

      if (!loginPageAnalysis.success) {
        return {
          success: false,
          sessionId: context.sessionId,
          error: loginPageAnalysis.error || 'Failed to analyze login page',
        };
      }

      // Step 2: Submit credentials
      const authResult = await this.submitCredentials(
        context,
        loginPageAnalysis.formData!,
        loginPageAnalysis.cookies!
      );

      return authResult;
    } catch (error) {
      return this.handleAuthError(error, 'GenericFormAuthStrategy');
    }
  }

  /**
   * Analyze login page to detect authentication method and extract form data
   */
  private async analyzeLoginPage(url: string): Promise<{
    success: boolean;
    authMethod?: string;
    formData?: any;
    cookies?: string;
    error?: string;
  }> {
    try {
      // Fetch login page with proper headers
      const axiosResponse = await axios.get(url, {
        headers: {
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        validateStatus: status => status < 500,
      });

      const response = {
        statusCode: axiosResponse.status,
        headers: axiosResponse.headers as any,
        body: { text: async () => axiosResponse.data },
      };

      if (response.statusCode >= 400) {
        return {
          success: false,
          error: `HTTP ${response.statusCode} when accessing login page`,
        };
      }

      const html = await response.body.text();
      const $ = cheerio.load(html);
      const cookies = this.extractCookies(response);

      // Detect authentication method
      const authMethod = this.detectAuthenticationMethod($);

      if (authMethod.type === 'none') {
        return {
          success: true,
          authMethod: 'no_auth_required',
          cookies,
        };
      }

      if (authMethod.type === 'unsupported') {
        return {
          success: false,
          error: `Unsupported authentication method: ${authMethod.details}`,
        };
      }

      if (authMethod.type === 'browser_required') {
        return {
          success: false,
          error: `Browser automation required: ${authMethod.details}`,
        };
      }

      if (authMethod.type === 'form') {
        return {
          success: true,
          authMethod: 'form',
          formData: authMethod.formData,
          cookies,
        };
      }

      return {
        success: false,
        error: `Unknown authentication method: ${authMethod.type}`,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to analyze login page',
      };
    }
  }

  /**
   * Detect authentication method from page content
   */
  private detectAuthenticationMethod($: cheerio.CheerioAPI): {
    type: string;
    details?: string;
    formData?: any;
  } {
    // Check for common authentication patterns
    const forms = $('form');

    if (forms.length === 0) {
      return { type: 'none', details: 'No forms found on page' };
    }

    // Look for login forms
    const loginForm = forms.filter((_, form) => {
      const $form = $(form);
      const action = $form.attr('action') || '';
      const id = $form.attr('id') || '';
      const className = $form.attr('class') || '';

      return (
        action.includes('login') ||
        action.includes('auth') ||
        id.includes('login') ||
        id.includes('auth') ||
        className.includes('login') ||
        className.includes('auth')
      );
    });

    if (loginForm.length > 0) {
      const $form = loginForm.first();
      const formData = this.extractFormData($form);

      if (formData) {
        return { type: 'form', formData };
      }
    }

    // Check for OAuth or other authentication methods that require browser automation
    if ($('a[href*="oauth"], a[href*="sso"], a[href*="saml"]').length > 0) {
      return {
        type: 'browser_required',
        details: 'OAuth/SSO authentication detected',
      };
    }

    // Check for complex authentication indicators
    const complexAuthIndicators = [
      'data-toggle="modal"',
      'javascript:',
      'onclick=',
      '.modal',
      '#modal',
    ];

    for (const indicator of complexAuthIndicators) {
      if ($.html().includes(indicator)) {
        return {
          type: 'browser_required',
          details: 'Complex authentication detected',
        };
      }
    }

    // Check if any form looks like it could be a login form
    const potentialLoginForm = forms.first();
    if (potentialLoginForm.length > 0) {
      const formData = this.extractFormData(potentialLoginForm);
      if (formData && this.hasPasswordField(potentialLoginForm)) {
        return { type: 'form', formData };
      }
    }

    return {
      type: 'unsupported',
      details: 'No recognizable authentication method found',
    };
  }

  /**
   * Extract form data from a form element
   */
  private extractFormData($form: cheerio.Cheerio<cheerio.Element>): any {
    const action = $form.attr('action');
    const method = $form.attr('method') || 'POST';

    if (!action) {
      return null;
    }

    const inputs = $form.find('input');
    const fields: Record<string, any> = {};
    const $ = cheerio.load($form.toString());

    inputs.each((_, input) => {
      const $input = $(input);
      const name = $input.attr('name');
      const type = $input.attr('type') || 'text';
      const value = $input.attr('value') || '';

      if (name) {
        fields[name] = {
          type,
          value,
          required: $input.attr('required') !== undefined,
        };
      }
    });

    return {
      action: action.startsWith('http')
        ? action
        : new URL(
            action,
            $form.closest('html').find('base').attr('href') || ''
          ).toString(),
      method: method.toUpperCase(),
      fields,
    };
  }

  /**
   * Check if form has a password field
   */
  private hasPasswordField($form: cheerio.Cheerio<cheerio.Element>): boolean {
    return $form.find('input[type="password"]').length > 0;
  }

  /**
   * Submit credentials to the login form
   */
  private async submitCredentials(
    context: AuthContext,
    formData: any,
    cookies: string
  ): Promise<AuthResult> {
    try {
      // Build form payload
      const payload: Record<string, string> = {};

      // Map credentials to form fields
      Object.entries(formData.fields).forEach(
        ([fieldName, fieldInfo]: [string, any]) => {
          const lowerFieldName = fieldName.toLowerCase();

          if (
            lowerFieldName.includes('user') ||
            lowerFieldName.includes('email') ||
            lowerFieldName.includes('login')
          ) {
            payload[fieldName] = context.username;
          } else if (
            lowerFieldName.includes('pass') ||
            fieldInfo.type === 'password'
          ) {
            payload[fieldName] = context.password;
          } else if (fieldInfo.value) {
            // Include hidden fields and CSRF tokens
            payload[fieldName] = fieldInfo.value;
          }
        }
      );

      console.log(`📤 Submitting form to: ${formData.action}`);
      console.log(`📋 Form fields:`, this.redactSensitiveInfo(payload));

      // Submit login form
      const loginAxiosResponse = await axios({
        method: formData.method,
        url: formData.action,
        data: new URLSearchParams(payload).toString(),
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: context.portalUrl,
          Cookie: cookies,
        },
        maxRedirects: 0,
        validateStatus: status => status >= 200 && status < 400,
      });

      const loginResponse = {
        statusCode: loginAxiosResponse.status,
        headers: loginAxiosResponse.headers as any,
        body: { text: async () => loginAxiosResponse.data },
      };

      // Extract new cookies from login response
      const sessionCookies = this.extractCookies(loginResponse);
      const allCookies = this.mergeCookies(cookies, sessionCookies);

      // Check if login was successful
      const isSuccessful = await this.validateLoginSuccess(loginResponse);

      if (isSuccessful) {
        console.log(`✅ Generic form authentication successful`);
        return {
          success: true,
          sessionId: context.sessionId,
          cookies: allCookies,
        };
      } else {
        console.log(
          `❌ Generic form authentication failed - still on login page`
        );
        return {
          success: false,
          sessionId: context.sessionId,
          error:
            'Authentication failed - invalid credentials or form submission error',
        };
      }
    } catch (error) {
      return this.handleAuthError(error, 'submitCredentials');
    }
  }

  /**
   * Validate if login was successful
   */
  private async validateLoginSuccess(loginResponse: any): Promise<boolean> {
    try {
      // Check for redirect (common for successful logins)
      if ([301, 302, 303, 307, 308].includes(loginResponse.statusCode)) {
        const location = loginResponse.headers.location;
        if (
          location &&
          !location.includes('login') &&
          !location.includes('auth')
        ) {
          return true; // Redirected away from login page
        }
      }

      // Check response content for login indicators
      if (loginResponse.statusCode === 200) {
        const responseHtml = await loginResponse.body.text();
        const $response = cheerio.load(responseHtml);

        // Look for login forms (absence indicates success)
        const hasLoginForm =
          $response('form').filter((_, form) => {
            const $form = $response(form);
            const action = $form.attr('action') || '';
            return action.includes('login') || action.includes('auth');
          }).length > 0;

        // Look for error messages
        const hasErrorMessage =
          $response('.error, .alert-danger, .login-error, [class*="error"]')
            .length > 0;

        // Look for success indicators
        const hasSuccessIndicators =
          $response('.dashboard, .welcome, .logout, [href*="logout"]').length >
          0;

        return (!hasLoginForm && !hasErrorMessage) || hasSuccessIndicators;
      }

      return false;
    } catch (error) {
      console.warn('⚠️ Error validating login success:', error);
      return false;
    }
  }
}
