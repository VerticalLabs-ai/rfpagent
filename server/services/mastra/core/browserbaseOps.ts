/**
 * Browserbase Operations for Mastra Scraping Service
 *
 * Unified Browserbase automation for web scraping, authentication, and content extraction
 */

import { z } from 'zod';
import { logger } from '../../../utils/logger';
import {
  executeStagehandTool,
  StagehandActionResultSchema,
  StagehandAuthResultSchema,
  StagehandExtractionResultSchema,
} from '../../scraping/utils/stagehand';
import {
  stagehandActTool,
  stagehandAuthTool,
  stagehandExtractTool,
} from '../../../../src/mastra/tools';

/**
 * Unified Browserbase web scraping with optional authentication
 * Handles the complete flow: auth (if needed) -> navigation -> extraction
 */
export async function unifiedBrowserbaseWebScrape(
  context: any
): Promise<any> {
  const {
    url,
    loginRequired,
    credentials,
    portalType,
    searchFilter,
    sessionId = 'default',
  } = context;

  try {
    console.log(`🌐 Starting unified Browserbase scrape of ${url}`);

    // Handle authentication if required
    if (loginRequired && credentials?.username && credentials?.password) {
      console.log(`🔐 Authentication required for portal: ${portalType}`);

      const authResult = await executeStagehandTool(
        stagehandAuthTool,
        {
          loginUrl: String(url),
          username: String(credentials.username),
          password: String(credentials.password),
          targetUrl: String(url),
          sessionId: String(sessionId),
          portalType: typeof portalType === 'string' ? portalType : 'generic',
        },
        StagehandAuthResultSchema
      );

      if (!authResult.success) {
        throw new Error(
          `Authentication failed: ${authResult.message || 'Unknown error'}`
        );
      }

      console.log(`✅ Authentication successful for ${portalType}`);
    }

    // Extract RFP opportunities using Browserbase
    const extractionResult = await executeStagehandTool(
      stagehandExtractTool,
      {
        url: String(url), // CRITICAL: Navigate to the portal URL before extraction
        instruction: searchFilter
          ? `find and extract RFP opportunities related to "${searchFilter}" including titles, deadlines, agencies, descriptions, and links`
          : 'extract all RFP opportunities, procurement notices, and solicitations with their complete details',
        sessionId: String(sessionId),
        schema: {
          opportunities: z
            .array(
              z.object({
                title: z.string().describe('RFP title or opportunity name'),
                description: z
                  .string()
                  .optional()
                  .describe('Description or summary'),
                agency: z.string().optional().describe('Issuing agency'),
                deadline: z
                  .string()
                  .optional()
                  .describe('Submission deadline'),
                estimatedValue: z
                  .string()
                  .optional()
                  .describe('Contract value'),
                url: z.string().optional().describe('Link to details'),
                category: z.string().optional().describe('Category or type'),
                confidence: z
                  .number()
                  .min(0)
                  .max(1)
                  .default(0.8)
                  .describe('Extraction confidence'),
              })
            )
            .describe('Array of extracted RFP opportunities'),
        },
      },
      StagehandExtractionResultSchema
    );

    // Debug logging with bounded output - only logs when LOG_LEVEL=debug
    logger.debug('Extraction result structure', {
      hasResult: !!extractionResult,
      resultKeys: extractionResult ? Object.keys(extractionResult) : null,
      dataType: extractionResult?.data
        ? typeof extractionResult.data
        : 'undefined',
      dataKeys: extractionResult?.data
        ? Object.keys(extractionResult.data)
        : null,
      opportunitiesCount:
        extractionResult?.opportunities?.length ??
        extractionResult?.data?.opportunities?.length ??
        0,
      // Truncated preview of extraction result (first 500 chars)
      resultPreview:
        JSON.stringify(extractionResult).slice(0, 500) +
        (JSON.stringify(extractionResult).length > 500
          ? '... (truncated)'
          : ''),
    });

    const opportunities =
      extractionResult.opportunities ??
      extractionResult.data?.opportunities ??
      [];
    logger.info('Successfully extracted opportunities', {
      url,
      opportunitiesCount: opportunities.length,
      portalType,
    });

    return {
      opportunities,
      status: 'success',
      message: `Successfully extracted ${opportunities.length} opportunities using Browserbase`,
      portalType,
      scrapedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('Unified Browserbase scrape failed', error as Error, {
      url,
    });
    return {
      opportunities: [],
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Handle portal authentication using unified Browserbase automation
 */
export async function handleBrowserbaseAuthentication(
  context: any
): Promise<any> {
  const {
    portalUrl,
    username,
    password,
    authContext,
    sessionId,
    portalType,
  } = context;

  try {
    console.log(
      `🔐 Starting Browserbase authentication for ${
        portalType || 'generic'
      } portal`
    );

    const authResult = await executeStagehandTool(
      stagehandAuthTool,
      {
        loginUrl: String(portalUrl),
        username: String(username),
        password: String(password),
        targetUrl: String(portalUrl),
        sessionId: String(sessionId ?? 'default'),
        portalType: typeof portalType === 'string' ? portalType : 'generic',
      },
      StagehandAuthResultSchema
    );

    if (authResult.success) {
      console.log(`✅ Browserbase authentication successful`);
      return {
        success: true,
        sessionId: authResult.sessionId ?? String(sessionId ?? 'default'),
        message: 'Portal authentication completed successfully',
        authenticatedAt: new Date().toISOString(),
      };
    } else {
      throw new Error(authResult.message || 'Authentication failed');
    }
  } catch (error) {
    console.error(`❌ Browserbase authentication failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Scrape content from a URL using Browserbase with intelligent RFP detection
 * Returns full page content including dynamically loaded elements
 */
export async function scrapeBrowserbaseContent(
  url: string,
  sessionId: string,
  instruction?: string
): Promise<string> {
  try {
    console.log(`🌐 Scraping content from ${url} using Browserbase`);

    // Navigate to the page using official Browserbase tools
    await executeStagehandTool(
      stagehandActTool,
      {
        url: String(url),
        action:
          'navigate to the page and wait for all content including JavaScript to load completely',
        sessionId: String(sessionId),
      },
      StagehandActionResultSchema
    );

    // Wait for dynamic content to load
    await executeStagehandTool(
      stagehandActTool,
      {
        action:
          'wait for any dynamic content, tables, or RFP listings to finish loading',
        sessionId: String(sessionId),
      },
      StagehandActionResultSchema
    );

    // Extract the page content using Browserbase with intelligent RFP detection
    const extractionResult = await executeStagehandTool(
      stagehandExtractTool,
      {
        instruction:
          instruction ||
          'extract all page content including RFP listings, procurement opportunities, and solicitation notices with their titles, deadlines, agencies, and descriptions',
        sessionId: String(sessionId),
        schema: {
          fullContent: z.string().describe('Complete page HTML content'),
          pageTitle: z.string().describe('Page title'),
          opportunities: z
            .array(
              z.object({
                title: z.string().describe('Opportunity title or RFP name'),
                deadline: z
                  .string()
                  .optional()
                  .describe('Submission deadline'),
                agency: z
                  .string()
                  .optional()
                  .describe('Issuing agency or organization'),
                description: z
                  .string()
                  .optional()
                  .describe('RFP description or summary'),
                estimatedValue: z
                  .string()
                  .optional()
                  .describe('Contract value or budget amount'),
                url: z
                  .string()
                  .optional()
                  .describe('Link to full RFP details'),
                category: z
                  .string()
                  .optional()
                  .describe('RFP category or type'),
              })
            )
            .optional()
            .describe('Extracted RFP opportunities if found on page'),
        },
      },
      StagehandExtractionResultSchema
    );

    const extractedData =
      extractionResult.data ??
      ({
        opportunities: extractionResult.opportunities ?? [],
        pageTitle: extractionResult.pageTitle,
        fullContent: undefined,
      } as z.infer<typeof StagehandExtractionResultSchema>['data']);
    const opportunities = extractedData?.opportunities ?? [];

    console.log(
      `✅ Successfully extracted content using Browserbase - Found ${
        opportunities.length
      } opportunities`
    );

    // Return the full content for further processing, but also log the structured data
    if (opportunities.length > 0) {
      console.log(
        `🎯 Structured opportunities extracted:`,
        opportunities.map(opp => ({
          title: opp.title,
          deadline: opp.deadline,
          agency: opp.agency,
        }))
      );
    }

    return (
      extractedData?.fullContent ||
      JSON.stringify({
        ...extractedData,
        opportunities,
      })
    );
  } catch (error) {
    console.error(
      `❌ Browserbase scraping failed for ${url}:`,
      error instanceof Error ? error.message : String(error)
    );
    throw new Error(
      `Browserbase content scraping failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
