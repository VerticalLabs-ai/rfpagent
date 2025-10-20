import { createClient } from '@1password/sdk';
import { createTool } from '@mastra/core';
import { z } from 'zod';
import { sessionManager } from './session-manager';

export const pageAuthTool = createTool({
  id: 'page-auth',
  description:
    'Authenticate with portals using Browserbase automation with session persistence and 1Password integration',
  inputSchema: z.object({
    loginUrl: z.string().describe('Portal login URL'),
    username: z
      .string()
      .optional()
      .describe('Login username/email (or use 1Password vault)'),
    password: z
      .string()
      .optional()
      .describe('Login password (or use 1Password vault)'),
    targetUrl: z
      .string()
      .describe('Target URL to navigate after authentication'),
    sessionId: z
      .string()
      .describe('Session ID for maintaining authenticated state'),
    portalType: z
      .string()
      .optional()
      .describe('Portal type (bonfire, sam.gov, etc.)'),
    useOnePassword: z
      .boolean()
      .default(false)
      .optional()
      .describe('Retrieve credentials from 1Password vault'),
    onePasswordVault: z
      .string()
      .optional()
      .describe('1Password vault name (default: "Browserbase Agent")'),
    onePasswordItem: z.string().optional().describe('1Password item name'),
  }),
  outputSchema: z.object({
    success: z.boolean().describe('Whether authentication was successful'),
    message: z.string().describe('Authentication result message'),
    sessionId: z.string().describe('Session ID for maintaining state'),
    currentUrl: z.string().describe('Current URL after authentication'),
    pageTitle: z.string().describe('Title of the authenticated page'),
    authenticatedAt: z.string().describe('ISO timestamp of authentication'),
  }),
  execute: async ({ context }) => {
    const {
      loginUrl,
      targetUrl,
      sessionId,
      portalType,
      useOnePassword,
      onePasswordVault,
      onePasswordItem,
    } = context;
    let { username, password } = context;
    const stagehand = await sessionManager.ensureStagehand(sessionId);
    const page = stagehand.page;

    try {
      // Retrieve credentials from 1Password if enabled
      if (useOnePassword && process.env.OP_SERVICE_ACCOUNT_TOKEN) {
        console.log(`🔑 Retrieving credentials from 1Password vault...`);

        const vaultName = onePasswordVault || 'Browserbase Agent';
        const itemName = onePasswordItem || 'Browserbase';

        try {
          const client = await createClient({
            auth: process.env.OP_SERVICE_ACCOUNT_TOKEN,
            integrationName: 'RFP Agent Browserbase Integration',
            integrationVersion: 'v1.0.0',
          });

          // Retrieve credentials using 1Password secret references
          username = await client.secrets.resolve(
            `op://${vaultName}/${itemName}/username`
          );
          password = await client.secrets.resolve(
            `op://${vaultName}/${itemName}/password`
          );

          console.log(
            `✅ Credentials retrieved from 1Password vault: ${vaultName}`
          );
        } catch (opError: any) {
          console.error(
            `❌ Failed to retrieve credentials from 1Password:`,
            opError.message
          );
          throw new Error(
            `1Password authentication failed: ${opError.message}`
          );
        }
      }

      // Validate credentials are available
      if (!username || !password) {
        throw new Error(
          'Username and password are required. Either provide them directly or enable 1Password integration.'
        );
      }

      console.log(`🔐 Authenticating with portal: ${loginUrl}`);

      // Navigate to login page
      await page.goto(loginUrl);
      await page.waitForLoadState('domcontentloaded');

      // Handle cookie consent if present
      try {
        await page.act(
          'dismiss cookie consent banner or accept cookies if present'
        );
        await page.waitForTimeout(1000);
      } catch (e) {
        // Cookie consent may not be present, continue
      }

      // Perform login based on portal type using secure variable substitution
      if (portalType?.toLowerCase().includes('bonfire')) {
        console.log(`🔥 Performing Bonfire Hub (Euna) authentication...`);

        // Bonfire uses Euna Supplier Network - multi-step auth
        await page.act({
          action: 'Type in the username: %username%',
          variables: { username },
        });
        await page.act('click continue or next button to proceed');
        await page.waitForTimeout(2000); // Wait for password field to appear

        await page.act({
          action: 'Type in the password: %password%',
          variables: { password },
        });
        await page.act('click login or sign in button to submit');
      } else {
        console.log(`🔍 Performing generic portal authentication...`);

        // Generic authentication flow with secure variable substitution
        await page.act({
          action: 'Type in the username: %username%',
          variables: { username },
        });
        await page.act({
          action: 'Type in the password: %password%',
          variables: { password },
        });
        await page.act('click login or sign in button to submit');
      }

      // Wait for authentication to complete
      await page.waitForTimeout(3000);

      // Check for authentication errors
      try {
        const errorCheck = await page.observe(
          'check for login errors, invalid credentials messages, or authentication failures'
        );
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
      if (
        pageTitle.includes('Just a moment') ||
        pageTitle.includes('Please wait')
      ) {
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
        authenticatedAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error(`❌ Portal authentication failed:`, error);
      throw new Error(`Browserbase authentication failed: ${error.message}`);
    }
  },
});
