import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageNavigateTool = createTool({
  id: 'page-navigate',
  description: 'Navigate to a webpage using Browserbase automation',
  inputSchema: z.object({
    url: z.string().describe('URL to navigate to'),
    sessionId: z
      .string()
      .optional()
      .describe('Session ID for maintaining browser context'),
    waitFor: z
      .enum(['load', 'domcontentloaded', 'networkidle'])
      .optional()
      .default('domcontentloaded')
      .describe('Wait condition after navigation'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Whether navigation was successful'),
    currentUrl: z.string().describe('Current URL after navigation'),
    pageTitle: z.string().describe('Title of the loaded page'),
    navigatedAt: z.string().describe('ISO timestamp of navigation'),
  }),
  execute: async ({ context }) => {
    const { url, sessionId, waitFor } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = await sessionManager.getPage(sessionId);

    try {
      console.log(`🌐 Navigating to: ${url}`);

      await page.goto(url);
      await page.waitForLoadState(waitFor);

      // Handle Cloudflare protection if present
      const pageTitle = await page.title();
      if (
        pageTitle.includes('Just a moment') ||
        pageTitle.includes('Please wait')
      ) {
        console.log(`🛡️ Cloudflare protection detected, waiting for bypass...`);
        await page.waitForLoadState('networkidle', 30000);
      }

      const currentUrl = await page.url();
      const finalTitle = await page.title();

      console.log(`✅ Successfully navigated to: ${currentUrl}`);

      return {
        success: true,
        currentUrl,
        pageTitle: finalTitle,
        navigatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Page navigation failed:`, error);
      throw new Error(`Browserbase navigation failed: ${error.message}`);
    }
  },
});
