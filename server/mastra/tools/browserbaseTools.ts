import { createTool } from '@mastra/core';
import { z } from 'zod';
import { Stagehand } from "@browserbasehq/stagehand";

// Session manager for consistent Browserbase sessions
class BrowserbaseSessionManager {
  private sessions: Map<string, Stagehand> = new Map();
  private defaultSessionId = 'default';

  async ensureStagehand(sessionId: string = this.defaultSessionId): Promise<Stagehand> {
    let stagehand = this.sessions.get(sessionId);
    
    if (!stagehand) {
      console.log(`🌐 Creating new Browserbase session: ${sessionId}`);
      
      stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        verbose: 1,
        browserbaseSessionCreateParams: {
          projectId: process.env.BROWSERBASE_PROJECT_ID!,
          keepAlive: true,
          timeout: 3600, // 1 hour session timeout
          browserSettings: {
            advancedStealth: true,
            solveCaptchas: true,
            blockAds: true,
            recordSession: true,
            logSession: true,
            viewport: {
              width: 1920,
              height: 1080
            }
          },
          region: "us-west-2"
        }
      });

      await stagehand.init();
      this.sessions.set(sessionId, stagehand);
      
      console.log(`✅ Browserbase session ${sessionId} initialized successfully`);
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

const sessionManager = new BrowserbaseSessionManager();

// Official Mastra-Browserbase stagehand tools
export const stagehandActTool = createTool({
  id: 'web-act',
  description: 'Take an action on a webpage using Browserbase automation (clicking, typing, navigation)',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    action: z.string().describe('Action to perform (e.g., "click sign in button", "type hello in search field", "navigate to login")'),
    sessionId: z.string().optional().describe('Session ID for maintaining browser context'),
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
        await page.act(action);
        console.log(`✅ Successfully performed: ${action}`);
      }

      return {
        success: true,
        message: `Successfully performed: ${action}`,
        currentUrl: await page.url()
      };
    } catch (error: any) {
      console.error(`❌ Stagehand action failed:`, error);
      throw new Error(`Browserbase action failed: ${error.message}`);
    }
  },
});

export const stagehandObserveTool = createTool({
  id: 'web-observe',
  description: 'Observe elements on a webpage using Browserbase to plan actions and understand page structure',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    instruction: z.string().describe('What to observe (e.g., "find all RFP listings", "locate login form fields")'),
    sessionId: z.string().optional().describe('Session ID for maintaining browser context'),
  }),
  execute: async ({ context }) => {
    const { url, instruction, sessionId } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    try {
      console.log(`🔍 Observing: "${instruction}"`);
      
      if (url) {
        console.log(`🌐 Navigating to: ${url}`);
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded');
      }

      const observations = await page.observe(instruction);
      console.log(`✅ Found ${observations.length} observations for: ${instruction}`);
      
      return {
        observations,
        currentUrl: await page.url(),
        pageTitle: await page.title()
      };
    } catch (error: any) {
      console.error(`❌ Stagehand observation failed:`, error);
      throw new Error(`Browserbase observation failed: ${error.message}`);
    }
  },
});

export const stagehandExtractTool = createTool({
  id: 'web-extract',
  description: 'Extract structured data from a webpage using Browserbase automation',
  inputSchema: z.object({
    url: z.string().optional().describe('URL to navigate to (optional if already on a page)'),
    instruction: z.string().describe('What to extract (e.g., "extract all RFP titles and deadlines", "get form data")'),
    schema: z.record(z.any()).optional().describe('Zod schema definition for data extraction'),
    sessionId: z.string().optional().describe('Session ID for maintaining browser context'),
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
      const defaultSchema = {
        title: z.string().describe('RFP title or opportunity name'),
        deadline: z.string().optional().describe('Submission deadline'),
        agency: z.string().optional().describe('Issuing agency or organization'),
        description: z.string().optional().describe('RFP description or summary'),
        value: z.string().optional().describe('Contract value or budget'),
        url: z.string().optional().describe('Link to full RFP details')
      };

      const extractionSchema = z.object(schema || defaultSchema);
      const extractedData = await page.extract({
        instruction,
        schema: extractionSchema
      });

      console.log(`✅ Successfully extracted data for: ${instruction}`);
      
      return {
        data: extractedData,
        currentUrl: await page.url(),
        pageTitle: await page.title(),
        extractedAt: new Date().toISOString()
      };
    } catch (error: any) {
      console.error(`❌ Stagehand extraction failed:`, error);
      throw new Error(`Browserbase extraction failed: ${error.message}`);
    }
  },
});

