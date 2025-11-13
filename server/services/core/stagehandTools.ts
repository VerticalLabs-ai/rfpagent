import { z } from 'zod';
import { sessionManager } from '../../../src/mastra/tools/session-manager';

// SessionManager has been moved to src/mastra/tools/session-manager.ts
// Now using the new Mastra-compliant implementation

/**
 * Default timeout for Stagehand operations (observe, extract, act)
 */
const STAGEHAND_OPERATION_TIMEOUT = 30000; // 30 seconds

/**
 * Wraps a Stagehand operation with timeout protection
 * @param operation - The Stagehand operation to execute
 * @param timeoutMs - Timeout in milliseconds (default: 30000)
 * @param operationName - Name of the operation for error messages
 * @returns Promise that resolves with the operation result or rejects on timeout
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = STAGEHAND_OPERATION_TIMEOUT,
  operationName: string = 'Stagehand operation'
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error(`${operationName} timed out after ${timeoutMs / 1000}s`)
          ),
        timeoutMs
      )
    ),
  ]);
}

export interface WebActionResult {
  success: boolean;
  message: string;
  url?: string;
  screenshot?: string;
}

export interface WebObservationResult {
  observations: any[];
  url: string;
}

export interface WebExtractionResult {
  data: any;
  url: string;
}

/**
 * Perform an action on a webpage using Stagehand
 */
export async function performWebAction(
  url: string | null,
  action: string,
  sessionId: string = 'default'
): Promise<WebActionResult> {
  const { stagehand, page } =
    await sessionManager.getStagehandAndPage(sessionId);

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Perform the action using Stagehand instance with timeout protection
    console.log(`🎬 Stagehand performing action: ${action}`);
    await withTimeout(
      stagehand.act(action),
      STAGEHAND_OPERATION_TIMEOUT,
      'act'
    );

    const currentUrl = page.url();

    return {
      success: true,
      message: `Successfully performed: ${action}`,
      url: currentUrl,
    };
  } catch (error: any) {
    console.error('Stagehand action failed:', error);
    throw new Error(`Stagehand action failed: ${error.message}`);
  }
}

/**
 * Observe elements on a webpage using Stagehand
 */
export async function performWebObservation(
  url: string | null,
  instruction: string,
  sessionId: string = 'default'
): Promise<WebObservationResult> {
  const { stagehand, page } =
    await sessionManager.getStagehandAndPage(sessionId);

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Observe the page using Stagehand instance with timeout protection
    console.log(`👀 Stagehand observing: ${instruction}`);
    const observations = await withTimeout(
      stagehand.observe(instruction),
      STAGEHAND_OPERATION_TIMEOUT,
      'observe'
    );

    const currentUrl = page.url();

    return {
      observations,
      url: currentUrl,
    };
  } catch (error: any) {
    console.error('Stagehand observation failed:', error);
    throw new Error(`Stagehand observation failed: ${error.message}`);
  }
}

/**
 * Extract data from a webpage using Stagehand
 */
export async function performWebExtraction(
  url: string | null,
  instruction: string,
  schema: any,
  sessionId: string = 'default'
): Promise<WebExtractionResult> {
  const { stagehand, page } =
    await sessionManager.getStagehandAndPage(sessionId);

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Debug: log schema to understand what's being passed
    console.log('Schema type:', typeof schema);
    console.log('Schema has _def:', !!schema?._def);
    console.log(
      'Schema structure:',
      JSON.stringify(schema, null, 2).substring(0, 500)
    );

    // Use schema directly if it's already a Zod schema, otherwise wrap it
    const zodSchema = schema?._def ? schema : z.object(schema);

    // Extract data with timeout protection
    console.log(`📤 Stagehand extracting: ${instruction}`);
    const data = await withTimeout(
      stagehand.extract(instruction, zodSchema),
      STAGEHAND_OPERATION_TIMEOUT,
      'extract'
    );

    const currentUrl = page.url();

    return {
      data,
      url: currentUrl,
    };
  } catch (error: any) {
    console.error('Stagehand extraction failed:', error);
    throw new Error(`Stagehand extraction failed: ${error.message}`);
  }
}

