import { Stagehand } from '@browserbasehq/stagehand';

// Session manager for consistent Browserbase sessions
export class BrowserbaseSessionManager {
  private sessions: Map<string, Stagehand> = new Map();
  private defaultSessionId = 'default';

  async ensureStagehand(
    sessionId: string = this.defaultSessionId
  ): Promise<Stagehand> {
    let stagehand = this.sessions.get(sessionId);

    if (!stagehand) {
      console.log(`🌐 Creating new Browserbase session: ${sessionId}`);

      stagehand = new Stagehand({
        env: 'BROWSERBASE',
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        verbose: 1,
        modelName: 'google/gemini-2.0-flash-exp', // Use Google Gemini for extraction
        modelClientOptions: {
          apiKey: process.env.GOOGLE_API_KEY,
        },
        browserbaseSessionCreateParams: {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          keepAlive: true,
          timeout: 3600, // 1 hour session timeout
          browserSettings: {
            advancedStealth: false, // Disable advanced stealth to avoid Enterprise plan errors
            solveCaptchas: false, // Disable enterprise features
            blockAds: true,
            recordSession: true,
            logSession: true,
            viewport: {
              width: 1920,
              height: 1080,
            },
          },
          region: 'us-west-2',
        },
      });

      await stagehand.init();
      this.sessions.set(sessionId, stagehand);

      console.log(
        `✅ Browserbase session ${sessionId} initialized successfully`
      );
    }

    return stagehand;
  }

  async closeSession(sessionId: string): Promise<void> {
    const stagehand = this.sessions.get(sessionId);
    if (stagehand) {
      try {
        await stagehand.close();
        this.sessions.delete(sessionId);
        console.log(`🔒 Browserbase session ${sessionId} closed`);
      } catch (error) {
        console.warn(`⚠️ Error closing session ${sessionId}:`, error);
      }
    }
  }

  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
  }
}

export const sessionManager = new BrowserbaseSessionManager();
