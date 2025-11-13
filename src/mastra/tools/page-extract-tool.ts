import { createTool } from '@mastra/core/tools';
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
      .union([
        z.record(z.string(), z.any()), // Plain object field map
        z.instanceof(z.ZodObject), // Pre-built Zod object
      ])
      .optional()
      .describe(
        'Zod schema definition for data extraction - accepts either a plain object field map or a pre-built ZodObject'
      ),
    sessionId: z
      .string()
      .optional()
      .describe('Session ID for maintaining browser context'),
  }),
  outputSchema: z.object({
    data: z.any().describe('Extracted data matching the provided schema'),
    currentUrl: z.string().describe('Current URL where data was extracted'),
    pageTitle: z.string().describe('Title of the page'),
    extractedAt: z.string().describe('ISO timestamp of extraction'),
  }),
  execute: async ({ context }) => {
    const { url, instruction, schema, sessionId } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = await sessionManager.getPage(sessionId);

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

      // Determine the extraction schema based on input type
      let extractionSchema: any;
      if (!schema) {
        // No schema provided, use default
        extractionSchema = defaultSchema;
      } else if (schema instanceof z.ZodObject) {
        // Pre-built Zod object, use as-is
        extractionSchema = schema;
      } else if (typeof schema === 'object' && schema !== null) {
        // Plain object field map, wrap with z.object()
        extractionSchema = z.object(schema);
      } else {
        // Fallback to default if schema format is unexpected
        console.warn('Unexpected schema format, using default schema');
        extractionSchema = defaultSchema;
      }
      const extractedData = await stagehand.extract(instruction, extractionSchema);

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
