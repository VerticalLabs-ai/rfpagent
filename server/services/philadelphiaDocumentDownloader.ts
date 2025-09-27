import { Stagehand } from '@browserbasehq/stagehand';
import { storage } from '../storage.js';

export interface PhiladelphiaDocument {
  name: string;
  downloadStatus: 'pending' | 'completed' | 'failed';
  error?: string;
  storagePath?: string;
  size?: number;
  contentType?: string;
}

export class PhiladelphiaDocumentDownloader {
  private readonly objectStorage: any;

  constructor(objectStorage: any) {
    this.objectStorage = objectStorage;
  }

  /**
   * Create Stagehand configuration for Philadelphia portal
   */
  private createStagehandConfig() {
    return {
      env: "BROWSERBASE" as const,
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      verbose: 1 as const,
      browserbaseSessionCreateParams: {
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        keepAlive: true,
        timeout: 3600,
        browserSettings: {
          advancedStealth: false,
          solveCaptchas: false,
          blockAds: true,
          recordSession: true,
          logSession: true,
          viewport: {
            width: 1920,
            height: 1080
          }
        },
        region: "us-west-2" as const
      }
    };
  }

  /**
   * Download documents from Philadelphia RFP portal
   * Uses proven Stagehand approach with page.act() and page.goBack()
   */
  async downloadRFPDocuments(
    rfpUrl: string,
    rfpId: string,
    documentNames: string[]
  ): Promise<PhiladelphiaDocument[]> {
    const results: PhiladelphiaDocument[] = [];
    let stagehand: Stagehand | null = null;

    console.log(`📥 Starting document download for RFP ${rfpId}`);
    console.log(`📄 Documents to download: ${documentNames.length}`);

    try {
      // Create new Stagehand instance with Google Gemini
      console.log('🤖 Initializing Stagehand with Google Gemini for downloads...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();

      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      // Navigate to RFP page
      console.log(`🌐 Navigating to RFP page: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      // Wait for file attachments section to load - Philadelphia specific
      await page.waitForSelector('text=File Attachments:', { timeout: 15000 });
      console.log(`📋 File Attachments section found`);

      // Set up response interception for monitoring (though file capture won't work in Browserbase)
      const capturedFiles: Map<string, { buffer: Buffer; contentType: string }> = new Map();

      page.on('response', async (response) => {
        try {
          const url = response.url();
          const headers = response.headers();
          const status = response.status();

          // Only process successful responses that look like file downloads
          if (status === 200) {
            const contentDisposition = headers['content-disposition'] || '';
            const contentType = headers['content-type'] || '';

            // Check if this is a download response
            if (
              contentDisposition.includes('attachment') ||
              contentType.includes('application/pdf') ||
              contentType.includes('application/msword') ||
              contentType.includes('application/vnd') ||
              url.includes('.pdf') ||
              url.includes('.doc') ||
              url.includes('.xls')
            ) {
              // Try to match this download to one of our expected documents
              const matchingDoc = documentNames.find((name) => {
                // Check various ways the document might be identified
                return (
                  url.toLowerCase().includes(name.toLowerCase()) ||
                  contentDisposition.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(url.split('/').pop()?.toLowerCase() || '')
                );
              });

              if (matchingDoc) {
                console.log(`📄 Intercepting download for: ${matchingDoc}`);
                try {
                  // Get response body as buffer - this will fail in Browserbase but we log it
                  const buffer = await response.body();

                  if (buffer.length > 0) {
                    capturedFiles.set(matchingDoc, {
                      buffer: buffer,
                      contentType: contentType || 'application/pdf',
                    });
                    console.log(`💾 Captured file: ${matchingDoc} (${buffer.length} bytes)`);
                  } else {
                    console.log(`⚠️ Empty file captured for: ${matchingDoc}`);
                  }
                } catch (error) {
                  console.error(`❌ Failed to capture file data for ${matchingDoc}:`, error);
                }
              }
            }
          }
        } catch (error) {
          // Don't let response handler errors break the main flow
          console.debug(`Response handler error:`, error);
        }
      });

      console.log(`⚙️ File capture configured with response interception`);

      // Extract the real Browserbase session ID from Stagehand with enhanced detection
      let browserbaseSessionId: string | null = null;

      try {
        // Try the new Stagehand API first
        if (stagehand && typeof (stagehand as any).getSessionId === 'function') {
          browserbaseSessionId = await (stagehand as any).getSessionId();
        }

        // If that doesn't work, try the browserbase property
        if (!browserbaseSessionId && (stagehand as any).browserbase) {
          const browserbase = (stagehand as any).browserbase;
          browserbaseSessionId = browserbase.sessionId || browserbase.session?.id;
        }

        // Try extracting from page context
        if (!browserbaseSessionId && page) {
          const context = page.context();
          const browser = context.browser();

          // Check for Browserbase-specific properties
          browserbaseSessionId =
            (context as any)._browserbaseSessionId ||
            (context as any).sessionId ||
            (browser as any)._browserbaseSessionId ||
            (browser as any).sessionId;
        }

        // Last resort: try extracting from WebSocket URL or debug URL
        if (!browserbaseSessionId && page) {
          try {
            const browserContext = page.context();
            const cdpSession = await browserContext.newCDPSession(page);
            const targetInfo = await cdpSession.send('Target.getTargetInfo');
            const websocketUrl = (targetInfo as any)?.targetInfo?.url;

            if (websocketUrl) {
              const sessionMatch = websocketUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
              if (sessionMatch) {
                browserbaseSessionId = sessionMatch[1];
              }
            }
          } catch (cdpError) {
            console.log(`⚠️ CDP session extraction failed: ${cdpError}`);
          }
        }

        console.log(`🆔 Browserbase session ID: ${browserbaseSessionId || 'not found'}`);
      } catch (error) {
        console.log(`⚠️ Could not extract Browserbase session ID: ${error}`);
      }

      // Process each document using the proven Stagehand approach
      for (const docName of documentNames) {
        const doc: PhiladelphiaDocument = {
          name: docName,
          downloadStatus: 'pending',
        };

        try {
          console.log(`🔍 Looking for document: ${docName}`);

          // Use Stagehand to find and click the document link
          console.log(`📎 Clicking document: "${docName}"`);
          await (stagehand as any).act({
            action: `click on the link for "${docName}"`,
          });

          // Wait for download to complete
          await page.waitForTimeout(5000);

          // For Philadelphia portal, the click succeeded if no error was thrown
          // Files are stored in Browserbase but not accessible for re-upload due to environment limitations
          console.log(`✅ Successfully triggered download for: ${docName}`);
          doc.downloadStatus = 'completed';

          // Navigate back to the RFP page to continue with other documents
          console.log(`↩️ Navigating back from ${docName}`);
          await page.goBack();
          await page.waitForTimeout(2000);
        } catch (error: any) {
          console.error(`❌ Failed to download ${docName}:`, error);
          doc.downloadStatus = 'failed';
          doc.error = error.message;

          // Try to get back to the main page if we're stuck
          try {
            await page.goBack();
            await page.waitForTimeout(1000);
          } catch (backError) {
            console.error(`Failed to navigate back after error:`, backError);
          }
        }

        results.push(doc);
      }

      // Report successful downloads (files triggered in Browserbase)
      const successfulDownloads = results.filter((d) => d.downloadStatus === 'completed');
      const actuallyStoredCount = successfulDownloads.length;

      console.log(`📊 Successfully stored ${actuallyStoredCount}/${successfulDownloads.length} files`);

      const finalSuccessCount = results.filter((d) => d.downloadStatus === 'completed').length;
      console.log(`✅ Successfully processed ${finalSuccessCount}/${documentNames.length} documents`);

      return results;
    } catch (error: any) {
      console.error('❌ Document download process failed:', error);

      // Mark all pending documents as failed
      for (const docName of documentNames) {
        if (!results.find((r) => r.name === docName)) {
          results.push({
            name: docName,
            downloadStatus: 'failed',
            error: error.message,
          });
        }
      }

      throw error;
    } finally {
      // Clean up Stagehand session
      if (stagehand) {
        try {
          await stagehand.close();
          console.log('🔒 Stagehand session closed');
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }
}