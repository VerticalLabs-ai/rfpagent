import { createTool } from '@mastra/core';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageActTool = createTool({
  id: 'page-act',
  description:
    'Take an action on a webpage using Browserbase automation (clicking, typing, navigation)',
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe('URL to navigate to (optional if already on a page)'),
    action: z
      .string()
      .describe(
        'Action to perform (e.g., "click sign in button", "type hello in search field", "navigate to login")'
      ),
    sessionId: z
      .string()
      .optional()
      .describe('Session ID for maintaining browser context'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Whether the action was successful'),
    message: z.string().describe('Result message of the action'),
    currentUrl: z.string().describe('Current URL after the action'),
    actionedAt: z.string().describe('ISO timestamp of the action'),
  }),
  execute: async ({ context }) => {
    const { url, action, sessionId } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    try {
      console.log(`🎭 Performing action: "${action}"`);

      if (url) {
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
      }

      if (action) {
        await page.act({ action });
        console.log(`✅ Successfully performed: ${action}`);
      }

      return {
        success: true,
        message: `Successfully performed: ${action}`,
        currentUrl: page.url(),
        actionedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Stagehand action failed:`, error);
      throw new Error(`Browserbase action failed: ${error.message}`);
    }
  },
});
