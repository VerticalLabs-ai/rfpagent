import type {
  Portal,
  Proposal,
  RFP,
  Submission,
  WorkItem,
} from '@shared/schema';
import { sessionManager } from '../../../src/mastra/tools/session-manager';
import { storage } from '../../storage';
import { agentMemoryService } from '../agents/agentMemoryService';

export interface SubmissionSpecialistResult {
  success: boolean;
  data?: any;
  error?: string;
  retryable?: boolean;
  metadata?: any;
  sessionData?: any;
}

/**
 * Portal Authentication Specialist
 * Handles portal login, MFA, and session management for government portals
 */
export class PortalAuthenticationSpecialist {
  /**
   * Authenticate with government portal
   */
  async authenticatePortal(
    workItem: WorkItem
  ): Promise<SubmissionSpecialistResult> {
    const inputs = workItem.inputs as Record<string, any>;
    console.log(
      `🔐 Auth Specialist: Authenticating with portal for submission ${inputs.submissionId}`
    );

    try {
      const {
        submissionId,
        portalId,
        preflightResults,
        browserOptions,
        pipelineId,
      } = inputs;

      // Get portal and submission data
      const [portal, submission] = await Promise.all([
        storage.getPortalWithCredentials(portalId),
        storage.getSubmission(submissionId),
      ]);

      if (!portal) {
        throw new Error(`Portal not found: ${portalId}`);
      }

      if (!submission) {
        throw new Error(`Submission not found: ${submissionId}`);
      }

      // Create browser session for this submission
      const sessionId = `submission_${submissionId}_${Date.now()}`;

      // Create audit event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId,
        eventType: 'authentication_started',
        phase: 'authenticating',
        level: 'info',
        message: `Starting authentication with ${portal.name}`,
        details: { portalUrl: portal.url, sessionId },
        agentId: 'portal-authentication-specialist',
      });

      // Initialize browser session
      const stagehand = await sessionManager.ensureStagehand(sessionId);

