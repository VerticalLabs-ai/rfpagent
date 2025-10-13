/**
 * Tool Factory for Mastra Scraping Service
 *
 * Creates Mastra tools for web scraping, RFP extraction, and authentication
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/**
 * Execution function types for tools
 */
export interface ToolExecutors {
  unifiedBrowserbaseWebScrape: (context: any) => Promise<any>;
  extractRFPData: (context: any) => Promise<any>;
  handleBrowserbaseAuthentication: (context: any) => Promise<any>;
}

/**
 * Create a web scraping tool
 * Uses unified Browserbase automation for web scraping
 */
export function createWebScrapingTool(executors: ToolExecutors) {
  return createTool({
    id: 'web-scrape',
    description:
      'Scrape a website for RFP opportunities using unified Browserbase automation',
    inputSchema: z.object({
      url: z.string().describe('URL to scrape'),
      loginRequired: z.boolean().describe('Whether login is required'),
      credentials: z
        .object({
          username: z.string().optional(),
          password: z.string().optional(),
        })
        .optional()
        .describe('Login credentials if required'),
      portalType: z
        .string()
        .describe('Type of portal (bonfire, sam.gov, etc.)'),
      searchFilter: z
        .string()
        .optional()
        .describe(
          'Search filter to apply during scraping - only return opportunities related to this term'
        ),
      sessionId: z
        .string()
        .optional()
        .describe('Session ID for maintaining browser context'),
    }),
    execute: async ({ context }) => {
      // Use unified Browserbase automation through official Mastra integration
      return await executors.unifiedBrowserbaseWebScrape(context);
    },
  });
}

/**
 * Create an RFP extraction tool
 * Extracts structured RFP data from web content using AI
 */
export function createRFPExtractionTool(executors: ToolExecutors) {
  return createTool({
    id: 'extract-rfp-data',
    description: 'Extract structured RFP data from web content using AI',
    inputSchema: z.object({
      content: z.string().describe('Raw web content to analyze'),
      url: z.string().describe('Source URL'),
      portalContext: z
        .string()
        .describe('Portal-specific context and patterns'),
    }),
    execute: async ({ context }) => {
      return await executors.extractRFPData(context);
    },
  });
}

/**
 * Create an authentication tool
 * Handles portal authentication using unified Browserbase automation
 */
export function createAuthenticationTool(executors: ToolExecutors) {
  return createTool({
    id: 'authenticate-portal',
    description:
      'Handle portal authentication using unified Browserbase automation',
    inputSchema: z.object({
      portalUrl: z.string(),
      username: z.string(),
      password: z.string(),
      authContext: z
        .string()
        .describe('Portal-specific authentication context'),
      sessionId: z
        .string()
        .describe('Session ID for maintaining authenticated state'),
      portalType: z
        .string()
        .optional()
        .describe('Portal type for specialized authentication'),
    }),
    execute: async ({ context }) => {
      return await executors.handleBrowserbaseAuthentication(context);
    },
  });
}
