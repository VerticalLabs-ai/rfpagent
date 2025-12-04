import { Stagehand } from '@browserbasehq/stagehand';
import { ObjectStorageService, objectStorageClient } from '../../objectStorage';

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

export interface PhiladelphiaDocument {
  name: string;
  url?: string;
  storagePath?: string;
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  error?: string;
}

export interface RFPDetails {
  bidNumber?: string;
  description?: string;
  bidOpeningDate?: string;
  purchaser?: string;
  organization?: string;
  department?: string;
  location?: string;
  fiscalYear?: string;
  typeCode?: string;
  allowElectronicQuote?: string;
  requiredDate?: string;
  availableDate?: string;
  infoContact?: string;
  bidType?: string;
  purchaseMethod?: string;
  bulletinDescription?: string;
  shipToAddress?: {
    name?: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    itemNumber?: string;
    description?: string;
    nigpCode?: string;
    quantity?: string;
    unitOfMeasure?: string;
  }>;
  attachments?: string[];
}

export class PhiladelphiaDocumentDownloader {
  private objectStorage: ObjectStorageService;
  private browserbaseApiKey: string;
  private browserbaseProjectId: string;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.validateEnvironment();

    // Safe to use after validation
    this.browserbaseApiKey = process.env.BROWSERBASE_API_KEY as string;
    this.browserbaseProjectId = process.env.BROWSERBASE_PROJECT_ID as string;
  }

  /**
   * Validate required environment variables
   */
  private validateEnvironment(): void {
    const missingVars: string[] = [];

    if (!process.env.BROWSERBASE_API_KEY) {
      missingVars.push('BROWSERBASE_API_KEY');
    }
    if (!process.env.BROWSERBASE_PROJECT_ID) {
      missingVars.push('BROWSERBASE_PROJECT_ID');
    }
    if (!process.env.GOOGLE_API_KEY) {
      missingVars.push('GOOGLE_API_KEY');
    }

    if (missingVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
          `Please ensure these are set in your .env file.`
      );
    }
  }

  /**
   * Create Stagehand instance with Google Gemini configuration
   */
  private createStagehandConfig() {
    return {
      env: 'BROWSERBASE' as const,
      verbose: 1 as const,
      apiKey: this.browserbaseApiKey,
      projectId: this.browserbaseProjectId,
      browserbaseSessionCreateParams: {
        projectId: this.browserbaseProjectId,
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
            height: 1080,
          },
        },
        region: 'us-west-2' as const,
      },
    };
  }

  /**
   * Extract RFP details from Philadelphia contracting portal
   */
  async extractRFPDetails(rfpUrl: string): Promise<RFPDetails> {
    let stagehand: Stagehand | null = null;

    try {
      console.log('🤖 Initializing Stagehand with Google Gemini...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();

      // V3 API: Get page with defensive check
      const pages = await stagehand.context.pages();
      const page =
        pages.length > 0 ? pages[0] : await stagehand.context.newPage();

      console.log(`🌐 Navigating to: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      console.log('📊 Extracting RFP details...');
      const extractedData = (await withTimeout(
        stagehand.extract(
          `Extract all the key details of this RFP including bid information, contact details, items, and requirements`,
          {
            bidNumber: { type: 'string', optional: true },
            description: { type: 'string', optional: true },
            bidOpeningDate: { type: 'string', optional: true },
            purchaser: { type: 'string', optional: true },
            organization: { type: 'string', optional: true },
            department: { type: 'string', optional: true },
            location: { type: 'string', optional: true },
            fiscalYear: { type: 'string', optional: true },
            typeCode: { type: 'string', optional: true },
            allowElectronicQuote: { type: 'string', optional: true },
            requiredDate: { type: 'string', optional: true },
            availableDate: { type: 'string', optional: true },
            infoContact: { type: 'string', optional: true },
            bidType: { type: 'string', optional: true },
            purchaseMethod: { type: 'string', optional: true },
            bulletinDescription: { type: 'string', optional: true },
            shipToAddress: {
              type: 'object',
              optional: true,
              properties: {
                name: { type: 'string', optional: true },
                address: { type: 'string', optional: true },
                email: { type: 'string', optional: true },
                phone: { type: 'string', optional: true },
              },
            },
            items: {
              type: 'array',
              optional: true,
              items: {
                type: 'object',
                properties: {
                  itemNumber: { type: 'string', optional: true },
                  description: { type: 'string', optional: true },
                  nigpCode: { type: 'string', optional: true },
                  quantity: { type: 'string', optional: true },
                  unitOfMeasure: { type: 'string', optional: true },
                },
              },
            },
            attachments: {
              type: 'array',
              optional: true,
              items: { type: 'string' },
            },
          } as any
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'extract'
      )) as RFPDetails;

      console.log('✅ Extracted RFP details:', extractedData);
      return extractedData;
    } catch (error) {
      console.error('❌ Failed to extract RFP details:', error);
      throw error;
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }

  /**
   * Extract filename from Content-Disposition header or URL
   */
  private extractFilenameFromResponse(
    contentDisposition: string,
    url: string
  ): string {
    let filename = '';

    if (contentDisposition) {
      // Handle RFC 5987 filename* parameter (e.g., filename*=UTF-8''example.pdf)
      const filenameStarMatch = contentDisposition.match(
        /filename\*=(?:UTF-8|iso-8859-1)?''([^;]+)/i
      );
      if (filenameStarMatch) {
        filename = decodeURIComponent(filenameStarMatch[1]);
      } else {
        // Handle standard filename parameter (with or without quotes)
        const filenameMatch = contentDisposition.match(
          /filename=["']?([^;"']+)["']?/i
        );
        if (filenameMatch) {
          filename = filenameMatch[1].trim();
        }
      }
    }

    // Fallback to URL extraction
    if (!filename && url) {
      const urlParts = url.split('/');
      filename = urlParts[urlParts.length - 1].split('?')[0];
      filename = decodeURIComponent(filename);
    }

    return filename;
  }

  /**
   * Normalize string for comparison by removing special chars and lowercasing
   */
  private normalizeForComparison(text: string): string {
    if (!text) return '';

    return text
      .toLowerCase()
      .replace(/[_\-\s]+/g, ' ') // Replace underscores, hyphens, spaces with single space
      .replace(/[^\w\s.]/g, '') // Remove special characters except dots
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .trim();
  }

  /**
   * Calculate simple string similarity (0-1)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    const longer = str1.length > str2.length ? str1 : str2;

    if (longer.length === 0) return 1.0;

    // Calculate Levenshtein distance
    const editDistance = this.levenshteinDistance(str1, str2);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Match document name with multiple strategies
   */
  private matchDocumentName(
    expectedName: string,
    extractedFilename: string,
    url: string,
    contentDisposition: string
  ): boolean {
    if (!expectedName) return false;

    // Normalize all comparison strings
    const normalizedExpected = this.normalizeForComparison(expectedName);
    const normalizedFilename = this.normalizeForComparison(extractedFilename);
    const normalizedUrl = this.normalizeForComparison(url);
    const normalizedDisposition =
      this.normalizeForComparison(contentDisposition);

    // Strategy 1: Exact normalized match
    if (normalizedExpected === normalizedFilename) {
      return true;
    }

    // Strategy 2: Normalized includes (bidirectional)
    if (
      normalizedFilename.includes(normalizedExpected) ||
      normalizedExpected.includes(normalizedFilename)
    ) {
      return true;
    }

    // Strategy 3: Check URL and Content-Disposition
    if (
      normalizedUrl.includes(normalizedExpected) ||
      normalizedDisposition.includes(normalizedExpected)
    ) {
      return true;
    }

    // Strategy 4: Fuzzy matching with similarity threshold
    const similarity = this.calculateSimilarity(
      normalizedExpected,
      normalizedFilename
    );
    const SIMILARITY_THRESHOLD = 0.8; // 80% similarity

    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(
        `📊 Fuzzy match: "${expectedName}" ≈ "${extractedFilename}" (${(similarity * 100).toFixed(1)}%)`
      );
      return true;
    }

    return false;
  }

  /**
   * Downloads documents from Philadelphia contracting portal
   * Handles click-to-download pattern where documents don't have direct URLs
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
      console.log(
        '🤖 Initializing Stagehand with Google Gemini for downloads...'
      );
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();

      // V3 API: Get page with defensive check
      const pages = await stagehand.context.pages();
      const page =
        pages.length > 0 ? pages[0] : await stagehand.context.newPage();

      // Navigate to RFP page
      console.log(`🌐 Navigating to RFP page: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      // Wait for file attachments section with polling instead of fixed timeout
      console.log(`🔍 Waiting for file attachments section...`);
      const maxAttempts = 20; // 10 seconds total (20 * 500ms)
      let sectionFound = false;

      for (let i = 0; i < maxAttempts; i++) {
        try {
          // Check if attachment elements exist on the page
          const hasAttachments = await page.evaluate(() => {
            const selectors = [
              '.file-attachments',
              '[class*="attachment"]',
              '[class*="document"]',
              '[id*="attachment"]',
              'a[href*=".pdf"]',
            ];
            return selectors.some(selector => document.querySelector(selector));
          });

          if (hasAttachments) {
            sectionFound = true;
            console.log(
              `📋 File Attachments section found after ${(i + 1) * 500}ms`
            );
            break;
          }

          // Wait 500ms before next attempt
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch {
          // Continue polling on errors
        }

        if (i === maxAttempts - 1 && !sectionFound) {
          console.log(
            `⚠️ File attachments section not found after ${maxAttempts * 500}ms, proceeding anyway`
          );
        }
      }

      // Set up proper file capture with response interception
      const capturedFiles: Map<
        string,
        { buffer: Buffer; contentType: string }
      > = new Map();

      (page as any).on?.('response', async (response: any) => {
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
              // Extract filename from Content-Disposition header or URL
              const extractedFilename = this.extractFilenameFromResponse(
                contentDisposition,
                url
              );

              // Try to match this download to one of our expected documents
              const matchingDoc = documentNames.find(name =>
                this.matchDocumentName(
                  name,
                  extractedFilename,
                  url,
                  contentDisposition
                )
              );

              if (matchingDoc) {
                console.log(`📄 Intercepting download for: ${matchingDoc}`);
                try {
                  // Get response body as buffer - this is the critical step
                  const buffer = await response.body();

                  if (buffer.length > 0) {
                    capturedFiles.set(matchingDoc, {
                      buffer: buffer,
                      contentType: contentType || 'application/pdf',
                    });
                    console.log(
                      `💾 Captured file: ${matchingDoc} (${buffer.length} bytes)`
                    );
                  } else {
                    console.log(`⚠️ Empty file captured for: ${matchingDoc}`);
                  }
                } catch (error) {
                  console.error(
                    `❌ Failed to capture file data for ${matchingDoc}:`,
                    error
                  );
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

      // Note: Browserbase session ID extraction logic removed as it's not currently used
      // Can be re-enabled if session tracking is needed in the future

      // Process each document
      for (const docName of documentNames) {
        const doc: PhiladelphiaDocument = {
          name: docName,
          downloadStatus: 'pending',
        };

        try {
          console.log(`🔍 Looking for document: ${docName}`);
          doc.downloadStatus = 'downloading';

          // Set up promise to wait for the file to be captured
          const downloadTimeout = 30000; // 30 seconds timeout
          const startTime = Date.now();
          const initialCapturedCount = capturedFiles.size;

          // Use proven Stagehand approach - directly click the document link by name with timeout protection
          console.log(`📎 Clicking document: "${docName}"`);
          await withTimeout(
            stagehand.act(`click the "${docName}" link`),
            STAGEHAND_OPERATION_TIMEOUT,
            'act'
          );

          // Wait for the download to be captured with polling
          let downloadCompleted = false;
          while (
            !downloadCompleted &&
            Date.now() - startTime < downloadTimeout
          ) {
            // Check if this document has been captured
            if (capturedFiles.has(docName)) {
              downloadCompleted = true;
              console.log(`✅ Download completed for: ${docName}`);
              break;
            }

            // Check if we captured any new file (might be a slight name mismatch)
            if (capturedFiles.size > initialCapturedCount) {
              // A new file was captured, check if it could be our document
              const newFiles = Array.from(capturedFiles.keys()).filter(
                key =>
                  !results.some(
                    r => r.name === key && capturedFiles.has(r.name)
                  )
              );
              if (newFiles.length > 0) {
                // Assume the most recent capture is our file
                console.log(
                  `✅ Download captured (possible name variation): ${newFiles[0]}`
                );
                downloadCompleted = true;
                break;
              }
            }

            // Wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          if (!downloadCompleted) {
            console.log(
              `⚠️ Download timeout reached for ${docName}, but will mark as completed if no error`
            );
          }

          // For Philadelphia portal, the click succeeded if no error was thrown
          doc.downloadStatus = 'completed';

          // Navigate back to the RFP page to continue with other documents
          console.log(`↩️ Navigating back from ${docName}`);
          try {
            await Promise.race([
              page.goBack(),
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(new Error('Navigation back timed out after 10s')),
                  10000
                )
              ),
            ]);
            // Wait for page to stabilize after navigation
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch {
            console.warn(`⚠️ Navigation back failed, continuing anyway`);
          }
        } catch (error) {
          console.error(`❌ Failed to download ${docName}:`, error);
          doc.downloadStatus = 'failed';
          doc.error = error instanceof Error ? error.message : 'Unknown error';

          // Try to get back to the main page if we're stuck
          try {
            await Promise.race([
              page.goBack(),
              new Promise((_, reject) =>
                setTimeout(
                  () =>
                    reject(new Error('Navigation back timed out after 10s')),
                  10000
                )
              ),
            ]);
            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch {
            console.error(`Failed to navigate back after error`);
          }
        }

        results.push(doc);
      }

      // Upload captured files to object storage with verification
      const successfulDownloads = results.filter(
        d => d.downloadStatus === 'completed'
      );
      let actuallyStoredCount = 0;

      for (const doc of successfulDownloads) {
        const capturedFile = capturedFiles.get(doc.name);
        if (capturedFile) {
          try {
            console.log(`📤 Uploading ${doc.name} to object storage...`);

            // Generate unique filename with proper content type
            const timestamp = Date.now();
            const fileExt = this.getFileExtension(
              doc.name,
              capturedFile.contentType
            );
            const fileName = `rfp-${rfpId}-${timestamp}-${doc.name}${fileExt}`;

            // Upload file buffer to storage
            const storagePath = await this.uploadBufferToStorage(
              capturedFile.buffer,
              rfpId,
              fileName,
              capturedFile.contentType
            );

            // Verify upload success with retry logic for eventual consistency
            const maxVerifyAttempts = 3;
            const verifyDelays = [500, 1000, 1500]; // ms
            let verified = false;

            for (let attempt = 0; attempt < maxVerifyAttempts; attempt++) {
              if (await this.verifyFileExists(storagePath)) {
                verified = true;
                doc.storagePath = storagePath;
                actuallyStoredCount++;
                console.log(
                  `✅ Successfully uploaded and verified: ${doc.name}`
                );
                break;
              }

              if (attempt < maxVerifyAttempts - 1) {
                const delay = verifyDelays[attempt];
                console.log(
                  `⏳ Verification attempt ${attempt + 1} failed, retrying in ${delay}ms...`
                );
                await new Promise(resolve => setTimeout(resolve, delay));
              }
            }

            if (!verified) {
              console.error(
                `❌ Upload verification failed after ${maxVerifyAttempts} attempts for: ${doc.name}`
              );
              doc.downloadStatus = 'failed';
              doc.error = 'Upload verification failed';
            }
          } catch (uploadError) {
            console.error(`❌ Failed to upload ${doc.name}:`, uploadError);
            doc.downloadStatus = 'failed';
            doc.error = `Upload failed: ${uploadError}`;
          }
        } else {
          console.error(`❌ No captured data found for: ${doc.name}`);
          doc.downloadStatus = 'failed';
          doc.error = 'No file data captured';
        }
      }

      console.log(
        `📊 Successfully stored ${actuallyStoredCount}/${successfulDownloads.length} files`
      );

      const finalSuccessCount = results.filter(
        d => d.downloadStatus === 'completed'
      ).length;
      console.log(
        `✅ Successfully processed ${finalSuccessCount}/${documentNames.length} documents`
      );

      return results;
    } catch (error) {
      console.error('❌ Document download process failed:', error);

      // Mark all pending documents as failed
      for (const docName of documentNames) {
        if (!results.find(r => r.name === docName)) {
          results.push({
            name: docName,
            downloadStatus: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
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

  /**
   * Retrieve downloaded files from Browserbase and upload to storage
   * Note: This method is currently unused but kept for future Browserbase integration
   */
  /*
  private async retrieveAndUploadFiles(
    sessionId: string,
    rfpId: string,
    results: PhiladelphiaDocument[]
  ): Promise<void> {
    try {
      // Use retry logic as recommended in Browserbase docs
      const maxRetries = 10;
      const retryDelay = 2000; // 2 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(
            `📥 Attempting to retrieve downloads (attempt ${attempt}/${maxRetries})...`
          );

          // Get downloads from Browserbase as ZIP
          const downloadBuffer = new ArrayBuffer(0); // Placeholder - actual implementation would use Browserbase SDK

          if (downloadBuffer.byteLength > 0) {
            console.log(
              `📦 Retrieved ZIP archive: ${downloadBuffer.byteLength} bytes`
            );

            // Extract files from ZIP
            let zipEntries: any[] = [];
            try {
              const { default: AdmZip } = await import('adm-zip');
              const zip = new AdmZip(Buffer.from(downloadBuffer));
              zipEntries = zip.getEntries();
              console.log(`🗂️ Found ${zipEntries.length} files in ZIP archive`);
            } catch (zipError) {
              console.error('Failed to extract ZIP archive:', zipError);
              throw zipError;
            }

            // Process each file
            for (const entry of zipEntries) {
              if (!entry.isDirectory) {
                const fileName = entry.entryName;
                const fileData = entry.getData();

                console.log(
                  `📄 Processing file: ${fileName} (${fileData.length} bytes)`
                );

                // Find matching result record
                const matchingResult = results.find(
                  r =>
                    r.downloadStatus === 'completed' &&
                    (fileName.includes(r.name.replace('.pdf', '')) ||
                      r.name.includes(fileName.replace(/-(\d+)\.pdf$/, '.pdf'))) // Handle timestamp suffix
                );

                if (matchingResult) {
                  // Upload to object storage with proper content type
                  // Infer content type from filename
                  let inferredContentType = 'application/pdf';
                  if (fileName.toLowerCase().endsWith('.doc')) {
                    inferredContentType = 'application/msword';
                  } else if (fileName.toLowerCase().endsWith('.docx')) {
                    inferredContentType =
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                  } else if (fileName.toLowerCase().endsWith('.xls')) {
                    inferredContentType = 'application/vnd.ms-excel';
                  } else if (fileName.toLowerCase().endsWith('.xlsx')) {
                    inferredContentType =
                      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                  }

                  const storagePath = await this.uploadBufferToStorage(
                    fileData,
                    rfpId,
                    fileName,
                    inferredContentType
                  );

                  matchingResult.storagePath = storagePath;
                  console.log(
                    `☁️ Uploaded ${fileName} to storage: ${storagePath}`
                  );
                } else {
                  console.log(
                    `⚠️ No matching result found for file: ${fileName}`
                  );
                }
              }
            }

            console.log(`✅ Successfully processed all files from Browserbase`);
            return; // Success, exit retry loop
          } else {
            console.log(
              `⏳ Download archive not ready yet, retrying in ${retryDelay}ms...`
            );
          }
        } catch (error: any) {
          console.log(
            `⚠️ Retrieval attempt ${attempt} failed: ${error.message}`
          );
        }

        // Wait before retrying (except on last attempt)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }

      console.log(
        `❌ Failed to retrieve downloads after ${maxRetries} attempts`
      );

      // Mark remaining downloads as failed
      results.forEach(result => {
        if (result.downloadStatus === 'completed' && !result.storagePath) {
          result.downloadStatus = 'failed';
          result.error = 'Failed to retrieve from Browserbase cloud storage';
        }
      });
    } catch (error: any) {
      console.error(`❌ Error retrieving files from Browserbase:`, error);
      throw error;
    }
  }
  */

  /**
   * Upload file buffer to object storage
   */
  private async uploadBufferToStorage(
    fileBuffer: Buffer,
    rfpId: string,
    fileName: string,
    contentType = 'application/pdf'
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${rfpId}/${fileName}`;

      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);

      // Fallback for missing/unknown MIME types
      const safeContentType = contentType || 'application/octet-stream';

      // Upload buffer directly
      await file.save(fileBuffer, {
        metadata: {
          contentType: safeContentType,
          metadata: {
            rfpId: rfpId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
    } catch (error) {
      console.error(`Failed to upload ${fileName} to storage:`, error);
      throw error;
    }
  }

  /**
   * Get file extension based on filename and content type
   */
  private getFileExtension(fileName: string, contentType: string): string {
    // First try to get extension from filename
    const fileExt = fileName
      .toLowerCase()
      .match(/\.(pdf|doc|docx|xls|xlsx)$/)?.[0];
    if (fileExt) return fileExt;

    // Fall back to content type mapping
    const contentTypeMap: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        '.xlsx',
    };

    return contentTypeMap[contentType] || '.pdf';
  }

  /**
   * Verify file exists in object storage
   */
  private async verifyFileExists(storagePath: string): Promise<boolean> {
    try {
      // Extract bucket and object path from storage URL
      const urlParts = storagePath
        .replace('https://storage.googleapis.com/', '')
        .split('/');
      const bucketName = urlParts[0];
      const objectPath = urlParts.slice(1).join('/');

      // Check if file exists
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);
      const [exists] = await file.exists();

      return exists;
    } catch {
      return false;
    }
  }

  /**
   * Alternative method to extract document info when downloads aren't available
   * This can at least get document metadata even if downloads fail
   */
  async extractDocumentInfo(rfpUrl: string): Promise<PhiladelphiaDocument[]> {
    let stagehand: Stagehand | null = null;

    try {
      console.log('🤖 Initializing Stagehand for document extraction...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();

      // V3 API: Get page with defensive check
      const pages = await stagehand.context.pages();
      const page =
        pages.length > 0 ? pages[0] : await stagehand.context.newPage();

      console.log(`📊 Extracting document information from: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      // Extract document information using Stagehand act method with timeout protection
      await withTimeout(
        stagehand.act(
          `Extract all document information from this RFP page, including names, types, sizes, and any download links`
        ),
        STAGEHAND_OPERATION_TIMEOUT,
        'act'
      );

      // Parse the result
      const documents = await page.evaluate(() => {
        const docs: any[] = [];
        const links = document.querySelectorAll(
          'a[href*=".pdf"], a[href*=".doc"], a[href*=".xls"]'
        );
        links.forEach((link: any) => {
          docs.push({
            name: link.textContent?.trim() || '',
            type: 'PDF',
            downloadHint: link.href,
          });
        });
        return docs;
      });

      // Convert to our format
      return documents.map((doc: any) => ({
        name: doc.name,
        downloadStatus: 'pending' as const,
        error: doc.downloadHint ? undefined : 'No download method found',
      }));
    } catch (error) {
      console.error('Failed to extract document info:', error);
      throw error;
    } finally {
      if (stagehand) {
        try {
          await stagehand.close();
        } catch (err) {
          console.error('Error closing Stagehand:', err);
        }
      }
    }
  }
}
