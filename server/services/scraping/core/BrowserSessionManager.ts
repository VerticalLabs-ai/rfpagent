import { BrowserSession, ScrapingError } from '../types';

export class BrowserSessionManager {
  private sessions: Map<string, BrowserSession> = new Map();
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    // Clean up expired sessions every 5 minutes
    setInterval(() => this.cleanupExpiredSessions(), 5 * 60 * 1000);
  }

  /**
   * Create a new browser session for a portal
   */
  async createSession(portalType: string): Promise<string> {
    const sessionId = this.generateSessionId();
    const session: BrowserSession = {
      id: sessionId,
      portalType,
      isAuthenticated: false,
      createdAt: new Date(),
      lastUsed: new Date(),
    };

    this.sessions.set(sessionId, session);
    console.log(
      `🔧 Created browser session ${sessionId} for portal type: ${portalType}`
    );

    return sessionId;
  }

  /**
   * Get an existing browser session
   */
  async getSession(sessionId: string): Promise<BrowserSession> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      throw new ScrapingError(
        `Session ${sessionId} not found`,
        'SESSION_NOT_FOUND'
      );
    }

    if (this.isSessionExpired(session)) {
      this.sessions.delete(sessionId);
      throw new ScrapingError(
        `Session ${sessionId} has expired`,
        'SESSION_EXPIRED'
      );
    }

    // Update last used timestamp
    session.lastUsed = new Date();
    return session;
  }

  /**
   * Update session with authentication data
   */
  async updateSessionAuth(
    sessionId: string,
    authData: {
      cookies?: string;
      authToken?: string;
      isAuthenticated: boolean;
    }
  ): Promise<void> {
    const session = await this.getSession(sessionId);

    session.cookies = authData.cookies;
    session.authToken = authData.authToken;
    session.isAuthenticated = authData.isAuthenticated;
    session.lastUsed = new Date();

    console.log(`🔐 Updated authentication for session ${sessionId}`);
  }

  /**
   * Close and cleanup a browser session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      console.log(`🔒 Closed browser session ${sessionId}`);
    }
  }

  /**
   * Get all active sessions for a portal type
   */
  getActiveSessionsForPortal(portalType: string): BrowserSession[] {
    return Array.from(this.sessions.values()).filter(
      session =>
        session.portalType === portalType && !this.isSessionExpired(session)
    );
  }

  /**
   * Check if session is authenticated
   */
  isSessionAuthenticated(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    return session?.isAuthenticated ?? false;
  }

  /**
   * Get session cookies for browser automation
   */
  getSessionCookies(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.cookies;
  }

  /**
   * Get session auth token
   */
  getSessionAuthToken(sessionId: string): string | undefined {
    const session = this.sessions.get(sessionId);
    return session?.authToken;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): void {
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isSessionExpired(session)) {
        expiredSessions.push(sessionId);
      }
    }

    expiredSessions.forEach(sessionId => {
      this.sessions.delete(sessionId);
      console.log(`🧹 Cleaned up expired session ${sessionId}`);
    });

    if (expiredSessions.length > 0) {
      console.log(`🧹 Cleaned up ${expiredSessions.length} expired sessions`);
    }
  }

  /**
   * Check if session has expired
   */
  private isSessionExpired(session: BrowserSession): boolean {
    const now = new Date().getTime();
    const sessionTime = session.lastUsed.getTime();
    return now - sessionTime > this.sessionTimeout;
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get session statistics
   */
  getSessionStats(): {
    total: number;
    authenticated: number;
    byPortalType: Record<string, number>;
  } {
    const sessions = Array.from(this.sessions.values());
    const byPortalType: Record<string, number> = {};

    sessions.forEach(session => {
      byPortalType[session.portalType] =
        (byPortalType[session.portalType] || 0) + 1;
    });

    return {
      total: sessions.length,
      authenticated: sessions.filter(s => s.isAuthenticated).length,
      byPortalType,
    };
  }
}
