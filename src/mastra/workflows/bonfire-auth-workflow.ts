import { createWorkflow } from '@mastra/core';
import { z } from 'zod';
import { storage } from '../../../server/storage';
import { sharedMemory } from '../tools/shared-memory-provider';
import { stagehandTools } from '../../../server/services/stagehandTools.js';

// Input schema for BonfireHub authentication workflow
const BonfireAuthInputSchema = z.object({
  portalId: z.string(),
  username: z.string(),
  password: z.string(),
  companyName: z.string(),
  retryCount: z.number().default(0),
  maxRetries: z.number().default(3)
});

export const bonfireAuthWorkflow = createWorkflow({
  id: 'bonfire-auth',
  name: 'BonfireHub Authentication Workflow',
  description: 'Handles complex BonfireHub authentication with 2FA and human-in-the-loop',
  version: '1.0.0',
  inputSchema: BonfireAuthInputSchema,
  
  execute: async ({ input, step, suspend }) => {
    const { portalId, username, password, companyName, retryCount, maxRetries } = input;
    
    // Step 1: Initialize browser session
    const browser = await step.run('initialize-browser', async () => {
      console.log('🌐 Initializing browser for BonfireHub authentication...');
      const stagehand = await stagehandTools.createStagehandInstance('BonfireHub Auth');
      
      // Store session in memory
      await sharedMemory.set(`bonfire-session-${portalId}`, {
        sessionId: stagehand.sessionId,
        startTime: new Date().toISOString(),
        status: 'initializing'
      });
      
      return stagehand;
    });
    
    // Step 2: Navigate to BonfireHub login
    await step.run('navigate-to-login', async () => {
      console.log('📍 Navigating to BonfireHub login page...');
      await browser.page.goto('https://www.bonfirehub.com/portal/login', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      return { url: browser.page.url() };
    });
    
    // Step 3: Attempt login
    const loginResult = await step.run('attempt-login', async () => {
      console.log('🔐 Attempting BonfireHub login...');
      
      try {
        // Fill username
        await browser.act({
          action: 'fill',
          selector: 'input[name="username"], input[type="email"], #username',
          value: username
        });
        
        // Fill password
        await browser.act({
          action: 'fill',
          selector: 'input[name="password"], input[type="password"], #password',
          value: password
        });
        
        // Click login button
        await browser.act({
          action: 'click',
          selector: 'button[type="submit"], button:has-text("Sign In"), button:has-text("Login")'
        });
        
        // Wait for navigation or response
        await browser.page.waitForNavigation({ 
          waitUntil: 'networkidle2',
          timeout: 10000 
        }).catch(() => {
          console.log('No navigation detected, checking for 2FA...');
        });
        
        return { status: 'login_attempted', url: browser.page.url() };
      } catch (error) {
        console.error('Login attempt error:', error);
        return { status: 'error', error: error instanceof Error ? error.message : 'Unknown error' };
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
        
        // Update memory with 2FA requirement
        await sharedMemory.set(`bonfire-2fa-${portalId}`, {
          required: true,
          timestamp: new Date().toISOString(),
          sessionId: browser.sessionId
        });
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
          sessionId: browser.sessionId,
          loginStatus: 'awaiting_2fa'
        },
        instructions: {
          action: 'provide_2fa_code',
          fields: ['twoFactorCode'],
          timeout: 300 // 5 minutes to provide 2FA
        }
      });
      
      // Resume with 2FA code
      if (resumeData && resumeData.twoFactorCode) {
        await step.run('submit-2fa', async () => {
          console.log('📝 Submitting 2FA code...');
          
          // Fill 2FA code
          await browser.act({
            action: 'fill',
            selector: 'input[name="code"], input[name="token"], input[type="text"]:visible',
            value: resumeData.twoFactorCode
          });
          
          // Submit 2FA
          await browser.act({
            action: 'click',
            selector: 'button[type="submit"], button:has-text("Verify"), button:has-text("Submit")'
          });
          
          // Wait for navigation
          await browser.page.waitForNavigation({ 
            waitUntil: 'networkidle2',
            timeout: 10000 
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
          retryCount: retryCount + 1
        };
      }
      
      return {
        status: isLoggedIn ? 'success' : 'failed',
        url: currentUrl,
        isLoggedIn
      };
    });
    
    // Step 7: Store authentication state
    if (verificationResult.status === 'success') {
      await step.run('store-auth-state', async () => {
        console.log('💾 Storing authentication state...');
        
        // Get cookies for session persistence
        const cookies = await browser.page.cookies();
        
        // Store in memory and database
        await sharedMemory.set(`bonfire-auth-${portalId}`, {
          authenticated: true,
          sessionId: browser.sessionId,
          cookies,
          loginTime: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 3600000).toISOString() // 1 hour
        });
        
        // Update portal status
        await storage.updatePortal(portalId, {
          lastScanned: new Date(),
          isActive: true,
          metadata: {
            lastAuthSuccess: new Date().toISOString(),
            authMethod: needs2FA.requires2FA ? '2fa' : 'standard'
          }
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
        retryCount: verificationResult.retryCount
      });
    }
    
    // Return final result
    return {
      success: verificationResult.status === 'success',
      portalId,
      sessionId: browser.sessionId,
      authenticated: verificationResult.isLoggedIn,
      required2FA: needs2FA.requires2FA,
      retryCount,
      timestamp: new Date().toISOString()
    };
  }
});