/**
 * Handle Bonfire Hub specific authentication (Euna Supplier Network)
 */
async function handleBonfireAuthentication(
  stagehand: any,
  page: any,
  username: string,
  password: string,
  targetUrl: string
): Promise<{ success: boolean; sessionData: any; targetUrl: string }> {
  // Separate timeout for login sequence vs post-login navigation
  const loginTimeout = 90000; // 90 seconds for login sequence only

  try {
    console.log(
      '🔥 Starting Bonfire Hub (Euna Supplier Network) authentication...'
    );
    console.log(`⏰ Login timeout set to ${loginTimeout / 1000} seconds`);

    // Only timeout the actual login process, not post-login navigation
    const loginResult = await Promise.race([
      performBonfireLoginOnly(stagehand, page, username, password),
      new Promise<{ success: boolean; error?: string }>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Bonfire Hub login timed out after ${loginTimeout / 1000} seconds`
              )
            ),
          loginTimeout
        )
      ),
    ]);

    if (!loginResult.success) {
      throw new Error(loginResult.error || 'Bonfire Hub authentication failed');
    }

    // Post-login navigation handled separately without tight timeout
    return await performPostLoginNavigation(stagehand, page, targetUrl);
  } catch (error: any) {
    const errorContext = {
      phase: 'bonfire_authentication',
      targetUrl: targetUrl,
      loginTimeout: loginTimeout,
      timestamp: new Date().toISOString(),
      userAgent: 'Stagehand Browser Automation',
    };

    console.error(`❌ Bonfire Hub authentication error:`, error);
    console.error(`🔍 Error context:`, errorContext);

    // Categorize and enhance error with structured information
    const structuredError = {
      code: 'BONFIRE_AUTH_UNKNOWN',
      message: error.message,
      category: 'authentication',
      portal: 'bonfire_hub',
      recoverable: false,
      context: errorContext,
    };

    if (error.message.includes('timed out')) {
      structuredError.code = 'BONFIRE_AUTH_TIMEOUT';
      structuredError.recoverable = true;
      console.error(
        `🕒 Bonfire Hub authentication timed out - this may indicate credential issues or Euna system problems`
      );
    } else if (error.message.includes('2FA required')) {
      structuredError.code = 'BONFIRE_AUTH_2FA_REQUIRED';
      structuredError.category = 'authentication_blocked';
      structuredError.recoverable = false;
    } else if (error.message.includes('SSO detected')) {
      structuredError.code = 'BONFIRE_AUTH_SSO_REQUIRED';
      structuredError.category = 'authentication_blocked';
      structuredError.recoverable = false;
    } else if (error.message.includes('still on login page')) {
      structuredError.code = 'BONFIRE_AUTH_CREDENTIALS_INVALID';
      structuredError.recoverable = false;
    } else if (error.message.includes('Password field never appeared')) {
      structuredError.code = 'BONFIRE_AUTH_FORM_CHANGED';
      structuredError.recoverable = true;
    }

    // Create enhanced error with structured data
    const enhancedError = new Error(structuredError.message);
    (enhancedError as any).structured = structuredError;

    // Rethrow the enhanced error so it propagates to portal monitoring service
    throw enhancedError;
  }
}

/**
 * Perform only the login steps (for timeout scoping)
 */
async function performBonfireLoginOnly(
  stagehand: any,
  page: any,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Handle cookie banners first
    console.log('🍪 Checking for cookie consent banners...');
    try {
      const cookieButtonSelectors = [
        'button:has-text("Accept")',
        'button:has-text("Accept All")',
        'button:has-text("Agree")',
        'button:has-text("Continue")',
        '[id*="accept"]',
        '[class*="accept"]',
        'button[value*="accept"]',
        'button[title*="accept"]',
      ];

      for (const selector of cookieButtonSelectors) {
        try {
          await page.waitForSelector(selector, { timeoutMs: 2000 });
          await page.click(selector);
          console.log(`✅ Clicked cookie consent button: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        } catch (cookieError) {
          // Continue to next selector
        }
      }
    } catch (cookieError) {
      console.log(
        '⚠️ No cookie banner detected or failed to handle, proceeding...'
      );
    }

    // Check for the "Login to Euna Supplier Network" dialog
    console.log('🔍 Looking for Euna Supplier Network login dialog...');

    // Observe the current page structure with timeout protection
    const pageObservation = await withTimeout(
      stagehand.observe('Look for login dialog, buttons, or forms on the page'),
      STAGEHAND_OPERATION_TIMEOUT,
      'observe'
    );
    console.log('📄 Page structure:', pageObservation);

    // Try to find and click the "Log In" button if there's a modal/dialog
    console.log('🎯 Looking for Log In button...');
    try {
      // Wait for login button or dialog to appear with timeout protection
      await withTimeout(
        stagehand.act('click the "Log In" button or login link if visible'),
        STAGEHAND_OPERATION_TIMEOUT,
        'act'
      );
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.log(
        '⚠️ No initial Log In button found, proceeding with form detection...'
      );
    }

    // Multi-step Euna login flow: First enter email, then wait for password field
    console.log('📝 Step 1: Looking for email address field...');
    try {
      await withTimeout(
        stagehand.act(
          `type "${username}" in the email address field, email field, or username field`
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'act'
      );
    } catch (emailError) {
      console.log('⚠️ Email field entry failed, trying alternate approach...');
      await withTimeout(
        stagehand.act(
          `type "${username}" in the input field for email or username`
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'act'
      );
    }

    console.log(
      '▶️ Step 2: Clicking Continue button to proceed to password step...'
    );
    try {
      await withTimeout(
        stagehand.act(
          'click the "Continue" button, "Next" button, or submit button'
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'act'
      );
    } catch (continueError) {
      console.log('⚠️ Continue button click failed, trying Enter key...');
      await page.keyboard.press('Enter');
    }

    // Wait for password field to appear with proper selector detection
    console.log('⏳ Step 3: Waiting for password field to appear...');
    let passwordFieldFound = false;
    let matchedPasswordSelector = '';
    const passwordSelectors = [
      'input[type="password"]',
      'input[name*="password"]',
      'input[name*="Password"]',
      'input[id*="password"]',
      'input[placeholder*="password"]',
      'input[placeholder*="Password"]',
    ];

    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Try to find password field with multiple selectors
        for (const selector of passwordSelectors) {
          try {
            await page.waitForSelector(selector, { timeoutMs: 1000 });
            passwordFieldFound = true;
            matchedPasswordSelector = selector;
            console.log(
              `✅ Password field detected with selector: ${selector} after ${attempt + 1} seconds`
            );
            break;
          } catch (selectorError) {
            // Continue to next selector
          }
        }

        if (passwordFieldFound) break;
        console.log(
          `⏳ Password field not yet visible, attempt ${attempt + 1}/10...`
        );
      } catch (checkError: unknown) {
        const errorMessage =
          checkError instanceof Error ? checkError.message : 'Unknown error';
        console.log(
          `⏳ Error checking for password field, attempt ${attempt + 1}/10:`,
          errorMessage
        );
      }
    }

    if (!passwordFieldFound) {
      throw new Error(
        'Password field never appeared after entering email and clicking Continue. Possible issues: email was invalid, 2FA required, SSO redirect, or page structure changed.'
      );
    }

    console.log('🔑 Step 4: Entering password using detected selector...');
    await page.fill(matchedPasswordSelector, password);

    // Submit the login form with timeout protection
    console.log('🚀 Submitting Euna Supplier Network login...');
    await withTimeout(
      stagehand.act(
        'click the login button, submit button, or "Log In" button'
      ),
      STAGEHAND_OPERATION_TIMEOUT,
      'act'
    );

    // Wait for authentication to complete
    console.log('⏳ Waiting for authentication to complete...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check if we successfully logged in by looking for typical post-login indicators
    try {
      const postLoginCheck = await withTimeout(
        stagehand.observe(
          'Look for success indicators like dashboard, opportunities, welcome message, or vendor portal content'
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'observe'
      );
      console.log('✅ Post-login check:', postLoginCheck);

      // Check for 2FA/SSO indicators
      const currentUrl = page.url();
      const currentTitle = await page.title();

      // Safely convert observe result to string for content analysis
      const pageContent = JSON.stringify(postLoginCheck || '').toLowerCase();

      // Detect 2FA scenarios
      const twoFactorIndicators = [
        'verification code',
        'two-factor',
        '2fa',
        'authenticator',
        'verify',
        'enter code',
        'security code',
        'sms code',
        'phone verification',
      ];
      const hasTwoFactor = twoFactorIndicators.some(
        indicator =>
          pageContent.includes(indicator) ||
          currentTitle.toLowerCase().includes(indicator)
      );

      // Detect SSO redirects
      const ssoIndicators = [
        'sso',
        'saml',
        'oauth',
        'microsoft',
        'google',
        'okta',
        'azure',
      ];
      const hasSSORedirect = ssoIndicators.some(
        indicator =>
          currentUrl.toLowerCase().includes(indicator) ||
          currentTitle.toLowerCase().includes(indicator)
      );

      if (hasTwoFactor) {
        throw new Error(
          '2FA required - Two-factor authentication detected. Manual verification needed.'
        );
      }

      if (hasSSORedirect) {
        throw new Error(
          'SSO detected - Single sign-on redirect detected. Account may require SSO authentication.'
        );
      }

      const isLoginSuccessful =
        !currentUrl.includes('login') &&
        !currentTitle.toLowerCase().includes('login') &&
        !currentTitle.toLowerCase().includes('sign in');

      if (isLoginSuccessful) {
        console.log('✅ Login phase completed successfully');
        return { success: true };
      } else {
        console.log('❌ Login phase failed - still on login page');
        throw new Error(
          'Authentication failed - still on login page. Check credentials and account status.'
        );
      }
    } catch (checkError: unknown) {
      const errorMessage =
        checkError instanceof Error
          ? checkError.message
          : 'Login verification failed';
      console.log('⚠️ Login verification error:', errorMessage);
      throw new Error(errorMessage || 'Could not verify login success');
    }
  } catch (error: any) {
    console.error(`❌ Login phase error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Handle post-login navigation and cookie extraction
 */
async function performPostLoginNavigation(
  stagehand: any,
  page: any,
  targetUrl: string
): Promise<{ success: boolean; sessionData: any; targetUrl: string }> {
  try {
    // Navigate to the target opportunities page
    console.log(`🎯 Navigating to target URL: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 45000,
    });

    // Handle potential Cloudflare protection
    const pageTitle = await page.title();
    console.log(`📄 Target page title: "${pageTitle}"`);

    if (
      pageTitle.includes('Just a moment') ||
      pageTitle.includes('Please wait')
    ) {
      console.log(`🛡️ Cloudflare protection detected, waiting for bypass...`);
      try {
        await page.waitForSelector(
          () =>
            !document.title.includes('Just a moment') &&
            !document.title.includes('Please wait'),
          { timeoutMs: 30000 }
        );
        console.log(`✅ Cloudflare protection bypassed`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      } catch (cloudflareError) {
        console.log(`⚠️ Cloudflare bypass timeout, proceeding anyway...`);
      }
    }

    // Wait for opportunities content to load
    console.log(`🔍 Waiting for Bonfire opportunities page content...`);
    try {
      await Promise.race([
        page.waitForSelector(
          'table, .opportunity, .listing, .rfp, .bid, [class*="opportunity"], [data-testid*="opportunity"]',
          { timeoutMs: 15000 }
        ),
        page.waitForTimeout(15000),
      ]);
      console.log(`✅ Bonfire opportunities page content detected`);
    } catch (contentError) {
      console.log(
        `⚠️ Opportunities content not detected within timeout, proceeding...`
      );
    }

    // Get final page info
    const finalUrl = page.url();
    const finalTitle = await page.title();

    console.log(`🎉 Bonfire authentication completed: ${finalUrl}`);
    console.log(`📄 Final page title: "${finalTitle}"`);

    // Check if authentication was successful by examining URL and content
    const isSuccessful =
      !finalUrl.includes('login') &&
      !finalTitle.toLowerCase().includes('login') &&
      !finalTitle.toLowerCase().includes('sign in');

    if (isSuccessful) {
      console.log(`✅ Bonfire Hub authentication successful!`);

      // Get cookies from Stagehand context (cast to any to access cookies method)
      const context: any = stagehand.context;
      const stagehandCookies = await context.cookies();
      console.log(
        `🍪 Retrieved ${stagehandCookies.length} cookies from authenticated session`
      );

      // Convert Stagehand cookies to Puppeteer-compatible format
      const puppeteerCookies = stagehandCookies.map((cookie: any) => {
        let expires = undefined;
        if (cookie.expires) {
          // Handle both milliseconds and seconds - if > 10^12, treat as milliseconds
          expires =
            cookie.expires > 1000000000000
              ? Math.floor(cookie.expires / 1000)
              : cookie.expires;
        }

        return {
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain,
          path: cookie.path || '/',
          expires,
          size: undefined,
          httpOnly: cookie.httpOnly || false,
          secure: cookie.secure || false,
          session: !expires, // Session if no expiry set
          sameSite: cookie.sameSite || 'Lax',
        };
      });

      // Convert cookies to semicolon-delimited string format expected by MastraScrapingService
      const cookieString = stagehandCookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      console.log(
        `🍪 Converted ${stagehandCookies.length} cookies to string format for compatibility`
      );

      return {
        success: true,
        sessionData: {
          cookies: cookieString, // String format expected by MastraScrapingService
          puppeteerCookies: puppeteerCookies, // Keep object format as backup
          stagehandCookies: stagehandCookies, // Keep original format as backup
          url: finalUrl,
          title: finalTitle,
        },
        targetUrl: finalUrl,
      };
    } else {
      console.log(
        `❌ Bonfire Hub authentication may have failed - still on login page`
      );
      throw new Error(
        'Authentication failed - still on login page. Check credentials and account status.'
      );
    }
  } catch (error: any) {
    console.error(`❌ Bonfire Hub post-login navigation error:`, error);
    throw error;
  }
}

/**
 * Authenticate using Stagehand browser automation
 */
export async function performBrowserAuthentication(
  loginUrl: string,
  username: string,
  password: string,
  targetUrl: string,
  sessionId: string = 'default'
): Promise<{ success: boolean; sessionData: any; targetUrl: string }> {
  const { stagehand, page } =
    await sessionManager.getStagehandAndPage(sessionId);

  try {
    console.log(`🔐 Starting browser authentication for: ${loginUrl}`);

    // Navigate to login page
    await page.goto(loginUrl, {
      waitUntil: 'domcontentloaded',
      timeoutMs: 30000,
    });

    // Check if this is a Bonfire Hub portal (Euna Supplier Network)
    const isBonfireHub =
      loginUrl.includes('bonfirehub.com') ||
      loginUrl.includes('vendor.bonfire');

    if (isBonfireHub) {
      console.log(
        '🔥 Detected Bonfire Hub portal - using specialized authentication...'
      );
      return await handleBonfireAuthentication(
        stagehand,
        page,
        username,
        password,
        targetUrl
      );
    }

    // Generic authentication for other portals
    console.log('🔍 Using generic authentication flow...');

    // First, observe the page to understand the login form structure with timeout protection
    const loginObservations = await withTimeout(
      stagehand.observe(
        'find the login form with username and password fields'
      ),
      STAGEHAND_OPERATION_TIMEOUT,
      'observe'
    );
    console.log('🔍 Login form observations:', loginObservations);

    // Fill in username (SECURITY: Never log actual credentials)
    console.log(`👤 Entering username: [REDACTED]`);
    await withTimeout(
      stagehand.act(`type "${username}" in the username field`),
      STAGEHAND_OPERATION_TIMEOUT,
      'act'
    );

    // Fill in password (SECURITY: Never log actual credentials)
    console.log('🔑 Entering password: [REDACTED]');
    await withTimeout(
      stagehand.act(`type "${password}" in the password field`),
      STAGEHAND_OPERATION_TIMEOUT,
      'act'
    );

    // Submit the form
    console.log('🚀 Submitting login form...');
    await withTimeout(
      stagehand.act('click the login button or submit button'),
      STAGEHAND_OPERATION_TIMEOUT,
      'act'
    );

    // Wait for navigation/login to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're successfully logged in by trying to navigate to target URL
    console.log(`🎯 Navigating to target URL: ${targetUrl}`);

    // Navigate to target URL with proper waiting and Cloudflare handling
    try {
      // Navigate with domcontentloaded first (faster for heavy JS pages)
      await page.goto(targetUrl, {
        waitUntil: 'domcontentloaded',
        timeoutMs: 45000,
      });

      // Handle Cloudflare protection if present
      const pageTitle = await page.title();
      console.log(`📄 Target page title: "${pageTitle}"`);

      if (
        pageTitle.includes('Just a moment') ||
        pageTitle.includes('Please wait')
      ) {
        console.log(
          `🛡️ Cloudflare protection detected on target page, waiting for bypass...`
        );

        try {
          // Wait for Cloudflare protection to clear
          await new Promise(resolve => setTimeout(resolve, 5000));
          console.log(`✅ Cloudflare protection bypassed on target page`);

          // Give additional time for the real page to load
          await new Promise(resolve => setTimeout(resolve, 3000));
        } catch (cloudflareError) {
          console.log(
            `⚠️ Cloudflare bypass timeout on target page, proceeding anyway...`
          );
        }
      }

      // Wait for opportunities page specific content to load
      console.log(`🔍 Waiting for opportunities page content...`);
      try {
        // Use simple timeout since waitForSelector and waitForTimeout don't exist
        await new Promise(resolve => setTimeout(resolve, 3000));
        console.log(`✅ Opportunities page content loaded`);
      } catch (waitError) {
        console.log(`⚠️ Opportunities content wait timeout, but proceeding...`);
      }
    } catch (navError: any) {
      console.log(
        `⚠️ Navigation to target URL had issues: ${navError.message}, but proceeding...`
      );
    }

    // Extract any session cookies (cast to any to access cookies method)
    const context: any = stagehand.context;
    const cookies = await context.cookies();
    const currentUrl = page.url();
    console.log(`🌐 Final URL after navigation: ${currentUrl}`);

    // Handle bounce URL redirects (common in portals after authentication)
    if (currentUrl.includes('bounceUrl')) {
      try {
        const url = new URL(currentUrl);
        const bounceUrl = url.searchParams.get('bounceUrl');
        if (bounceUrl) {
          console.log(
            `🔄 Bounce URL detected: ${bounceUrl}, navigating to actual target...`
          );
          const fullBounceUrl = bounceUrl.startsWith('http')
            ? bounceUrl
            : `${url.origin}${bounceUrl}`;
          console.log(`🎯 Navigating to bounce URL: ${fullBounceUrl}`);

          // Navigate to the bounce URL with proper waiting
          await page.goto(fullBounceUrl, {
            waitUntil: 'domcontentloaded',
            timeoutMs: 45000,
          });

          // Handle Cloudflare protection on bounce URL if needed
          const bouncePageTitle = await page.title();
          console.log(`📄 Bounce page title: "${bouncePageTitle}"`);

          if (
            bouncePageTitle.includes('Just a moment') ||
            bouncePageTitle.includes('Please wait')
          ) {
            console.log(
              `🛡️ Cloudflare protection detected on bounce page, waiting for bypass...`
            );
            try {
              // Wait for Cloudflare protection to clear
              await new Promise(resolve => setTimeout(resolve, 5000));
              console.log(`✅ Cloudflare protection bypassed on bounce page`);
              await new Promise(resolve => setTimeout(resolve, 3000));
            } catch (cloudflareError) {
              console.log(
                `⚠️ Cloudflare bypass timeout on bounce page, proceeding anyway...`
              );
            }
          }

          // Wait for opportunities content on the actual target page
          console.log(`🔍 Waiting for opportunities content on bounce page...`);
          try {
            // Use simple timeout since waitForSelector and waitForTimeout don't exist
            await new Promise(resolve => setTimeout(resolve, 3000));
            console.log(`✅ Opportunities content loaded on bounce page`);
          } catch (waitError) {
            console.log(
              `⚠️ Opportunities content wait timeout on bounce page, but proceeding...`
            );
          }
        }
      } catch (bounceError: any) {
        console.log(`⚠️ Error handling bounce URL: ${bounceError.message}`);
      }
    }

    // Check if we successfully reached the target or got redirected to login
    const finalUrl = page.url();
    console.log(`🌐 Final URL after bounce handling: ${finalUrl}`);
    const isLoggedIn =
      !finalUrl.includes('login') && !finalUrl.includes('signin');

    if (isLoggedIn) {
      console.log('✅ Browser authentication successful!');
      return {
        success: true,
        sessionData: {
          cookies,
          sessionId,
          loginUrl,
          targetUrl: currentUrl,
        },
        targetUrl: currentUrl,
      };
    } else {
      console.log('❌ Browser authentication failed - still on login page');
      throw new Error('Authentication failed - redirected back to login page');
    }
  } catch (error: any) {
    console.error('Browser authentication error:', error);
    throw new Error(`Browser authentication failed: ${error.message}`);
  }
}

/**
 * Use existing authenticated session to scrape content
 */
export async function scrapeWithAuthenticatedSession(
  targetUrl: string,
  extractionInstruction: string,
  sessionId: string = 'default'
): Promise<{ opportunities: any[]; sessionData: any }> {
  const { stagehand, page } =
    await sessionManager.getStagehandAndPage(sessionId);

  try {
    console.log(`🔍 Scraping authenticated content from: ${targetUrl}`);

    // Navigate to target page (should already be authenticated)
    await page.goto(targetUrl);

    // Extract RFP/opportunity data
    const extractionSchema = z.object({
      opportunities: z.array(
        z.object({
          title: z.string(),
          id: z.string().optional(),
          deadline: z.string().optional(),
          description: z.string().optional(),
          agency: z.string().optional(),
          value: z.string().optional(),
          url: z.string().optional(),
        })
      ),
    });

    const result = (await withTimeout(
      stagehand.extract(extractionInstruction, extractionSchema as any),
      STAGEHAND_OPERATION_TIMEOUT,
      'extract'
    )) as any;

    // Get current session data (cast to any to access cookies method)
    const context: any = stagehand.context;
    const cookies = await context.cookies();
    const currentUrl = page.url();

    return {
      opportunities: result.opportunities || [],
      sessionData: {
        cookies,
        sessionId,
        currentUrl,
      },
    };
  } catch (error: any) {
    console.error('Authenticated scraping error:', error);
    throw new Error(`Authenticated scraping failed: ${error.message}`);
  }
}

export const stagehandTools = {
  performWebAction,
  performWebObservation,
  performWebExtraction,
  performBrowserAuthentication,
  scrapeWithAuthenticatedSession,
};