// Portal authentication tool using Browserbase
export const stagehandAuthTool = createTool({
  id: 'web-auth',
  description: 'Authenticate with portals using Browserbase automation with session persistence',
  inputSchema: z.object({
    loginUrl: z.string().describe('Portal login URL'),
    username: z.string().describe('Login username/email'),
    password: z.string().describe('Login password'),
    targetUrl: z.string().describe('Target URL to navigate after authentication'),
    sessionId: z.string().describe('Session ID for maintaining authenticated state'),
    portalType: z.string().optional().describe('Portal type (bonfire, sam.gov, etc.)'),
  }),
  execute: async ({ context }) => {
    const { loginUrl, username, password, targetUrl, sessionId, portalType } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    try {
      console.log(`🔐 Authenticating with portal: ${loginUrl}`);
      
      // Navigate to login page
      await page.goto(loginUrl);
      await page.waitForLoadState('domcontentloaded');

      // Handle cookie consent if present
      try {
        await page.act('dismiss cookie consent banner or accept cookies if present');
        await page.waitForTimeout(1000);
      } catch (e) {
        // Cookie consent may not be present, continue
      }

      // Perform login based on portal type
      if (portalType?.toLowerCase().includes('bonfire')) {
        console.log(`🔥 Performing Bonfire Hub (Euna) authentication...`);
        
        // Bonfire uses Euna Supplier Network - multi-step auth
        await page.act(`enter "${username}" in the email or username field`);
        await page.act('click continue or next button to proceed');
        await page.waitForTimeout(2000); // Wait for password field to appear
        
        await page.act(`enter "${password}" in the password field`);
        await page.act('click login or sign in button to submit');
        
      } else {
        console.log(`🔍 Performing generic portal authentication...`);
        
        // Generic authentication flow
        await page.act(`enter "${username}" in the username or email field`);
        await page.act(`enter "${password}" in the password field`);
        await page.act('click login or sign in button to submit');
      }

      // Wait for authentication to complete
      await page.waitForTimeout(3000);
      
      // Check for authentication errors
      try {
        const errorCheck = await page.observe('check for login errors, invalid credentials messages, or authentication failures');
        if (errorCheck.length > 0) {
          throw new Error(`Authentication failed: ${errorCheck[0]}`);
        }
      } catch (e) {
        // No errors found, continue
      }

      // Navigate to target URL
      console.log(`🎯 Navigating to target: ${targetUrl}`);
      await page.goto(targetUrl);
      await page.waitForLoadState('domcontentloaded');

      // Handle Cloudflare protection if present
      const pageTitle = await page.title();
      if (pageTitle.includes("Just a moment") || pageTitle.includes("Please wait")) {
        console.log(`🛡️ Cloudflare protection detected, waiting for bypass...`);
        await page.waitForLoadState('networkidle', { timeout: 30000 });
      }

      const currentUrl = await page.url();
      const finalTitle = await page.title();
      
      console.log(`✅ Authentication successful - Final URL: ${currentUrl}`);
      
      return {
        success: true,
        message: 'Portal authentication completed successfully',
        sessionId,
        currentUrl,
        pageTitle: finalTitle,
        authenticatedAt: new Date().toISOString()
      };
      
    } catch (error: any) {
      console.error(`❌ Portal authentication failed:`, error);
      throw new Error(`Browserbase authentication failed: ${error.message}`);
    }
  },
});

export { sessionManager };