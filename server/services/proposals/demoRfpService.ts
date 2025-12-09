import { nanoid } from 'nanoid';
import { storage } from '../../storage';
import { progressTracker } from '../monitoring/progressTracker';
import { getDemoRfpDataWithFreshDeadline, DEMO_RFP_DATA } from '@shared/demoData';

export interface CreateDemoRfpResult {
  success: boolean;
  sessionId: string;
  rfpId?: string;
  error?: string;
  message: string;
}

export class DemoRfpService {
  /**
   * Creates a demo RFP with pre-populated data for testing the full pipeline
   */
  async createDemoRfp(sessionId?: string): Promise<CreateDemoRfpResult> {
    const sid = sessionId || nanoid();

    try {
      console.log(`[DemoRfpService] Creating demo RFP with session: ${sid}`);

      // Start progress tracking
      progressTracker.startTracking(sid, 'demo://rfp-agent/demo-rfp');
      progressTracker.updateStep(sid, 'portal_detection', 'completed', 'Demo mode - using sample data');

      // Get demo data with fresh deadline
      const demoData = getDemoRfpDataWithFreshDeadline();

      // Simulate portal detection step
      progressTracker.updateStep(sid, 'page_navigation', 'completed', 'Demo data loaded');

      // Create the RFP record
      progressTracker.updateStep(sid, 'data_extraction', 'in_progress', 'Creating RFP record...');

      const rfpId = nanoid();

      // Find or create a demo portal
      const portalId = await this.findOrCreateDemoPortal();

      const rfp = {
        id: rfpId,
        title: demoData.title,
        description: `${demoData.description}\n\n**Contact:** ${demoData.contactInfo.name} | ${demoData.contactInfo.email} | ${demoData.contactInfo.phone}`,
        agency: demoData.agency,
        category: demoData.category,
        naicsCode: demoData.naicsCode,
        naicsDescription: demoData.naicsDescription,
        pscCode: demoData.pscCode,
        pscDescription: demoData.pscDescription,
        setAsideType: demoData.setAsideType,
        placeOfPerformance: demoData.placeOfPerformance,
        state: demoData.state,
        contractType: demoData.contractType,
        solicitationNumber: demoData.solicitationNumber,
        portalId: portalId,
        sourceUrl: demoData.sourceUrl,
        deadline: demoData.deadline,
        estimatedValue: demoData.estimatedValue,
        status: 'discovered' as const,
        progress: 10,
        requirements: demoData.requirements,
        complianceItems: demoData.complianceItems,
        riskFlags: demoData.riskFlags,
        addedBy: 'manual' as const,
        manuallyAddedAt: new Date(),
        isDemo: true,
        discoveredAt: new Date(),
        updatedAt: new Date(),
      };

      await storage.createRFP(rfp);

      progressTracker.updateStep(sid, 'data_extraction', 'completed', 'RFP record created');

      // Create mock documents (without actual file content)
      progressTracker.updateStep(sid, 'document_discovery', 'in_progress', `Found ${demoData.documents.length} documents`);

      for (const doc of demoData.documents) {
        await storage.createDocument({
          rfpId: rfpId,
          filename: doc.filename,
          fileType: doc.fileType,
          objectPath: `demo/${rfpId}/${doc.filename}`, // Mock path
          extractedText: `[DEMO] This is simulated extracted text from ${doc.filename}. In a real scenario, this would contain the actual document content extracted via AI/OCR processing.`,
          parsedData: {
            isDemo: true,
            description: doc.description,
            fileSize: doc.fileSize,
          },
        });
      }

      progressTracker.updateStep(sid, 'document_discovery', 'completed', `${demoData.documents.length} documents attached`);
      progressTracker.updateStep(sid, 'document_download', 'completed', 'Demo documents ready');
      progressTracker.updateStep(sid, 'database_save', 'completed', 'RFP saved to database');
      progressTracker.setRfpId(sid, rfpId);

      // Create notification
      await storage.createNotification({
        type: 'info',
        title: 'Demo RFP Created',
        message: `Demo RFP "${demoData.title}" has been created with ${demoData.documents.length} sample documents. This is test data for pipeline validation.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
        isRead: false,
      });

      // Trigger AI analysis and proposal generation
      progressTracker.updateStep(sid, 'ai_analysis', 'in_progress', 'Starting AI analysis and proposal generation');
      this.triggerProposalGeneration(rfpId, sid);

      console.log(`[DemoRfpService] Demo RFP created successfully: ${rfpId}`);

      return {
        success: true,
        sessionId: sid,
        rfpId: rfpId,
        message: `Demo RFP "${demoData.title}" created successfully with ${demoData.documents.length} sample documents.`,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[DemoRfpService] Error creating demo RFP:', error);

      progressTracker.failTracking(sid, `Failed to create demo RFP: ${errorMessage}`);

      return {
        success: false,
        sessionId: sid,
        error: errorMessage,
        message: 'Failed to create demo RFP. Please try again.',
      };
    }
  }

  private async findOrCreateDemoPortal(): Promise<string> {
    const portals = await storage.getAllPortals();
    const demoPortal = portals.find((p: any) => p.name === 'Demo Portal (Test Data)');

    if (demoPortal) {
      return demoPortal.id;
    }

    // Create demo portal
    const portalId = nanoid();
    await storage.createPortal({
      id: portalId,
      name: 'Demo Portal (Test Data)',
      url: 'https://demo.rfpagent.local',
      type: 'federal',
      isActive: true,
      monitoringEnabled: false,
      loginRequired: false,
      status: 'active',
      scanFrequency: 24,
      maxRfpsPerScan: 50,
      errorCount: 0,
    });

    return portalId;
  }

  private async triggerProposalGeneration(rfpId: string, sessionId: string) {
    try {
      console.log(`[DemoRfpService] Triggering proposal generation for demo RFP: ${rfpId}`);

      // Update RFP status to parsing
      await storage.updateRFP(rfpId, {
        status: 'parsing',
        progress: 25,
        updatedAt: new Date(),
      });

      // Import enhanced proposal service dynamically
      const { enhancedProposalService } = await import('./enhancedProposalService.js');

      // Trigger proposal generation
      enhancedProposalService
        .generateProposal({
          rfpId: rfpId,
          generatePricing: true,
          autoSubmit: false,
          companyProfileId: undefined,
        })
        .then(async (result) => {
          console.log(`[DemoRfpService] Proposal generation completed for demo RFP: ${rfpId}`, result);

          await storage.updateRFP(rfpId, {
            status: result.readyForSubmission ? 'review' : 'drafting',
            progress: result.readyForSubmission ? 90 : 75,
            updatedAt: new Date(),
          });

          progressTracker.completeTracking(sessionId, rfpId);

          await storage.createNotification({
            type: 'success',
            title: 'Demo RFP Processing Complete',
            message: `Demo proposal has been generated and is ready for review. ${result.humanActionItems?.length || 0} action items identified.`,
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });
        })
        .catch(async (error) => {
          console.error(`[DemoRfpService] Proposal generation failed for demo RFP: ${rfpId}`, error);

          progressTracker.failTracking(sessionId, `Proposal generation failed: ${error.message}`);

          await storage.createNotification({
            type: 'error',
            title: 'Demo RFP Processing Failed',
            message: 'Proposal generation failed for demo RFP. The RFP data is still available for manual testing.',
            relatedEntityType: 'rfp',
            relatedEntityId: rfpId,
            isRead: false,
          });

          await storage.updateRFP(rfpId, {
            status: 'discovered',
            progress: 15,
            updatedAt: new Date(),
          });
        });

    } catch (error) {
      console.error('[DemoRfpService] Error triggering proposal generation:', error);
      progressTracker.failTracking(sessionId, 'Failed to start proposal generation');
    }
  }
}

export const demoRfpService = new DemoRfpService();
