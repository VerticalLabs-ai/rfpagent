import { createTool } from '@mastra/core';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageAuthTool = createTool({
  id: 'page-auth',
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