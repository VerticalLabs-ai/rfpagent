import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { ZodError } from 'zod';
import { insertRfpSchema } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { DocumentParsingService } from '../services/processing/documentParsingService';
import { ManualRfpService } from '../services/proposals/manualRfpService';
import { PhiladelphiaDocumentDownloader } from '../services/scrapers/philadelphiaDocumentDownloader';
import { getMastraScrapingService } from '../services/scrapers/mastraScrapingService';
import { progressTracker } from '../services/monitoring/progressTracker';
import { analysisOrchestrator } from '../services/orchestrators/analysisOrchestrator';
import { storage } from '../storage';
import { validateSchema, validateQuery } from '../middleware/zodValidation';

const router = Router();
const objectStorageService = new ObjectStorageService();
const documentService = new DocumentParsingService();
const manualRfpService = new ManualRfpService();

// Query validation schema for GET /api/rfps
const getRfpsQuerySchema = z.object({
  status: z.string().optional(),
  portalId: z.string().uuid('Portal ID must be a valid UUID').optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Manual RFP Input Schema
const ManualRfpInputSchema = z.object({
  url: z.string().url(),
  userNotes: z.string().optional(),
});

/**
 * Get all RFPs with pagination and filtering
 */
router.get('/', validateQuery(getRfpsQuerySchema), async (req, res) => {
  try {
    const { status, portalId, page, limit } = req.query as z.infer<
      typeof getRfpsQuerySchema
    >;
    const offset = (page - 1) * limit;

    const result = await storage.getAllRFPs({
      status,
      portalId,
      limit,
      offset,
    });

    // Return standardized paginated response
    res.json({
      success: true,
      data: result.data,
      pagination: {
        total: result.total,
        page,
        limit,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching RFPs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RFPs',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get detailed RFPs with compliance data
 */
router.get('/detailed', async (req, res) => {
  try {
    const rfps = await storage.getRFPsWithDetails();
    res.json(rfps);
  } catch (error) {
    console.error('Error fetching detailed RFPs:', error);
    res.status(500).json({ error: 'Failed to fetch detailed RFPs' });
  }
});

/**
 * Get a specific RFP by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rfp = await storage.getRFP(id);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }
    res.json(rfp);
  } catch (error) {
    console.error('Error fetching RFP:', error);
    res.status(500).json({ error: 'Failed to fetch RFP' });
  }
});

/**
 * Get documents for a specific RFP
 */
router.get('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const documents = await storage.getDocumentsByRFP(id);
    res.json(documents);
  } catch (error) {
    console.error('Error getting RFP documents:', error);
    res.status(500).json({ error: 'Failed to get RFP documents' });
  }
});

/**
 * Create a new RFP
 */
router.post('/', validateSchema(insertRfpSchema), async (req, res) => {
  try {
    const rfp = await storage.createRFP(req.body);

    // Create audit log
    await storage.createAuditLog({
      entityType: 'rfp',
      entityId: rfp.id,
      action: 'created',
      details: { source: 'manual' },
    });

    res.status(201).json({
      success: true,
      data: rfp,
      message: 'RFP created successfully',
    });
  } catch (error) {
    console.error('Error creating RFP:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create RFP',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Update an RFP
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const rfp = await storage.updateRFP(id, updates);

    // Create audit log
    await storage.createAuditLog({
      entityType: 'rfp',
      entityId: id,
      action: 'updated',
      details: { updates },
    });

    res.json(rfp);
  } catch (error) {
    console.error('Error updating RFP:', error);
    res.status(400).json({ error: 'Failed to update RFP' });
  }
});

/**
 * Delete an RFP
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await storage.deleteRFP(id);
    res.json({ success: true, message: 'RFP deleted successfully' });
  } catch (error) {
    console.error('Error deleting RFP:', error);
    if (error instanceof Error && error.message === 'RFP not found') {
      res.status(404).json({ error: 'RFP not found' });
    } else {
      res.status(500).json({ error: 'Failed to delete RFP' });
    }
  }
});

/**
 * Get upload URL for RFP documents
 */
router.post('/:id/documents/upload', async (req, res) => {
  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    res.json({ uploadURL });
  } catch (error) {
    console.error('Error getting upload URL:', error);
    res.status(500).json({ error: 'Failed to get upload URL' });
  }
});

/**
 * Create document for RFP
 */
router.post('/:id/documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentURL, filename, fileType } = req.body;

    if (!documentURL || !filename || !fileType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const objectPath =
      objectStorageService.normalizeObjectEntityPath(documentURL);

    const document = await storage.createDocument({
      rfpId: id,
      filename,
      fileType,
      objectPath,
    });

    // Parse document asynchronously
    documentService.parseDocument(document.id).catch(console.error);

    res.status(201).json({ document, objectPath });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ error: 'Failed to create document' });
  }
});

/**
 * Process manual RFP submission
 */
router.post('/manual', async (req, res) => {
  try {
    const validationResult = ManualRfpInputSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: validationResult.error.issues.map((e: any) => ({
          field: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    console.log(
      `📝 Processing manual RFP submission: ${validationResult.data.url}`
    );

    // Start processing asynchronously and return sessionId immediately
    const sessionId = randomUUID();

    // Return sessionId immediately so frontend can connect to progress stream
    res.status(202).json({
      success: true,
      sessionId,
      message:
        'RFP processing started. Connect to the progress stream for updates.',
    });

    // Process asynchronously in the background
    manualRfpService
      .processManualRfp({ ...validationResult.data, sessionId })
      .then(async result => {
        if (result.success && result.rfpId) {
          // Create audit log for manual RFP addition
          await storage.createAuditLog({
            entityType: 'rfp',
            entityId: result.rfpId,
            action: 'created_manually',
            details: {
              url: validationResult.data.url,
              userNotes: validationResult.data.userNotes,
            },
          });
          console.log(`✅ Manual RFP processing completed: ${result.rfpId}`);
        } else {
          console.error(`❌ Manual RFP processing failed: ${result.error}`);
        }
      })
      .catch(error => {
        console.error('Error in background RFP processing:', error);
      });
  } catch (error) {
    console.error('Error processing manual RFP:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to process the manual RFP. Please try again.',
    });
  }
});

/**
 * SSE endpoint for real-time RFP processing progress
 */
router.get('/manual/progress/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(`📡 SSE connection established for session: ${sessionId}`);

    // Register SSE client for the session
    progressTracker.registerSSEClient(sessionId, res);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`📡 SSE connection closed for session: ${sessionId}`);
    });
  } catch (error) {
    console.error('Error setting up SSE connection:', error);
    res.status(500).json({ error: 'Failed to establish progress stream' });
  }
});

