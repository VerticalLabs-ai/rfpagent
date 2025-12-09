import { BrowserbaseSessionManager } from '../../src/mastra/tools/session-manager';

// Skip this test if no Browserbase credentials (will run in CI with proper setup)
const describeIfBrowserbase = process.env.BROWSERBASE_API_KEY ? describe : describe.skip;

describe('BrowserbaseSessionManager', () => {
  describe('getBrowserbaseSessionId', () => {
    it('should return undefined for non-existent session', () => {
      const manager = new BrowserbaseSessionManager();
      const bbSessionId = manager.getBrowserbaseSessionId('non-existent');
      expect(bbSessionId).toBeUndefined();
    });

    it('should have getBrowserbaseSessionId method', () => {
      const manager = new BrowserbaseSessionManager();
      expect(typeof manager.getBrowserbaseSessionId).toBe('function');
    });
  });

  // Only run this test if Browserbase credentials are available
  describeIfBrowserbase('with Browserbase credentials', () => {
    let manager: BrowserbaseSessionManager;

    beforeEach(() => {
      manager = new BrowserbaseSessionManager();
    });

    afterEach(async () => {
      // Cleanup any sessions created during tests
      await manager.cleanup();
    });

    it('should return the Browserbase session ID for an active session', async () => {
      const localSessionId = 'test-session-' + Date.now();

      // Initialize session
      await manager.ensureStagehand(localSessionId);

      // Get Browserbase session ID
      const bbSessionId = manager.getBrowserbaseSessionId(localSessionId);

      // Verify it's defined and a string
      expect(bbSessionId).toBeDefined();
      expect(typeof bbSessionId).toBe('string');
      expect(bbSessionId!.length).toBeGreaterThan(0);

      // Cleanup
      await manager.closeSession(localSessionId);

      // After closing, ID should be removed
      const bbSessionIdAfterClose = manager.getBrowserbaseSessionId(localSessionId);
      expect(bbSessionIdAfterClose).toBeUndefined();
    }, 60000); // 60 second timeout for this integration test

    it('should enable download behavior after session initialization', async () => {
      const localSessionId = 'download-test-' + Date.now();

      // Initialize session - this should enable download behavior
      const stagehand = await manager.ensureStagehand(localSessionId);

      // Verify session was created
      expect(stagehand).toBeDefined();

      // Verify Browserbase session ID was stored (required for downloads)
      const bbSessionId = manager.getBrowserbaseSessionId(localSessionId);
      expect(bbSessionId).toBeDefined();
      expect(typeof bbSessionId).toBe('string');

      // The download behavior should have been enabled during init
      // We can't directly test CDP calls, but we can verify the session is ready
      const pages = await stagehand.context.pages();
      expect(pages.length).toBeGreaterThan(0);

      // Cleanup
      await manager.closeSession(localSessionId);
    }, 60000);
  });
});
