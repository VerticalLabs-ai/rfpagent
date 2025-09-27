import { Router } from 'express';
import { PortalSchedulerService } from '../services/portal-scheduler-service';
import { workflowCoordinator } from '../services/workflowCoordinator';
import { storage } from '../storage';

const router = Router();

// Runtime service state tracking (tracks actual running status vs environment variables)
const serviceRuntimeState = {
  portalScheduler: false,
  workDistribution: false,
  retryScheduler: false,
  dlqMonitor: false
};

const portalSchedulerService = new PortalSchedulerService();

/**
 * Get system configuration
 */
router.get('/config', async (req, res) => {
  try {
    const config = {
      backgroundServices: {
        workDistribution: serviceRuntimeState.workDistribution || process.env.AUTO_WORK_DISTRIBUTION === 'true',
        retryScheduler: serviceRuntimeState.retryScheduler || process.env.AUTO_RETRY_SCHEDULER === 'true',
        dlqMonitor: serviceRuntimeState.dlqMonitor || process.env.AUTO_DLQ_MONITOR === 'true',
        portalScheduler: serviceRuntimeState.portalScheduler || process.env.AUTO_PORTAL_SCHEDULER === 'true'
      },
      manualOperationMode: !(
        serviceRuntimeState.workDistribution || process.env.AUTO_WORK_DISTRIBUTION === 'true' ||
        serviceRuntimeState.retryScheduler || process.env.AUTO_RETRY_SCHEDULER === 'true' ||
        serviceRuntimeState.dlqMonitor || process.env.AUTO_DLQ_MONITOR === 'true' ||
        serviceRuntimeState.portalScheduler || process.env.AUTO_PORTAL_SCHEDULER === 'true'
      )
    };
    res.json(config);
  } catch (error) {
    console.error("Error fetching system config:", error);
    res.status(500).json({ error: "Failed to fetch system config" });
  }
});

/**
 * Background service control endpoints - ADMIN ONLY
 */
router.post('/services/:service/:action', async (req, res) => {
  try {
    // Basic auth check - in production this should use proper authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer admin-token-change-in-production') {
      return res.status(401).json({ error: 'Unauthorized - admin access required' });
    }

    const { service, action } = req.params;

    if (!['enable', 'disable'].includes(action)) {
      return res.status(400).json({ error: "Action must be 'enable' or 'disable'" });
    }

    const response = { service, action, success: false, message: '' };

    switch (service) {
      case 'portal-scheduler':
        if (action === 'enable') {
          await portalSchedulerService.initialize();
          serviceRuntimeState.portalScheduler = true;
          response.success = true;
          response.message = 'Portal scheduler enabled and initialized';
        } else {
          // Properly shutdown the portal scheduler and update runtime state
          portalSchedulerService.shutdown();
          serviceRuntimeState.portalScheduler = false;
          response.success = true;
          response.message = 'Portal scheduler shutdown and disabled';
        }
        break;

      case 'work-distribution':
        if (action === 'enable') {
          workflowCoordinator.startWorkItemProcessing();
          serviceRuntimeState.workDistribution = true;
          response.success = true;
          response.message = 'Work distribution enabled and processing started';
        } else {
          workflowCoordinator.stopWorkItemProcessing();
          serviceRuntimeState.workDistribution = false;
          response.success = true;
          response.message = 'Work distribution stopped and disabled';
        }
        break;

      case 'retry-scheduler':
      case 'dlq-monitor':
        // These services are currently managed by RetryBackoffDlqService
        // and don't have individual start/stop methods in current implementation
        response.success = false;
        response.message = `${service} control not yet implemented - requires service restart to change`;
        break;

      default:
        return res.status(400).json({ error: `Unknown service: ${service}` });
    }

    res.json(response);
  } catch (error) {
    console.error(`Error controlling service:`, error);
    res.status(500).json({ error: "Failed to control service" });
  }
});

/**
 * Check database for company profiles
 * GET /api/system/check-company-profiles
 */
router.get('/check-company-profiles', async (req, res) => {
  try {
    const profiles = await storage.getAllCompanyProfiles();
    console.log(`📊 Found ${profiles.length} company profiles in database`);

    res.json({
      success: true,
      count: profiles.length,
      profiles: profiles.map(p => ({
        id: p.id,
        companyName: p.companyName,
        dba: p.dba,
        isActive: p.isActive,
        createdAt: p.createdAt
      }))
    });
  } catch (error) {
    console.error('❌ Error checking company profiles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check company profiles',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Fix RFP progress values that were incorrectly set to 100%
 * POST /api/system/fix-rfp-progress
 */
router.post('/fix-rfp-progress', async (req, res) => {
  try {
    console.log('🔧 Starting RFP progress fix...');

    // Get all RFPs
    const { rfps } = await storage.getAllRFPs({ limit: 1000 });
    console.log(`📊 Found ${rfps.length} RFPs to check`);

    let updatedCount = 0;

    for (const rfp of rfps) {
      let newProgress = rfp.progress;

      // Determine correct progress based on status
      switch (rfp.status) {
        case 'discovered':
          newProgress = 15;  // Just discovered and scraped
          break;
        case 'parsing':
          newProgress = 20;  // Documents being processed
          break;
        case 'review':
          newProgress = 25;  // Analysis complete, ready for review
          break;
        case 'drafting':
          newProgress = 50;  // Proposal being generated
          break;
        case 'approved':
          newProgress = 85;  // Proposal approved, ready for submission
          break;
        case 'submitted':
          newProgress = 100; // Actually submitted - this should be 100%
          break;
        case 'closed':
          newProgress = 100; // Process complete
          break;
        default:
          // Keep existing progress if status is unknown
          continue;
      }

      // Only update if progress is different
      if (rfp.progress !== newProgress) {
        await storage.updateRFP(rfp.id, { progress: newProgress });
        console.log(`✅ Updated RFP "${rfp.title}" (${rfp.status}): ${rfp.progress}% → ${newProgress}%`);
        updatedCount++;
      }
    }

    console.log(`🎉 Progress fix complete! Updated ${updatedCount} out of ${rfps.length} RFPs`);

    res.json({
      success: true,
      message: `Fixed progress for ${updatedCount} out of ${rfps.length} RFPs`,
      updatedCount,
      totalChecked: rfps.length
    });

  } catch (error) {
    console.error('❌ Error fixing RFP progress:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fix RFP progress',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;