/**
 * Get manual RFP status
 */
router.get('/manual/status/:rfpId', async (req, res) => {
  try {
    const { rfpId } = req.params;

    const rfp = await storage.getRFP(rfpId);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    // Check if it's a manually added RFP
    if (rfp.addedBy !== 'manual') {
      return res.status(400).json({ error: 'Not a manually added RFP' });
    }

    const documents = await storage.getDocumentsByRFP(rfpId);
    const proposal = await storage.getProposalByRFP(rfpId);

    res.json({
      rfp,
      documentsCount: documents.length,
      hasProposal: !!proposal,
      processingStatus: rfp.status,
      progress: rfp.progress,
      manuallyAddedAt: rfp.manuallyAddedAt,
    });
  } catch (error) {
    console.error('Error fetching manual RFP status:', error);
    res.status(500).json({ error: 'Failed to fetch RFP status' });
  }
});

/**
 * Download documents for RFPs from any supported portal
 * Supports: Philadelphia, Austin Finance, and other portals
 */
router.post('/:id/download-documents', async (req, res) => {
  try {
    const { id } = req.params;
    const { documentNames } = req.body;

    // Get the RFP
    const rfp = await storage.getRFP(id);
    if (!rfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    if (!rfp.sourceUrl) {
      return res.status(400).json({
        error: 'RFP does not have a source URL',
      });
    }

    console.log(`📥 Starting document download for RFP ${id}`);
    console.log(`📄 Portal: ${rfp.sourceUrl}`);

    // Determine portal type and use appropriate downloader
    let results: any[] = [];
    let savedDocuments: any[] = [];

    // Austin Finance Portal
    if (
      rfp.sourceUrl.includes('financeonline.austintexas.gov') ||
      rfp.sourceUrl.includes('austintexas.gov')
    ) {
      console.log('🏛️ Using Austin Finance document scraper');
      const austinScraper = new (
        await import('../services/scrapers/austinFinanceDocumentScraper')
      ).AustinFinanceDocumentScraper();

      try {
        const documents = await austinScraper.scrapeRFPDocuments(
          id,
          rfp.sourceUrl
        );
        savedDocuments = documents;

        // Convert to results format for consistency
        results = documents.map(doc => ({
          name: doc.filename,
          downloadStatus: 'completed',
          storagePath: doc.objectPath,
          fileType: doc.fileType,
        }));

        console.log(
          `✅ Downloaded ${documents.length} documents from Austin Finance`
        );
      } catch (error) {
        console.error('Austin Finance document download failed:', error);
        results = [
          {
            name: 'Document download failed',
            downloadStatus: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ];
      }
    }
    // BeaconBid Portal
    else if (rfp.sourceUrl.includes('beaconbid.com')) {
      console.log('🏛️ Using BeaconBid document scraper');
      const beaconBidScraper = new (
        await import('../services/scrapers/beaconBidDocumentScraper')
      ).BeaconBidDocumentScraper();

      try {
        const documents = await beaconBidScraper.scrapeRFPDocuments(
          id,
          rfp.sourceUrl
        );
        savedDocuments = documents;

        // Convert to results format for consistency
        results = documents.map(doc => ({
          name: doc.filename,
          downloadStatus: 'completed',
          storagePath: doc.objectPath,
          fileType: doc.fileType,
        }));

        console.log(
          `✅ Downloaded ${documents.length} documents from BeaconBid`
        );
      } catch (error) {
        console.error('BeaconBid document download failed:', error);
        results = [
          {
            name: 'Document download failed',
            downloadStatus: 'failed',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ];
      }
    }
    // Philadelphia Portal
    else if (rfp.sourceUrl.includes('phlcontracts.phila.gov')) {
      console.log('🏛️ Using Philadelphia document downloader');
      console.log(`📄 Documents to download: ${documentNames?.length || 0}`);

      const downloader = new PhiladelphiaDocumentDownloader();
      results = await downloader.downloadRFPDocuments(
        rfp.sourceUrl,
        id,
        documentNames || []
      );

      // Save successful downloads to database (Philadelphia only - Austin/BeaconBid save automatically)
      for (const doc of results) {
        if (doc.downloadStatus === 'completed' && doc.storagePath) {
          try {
            const savedDoc = await storage.createDocument({
              rfpId: id,
              filename: doc.name,
              fileType: 'application/pdf',
              objectPath: doc.storagePath,
            });
            savedDocuments.push(savedDoc);
          } catch (error) {
            console.error(
              `Failed to save document ${doc.name} to database:`,
              error
            );
          }
        }
      }
    }
    // Unsupported portal type
    else {
      console.warn(
        `⚠️ Unsupported portal type for document download: ${rfp.sourceUrl}`
      );
      return res.status(400).json({
        error: 'Unsupported portal type',
        message:
          'Document download is currently only supported for Austin Finance, BeaconBid, and Philadelphia portals.',
        portalUrl: rfp.sourceUrl,
      });
    }

    // Update RFP status
    const successCount = results.filter(
      d => d.downloadStatus === 'completed'
    ).length;
    await storage.updateRFP(id, {
      status: successCount > 0 ? 'parsing' : 'open',
      progress: successCount > 0 ? 40 : 20,
    });

    // Create audit log
    await storage.createAuditLog({
      entityType: 'rfp',
      entityId: id,
      action: 'documents_downloaded',
      details: {
        totalRequested: documentNames.length,
        successfulDownloads: successCount,
        failedDownloads: documentNames.length - successCount,
      },
    });

    // Trigger document analysis workflow if documents were successfully downloaded
    let analysisWorkflowId = undefined;
    if (successCount > 0 && savedDocuments.length > 0) {
      try {
        const sessionId = `analysis_${id}_${Date.now()}`;
        console.log(`🔍 Starting document analysis workflow for RFP ${id}`);

        const analysisResult =
          await analysisOrchestrator.executeAnalysisWorkflow({
            rfpId: id,
            sessionId,
            priority: 8, // High priority for downloaded documents
          });

        if (analysisResult.success) {
          analysisWorkflowId = analysisResult.metadata?.workflowId;
          console.log(`✅ Analysis workflow started: ${analysisWorkflowId}`);
        } else {
          console.error(
            `❌ Failed to start analysis workflow: ${analysisResult.error}`
          );
        }
      } catch (analysisError) {
        console.error('Error starting analysis workflow:', analysisError);
        // Don't fail the download response if analysis fails
      }
    }

    // Determine portal type for response
    const portalType =
      rfp.sourceUrl.includes('financeonline.austintexas.gov') ||
      rfp.sourceUrl.includes('austintexas.gov')
        ? 'Austin Finance'
        : rfp.sourceUrl.includes('beaconbid.com')
          ? 'BeaconBid'
          : rfp.sourceUrl.includes('phlcontracts.phila.gov')
            ? 'Philadelphia'
            : 'Unknown';

    res.json({
      success: true,
      rfpId: id,
      portalType,
      results: results,
      savedDocuments: savedDocuments,
      summary: {
        total: documentNames?.length || results.length,
        successful: successCount,
        failed: (documentNames?.length || results.length) - successCount,
      },
      documentsDownloaded: successCount,
      analysisWorkflowId, // Include workflow ID if analysis was triggered
    });
  } catch (error) {
    console.error('Error downloading RFP documents:', error);
    res.status(500).json({
      error: 'Failed to download documents',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Re-scrape an RFP from its source URL
 */
router.post('/:id/rescrape', async (req, res) => {
  try {
    const { id } = req.params;
    const { url, userNotes } = req.body;

    console.log(`🔄 Re-scraping RFP ${id} from URL: ${url}`);

    // Get existing RFP
    const existingRfp = await storage.getRFP(id);
    if (!existingRfp) {
      return res.status(404).json({ error: 'RFP not found' });
    }

    const targetUrl = url || existingRfp.sourceUrl;

    // Enhanced URL validation for security (prevent SSRF attacks)
    try {
      const parsedUrl = new URL(targetUrl);

      // Require HTTPS for security
      if (parsedUrl.protocol !== 'https:') {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL protocol',
          message: 'Only HTTPS URLs are allowed for security',
        });
      }

      // Block private/localhost IPs
      const hostname = parsedUrl.hostname.toLowerCase();
      const privateIpRegex =
        /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|localhost$|0\.0\.0\.0$)/;
      if (privateIpRegex.test(hostname)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL target',
          message: 'Private IP addresses and localhost are not allowed',
        });
      }

      // Safe domain allowlist with exact matching
      const allowedDomains = [
        'financeonline.austintexas.gov',
        'austintexas.gov',
        'bonfirehub.com',
        'vendor.bonfirehub.com',
        'sam.gov',
        'governmentjobs.com',
        'find-rfp.com',
        'findrfp.com',
        'phlcontracts.phila.gov',
      ];

      const isAllowed = allowedDomains.some(
        domain => hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (!isAllowed) {
        return res.status(400).json({
          success: false,
          error: 'Invalid URL domain',
          message: 'URL must be from an approved government portal',
        });
      }
    } catch {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL format',
        message: 'Please provide a valid URL',
      });
    }

    // Use Mastra scraping service directly for proper integration
    const mastraService = getMastraScrapingService();

    console.log(`🤖 Using Mastra service for re-scraping RFP ${id}`);

    // Use enhanced scraping with proper RFP ID preservation
    const scrapingResult = await mastraService.enhancedScrapeFromUrl(
      targetUrl,
      id
    );

    if (!scrapingResult || !scrapingResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to re-scrape RFP',
        message:
          scrapingResult?.message ||
          'Could not extract updated data from the URL. Please check the URL and try again.',
      });
    }

    // Update RFP status to indicate re-processing
    await storage.updateRFP(id, {
      status: 'parsing',
      progress: 25,
      updatedAt: new Date(),
    });

    // Add user notes if provided
    if (userNotes) {
      const currentRfp = await storage.getRFP(id);
      await storage.updateRFP(id, {
        description: `${
          currentRfp?.description || ''
        }\n\nRe-scrape Notes (${new Date().toISOString()}): ${userNotes}`,
        updatedAt: new Date(),
      });
    }

    // Create audit log for re-scraping
    await storage.createAuditLog({
      entityType: 'rfp',
      entityId: id,
      action: 're_scraped',
      details: {
        url: targetUrl,
        documentsFound: scrapingResult.documentsCount || 0,
        userNotes: userNotes,
        mastraService: true,
      },
    });

    // Create notification
    await storage.createNotification({
      type: 'info',
      title: 'RFP Re-scraped',
      message: `RFP has been re-scraped using Mastra service. ${
        scrapingResult.documentsCount || 0
      } documents were captured.`,
      relatedEntityType: 'rfp',
      relatedEntityId: id,
      isRead: false,
    });

    res.json({
      success: true,
      rfpId: id,
      documentsFound: scrapingResult.documentsCount || 0,
      message:
        scrapingResult.message ||
        `RFP re-scraped successfully with ${
          scrapingResult.documentsCount || 0
        } documents captured using Mastra service.`,
    });
  } catch (error) {
    console.error('Error re-scraping RFP:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to re-scrape the RFP. Please try again.',
      documentsFound: 0,
    });
  }
});

export default router;
