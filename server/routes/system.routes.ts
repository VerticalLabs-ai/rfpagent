import { Router } from 'express';
import { PortalSchedulerService } from '../services/portal-scheduler-service';
import { workflowCoordinator } from '../services/workflowCoordinator';

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

export default router;