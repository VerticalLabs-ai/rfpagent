import { Browserbase } from '@browserbasehq/sdk';
import { Stagehand, type ConstructorParams } from '@browserbasehq/stagehand';
import { z } from 'zod';
import { ObjectStorageService, objectStorageClient } from '../objectStorage';

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
  private browserbase: Browserbase;

  constructor() {
    this.objectStorage = new ObjectStorageService();
    this.browserbase = new Browserbase({
      apiKey: process.env.BROWSERBASE_API_KEY!,
    });
  }

  /**
   * Create Stagehand instance with Google Gemini configuration
   */
  private createStagehandConfig(): ConstructorParams {
    return {
      env: 'BROWSERBASE',
      verbose: 1,
      modelName: 'google/gemini-2.0-flash-exp',
      disablePino: true,
      apiKey: process.env.BROWSERBASE_API_KEY,
      projectId: process.env.BROWSERBASE_PROJECT_ID,
      modelClientOptions: {
        apiKey: process.env.GOOGLE_API_KEY,
      },
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
            height: 1080,
          },
        },
        region: 'us-west-2',
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

      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      console.log(`🌐 Navigating to: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      console.log('📊 Extracting RFP details...');
      const extractedData = await page.extract({
        instruction: `Extract all the key details of this RFP including bid information, contact details, items, and requirements`,
        schema: z.object({
          bidNumber: z.string().optional(),
          description: z.string().optional(),
          bidOpeningDate: z.string().optional(),
          purchaser: z.string().optional(),
          organization: z.string().optional(),
          department: z.string().optional(),
          location: z.string().optional(),
          fiscalYear: z.string().optional(),
          typeCode: z.string().optional(),
          allowElectronicQuote: z.string().optional(),
          requiredDate: z.string().optional(),
          availableDate: z.string().optional(),
          infoContact: z.string().optional(),
          bidType: z.string().optional(),
          purchaseMethod: z.string().optional(),
          bulletinDescription: z.string().optional(),
          shipToAddress: z
            .object({
              name: z.string().optional(),
              address: z.string().optional(),
              email: z.string().optional(),
              phone: z.string().optional(),
            })
            .optional(),
          items: z
            .array(
              z.object({
                itemNumber: z.string().optional(),
                description: z.string().optional(),
                nigpCode: z.string().optional(),
                quantity: z.string().optional(),
                unitOfMeasure: z.string().optional(),
              })
            )
            .optional(),
          attachments: z.array(z.string()).optional(),
        }),
      });

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

      // Set up proper file capture with response interception
      const capturedFiles: Map<
        string,
        { buffer: Buffer; contentType: string }
      > = new Map();

      page.on('response', async response => {
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
              const matchingDoc = documentNames.find(name => {
                // Check various ways the document might be identified
                return (
                  url.toLowerCase().includes(name.toLowerCase()) ||
                  contentDisposition
                    .toLowerCase()
                    .includes(name.toLowerCase()) ||
                  name
                    .toLowerCase()
                    .includes(url.split('/').pop()?.toLowerCase() || '')
                );
              });

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

      // Extract the real Browserbase session ID from Stagehand with enhanced detection
      let browserbaseSessionId: string | null = null;

      try {
        // Try enhanced methods to get the real session ID
        browserbaseSessionId =
          (stagehand as any).sessionId ||
          (stagehand as any)._sessionId ||
          (stagehand as any).browserbase?.sessionId ||
          (stagehand as any).session?.id ||
          (stagehand as any).context?.sessionId ||
          (page.context() as any)._browserbaseSessionId ||
          (page.context() as any).sessionId;

        if (!browserbaseSessionId) {
          // Try extracting from various URL sources
          const debugUrl =
            (page.context() as any)._debugUrl || (page as any)._debugUrl || '';
          const wsUrl =
            (page.context() as any)._wsEndpoint ||
            (page as any)._wsEndpoint ||
            '';
          const browserUrl = page.url() || '';

          const sessionMatch =
            debugUrl.match(
              /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            ) ||
            wsUrl.match(
              /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            ) ||
            browserUrl.match(
              /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
            );

          if (sessionMatch) {
            browserbaseSessionId = sessionMatch[1];
          }
        }

        if (!browserbaseSessionId) {
          // Try to extract from browser context properties
          const browser = page.context().browser();
          if (browser) {
            const contexts = (browser as any)._contexts || [];
            for (const ctx of contexts) {
              const ctxSessionId =
                (ctx as any)._sessionId || (ctx as any).sessionId;
              if (ctxSessionId) {
                browserbaseSessionId = ctxSessionId;
                break;
              }
            }
          }
        }

        console.log(
          `🆔 Browserbase session ID: ${browserbaseSessionId || 'not found'}`
        );
      } catch (error) {
        console.log(`⚠️ Could not extract Browserbase session ID: ${error}`);
      }

      // Process each document
      for (const docName of documentNames) {
        const doc: PhiladelphiaDocument = {
          name: docName,
          downloadStatus: 'pending',
        };

        try {
          console.log(`🔍 Looking for document: ${docName}`);
          doc.downloadStatus = 'downloading';

          // Use proven Stagehand approach - directly click the document link by name
          console.log(`📎 Clicking document: "${docName}"`);
          await page.act(`click the "${docName}" link`);

          // Wait for download to complete and be captured
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
              fileName
            );

            // Verify upload success by checking if file exists
            if (await this.verifyFileExists(storagePath)) {
              doc.storagePath = storagePath;
              actuallyStoredCount++;
              console.log(`✅ Successfully uploaded and verified: ${doc.name}`);
            } else {
              console.error(`❌ Upload verification failed for: ${doc.name}`);
              doc.downloadStatus = 'failed';
              doc.error = 'Upload verification failed';
            }
          } catch (error) {
            console.error(`❌ Failed to upload ${doc.name}:`, error);
            doc.downloadStatus = 'failed';
            doc.error = `Upload failed: ${error}`;
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
    } catch (error: any) {
      console.error('❌ Document download process failed:', error);

      // Mark all pending documents as failed
      for (const docName of documentNames) {
        if (!results.find(r => r.name === docName)) {
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

  /**
   * Retrieve downloaded files from Browserbase and upload to storage
   */
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
          const response =
            await this.browserbase.sessions.downloads.list(sessionId);
          const downloadBuffer = await response.arrayBuffer();

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
                      r.name.includes(
                        fileName.replace(/-(\\d+)\\.pdf$/, '.pdf')
                      )) // Handle timestamp suffix
                );

                if (matchingResult) {
                  // Upload to object storage
                  const storagePath = await this.uploadBufferToStorage(
                    fileData,
                    rfpId,
                    fileName
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

  /**
   * Upload file buffer to object storage
   */
  private async uploadBufferToStorage(
    fileBuffer: Buffer,
    rfpId: string,
    fileName: string
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${rfpId}/${fileName}`;

      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);

      // Upload buffer directly
      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            rfpId: rfpId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
    } catch (error: any) {
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
    } catch (error) {
      console.error(`Failed to verify file existence: ${error}`);
      return false;
    }
  }

  /**
   * Upload file buffer to object storage
   */
  private async uploadToStorage(
    fileName: string,
    fileBuffer: Buffer
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${fileName}`;

      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);

      // Upload buffer directly
      await file.save(fileBuffer, {
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
    } catch (error: any) {
      console.error(`Failed to upload ${fileName} to storage:`, error);
      throw error;
    }
  }

  /**
   * Upload downloaded document to object storage (legacy method)
   */
  private async uploadToStorageLegacy(
    filePath: string,
    rfpId: string,
    fileName: string
  ): Promise<string> {
    try {
      // Get the private directory for uploads
      const privateDir = this.objectStorage.getPrivateObjectDir();
      const bucketName = privateDir.split('/')[0];
      const objectPath = `rfp_documents/${rfpId}/${fileName}`;

      // Get bucket reference
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectPath);

      // Upload file from local path
      await bucket.upload(filePath, {
        destination: objectPath,
        metadata: {
          contentType: 'application/pdf',
          metadata: {
            rfpId: rfpId,
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${bucketName}/${objectPath}`;
      return publicUrl;
    } catch (error: any) {
      console.error(`Failed to upload ${fileName} to storage:`, error);
      throw error;
    }
  }

  /**
   * Alternative method to extract document info when downloads aren't available
   * This can at least get document metadata even if downloads fail
   */
  async extractDocumentInfo(
    rfpUrl: string,
    rfpId: string
  ): Promise<PhiladelphiaDocument[]> {
    let stagehand: Stagehand | null = null;

    try {
      console.log('🤖 Initializing Stagehand for document extraction...');
      stagehand = new Stagehand(this.createStagehandConfig());
      await stagehand.init();

      const page = stagehand.page;
      if (!page) {
        throw new Error('Failed to get page instance from Stagehand');
      }

      console.log(`📊 Extracting document information from: ${rfpUrl}`);
      await page.goto(rfpUrl, { waitUntil: 'networkidle' });

      // Extract document information using Stagehand act method
      const extractionResult = await page.act(
        `Extract all document information from this RFP page, including names, types, sizes, and any download links`
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
    } catch (error: any) {
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
