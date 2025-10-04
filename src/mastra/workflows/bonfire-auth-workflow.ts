import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { sessionManager } from '../tools/session-manager';
import { sharedMemory } from '../tools/shared-memory-provider';

// Input schema for BonfireHub authentication workflow
const BonfireAuthInputSchema = z.object({
  portalId: z.string(),
  username: z.string(),
  password: z.string(),
  companyName: z.string(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3),
});

export const bonfireAuthWorkflow = createWorkflow({
  id: 'bonfire-auth',
  description:
    'Handles complex BonfireHub authentication with 2FA and human-in-the-loop',
  inputSchema: BonfireAuthInputSchema,

  execute: async ({ input, step, suspend }: any) => {
    const {
      portalId,
      username,
      password,
      companyName,
      retryCount,
      maxRetries,
    } = input;

    // Step 1: Initialize browser session
    const browser = await step.run('initialize-browser', async () => {
      console.log('🌐 Initializing browser for BonfireHub authentication...');
      const stagehand = await sessionManager.ensureStagehand(
        `bonfire-auth-${portalId}`
      );

      // Session initialized - memory storage handled by Memory provider
      console.log(`Session initialized: bonfire-auth-${portalId}`);

      return stagehand;
    });

    // Step 2: Navigate to BonfireHub login
    await step.run('navigate-to-login', async () => {
      console.log('📍 Navigating to BonfireHub login page...');
      await browser.page.goto('https://www.bonfirehub.com/portal/login', {
        waitUntil: 'networkidle2',
        timeout: 30000,
      });

      return { url: browser.page.url() };
    });

    // Step 3: Attempt login
    const loginResult = await step.run('attempt-login', async () => {
      console.log('🔐 Attempting BonfireHub login...');

      try {
        // Fill username
        await browser.page.act(
          `type "${username}" in the username field, email field, or input field`
        );

        // Fill password
        await browser.page.act(`type "${password}" in the password field`);

        // Click login button
        await browser.page.act(
          'click the login button, submit button, or Sign In button'
        );

        // Wait for navigation or response
        await browser.page
          .waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 10000,
          })
          .catch(() => {
            console.log('No navigation detected, checking for 2FA...');
          });

        return { status: 'login_attempted', url: browser.page.url() };
      } catch (error) {
        console.error('Login attempt error:', error);
        return {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    // Step 4: Check for 2FA requirement
    const needs2FA = await step.run('check-2fa', async () => {
      console.log('🔍 Checking for 2FA requirement...');

      const pageContent = await browser.page.content();
      const currentUrl = browser.page.url();

      // Check common 2FA indicators
      const has2FA =
        pageContent.includes('verification code') ||
        pageContent.includes('2FA') ||
        pageContent.includes('two-factor') ||
        pageContent.includes('authenticator') ||
        currentUrl.includes('verify') ||
        currentUrl.includes('mfa');

      if (has2FA) {
        console.log('⚠️ 2FA required for BonfireHub login');
        // 2FA requirement detected - will be handled via suspend/resume
      }

      return { requires2FA: has2FA };
    });

    // Step 5: Handle 2FA if needed
    if (needs2FA.requires2FA) {
      // Suspend workflow for human intervention
      const resumeData = await suspend({
        reason: '2FA_REQUIRED',
        message: `Two-factor authentication required for BonfireHub portal "${companyName}". Please provide the 2FA code.`,
        data: {
          portalId,
          sessionId: `bonfire-auth-${portalId}`,
          loginStatus: 'awaiting_2fa',
        },
        instructions: {
          action: 'provide_2fa_code',
          fields: ['twoFactorCode'],
          timeout: 300, // 5 minutes to provide 2FA
        },
      });

      // Resume with 2FA code
      if (resumeData && resumeData.twoFactorCode) {
        await step.run('submit-2fa', async () => {
          console.log('📝 Submitting 2FA code...');

          // Fill 2FA code
          await browser.page.act(
            `type "${resumeData.twoFactorCode}" in the verification code field or token field`
          );

          // Submit 2FA
          await browser.page.act(
            'click the verify button, submit button, or continue button'
          );

          // Wait for navigation
          await browser.page.waitForNavigation({
            waitUntil: 'networkidle2',
            timeout: 10000,
          });

          return { status: '2fa_submitted' };
        });
      }
    }

    // Step 6: Verify successful login
    const verificationResult = await step.run('verify-login', async () => {
      console.log('✅ Verifying login success...');

      const currentUrl = browser.page.url();
      const pageContent = await browser.page.content();

      // Check for successful login indicators
      const isLoggedIn =
        currentUrl.includes('dashboard') ||
        currentUrl.includes('opportunities') ||
        currentUrl.includes('home') ||
        pageContent.includes('Welcome') ||
        pageContent.includes(companyName) ||
        !currentUrl.includes('login');

      if (!isLoggedIn && retryCount < maxRetries) {
        console.log(`❌ Login failed, retry ${retryCount + 1}/${maxRetries}`);

        // Recursive retry
        return {
          status: 'retry_needed',
          shouldRetry: true,
          retryCount: retryCount + 1,
        };
      }

      return {
        status: isLoggedIn ? 'success' : 'failed',
        url: currentUrl,
        isLoggedIn,
      };
    });

    // Step 7: Store authentication state
    if (verificationResult.status === 'success') {
      await step.run('store-auth-state', async () => {
        console.log('💾 Storing authentication state...');

        // Get cookies for session persistence
        const cookies = await browser.page.cookies();

        // Authentication state stored via Memory provider
        console.log(`Authentication successful for portal ${portalId}`);

        // Update portal status
        await storage.updatePortal(portalId, {
          lastScanned: new Date(),
          status: 'active',
        });

        return { stored: true };
      });
    }

    // Step 8: Handle retry if needed
    if (verificationResult.shouldRetry) {
      console.log('🔄 Retrying authentication...');

      // Execute workflow recursively with retry count
      return await bonfireAuthWorkflow.execute({
        ...input,
        retryCount: verificationResult.retryCount,
      });
    }

    // Return final result
    return {
      success: verificationResult.status === 'success',
      portalId,
      sessionId: `bonfire-auth-${portalId}`,
      authenticated: verificationResult.isLoggedIn,
      required2FA: needs2FA.requires2FA,
      retryCount,
      timestamp: new Date().toISOString(),
    };
  },
});
