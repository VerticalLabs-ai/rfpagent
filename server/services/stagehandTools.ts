import { Stagehand } from "@browserbasehq/stagehand";
import { z } from "zod";

export interface StagehandSession {
  stagehand: Stagehand;
  sessionId: string;
  createdAt: Date;
}

class StagehandSessionManager {
  private sessions: Map<string, StagehandSession> = new Map();
  private defaultSessionId = 'default';

  async createStagehand(sessionId: string = this.defaultSessionId): Promise<Stagehand> {
    // Check if we have an existing session
    const existingSession = this.sessions.get(sessionId);
    if (existingSession && existingSession.stagehand.page) {
      try {
        // Test if the browser is still alive
        await existingSession.stagehand.page.url();
        return existingSession.stagehand;
      } catch (error) {
        // Browser is dead, clean up
        await this.closeSession(sessionId);
      }
    }

    // Create new Stagehand instance
    const stagehand = new Stagehand({
      env: "BROWSERBASE",
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1,
    });

    await stagehand.init();
    
    // Store the session
    this.sessions.set(sessionId, {
      stagehand,
      sessionId,
      createdAt: new Date(),
    });

    return stagehand;
  }

  async ensureStagehand(sessionId: string = this.defaultSessionId): Promise<Stagehand> {
    return this.createStagehand(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        await session.stagehand.close();
      } catch (error) {
        console.warn(`Error closing Stagehand session ${sessionId}:`, error);
      }
      this.sessions.delete(sessionId);
    }
  }

  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    await Promise.all(sessionIds.map(id => this.closeSession(id)));
  }

  getSession(sessionId: string = this.defaultSessionId): StagehandSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const sessionManager = new StagehandSessionManager();

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
  const stagehand = await sessionManager.ensureStagehand(sessionId);
  const page = stagehand.page;

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Perform the action
    console.log(`🎬 Stagehand performing action: ${action}`);
    await page.act(action);

    const currentUrl = await page.url();
    
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
  const stagehand = await sessionManager.ensureStagehand(sessionId);
  const page = stagehand.page;

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Observe the page
    console.log(`👀 Stagehand observing: ${instruction}`);
    const observations = await page.observe(instruction);

    const currentUrl = await page.url();

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
  schema: Record<string, any> = { content: z.string() },
  sessionId: string = 'default'
): Promise<WebExtractionResult> {
  const stagehand = await sessionManager.ensureStagehand(sessionId);
  const page = stagehand.page;

  try {
    // Navigate to URL if provided
    if (url) {
      console.log(`🌐 Stagehand navigating to: ${url}`);
      await page.goto(url);
    }

    // Convert schema to Zod schema
    const zodSchema = z.object(schema);

    // Extract data
    console.log(`📤 Stagehand extracting: ${instruction}`);
    const data = await page.extract({
      instruction,
      schema: zodSchema,
    });

    const currentUrl = await page.url();

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
 * Authenticate using Stagehand browser automation
 */
export async function performBrowserAuthentication(
  loginUrl: string,
  username: string,
  password: string,
  targetUrl: string,
  sessionId: string = 'default'
): Promise<{ success: boolean; sessionData: any; targetUrl: string }> {
  const stagehand = await sessionManager.ensureStagehand(sessionId);
  const page = stagehand.page;

  try {
    console.log(`🔐 Starting browser authentication for: ${loginUrl}`);
    
    // Navigate to login page
    await page.goto(loginUrl);
    
    // Try to find and fill login form
    console.log('🔍 Looking for login form...');
    
    // First, observe the page to understand the login form structure
    const loginObservations = await page.observe('find the login form with username and password fields');
    console.log('🔍 Login form observations:', loginObservations);
    
    // Fill in username
    console.log(`👤 Entering username: ${username}`);
    await page.act(`type "${username}" in the username field`);
    
    // Fill in password
    console.log('🔑 Entering password...');
    await page.act(`type "${password}" in the password field`);
    
    // Submit the form
    console.log('🚀 Submitting login form...');
    await page.act('click the login button or submit button');
    
    // Wait for navigation/login to complete
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check if we're successfully logged in by trying to navigate to target URL
    console.log(`🎯 Navigating to target URL: ${targetUrl}`);
    
    // Navigate to target URL with proper waiting and Cloudflare handling
    try {
      // Navigate with domcontentloaded first (faster for heavy JS pages)
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
      
      // Handle Cloudflare protection if present
      const pageTitle = await page.title();
      console.log(`📄 Target page title: "${pageTitle}"`);
      
      if (pageTitle.includes("Just a moment") || pageTitle.includes("Please wait")) {
        console.log(`🛡️ Cloudflare protection detected on target page, waiting for bypass...`);
        
        try {
          await page.waitForFunction(
            () => !document.title.includes("Just a moment") && !document.title.includes("Please wait"),
            { timeout: 30000 }
          );
          console.log(`✅ Cloudflare protection bypassed on target page`);
          
          // Give additional time for the real page to load
          await page.waitForTimeout(3000);
        } catch (cloudflareError) {
          console.log(`⚠️ Cloudflare bypass timeout on target page, proceeding anyway...`);
        }
      }
      
      // Wait for opportunities page specific content to load
      console.log(`🔍 Waiting for opportunities page content...`);
      try {
        await Promise.race([
          page.waitForSelector('table, .opportunity, .listing, .rfp, .bid, [data-testid*="opportunity"], [class*="opportunity"]', { timeout: 15000 }),
          page.waitForTimeout(15000)
        ]);
        console.log(`✅ Opportunities page content detected`);
      } catch (waitError) {
        console.log(`⚠️ Opportunities content wait timeout, but proceeding...`);
      }
      
    } catch (navError: any) {
      console.log(`⚠️ Navigation to target URL had issues: ${navError.message}, but proceeding...`);
    }
    
    // Extract any session cookies
    const cookies = await page.context().cookies();
    const currentUrl = await page.url();
    console.log(`🌐 Final URL after navigation: ${currentUrl}`);
    
    // Handle bounce URL redirects (common in portals after authentication)
    if (currentUrl.includes('bounceUrl')) {
      try {
        const url = new URL(currentUrl);
        const bounceUrl = url.searchParams.get('bounceUrl');
        if (bounceUrl) {
          console.log(`🔄 Bounce URL detected: ${bounceUrl}, navigating to actual target...`);
          const fullBounceUrl = bounceUrl.startsWith('http') ? bounceUrl : `${url.origin}${bounceUrl}`;
          console.log(`🎯 Navigating to bounce URL: ${fullBounceUrl}`);
          
          // Navigate to the bounce URL with proper waiting
          await page.goto(fullBounceUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
          
          // Handle Cloudflare protection on bounce URL if needed
          const bouncePageTitle = await page.title();
          console.log(`📄 Bounce page title: "${bouncePageTitle}"`);
          
          if (bouncePageTitle.includes("Just a moment") || bouncePageTitle.includes("Please wait")) {
            console.log(`🛡️ Cloudflare protection detected on bounce page, waiting for bypass...`);
            try {
              await page.waitForFunction(
                () => !document.title.includes("Just a moment") && !document.title.includes("Please wait"),
                { timeout: 30000 }
              );
              console.log(`✅ Cloudflare protection bypassed on bounce page`);
              await page.waitForTimeout(3000);
            } catch (cloudflareError) {
              console.log(`⚠️ Cloudflare bypass timeout on bounce page, proceeding anyway...`);
            }
          }
          
          // Wait for opportunities content on the actual target page
          console.log(`🔍 Waiting for opportunities content on bounce page...`);
          try {
            await Promise.race([
              page.waitForSelector('table, .opportunity, .listing, .rfp, .bid, [data-testid*="opportunity"], [class*="opportunity"]', { timeout: 15000 }),
              page.waitForTimeout(15000)
            ]);
            console.log(`✅ Opportunities content detected on bounce page`);
          } catch (waitError) {
            console.log(`⚠️ Opportunities content wait timeout on bounce page, but proceeding...`);
          }
        }
      } catch (bounceError: any) {
        console.log(`⚠️ Error handling bounce URL: ${bounceError.message}`);
      }
    }
    
    // Check if we successfully reached the target or got redirected to login
    const finalUrl = await page.url();
    console.log(`🌐 Final URL after bounce handling: ${finalUrl}`);
    const isLoggedIn = !finalUrl.includes('login') && !finalUrl.includes('signin');
    
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
  const stagehand = await sessionManager.ensureStagehand(sessionId);
  const page = stagehand.page;

  try {
    console.log(`🔍 Scraping authenticated content from: ${targetUrl}`);
    
    // Navigate to target page (should already be authenticated)
    await page.goto(targetUrl);
    
    // Extract RFP/opportunity data
    const extractionSchema = {
      opportunities: z.array(z.object({
        title: z.string(),
        id: z.string().optional(),
        deadline: z.string().optional(),
        description: z.string().optional(),
        agency: z.string().optional(),
        value: z.string().optional(),
        url: z.string().optional(),
      }))
    };
    
    const result = await page.extract({
      instruction: extractionInstruction,
      schema: z.object(extractionSchema),
    });
    
    // Get current session data
    const cookies = await page.context().cookies();
    const currentUrl = await page.url();
    
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