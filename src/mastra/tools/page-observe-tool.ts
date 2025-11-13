import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageObserveTool = createTool({
  id: 'page-observe',
  description:
    'Observe elements on a webpage using Browserbase to plan actions and understand page structure',
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe('URL to navigate to (optional if already on a page)'),
    instruction: z
      .string()
      .describe(
        'What to observe (e.g., "find all RFP listings", "locate login form fields")'
      ),
    sessionId: z
      .string()
      .optional()
      .describe('Session ID for maintaining browser context'),
  }),
  outputSchema: z.object({
    observations: z
      .array(z.any())
      .describe('Array of observed elements or data'),
    currentUrl: z.string().describe('Current URL where observations were made'),
    pageTitle: z.string().describe('Title of the page'),
    observedAt: z.string().describe('ISO timestamp of observation'),
  }),
  execute: async ({ context }) => {
    const { url, instruction, sessionId } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = await sessionManager.getPage(sessionId);

    try {
      console.log(`🔍 Observing: "${instruction}"`);

      if (url) {
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
      }

      const observations = await stagehand.observe(instruction);
      console.log(
        `✅ Found ${observations.length} observations for: ${instruction}`
      );

      const [currentUrl, pageTitle] = await Promise.all([
        page.url(),
        page.title(),
      ]);

      return {
        observations,
        currentUrl,
        pageTitle,
        observedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Stagehand observation failed:`, error);
      throw new Error(`Browserbase observation failed: ${error.message}`);
    }
  },
});