      try {
        // Navigate to portal login page
        console.log(`🌐 Navigating to portal: ${portal.url}`);
        await stagehand.context.pages()[0].goto(portal.url);

        // Wait for page to load and take screenshot
        await stagehand.context.pages()[0].waitForLoadState('networkidle');
        const loginPageScreenshot = await stagehand.context.pages()[0].screenshot({
          fullPage: true,
        });

        // Check if already logged in
        const isLoggedIn = await this.checkIfLoggedIn(stagehand, portal);
        if (isLoggedIn) {
          console.log('✅ Already authenticated with portal');

          return await this.handleSuccessfulAuth(
            sessionId,
            submission,
            portal,
            pipelineId,
            { method: 'existing_session', screenshot: loginPageScreenshot }
          );
        }

        // Find login elements
        const loginElements = await this.findLoginElements(stagehand, portal);
        if (!loginElements.usernameField || !loginElements.passwordField) {
          throw new Error('Could not locate login form elements on the page');
        }

        // Perform login
        await this.performLogin(stagehand, portal, loginElements);

        // Handle potential MFA
        const mfaResult = await this.handleMFA(stagehand, portal);

        // Verify successful login
        const authVerification = await this.verifyAuthentication(
          stagehand,
          portal
        );
        if (!authVerification.success) {
          throw new Error(
            `Authentication verification failed: ${authVerification.error}`
          );
        }

        // Take success screenshot
        const successScreenshot = await stagehand.context.pages()[0].screenshot({
          fullPage: true,
        });

        console.log('✅ Portal authentication successful');

        return await this.handleSuccessfulAuth(
          sessionId,
          submission,
          portal,
          pipelineId,
          {
            method: 'login_form',
            mfaUsed: mfaResult.mfaDetected,
            screenshot: successScreenshot,
            currentUrl: stagehand.context.pages()[0].url(),
          }
        );
      } catch (browserError) {
        // Close browser session on error
        await sessionManager.closeSession(sessionId);
        throw browserError;
      }
    } catch (error) {
      console.error('❌ Portal authentication failed:', error);

      // Create error event
      const errorInputs = workItem.inputs as Record<string, any>;
      await storage.createSubmissionEvent({
        pipelineId: errorInputs.pipelineId,
        submissionId: errorInputs.submissionId,
        eventType: 'error',
        phase: 'authenticating',
        level: 'error',
        message: 'Portal authentication failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        agentId: 'portal-authentication-specialist',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        retryable: this.isRetryableError(error),
        metadata: {
          phase: 'authentication',
          specialist: 'portal-authentication-specialist',
        },
      };
    }
  }

  private async checkIfLoggedIn(
    stagehand: any,
    portal: Partial<Portal>
  ): Promise<boolean> {
    try {
      // Common indicators of being logged in
      const loggedInSelectors = [
        'text=/logout/i',
        'text=/sign out/i',
        'text=/dashboard/i',
        'text=/profile/i',
        'text=/welcome/i',
        '[data-testid="user-menu"]',
        '.user-menu',
        '.dashboard',
        '#logout',
        '.logout',
      ];

      for (const selector of loggedInSelectors) {
        try {
          const element = await stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible()) {
            return true;
          }
        } catch (e) {
          // Continue checking other selectors
        }
      }

      // Check for login form (if present, likely not logged in)
      const loginSelectors = [
        'input[type="password"]',
        'text=/login/i',
        'text=/sign in/i',
      ];

      for (const selector of loginSelectors) {
        try {
          const element = await stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible()) {
            return false; // Login form present, not logged in
          }
        } catch (e) {
          // Continue checking
        }
      }

      return false;
    } catch (error) {
      console.warn('Could not determine login status:', error);
      return false;
    }
  }

  private async findLoginElements(
    stagehand: any,
    portal: Partial<Portal>
  ): Promise<any> {
    // Try multiple strategies to find login elements
    const strategies = [
      // Strategy 1: Use portal-specific selectors if available
      () => this.findLoginElementsWithPortalSelectors(stagehand, portal),
      // Strategy 2: Use common selectors
      () => this.findLoginElementsWithCommonSelectors(stagehand),
      // Strategy 3: Use AI to identify elements
      () => this.findLoginElementsWithAI(stagehand),
    ];

    for (const strategy of strategies) {
      try {
        const elements = await strategy();
        if (elements.usernameField && elements.passwordField) {
          return elements;
        }
      } catch (error) {
        console.warn('Login element detection strategy failed:', error);
      }
    }

    throw new Error('Could not locate login form elements');
  }

  private async findLoginElementsWithPortalSelectors(
    stagehand: any,
    portal: Partial<Portal>
  ): Promise<any> {
    if (!portal.selectors) {
      throw new Error('No portal-specific selectors available');
    }

    const selectors = portal.selectors as any;
    return {
      usernameField: selectors.username
        ? stagehand.context.pages()[0].locator(selectors.username)
        : null,
      passwordField: selectors.password
        ? stagehand.context.pages()[0].locator(selectors.password)
        : null,
      loginButton: selectors.loginButton
        ? stagehand.context.pages()[0].locator(selectors.loginButton)
        : null,
    };
  }

  private async findLoginElementsWithCommonSelectors(
    stagehand: any
  ): Promise<any> {
    const usernameSelectors = [
      'input[name="username"]',
      'input[name="email"]',
      'input[name="login"]',
      'input[type="email"]',
      'input[id*="username"]',
      'input[id*="email"]',
      'input[placeholder*="username"]',
      'input[placeholder*="email"]',
    ];

    const passwordSelectors = [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
      'input[placeholder*="password"]',
    ];

    const loginButtonSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("login")',
      'button:has-text("sign in")',
      'button:has-text("log in")',
      '[data-testid="login-button"]',
    ];

    let usernameField = null;
    let passwordField = null;
    let loginButton = null;

    // Find username field
    for (const selector of usernameSelectors) {
      try {
        const element = stagehand.context.pages()[0].locator(selector).first();
        if (await element.isVisible()) {
          usernameField = element;
          break;
        }
      } catch (_e) {
        // Ignore if element not found, try next selector
      }
    }

    // Find password field
    for (const selector of passwordSelectors) {
      try {
        const element = stagehand.context.pages()[0].locator(selector).first();
        if (await element.isVisible()) {
          passwordField = element;
          break;
        }
      } catch (_e) {
        // Ignore if element not found, try next selector
      }
    }

    // Find login button
    for (const selector of loginButtonSelectors) {
      try {
        const element = stagehand.context.pages()[0].locator(selector).first();
        if (await element.isVisible()) {
          loginButton = element;
          break;
        }
      } catch (_e) {
        // Ignore if element not found, try next selector
      }
    }

    return { usernameField, passwordField, loginButton };
  }

  private async findLoginElementsWithAI(stagehand: any): Promise<any> {
    // Use Stagehand's AI capabilities to find login elements
    try {
      const usernameField = await stagehand.act({
        action: 'locate the username or email input field',
      });

      const passwordField = await stagehand.act({
        action: 'locate the password input field',
      });

      const loginButton = await stagehand.act({
        action: 'locate the login or sign in button',
      });

      return { usernameField, passwordField, loginButton };
    } catch (error) {
      throw new Error('AI-based element detection failed');
    }
  }

  private async performLogin(
    stagehand: any,
    portal: Partial<Portal>,
    loginElements: any
  ): Promise<void> {
    if (!portal.username || !portal.password) {
      throw new Error('Portal credentials not configured');
    }

    console.log('🔑 Entering credentials...');

    // Clear and fill username
    await loginElements.usernameField.clear();
    await loginElements.usernameField.fill(portal.username);
    await stagehand.context.pages()[0].waitForTimeout(500);

    // Clear and fill password
    await loginElements.passwordField.clear();
    await loginElements.passwordField.fill(portal.password);
    await stagehand.context.pages()[0].waitForTimeout(500);

    // Click login button or submit form
    if (loginElements.loginButton) {
      await loginElements.loginButton.click();
    } else {
      // Try submitting the form
      await loginElements.passwordField.press('Enter');
    }

    // Wait for navigation or response
    await stagehand.context.pages()[0].waitForTimeout(3000);
  }

  private async handleMFA(
    stagehand: any,
    portal: Partial<Portal>,
    options: {
      mfaTimeoutMs?: number;
      mfaCallback?: () => Promise<void>;
    } = {}
  ): Promise<any> {
    const { mfaTimeoutMs = 60000, mfaCallback } = options; // Default 60s instead of hardcoded 30s

    try {
      // Check for common MFA elements
      const mfaSelectors = [
        'input[name*="mfa"]',
        'input[name*="token"]',
        'input[name*="code"]',
        'text=/verification code/i',
        'text=/two.factor/i',
        'text=/authenticator/i',
      ];

      let mfaDetected = false;
      for (const selector of mfaSelectors) {
        try {
          const element = stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            mfaDetected = true;
            console.log(`🔐 MFA detected via selector: ${selector}`);
            break;
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      if (mfaDetected) {
        console.log(
          `🔐 MFA detected - waiting up to ${mfaTimeoutMs}ms for completion`
        );

        // Execute callback if provided (e.g., send notification)
        if (mfaCallback) {
          try {
            await mfaCallback();
          } catch (callbackError) {
            console.error('MFA callback failed:', callbackError);
          }
        }

        // Poll for MFA completion indicators
        const startTime = Date.now();
        const pollInterval = 2000; // Check every 2 seconds
        let mfaCompleted = false;

        while (Date.now() - startTime < mfaTimeoutMs) {
          // Check if we've navigated away from MFA page
          const currentUrl = stagehand.context.pages()[0].url();
          const currentUrlLower = currentUrl.toLowerCase();
          const isMfaPage =
            currentUrlLower.includes('mfa') ||
            currentUrlLower.includes('verify') ||
            currentUrlLower.includes('2fa');

          if (!isMfaPage) {
            console.log('✅ Navigated away from MFA page');
            mfaCompleted = true;
            break;
          }

          // Check for success indicators in parallel
          const successSelectors = [
            'text=/dashboard/i',
            'text=/welcome/i',
            'text=/logout/i',
            'text=/sign out/i',
            '.dashboard',
            '[data-testid="user-menu"]',
          ];

          // Create promises for each selector check with short timeout
          const visibilityChecks = successSelectors.map(selector =>
            stagehand.context.pages()[0]
              .locator(selector)
              .first()
              .isVisible({ timeout: 300 })
              .then(() => selector)
              .catch(() => null)
          );

          try {
            // Race all checks - completes as soon as any selector is visible
            const firstVisible = await Promise.race([
              Promise.any(
                visibilityChecks.map(p =>
                  p.then((s: string | null) =>
                    s ? Promise.resolve(s) : Promise.reject()
                  )
                )
              ),
              // Add a timeout for the entire parallel check
              new Promise<null>(resolve =>
                setTimeout(() => resolve(null), 500)
              ),
            ]);

            if (firstVisible) {
              console.log(`✅ MFA completion detected via: ${firstVisible}`);
              mfaCompleted = true;
            }
          } catch (_e) {
            // All checks failed or timed out - continue polling
          }

          if (mfaCompleted) break;

          // Wait before next poll
          await stagehand.context.pages()[0].waitForTimeout(pollInterval);
        }

        if (!mfaCompleted) {
          console.warn(
            `⚠️ MFA timeout reached (${mfaTimeoutMs}ms) - completion uncertain`
          );
        }

        return { mfaDetected: true, mfaCompleted };
      }

      return { mfaDetected: false, mfaCompleted: true };
    } catch (error) {
      console.error('Error handling MFA:', error);
      return {
        mfaDetected: false,
        mfaCompleted: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async verifyAuthentication(
    stagehand: any,
    portal: Portal
  ): Promise<any> {
    try {
      // Wait for potential redirects
      await stagehand.context.pages()[0].waitForTimeout(3000);

      // Check for success indicators
      const successIndicators = [
        'text=/dashboard/i',
        'text=/welcome/i',
        'text=/logout/i',
        'text=/sign out/i',
      ];

      for (const indicator of successIndicators) {
        try {
          const element = stagehand.context.pages()[0].locator(indicator).first();
          if (await element.isVisible({ timeout: 5000 })) {
            return { success: true, indicator };
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      // Check for error messages
      const errorIndicators = [
        'text=/invalid/i',
        'text=/incorrect/i',
        'text=/error/i',
        'text=/failed/i',
        '.error',
        '.alert-danger',
      ];

      for (const indicator of errorIndicators) {
        try {
          const element = stagehand.context.pages()[0].locator(indicator).first();
          if (await element.isVisible({ timeout: 2000 })) {
            const errorText = await element.textContent();
            return { success: false, error: errorText };
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      // If no clear indicators, consider it successful if we're not on login page
      const currentUrl = stagehand.context.pages()[0].url();
      const isOnLoginPage =
        currentUrl.includes('login') || currentUrl.includes('signin');

      return {
        success: !isOnLoginPage,
        method: 'url_analysis',
        currentUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async handleSuccessfulAuth(
    sessionId: string,
    submission: Submission,
    portal: Partial<Portal>,
    pipelineId: string,
    authDetails: any
  ): Promise<SubmissionSpecialistResult> {
    // Store authentication data in agent memory
    await agentMemoryService.storeMemory({
      agentId: 'portal-authentication-specialist',
      memoryType: 'working',
      contextKey: `auth_session_${submission.id}`,
      title: `Portal Authentication - ${portal.name}`,
      content: {
        sessionId,
        portalName: portal.name,
        authMethod: authDetails.method,
        authenticatedAt: new Date(),
        currentUrl: authDetails.currentUrl || portal.url,
      },
      importance: 8,
      tags: [
        'portal_authentication',
        'active_session',
        portal.name || 'unknown_portal',
      ],
      metadata: { submissionId: submission.id, pipelineId },
    });

    // Create success event
    await storage.createSubmissionEvent({
      pipelineId,
      submissionId: submission.id,
      eventType: 'authentication_completed',
      phase: 'authenticating',
      level: 'info',
      message: `Successfully authenticated with ${portal.name}`,
      details: {
        sessionId,
        authMethod: authDetails.method,
        mfaUsed: authDetails.mfaUsed || false,
      },
      agentId: 'portal-authentication-specialist',
    });

    return {
      success: true,
      data: {
        browser_session_id: sessionId,
        authentication_status: 'success',
        session_data: {
          portalName: portal.name,
          sessionId,
          authenticatedAt: new Date(),
          currentUrl: authDetails.currentUrl,
          authMethod: authDetails.method,
        },
      },
      metadata: {
        phase: 'authentication',
        specialist: 'portal-authentication-specialist',
        sessionId,
      },
    };
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'ECONNRESET',
      'ENOTFOUND',
      'rate limit',
      'server error',
      'service unavailable',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }
}

/**
 * Form Submission Specialist
 * Handles form navigation, field population, and validation for submission forms
 */
export class FormSubmissionSpecialist {
  /**
   * Navigate and populate submission forms
   */
  async populateSubmissionForms(
    workItem: WorkItem
  ): Promise<SubmissionSpecialistResult> {
    const inputs = workItem.inputs as Record<string, any>;
    console.log(
      `📝 Form Specialist: Populating forms for submission ${inputs.submissionId}`
    );

    try {
      const {
        submissionId,
        proposalId,
        browserSessionId,
        formMapping,
        authenticationData,
        pipelineId,
      } = inputs;

      // Get submission and proposal data
      const [submission, proposal] = await Promise.all([
        storage.getSubmission(submissionId),
        storage.getProposal(proposalId),
      ]);

      if (!submission || !proposal) {
        throw new Error('Submission or proposal not found');
      }

      // Get RFP and company data for form population
      const rfp = await storage.getRFP(proposal.rfpId);
      if (!rfp) {
        throw new Error('RFP not found');
      }

      // Get browser session (create if needed)
      const stagehand = await sessionManager.ensureStagehand(browserSessionId);

      // Create form population event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId,
        eventType: 'form_population_started',
        phase: 'filling',
        level: 'info',
        message: 'Starting form population',
        details: { currentUrl: stagehand.context.pages()[0].url() },
        agentId: 'form-submission-specialist',
      });

      // Navigate to submission form if not already there
      const formUrl = await this.findSubmissionFormUrl(stagehand, formMapping);
      if (formUrl && formUrl !== stagehand.context.pages()[0].url()) {
        await stagehand.context.pages()[0].goto(formUrl);
        await stagehand.context.pages()[0].waitForLoadState('networkidle');
      }

      // Extract form data from proposal
      const formData = await this.extractFormDataFromProposal(proposal, rfp);

      // Populate forms step by step
      const populationResults = await this.populateFormsStepByStep(
        stagehand,
        formData,
        formMapping
      );

      // Validate populated forms
      const validationResults = await this.validatePopulatedForms(stagehand);

      // Take screenshot of completed forms
      const completedFormsScreenshot = await stagehand.context.pages()[0].screenshot({
        fullPage: true,
      });

      // Store form data in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'form-submission-specialist',
        memoryType: 'working',
        contextKey: `form_data_${submissionId}`,
        title: `Form Data - ${rfp.title}`,
        content: {
          formData,
          populationResults,
          validationResults,
          populatedAt: new Date(),
        },
        importance: 8,
        tags: ['form_population', 'active_submission'],
        metadata: { submissionId, pipelineId, proposalId },
      });

      // Create success event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId,
        eventType: 'form_population_completed',
        phase: 'filling',
        level: 'info',
        message: 'Form population completed successfully',
        details: {
          fieldsPopulated: populationResults.fieldsPopulated,
          validationStatus: validationResults.status,
        },
        agentId: 'form-submission-specialist',
      });

      console.log('✅ Form population completed successfully');

      return {
        success: true,
        data: {
          form_data: formData,
          populated_fields: populationResults.fieldsPopulated,
          validation_status: validationResults.status,
          current_url: stagehand.context.pages()[0].url(),
        },
        metadata: {
          phase: 'form_population',
          specialist: 'form-submission-specialist',
          sessionId: browserSessionId,
        },
      };
    } catch (error) {
      console.error('❌ Form population failed:', error);

      // Create error event
      const errorInputs = workItem.inputs as Record<string, any>;
      await storage.createSubmissionEvent({
        pipelineId: errorInputs.pipelineId,
        submissionId: errorInputs.submissionId,
        eventType: 'error',
        phase: 'filling',
        level: 'error',
        message: 'Form population failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        agentId: 'form-submission-specialist',
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Form population failed',
        retryable: this.isRetryableError(error),
        metadata: {
          phase: 'form_population',
          specialist: 'form-submission-specialist',
        },
      };
    }
  }

  private async findSubmissionFormUrl(
    stagehand: any,
    formMapping: any
  ): Promise<string | null> {
    try {
      // Use form mapping to find submission URL
      if (formMapping?.submissionUrl) {
        return formMapping.submissionUrl;
      }

      // Look for common submission links
      const submissionSelectors = [
        'a:has-text("submit")',
        'a:has-text("proposal")',
        'a:has-text("bid")',
        'a:has-text("response")',
        '[href*="submit"]',
        '[href*="proposal"]',
        '[href*="bid"]',
      ];

      for (const selector of submissionSelectors) {
        try {
          const element = stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible()) {
            const href = await element.getAttribute('href');
            if (href) {
              return new URL(href, stagehand.context.pages()[0].url()).href;
            }
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      return null;
    } catch (error) {
      console.warn('Could not find submission form URL:', error);
      return null;
    }
  }

  private async extractFormDataFromProposal(
    proposal: Proposal,
    rfp: RFP
  ): Promise<any> {
    // Extract relevant data from proposal and RFP for form population
    let proposalData: any = proposal.proposalData || {};
    if (typeof proposalData === 'string') {
      try {
        proposalData = JSON.parse(proposalData);
      } catch {
        proposalData = {};
      }
    }

    return {
      // Basic information
      projectTitle: rfp.title,
      projectDescription: rfp.description,
      agency: rfp.agency,
      rfpNumber: rfp.id,
      proposalNumber: proposal.id,

      // Company information (if available in proposal)
      companyName: proposalData.companyName || 'Professional Services Company',
      companyAddress: proposalData.companyAddress || '',
      contactName: proposalData.contactName || '',
      contactEmail: proposalData.contactEmail || '',
      contactPhone: proposalData.contactPhone || '',

      // Proposal specifics
      proposalValue: proposalData.totalCost || proposal.estimatedCost || '',
      projectDuration: proposalData.duration || '',
      startDate: proposalData.startDate || '',

      // Technical details
      technicalApproach: proposalData.technicalApproach || '',
      methodology: proposalData.methodology || '',
      deliverables: proposalData.deliverables || '',

      // Compliance
      certifications: proposalData.certifications || [],
      insurance: proposalData.insurance || '',

      // Additional fields that might be needed
      previousExperience: proposalData.experience || '',
      teamQualifications: proposalData.teamQualifications || '',
      references: proposalData.references || [],
    };
  }

  private async populateFormsStepByStep(
    stagehand: any,
    formData: any,
    formMapping: any
  ): Promise<any> {
    const populatedFields = [];
    const errors = [];

    try {
      // Get all form elements
      const formElements = await this.findFormElements(stagehand);

      for (const element of formElements) {
        try {
          const fieldType = await this.identifyFieldType(element);
          const fieldName = await this.getFieldName(element);
          const fieldValue = this.getValueForField(fieldName, formData);

          if (fieldValue) {
            await this.populateField(element, fieldValue, fieldType);
            populatedFields.push({
              field: fieldName,
              type: fieldType,
              value: fieldValue,
              status: 'success',
            });
          }
        } catch (fieldError) {
          errors.push({
            field: await this.getFieldName(element),
            error:
              fieldError instanceof Error
                ? fieldError.message
                : String(fieldError),
          });
        }
      }

      return {
        fieldsPopulated: populatedFields,
        errors,
        status: errors.length === 0 ? 'success' : 'partial',
      };
    } catch (error) {
      throw new Error(
        `Form population failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async findFormElements(stagehand: any): Promise<any[]> {
    const formSelectors = [
      'input[type="text"]',
      'input[type="email"]',
      'input[type="tel"]',
      'input[type="number"]',
      'input[type="date"]',
      'textarea',
      'select',
    ];

    const elements = [];
    for (const selector of formSelectors) {
      try {
        const locators = stagehand.context.pages()[0].locator(selector);
        const count = await locators.count();
        for (let i = 0; i < count; i++) {
          const element = locators.nth(i);
          if (await element.isVisible()) {
            elements.push(element);
          }
        }
      } catch (_e) {
        // Ignore - element not found, continue checking
      }
    }

    return elements;
  }

  private async identifyFieldType(element: any): Promise<string> {
    try {
      const tagName = await element.evaluate((el: any) =>
        el.tagName.toLowerCase()
      );
      if (tagName === 'select') return 'select';
      if (tagName === 'textarea') return 'textarea';

      const type = await element.getAttribute('type');
      return type || 'text';
    } catch (error) {
      return 'text';
    }
  }

  private async getFieldName(element: any): Promise<string> {
    try {
      // Try different ways to identify the field
      const name = await element.getAttribute('name');
      if (name) return name;

      const id = await element.getAttribute('id');
      if (id) return id;

      const placeholder = await element.getAttribute('placeholder');
      if (placeholder) return placeholder;

      const label = await element.evaluate((el: any) => {
        const labels = document.querySelectorAll('label');
        for (const label of labels) {
          if (label.getAttribute('for') === el.id) {
            return label.textContent;
          }
        }
        return null;
      });

      return label || 'unknown_field';
    } catch (error) {
      return 'unknown_field';
    }
  }

  private getValueForField(fieldName: string, formData: any): string {
    const fieldNameLower = fieldName.toLowerCase();

    // Map field names to form data
    const fieldMappings = {
      company: formData.companyName,
      organization: formData.companyName,
      business: formData.companyName,
      name: formData.contactName,
      contact: formData.contactName,
      email: formData.contactEmail,
      phone: formData.contactPhone,
      title: formData.projectTitle,
      project: formData.projectTitle,
      description: formData.projectDescription,
      amount: formData.proposalValue,
      cost: formData.proposalValue,
      value: formData.proposalValue,
      price: formData.proposalValue,
      address: formData.companyAddress,
      duration: formData.projectDuration,
      start: formData.startDate,
      approach: formData.technicalApproach,
      methodology: formData.methodology,
    };

    // Find matching field mapping
    for (const [key, value] of Object.entries(fieldMappings)) {
      if (fieldNameLower.includes(key)) {
        return value || '';
      }
    }

    return '';
  }

  private async populateField(
    element: any,
    value: string,
    fieldType: string
  ): Promise<void> {
    try {
      await element.scrollIntoViewIfNeeded();

      if (fieldType === 'select') {
        // For select elements, try to find and select the option
        await element.selectOption({ label: value });
      } else {
        // For text inputs and textareas
        await element.clear();
        await element.fill(value);
      }

      // Wait a bit for any dynamic updates
      await element.page().waitForTimeout(300);
    } catch (error) {
      throw new Error(
        `Failed to populate field: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async validatePopulatedForms(stagehand: any): Promise<any> {
    try {
      // Look for validation errors
      const errorSelectors = [
        '.error',
        '.invalid',
        '.has-error',
        '[aria-invalid="true"]',
        '.field-error',
      ];

      const errors = [];
      for (const selector of errorSelectors) {
        try {
          const errorElements = stagehand.context.pages()[0].locator(selector);
          const count = await errorElements.count();
          for (let i = 0; i < count; i++) {
            const element = errorElements.nth(i);
            if (await element.isVisible()) {
              const errorText = await element.textContent();
              errors.push(errorText);
            }
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      return {
        status: errors.length === 0 ? 'valid' : 'has_errors',
        errors,
        validatedAt: new Date(),
      };
    } catch (error) {
      return {
        status: 'validation_failed',
        errors: [error instanceof Error ? error.message : String(error)],
        validatedAt: new Date(),
      };
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'element not found',
      'element not visible',
      'page not loaded',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }
}

/**
 * Document Upload Specialist
 * Handles document uploads, file validation, and attachment management
 */
export class DocumentUploadSpecialist {
  /**
   * Upload required documents for submission
   */
  async uploadSubmissionDocuments(
    workItem: WorkItem
  ): Promise<SubmissionSpecialistResult> {
    const inputs = workItem.inputs as Record<string, any>;
    console.log(
      `📎 Upload Specialist: Uploading documents for submission ${inputs.submissionId}`
    );

    try {
      const {
        submissionId,
        proposalId,
        browserSessionId,
        documentChecklist,
        formData,
        pipelineId,
      } = inputs;

      // Get submission and proposal data
      const [submission, proposal] = await Promise.all([
        storage.getSubmission(submissionId),
        storage.getProposal(proposalId),
      ]);

      if (!submission || !proposal) {
        throw new Error('Submission or proposal not found');
      }

      // Get browser session (create if needed)
      const stagehand = await sessionManager.ensureStagehand(browserSessionId);

      // Create upload event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId,
        eventType: 'document_upload_started',
        phase: 'uploading',
        level: 'info',
        message: 'Starting document uploads',
        details: { currentUrl: stagehand.context.pages()[0].url() },
        agentId: 'document-upload-specialist',
      });

      // Get documents to upload
      const documentsToUpload = await this.getDocumentsToUpload(
        submission,
        proposal,
        documentChecklist
      );

      if (documentsToUpload.length === 0) {
        console.log('⚠️ No documents found to upload');
        return {
          success: true,
          data: {
            uploaded_documents: [],
            upload_confirmations: [],
            attachment_status: 'no_documents_required',
          },
          metadata: {
            phase: 'document_upload',
            specialist: 'document-upload-specialist',
          },
        };
      }

      // Find upload areas on the page
      const uploadAreas = await this.findUploadAreas(stagehand);

      if (uploadAreas.length === 0) {
        throw new Error('No file upload areas found on the page');
      }

      // Upload documents one by one
      const uploadResults = await this.uploadDocumentsSequentially(
        stagehand,
        documentsToUpload,
        uploadAreas
      );

      // Verify uploads
      const verificationResults = await this.verifyUploads(
        stagehand,
        uploadResults
      );

      // Take screenshot of completed uploads
      const uploadsScreenshot = await stagehand.context.pages()[0].screenshot({
        fullPage: true,
      });

      // Store upload data in agent memory
      await agentMemoryService.storeMemory({
        agentId: 'document-upload-specialist',
        memoryType: 'working',
        contextKey: `upload_data_${submissionId}`,
        title: `Document Uploads - ${proposal.id}`,
        content: {
          uploadResults,
          verificationResults,
          uploadedAt: new Date(),
        },
        importance: 8,
        tags: ['document_upload', 'active_submission'],
        metadata: { submissionId, pipelineId, proposalId },
      });

      // Create success event
      await storage.createSubmissionEvent({
        pipelineId,
        submissionId,
        eventType: 'document_upload_completed',
        phase: 'uploading',
        level: 'info',
        message: 'Document uploads completed successfully',
        details: {
          documentsUploaded: uploadResults.length,
          verificationStatus: verificationResults.status,
        },
        agentId: 'document-upload-specialist',
      });

      console.log('✅ Document upload completed successfully');

      return {
        success: true,
        data: {
          uploaded_documents: uploadResults,
          upload_confirmations: verificationResults.confirmations,
          attachment_status: verificationResults.status,
        },
        metadata: {
          phase: 'document_upload',
          specialist: 'document-upload-specialist',
          sessionId: browserSessionId,
        },
      };
    } catch (error) {
      console.error('❌ Document upload failed:', error);

      // Create error event
      const errorInputs = workItem.inputs as Record<string, any>;
      await storage.createSubmissionEvent({
        pipelineId: errorInputs.pipelineId,
        submissionId: errorInputs.submissionId,
        eventType: 'error',
        phase: 'uploading',
        level: 'error',
        message: 'Document upload failed',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        agentId: 'document-upload-specialist',
      });

      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Document upload failed',
        retryable: this.isRetryableError(error),
        metadata: {
          phase: 'document_upload',
          specialist: 'document-upload-specialist',
        },
      };
    }
  }

  private async getDocumentsToUpload(
    submission: Submission,
    proposal: Proposal,
    documentChecklist: any
  ): Promise<any[]> {
    try {
      // Get proposal documents
      const proposalDocuments = await storage.getDocumentsByRFP(proposal.rfpId);

      const documentsToUpload = [];

      // Add main proposal document if it exists
      const proposalData = proposal.proposalData as any;
      if (proposalData?.documentPath) {
        documentsToUpload.push({
          type: 'proposal',
          name: 'proposal.pdf',
          path: proposalData.documentPath,
          description: 'Main proposal document',
        });
      }

      // Add supporting documents
      for (const doc of proposalDocuments) {
        const path = doc.objectPath || (doc.parsedData as any)?.downloadUrl;
        if (path) {
          documentsToUpload.push({
            type: 'supporting',
            name: doc.filename || 'document.pdf',
            path,
            description:
              (doc.parsedData as any)?.description || 'Supporting document',
          });
        }
      }

      // Add any additional documents from checklist
      if (documentChecklist?.requiredDocuments) {
        for (const requiredDoc of documentChecklist.requiredDocuments) {
          // Try to find matching document
          const matchingDoc = proposalDocuments.find(
            doc =>
              (doc.parsedData as any)?.documentType === requiredDoc.type ||
              doc.filename?.includes(requiredDoc.name)
          );

          if (matchingDoc) {
            const path =
              matchingDoc.objectPath ||
              (matchingDoc.parsedData as any)?.downloadUrl;

            if (path && !documentsToUpload.find(d => d.path === path)) {
              documentsToUpload.push({
                type: requiredDoc.type,
                name: requiredDoc.name,
                path,
                description: requiredDoc.description,
                required: true,
              });
            }
          }
        }
      }

      return documentsToUpload;
    } catch (error) {
      console.warn('Error getting documents to upload:', error);
      return [];
    }
  }

  private async findUploadAreas(stagehand: any): Promise<any[]> {
    const uploadSelectors = [
      'input[type="file"]',
      '[data-testid*="upload"]',
      '[data-testid*="file"]',
      '.upload-area',
      '.file-upload',
      '.dropzone',
    ];

    const uploadAreas = [];
    for (const selector of uploadSelectors) {
      try {
        const elements = stagehand.context.pages()[0].locator(selector);
        const count = await elements.count();
        for (let i = 0; i < count; i++) {
          const element = elements.nth(i);
          if (
            (await element.isVisible()) ||
            (await element.evaluate((el: any) => el.offsetParent !== null))
          ) {
            uploadAreas.push(element);
          }
        }
      } catch (_e) {
        // Ignore - element not found, continue checking
      }
    }

    return uploadAreas;
  }

  private async uploadDocumentsSequentially(
    stagehand: any,
    documents: any[],
    uploadAreas: any[]
  ): Promise<any[]> {
    const uploadResults = [];

    for (let i = 0; i < documents.length; i++) {
      const document = documents[i];
      const uploadArea = uploadAreas[i % uploadAreas.length]; // Cycle through upload areas if more docs than areas

      try {
        console.log(`📄 Uploading document: ${document.name}`);

        // Get the file input element
        const fileInput = await this.getFileInputElement(uploadArea);

        if (!fileInput) {
          throw new Error('Could not find file input element');
        }

        // Upload the file
        await fileInput.setInputFiles(document.path);

        // Wait for upload to process
        await stagehand.context.pages()[0].waitForTimeout(2000);

        // Check for upload success indicators
        const uploadSuccess = await this.checkUploadSuccess(
          stagehand,
          document.name
        );

        uploadResults.push({
          document: document.name,
          type: document.type,
          status: uploadSuccess ? 'success' : 'uncertain',
          uploadedAt: new Date(),
          path: document.path,
        });
      } catch (uploadError) {
        console.error(`Failed to upload ${document.name}:`, uploadError);
        uploadResults.push({
          document: document.name,
          type: document.type,
          status: 'failed',
          error:
            uploadError instanceof Error
              ? uploadError.message
              : String(uploadError),
          path: document.path,
        });
      }
    }

    return uploadResults;
  }

  private async getFileInputElement(uploadArea: any): Promise<any> {
    try {
      // If the element itself is a file input, return it
      const tagName = await uploadArea.evaluate((el: any) =>
        el.tagName.toLowerCase()
      );
      if (tagName === 'input') {
        const type = await uploadArea.getAttribute('type');
        if (type === 'file') {
          return uploadArea;
        }
      }

      // Look for file input within the upload area
      const fileInput = uploadArea.locator('input[type="file"]').first();
      if ((await fileInput.isVisible()) || (await fileInput.count()) > 0) {
        return fileInput;
      }

      // Look for hidden file inputs (common in modern upload components)
      const hiddenInput = uploadArea.locator('input[type="file"]').first();
      if ((await hiddenInput.count()) > 0) {
        return hiddenInput;
      }

      return null;
    } catch (error) {
      throw new Error(
        `Could not find file input: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async checkUploadSuccess(
    stagehand: any,
    fileName: string
  ): Promise<boolean> {
    try {
      // Look for success indicators
      const successSelectors = [
        `text=/${fileName}/i`,
        '.upload-success',
        '.file-uploaded',
        '.success',
        '[data-testid*="success"]',
      ];

      for (const selector of successSelectors) {
        try {
          const element = stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible({ timeout: 3000 })) {
            return true;
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      // Look for error indicators
      const errorSelectors = [
        '.upload-error',
        '.error',
        '.failed',
        '[data-testid*="error"]',
      ];

      for (const selector of errorSelectors) {
        try {
          const element = stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible({ timeout: 1000 })) {
            return false;
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      // If no clear indicators, assume success
      return true;
    } catch (error) {
      return false;
    }
  }

  private async verifyUploads(
    stagehand: any,
    uploadResults: any[]
  ): Promise<any> {
    try {
      const successfulUploads = uploadResults.filter(
        result => result.status === 'success'
      );
      const failedUploads = uploadResults.filter(
        result => result.status === 'failed'
      );

      // Look for upload summary or list
      const uploadListSelectors = [
        '.uploaded-files',
        '.file-list',
        '.attachments',
        '[data-testid*="uploaded"]',
      ];

      let foundUploadList = false;
      for (const selector of uploadListSelectors) {
        try {
          const element = stagehand.context.pages()[0].locator(selector).first();
          if (await element.isVisible()) {
            foundUploadList = true;
            break;
          }
        } catch (_e) {
          // Ignore - element not found, continue checking
        }
      }

      return {
        status: failedUploads.length === 0 ? 'all_uploaded' : 'partial_upload',
        successfulUploads: successfulUploads.length,
        failedUploads: failedUploads.length,
        totalUploads: uploadResults.length,
        uploadListVisible: foundUploadList,
        confirmations: uploadResults.map(result => ({
          document: result.document,
          status: result.status,
          timestamp: result.uploadedAt,
        })),
        verifiedAt: new Date(),
      };
    } catch (error) {
      return {
        status: 'verification_failed',
        error: error instanceof Error ? error.message : String(error),
        confirmations: [],
        verifiedAt: new Date(),
      };
    }
  }

  private isRetryableError(error: any): boolean {
    const retryableErrors = [
      'timeout',
      'network',
      'connection',
      'file not found',
      'upload failed',
      'server error',
    ];

    const errorMessage = error?.message?.toLowerCase() || '';
    return retryableErrors.some(retryableError =>
      errorMessage.includes(retryableError)
    );
  }
}

// Export specialist instances
export const portalAuthenticationSpecialist =
  new PortalAuthenticationSpecialist();
export const formSubmissionSpecialist = new FormSubmissionSpecialist();
export const documentUploadSpecialist = new DocumentUploadSpecialist();
