import { AuthContext, AuthResult, Credentials } from '../../types';

/**
 * Base authentication strategy interface
 */
export interface AuthenticationStrategy {
  authenticate(context: AuthContext): Promise<AuthResult>;
  validateCredentials(credentials: Credentials): boolean;
  getPortalType(): string;
  canHandle(portalType: string, url: string): boolean;
}

/**
 * Abstract base class for authentication strategies
 */
export abstract class BaseAuthenticationStrategy implements AuthenticationStrategy {
  protected portalType: string;

  constructor(portalType: string) {
    this.portalType = portalType;
  }

  abstract authenticate(context: AuthContext): Promise<AuthResult>;

  /**
   * Basic credential validation
   */
  validateCredentials(credentials: Credentials): boolean {
    return !!(credentials.username && credentials.password);
  }

  /**
   * Get supported portal type
   */
  getPortalType(): string {
    return this.portalType;
  }

  /**
   * Check if this strategy can handle the portal
   */
  canHandle(portalType: string, url: string): boolean {
    return portalType === this.portalType;
  }

  /**
   * Extract cookies from response headers
   */
  protected extractCookies(response: any): string {
    if (!response?.headers?.['set-cookie']) {
      return '';
    }

    const cookies = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie']
      : [response.headers['set-cookie']];

    return cookies
      .map((cookie: string) => cookie.split(';')[0])
      .join('; ');
  }

  /**
   * Merge cookie strings
   */
  protected mergeCookies(...cookieStrings: string[]): string {
    const cookieMap = new Map<string, string>();

    cookieStrings.forEach(cookieString => {
      if (cookieString) {
        cookieString.split(';').forEach(cookie => {
          const [name, value] = cookie.trim().split('=');
          if (name && value) {
            cookieMap.set(name, value);
          }
        });
      }
    });

    return Array.from(cookieMap.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  /**
   * Redact sensitive information for logging
   */
  protected redactSensitiveInfo(data: any): any {
    if (typeof data === 'string') {
      // Redact common password patterns
      return data.replace(/password[^&]*=[^&]*/gi, 'password=***')
                 .replace(/pass[^&]*=[^&]*/gi, 'pass=***')
                 .replace(/pwd[^&]*=[^&]*/gi, 'pwd=***');
    }

    if (typeof data === 'object' && data !== null) {
      const redacted = { ...data };
      Object.keys(redacted).forEach(key => {
        if (key.toLowerCase().includes('password') ||
            key.toLowerCase().includes('secret') ||
            key.toLowerCase().includes('token')) {
          redacted[key] = '***';
        }
      });
      return redacted;
    }

    return data;
  }

  /**
   * Handle common authentication errors
   */
  protected handleAuthError(error: any, context: string): AuthResult {
    console.error(`❌ Authentication error in ${context}:`, error);

    let errorMessage = 'Authentication failed';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    return {
      success: false,
      sessionId: '',
      error: errorMessage
    };
  }
}