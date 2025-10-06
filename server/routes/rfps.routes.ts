import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { insertRfpSchema } from '@shared/schema';
import { ObjectStorageService } from '../objectStorage';
import { DocumentParsingService } from '../services/documentParsingService';
import { ManualRfpService } from '../services/manualRfpService';
import { PhiladelphiaDocumentDownloader } from '../services/philadelphiaDocumentDownloader';
import { getMastraScrapingService } from '../services/mastraScrapingService';
import { progressTracker } from '../services/progressTracker';
import { storage } from '../storage';

const router = Router();
const objectStorageService = new ObjectStorageService();
const documentService = new DocumentParsingService();
const manualRfpService = new ManualRfpService();

// Manual RFP Input Schema
const ManualRfpInputSchema = z.object({
  url: z.string().url(),
  userNotes: z.string().optional(),
});

/**
 * Get all RFPs with pagination and filtering
 */
router.get('/', async (req, res) => {
  try {
    const { status, portalId, page = '1', limit = '20' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    const result = await storage.getAllRFPs({
      status: status as string,
      portalId: portalId as string,
      limit: parseInt(limit as string),
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching RFPs:', error);
    res.status(500).json({ error: 'Failed to fetch RFPs' });
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
router.post('/', async (req, res) => {
  try {
    const rfpData = insertRfpSchema.parse(req.body);
    const rfp = await storage.createRFP(rfpData);

    // Create audit log
    await storage.createAuditLog({
      entityType: 'rfp',
      entityId: rfp.id,
      action: 'created',
      details: { source: 'manual' },
    });

    res.status(201).json(rfp);
  } catch (error) {
    console.error('Error creating RFP:', error);
    res.status(400).json({ error: 'Failed to create RFP' });
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
        details: validationResult.error.errors.map((e: any) => ({
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
 * Download documents for Philadelphia RFPs
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

    // Validate it's a Philadelphia RFP
    if (!rfp.sourceUrl || !rfp.sourceUrl.includes('phlcontracts.phila.gov')) {
      return res.status(400).json({
        error: 'This endpoint only supports Philadelphia portal RFPs',
      });
    }

    console.log(`📥 Starting document download for RFP ${id}`);
    console.log(`📄 Documents to download: ${documentNames.length}`);

    // Use Philadelphia document downloader
    const downloader = new PhiladelphiaDocumentDownloader();
    const results = await downloader.downloadRFPDocuments(
      rfp.sourceUrl,
      id,
      documentNames
    );

    // Save successful downloads to database
    const savedDocuments = [];
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

    res.json({
      success: true,
      rfpId: id,
      results: results,
      savedDocuments: savedDocuments,
      summary: {
        total: documentNames.length,
        successful: successCount,
        failed: documentNames.length - successCount,
      },
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
