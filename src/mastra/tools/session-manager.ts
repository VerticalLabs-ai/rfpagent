import { Stagehand } from '@browserbasehq/stagehand';

// Stagehand's Page type doesn't fully expose all Playwright Page methods in TypeScript
// At runtime, this IS a Playwright Page with all standard methods like content(), goto(), etc.
// We define an interface that includes the methods we need for type safety
export interface PageWithContent {
  goto(url: string, options?: any): Promise<any>;
  waitForLoadState(state?: string, options?: any): Promise<void>;
  content(): Promise<string>;
  [key: string]: any; // Allow other Playwright Page methods
}

// Session manager for consistent Browserbase sessions
export class BrowserbaseSessionManager {
  private sessions: Map<string, Stagehand> = new Map();
  private browserbaseSessionIds: Map<string, string> = new Map(); // Track BB session IDs
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
        // V3 API: model configuration moved to method calls
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

      // Enable download behavior for this session
      await this.enableDownloadBehavior(stagehand);

      this.sessions.set(sessionId, stagehand);

      // Store the Browserbase session ID from the initialized stagehand
      // The browserbaseSessionId property is available after init()
      const bbSessionId = (stagehand as any).browserbaseSessionId;

      if (bbSessionId) {
        this.browserbaseSessionIds.set(sessionId, bbSessionId);
        console.log(`📌 Browserbase session ID stored: ${bbSessionId}`);
      }

      console.log(
        `✅ Browserbase session ${sessionId} initialized with downloads enabled`
      );
    }

    return stagehand;
  }

  // V3 API: Helper to get the page object from context
  // Returns Playwright Page object from Stagehand's BrowserContext
  // At runtime this is a full Playwright Page, but we type it with our interface for safety
  async getPage(
    sessionId: string = this.defaultSessionId
  ): Promise<PageWithContent> {
    const stagehand = await this.ensureStagehand(sessionId);
    const pages = await stagehand.context.pages();

    // Defensive check: ensure pages array is not empty
    if (!pages || pages.length === 0) {
      console.log(
        `📄 No pages found for session ${sessionId}, creating new page`
      );
      const newPage = await stagehand.context.newPage();
      return newPage as unknown as PageWithContent;
    }

    return pages[0] as unknown as PageWithContent; // Runtime is Playwright Page
  }

  // V3 API: Helper to get both stagehand and page
  async getStagehandAndPage(
    sessionId: string = this.defaultSessionId
  ): Promise<{ stagehand: Stagehand; page: PageWithContent }> {
    const stagehand = await this.ensureStagehand(sessionId);
    const pages = await stagehand.context.pages();

    // Defensive check: ensure pages array is not empty
    if (!pages || pages.length === 0) {
      console.log(
        `📄 No pages found for session ${sessionId}, creating new page`
      );
      const newPage = await stagehand.context.newPage();
      return { stagehand, page: newPage as unknown as PageWithContent };
    }

    return { stagehand, page: pages[0] as unknown as PageWithContent };
  }

  /**
   * Get the Browserbase session ID for a given local session
   * Required for accessing Browserbase cloud features like downloads
   */
  getBrowserbaseSessionId(sessionId: string = this.defaultSessionId): string | undefined {
    return this.browserbaseSessionIds.get(sessionId);
  }

  /**
   * Enable download behavior for a Stagehand session
   * This allows files downloaded during browser automation to be saved
   * to Browserbase's cloud storage for later retrieval
   *
   * @private
   */
  private async enableDownloadBehavior(stagehand: Stagehand): Promise<void> {
    try {
      const pages = await stagehand.context.pages();
      if (pages.length === 0) {
        console.log('⚠️ No pages available for download behavior setup');
        return;
      }

      const page = pages[0];

      // Create CDP session using type assertion since Playwright types may not expose this
      // At runtime, this is a Playwright Page with full CDP support
      const pageAny = page as any;
      if (!pageAny.context || typeof pageAny.context !== 'function') {
        console.warn('⚠️ Page context method not available');
        return;
      }

      const context = pageAny.context();
      const client = await context.newCDPSession(page);

      await client.send('Browser.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: 'downloads',
        eventsEnabled: true,
      });

      console.log('📥 Download behavior enabled for session');
    } catch (error) {
      console.warn('⚠️ Failed to enable download behavior:', error);
      // Non-fatal - session can still be used for scraping
    }
  }

  async closeSession(sessionId: string): Promise<void> {
    const stagehand = this.sessions.get(sessionId);
    if (stagehand) {
      try {
        await stagehand.close();
        this.sessions.delete(sessionId);
        this.browserbaseSessionIds.delete(sessionId); // Clean up BB session ID
        console.log(`🔒 Browserbase session ${sessionId} closed`);
      } catch (error) {
        console.warn(`⚠️ Error closing session ${sessionId}:`, error);
      }
    }
  }

  async cleanupSession(sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.closeSession(sessionId);
      return;
    }
    await this.cleanup();
  }

  async cleanup(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
  }
}

export const sessionManager = new BrowserbaseSessionManager();
