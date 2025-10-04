import { createTool } from '@mastra/core';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageExtractTool = createTool({
  id: 'page-extract',
  description:
    'Extract structured data from a webpage using Browserbase automation',
  inputSchema: z.object({
    url: z
      .string()
      .optional()
      .describe('URL to navigate to (optional if already on a page)'),
    instruction: z
      .string()
      .describe(
        'What to extract (e.g., "extract all RFP titles and deadlines", "get form data")'
      ),
    schema: z
      .record(z.any())
      .optional()
      .describe('Zod schema definition for data extraction'),
    sessionId: z
      .string()
      .optional()
      .describe('Session ID for maintaining browser context'),
  }),
  execute: async ({ context }) => {
    const { url, instruction, schema, sessionId } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    try {
      console.log(`📊 Extracting: "${instruction}"`);

      if (url) {
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
      }

      // Default schema for RFP extraction
      const defaultSchema = z.object({
        title: z.string().describe('RFP title or opportunity name'),
        deadline: z.string().optional().describe('Submission deadline'),
        agency: z
          .string()
          .optional()
          .describe('Issuing agency or organization'),
        description: z
          .string()
          .optional()
          .describe('RFP description or summary'),
        value: z.string().optional().describe('Contract value or budget'),
        url: z.string().optional().describe('Link to full RFP details'),
      });

      // Use provided schema or default, but don't double-wrap
      const extractionSchema = schema ? z.object(schema) : defaultSchema;
      const extractedData = await page.extract({
        instruction,
        schema: extractionSchema,
      });

      console.log(`✅ Successfully extracted data for: ${instruction}`);

      const [currentUrl, pageTitle] = await Promise.all([
        page.url(),
        page.title(),
      ]);

      return {
        data: extractedData,
        currentUrl,
        pageTitle,
        extractedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Stagehand extraction failed:`, error);
      throw new Error(`Browserbase extraction failed: ${error.message}`);
    }
  },
});
