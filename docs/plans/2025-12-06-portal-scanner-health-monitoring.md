# Portal Scanner Health Monitoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the automated portal scanning system that hasn't run in 45 days and add comprehensive health monitoring with alerts.

**Architecture:** The portal scheduler needs to auto-start on server boot (currently only starts via admin API). We'll add health check endpoints for portal monitoring status, implement the missing `/api/scans/history` and `/api/scans/statistics` endpoints, and enhance the existing Scan History UI page.

**Tech Stack:** Express, Node.js, TypeScript, node-cron, Drizzle ORM, React, TanStack Query

---

## Investigation Summary

**Root Cause Identified:**
- `PortalSchedulerService.initialize()` is **NOT called on server startup**
- The scheduler only starts when an admin manually calls `POST /api/system/services/portal-scheduler/enable`
- This means automated scanning has never been running since last server restart

**Austin Portal Status:** URL returns HTTP 200 - portal is accessible

**Missing Components:**
1. Auto-initialization of portal scheduler on server startup
2. `/api/scans/history` endpoint (frontend expects it, but doesn't exist)
3. `/api/scans/statistics` endpoint (frontend expects it, but doesn't exist)
4. Health check endpoints for portal monitoring status
5. Alert system for scan failures

---

## Task 1: Add Auto-Initialization of Portal Scheduler on Server Startup

**Files:**
- Modify: `server/index.ts:162-196` (add scheduler initialization after agent bootstrap)

**Step 1: Read the existing server initialization code**

Read `server/index.ts` to understand the initialization flow.

**Step 2: Add scheduler initialization after agent system bootstrap**

Add the following after the SAFLA initialization block (around line 195):

```typescript
// Initialize portal scheduler for automated scanning
if (process.env.AUTO_PORTAL_SCHEDULER !== 'false') {
  try {
    log('📡 Initializing portal scheduler...');
    const { PortalSchedulerService } = await import(
      './services/portals/portal-scheduler-service'
    );
    const { PortalMonitoringService } = await import(
      './services/monitoring/portal-monitoring-service'
    );
    const { storage } = await import('./storage');

    const portalMonitoringService = new PortalMonitoringService(storage);
    const portalSchedulerService = new PortalSchedulerService(
      storage,
      portalMonitoringService
    );
    await portalSchedulerService.initialize();
    log('✅ Portal scheduler initialized with automated scanning');
  } catch (error) {
    log(
      '⚠️ Failed to initialize portal scheduler (non-fatal):',
      error instanceof Error ? error.message : String(error)
    );
    log('   Portal scanning will need to be started manually');
  }
}
```

**Step 3: Run type-check to verify no errors**

Run: `pnpm run type-check`
Expected: No errors related to portal scheduler initialization

**Step 4: Commit the change**

```bash
git add server/index.ts
git commit -m "$(cat <<'EOF'
fix(portal-scheduler): auto-initialize scheduler on server startup

The portal scheduler was only starting when an admin manually called
the enable API endpoint. This meant automated scanning never ran after
server restarts. Now the scheduler initializes automatically unless
explicitly disabled with AUTO_PORTAL_SCHEDULER=false.
EOF
)"
```

---

## Task 2: Add Scan History API Endpoint

**Files:**
- Modify: `server/routes/scans.routes.ts` (add history endpoint)

**Step 1: Read the existing scans routes file**

Read `server/routes/scans.routes.ts` to understand the current route structure.

**Step 2: Add the history endpoint after the existing routes**

Add after line 309 (before `export default router`):

```typescript
/**
 * Get scan history with filtering and pagination
 * GET /api/scans/history?portalName=X&status=completed&limit=20&offset=0
 */
router.get('/history', async (req, res) => {
  try {
    const { portalName, status, limit = '50', offset = '0' } = req.query;

    const filter = {
      portalName: portalName as string | undefined,
      status: status as 'all' | 'completed' | 'failed' | 'completed_with_warnings' | 'running' | undefined,
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
    };

    const { scanHistoryService } = await import('../services/monitoring/scanHistoryService');

    const scans = await scanHistoryService.getScanHistory(filter);
    const total = await scanHistoryService.getScanHistoryCount(filter);

    res.json({
      scans,
      total,
      hasMore: filter.offset + scans.length < total,
    });
  } catch (error) {
    console.error('Error fetching scan history:', error);
    res.status(500).json({ error: 'Failed to fetch scan history' });
  }
});
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/routes/scans.routes.ts
git commit -m "$(cat <<'EOF'
feat(api): add scan history endpoint

Adds GET /api/scans/history with filtering by portal name and status,
plus pagination support. This endpoint is required by the Scan History
page in the frontend.
EOF
)"
```

---

## Task 3: Add Scan Statistics API Endpoint

**Files:**
- Modify: `server/routes/scans.routes.ts` (add statistics endpoint)

**Step 1: Add the statistics endpoint after the history endpoint**

Add after the `/history` endpoint:

```typescript
/**
 * Get scan statistics for the last N days
 * GET /api/scans/statistics?days=30
 */
router.get('/statistics', async (req, res) => {
  try {
    const { days = '30' } = req.query;
    const daysNum = parseInt(days as string, 10);

    const { scanHistoryService } = await import('../services/monitoring/scanHistoryService');

    const stats = await scanHistoryService.getScanStatistics(daysNum);

    res.json(stats);
  } catch (error) {
    console.error('Error fetching scan statistics:', error);
    res.status(500).json({ error: 'Failed to fetch scan statistics' });
  }
});
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/routes/scans.routes.ts
git commit -m "$(cat <<'EOF'
feat(api): add scan statistics endpoint

Adds GET /api/scans/statistics to retrieve aggregated scan metrics
including success rate, average RFPs per scan, and top performing
portals. Used by the Scan History page for the summary header.
EOF
)"
```

---

## Task 4: Add Portal Health Check Endpoint

**Files:**
- Modify: `server/routes/health.routes.ts` (add portal health endpoint)

**Step 1: Read the existing health routes**

Read `server/routes/health.routes.ts` to understand the current structure.

**Step 2: Add portal health check endpoint**

Add a new endpoint for portal monitoring health:

```typescript
/**
 * Get portal monitoring health status
 * GET /api/health/portals
 */
router.get('/portals', async (req, res) => {
  try {
    const { storage } = await import('../storage');
    const portals = await storage.getActivePortals();

    const now = new Date();
    const staleDays = 7; // Consider stale if not scanned in 7 days
    const staleThreshold = new Date(now.getTime() - staleDays * 24 * 60 * 60 * 1000);

    const portalHealth = await Promise.all(
      portals.map(async (portal) => {
        const lastScanned = portal.lastScanned ? new Date(portal.lastScanned) : null;
        const isStale = !lastScanned || lastScanned < staleThreshold;
        const daysSinceLastScan = lastScanned
          ? Math.floor((now.getTime() - lastScanned.getTime()) / (24 * 60 * 60 * 1000))
          : null;

        return {
          id: portal.id,
          name: portal.name,
          url: portal.url,
          status: portal.status,
          isActive: portal.isActive,
          monitoringEnabled: portal.monitoringEnabled,
          lastScanned: portal.lastScanned,
          daysSinceLastScan,
          isStale,
          errorCount: portal.errorCount || 0,
          lastError: portal.lastError,
          scanFrequency: portal.scanFrequency,
          health: isStale ? 'unhealthy' : portal.status === 'error' ? 'degraded' : 'healthy',
        };
      })
    );

    const healthyCount = portalHealth.filter(p => p.health === 'healthy').length;
    const degradedCount = portalHealth.filter(p => p.health === 'degraded').length;
    const unhealthyCount = portalHealth.filter(p => p.health === 'unhealthy').length;

    res.json({
      status: unhealthyCount > 0 ? 'unhealthy' : degradedCount > 0 ? 'degraded' : 'healthy',
      summary: {
        total: portals.length,
        healthy: healthyCount,
        degraded: degradedCount,
        unhealthy: unhealthyCount,
        staleThresholdDays: staleDays,
      },
      portals: portalHealth,
      timestamp: now.toISOString(),
    });
  } catch (error) {
    console.error('Error fetching portal health:', error);
    res.status(500).json({
      status: 'error',
      error: 'Failed to fetch portal health',
      timestamp: new Date().toISOString(),
    });
  }
});
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/routes/health.routes.ts
git commit -m "$(cat <<'EOF'
feat(health): add portal monitoring health check endpoint

Adds GET /api/health/portals to check portal scanning health.
Reports stale portals (not scanned in 7+ days), error counts,
and overall monitoring health status.
EOF
)"
```

---

## Task 5: Add Scheduler Status Endpoint

**Files:**
- Modify: `server/routes/system.routes.ts` (add scheduler status)

**Step 1: Read the system routes file**

Read `server/routes/system.routes.ts` to understand the current structure.

**Step 2: Add scheduler status endpoint**

Add after the existing routes (before `export default router`):

```typescript
/**
 * Get portal scheduler status and scheduled jobs
 * GET /api/system/scheduler/status
 */
router.get('/scheduler/status', async (req, res) => {
  try {
    const jobs = portalSchedulerService.getActiveJobs();

    res.json({
      isRunning: serviceRuntimeState.portalScheduler,
      jobCount: jobs.length,
      jobs: jobs.map(job => ({
        portalId: job.portalId,
        portalName: job.portalName,
        cronExpression: job.cronExpression,
        lastRun: job.lastRun,
        nextRun: job.nextRun,
        isActive: job.isActive,
      })),
      globalScanSchedule: '0 */6 * * *',
      timezone: 'America/Chicago',
    });
  } catch (error) {
    console.error('Error fetching scheduler status:', error);
    res.status(500).json({ error: 'Failed to fetch scheduler status' });
  }
});
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/routes/system.routes.ts
git commit -m "$(cat <<'EOF'
feat(api): add scheduler status endpoint

Adds GET /api/system/scheduler/status to view the current state of
the portal scheduler including all scheduled jobs, their cron
expressions, last/next run times, and active status.
EOF
)"
```

---

## Task 6: Add Scan Failure Alert Service

**Files:**
- Create: `server/services/monitoring/scanAlertService.ts`

**Step 1: Create the alert service file**

Create new file `server/services/monitoring/scanAlertService.ts`:

```typescript
import { IStorage, storage } from '../../storage';
import { captureMessage, withScope } from '@sentry/node';

export interface ScanAlert {
  type: 'scan_failure' | 'portal_stale' | 'consecutive_failures';
  portalId: string;
  portalName: string;
  message: string;
  severity: 'warning' | 'error' | 'critical';
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export class ScanAlertService {
  private readonly STALE_THRESHOLD_DAYS = 7;
  private readonly CONSECUTIVE_FAILURE_THRESHOLD = 3;

  constructor(private storage: IStorage) {}

  /**
   * Check all portals for alertable conditions
   */
  async checkPortalHealth(): Promise<ScanAlert[]> {
    const alerts: ScanAlert[] = [];

    try {
      const portals = await this.storage.getActivePortals();
      const now = new Date();

      for (const portal of portals) {
        // Check for stale portals
        if (portal.lastScanned) {
          const lastScanned = new Date(portal.lastScanned);
          const daysSinceLastScan = Math.floor(
            (now.getTime() - lastScanned.getTime()) / (24 * 60 * 60 * 1000)
          );

          if (daysSinceLastScan >= this.STALE_THRESHOLD_DAYS) {
            alerts.push({
              type: 'portal_stale',
              portalId: portal.id,
              portalName: portal.name,
              message: `Portal "${portal.name}" hasn't been scanned in ${daysSinceLastScan} days`,
              severity: daysSinceLastScan >= 30 ? 'critical' : 'warning',
              timestamp: now,
              metadata: { daysSinceLastScan, lastScanned: portal.lastScanned },
            });
          }
        }

        // Check for consecutive failures
        if (portal.errorCount >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
          alerts.push({
            type: 'consecutive_failures',
            portalId: portal.id,
            portalName: portal.name,
            message: `Portal "${portal.name}" has failed ${portal.errorCount} consecutive times`,
            severity: portal.errorCount >= 5 ? 'critical' : 'error',
            timestamp: now,
            metadata: {
              errorCount: portal.errorCount,
              lastError: portal.lastError,
            },
          });
        }
      }

      // Send alerts to Sentry if critical
      for (const alert of alerts) {
        if (alert.severity === 'critical') {
          this.sendToSentry(alert);
        }
      }

      // Create notifications for all alerts
      await this.createNotifications(alerts);

    } catch (error) {
      console.error('Error checking portal health:', error);
    }

    return alerts;
  }

  /**
   * Record a scan failure and check if we need to alert
   */
  async recordScanFailure(
    portalId: string,
    portalName: string,
    error: string
  ): Promise<ScanAlert | null> {
    const portal = await this.storage.getPortal(portalId);
    if (!portal) return null;

    const newErrorCount = (portal.errorCount || 0) + 1;

    // Update portal with new error
    await this.storage.updatePortal(portalId, {
      status: 'error',
      lastError: error,
      errorCount: newErrorCount,
    });

    // Check if we need to alert
    if (newErrorCount >= this.CONSECUTIVE_FAILURE_THRESHOLD) {
      const alert: ScanAlert = {
        type: 'consecutive_failures',
        portalId,
        portalName,
        message: `Portal "${portalName}" has failed ${newErrorCount} consecutive times: ${error}`,
        severity: newErrorCount >= 5 ? 'critical' : 'error',
        timestamp: new Date(),
        metadata: { errorCount: newErrorCount, lastError: error },
      };

      if (alert.severity === 'critical') {
        this.sendToSentry(alert);
      }

      await this.createNotifications([alert]);

      return alert;
    }

    return null;
  }

  /**
   * Record a successful scan (resets error count)
   */
  async recordScanSuccess(portalId: string): Promise<void> {
    await this.storage.updatePortal(portalId, {
      status: 'active',
      errorCount: 0,
      lastError: null,
    });
  }

  private sendToSentry(alert: ScanAlert): void {
    withScope(scope => {
      scope.setTag('service', 'portal-monitoring');
      scope.setTag('alert_type', alert.type);
      scope.setTag('portal_id', alert.portalId);
      scope.setTag('severity', alert.severity);
      scope.setContext('alert', {
        portalName: alert.portalName,
        ...alert.metadata,
      });
      scope.setLevel(alert.severity === 'critical' ? 'fatal' : 'error');
      captureMessage(alert.message);
    });
  }

  private async createNotifications(alerts: ScanAlert[]): Promise<void> {
    for (const alert of alerts) {
      try {
        await this.storage.createNotification({
          type: 'system',
          title: this.getAlertTitle(alert.type),
          message: alert.message,
          relatedEntityType: 'portal',
          relatedEntityId: alert.portalId,
          isRead: false,
        });
      } catch (error) {
        console.error('Failed to create notification for alert:', error);
      }
    }
  }

  private getAlertTitle(type: ScanAlert['type']): string {
    switch (type) {
      case 'scan_failure':
        return 'Portal Scan Failed';
      case 'portal_stale':
        return 'Portal Scan Overdue';
      case 'consecutive_failures':
        return 'Portal Requires Attention';
      default:
        return 'Portal Alert';
    }
  }
}

export const scanAlertService = new ScanAlertService(storage);
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/services/monitoring/scanAlertService.ts
git commit -m "$(cat <<'EOF'
feat(monitoring): add scan alert service for failure detection

Adds ScanAlertService to monitor portal scanning health and generate
alerts for:
- Stale portals (not scanned in 7+ days)
- Consecutive scan failures (3+ failures)
- Critical failures sent to Sentry
- User notifications created for all alerts
EOF
)"
```

---

## Task 7: Integrate Alert Service with Portal Scheduler

**Files:**
- Modify: `server/services/portals/portal-scheduler-service.ts` (integrate alert service)

**Step 1: Read the portal scheduler service**

Read `server/services/portals/portal-scheduler-service.ts` to find the right integration points.

**Step 2: Update the executePortalScan method to use alert service**

Update the imports at the top of the file:

```typescript
import { scanAlertService } from '../monitoring/scanAlertService';
```

Update the `executePortalScan` method to call the alert service on success/failure:

In the success path (after `console.log(`[SCHEDULER] Scan completed...`):
```typescript
// Reset error count on success
await scanAlertService.recordScanSuccess(portalId);
```

In the catch block (replace the notification creation with):
```typescript
// Record failure and check for alerts
await scanAlertService.recordScanFailure(
  portalId,
  portalName,
  error instanceof Error ? error.message : 'Unknown error'
);
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add server/services/portals/portal-scheduler-service.ts
git commit -m "$(cat <<'EOF'
feat(scheduler): integrate alert service for failure tracking

Portal scheduler now uses ScanAlertService to:
- Track consecutive scan failures
- Reset error count on successful scans
- Trigger alerts when failure threshold exceeded
EOF
)"
```

---

## Task 8: Add Health Check Alert Cron Job

**Files:**
- Modify: `server/index.ts` (add daily health check)

**Step 1: Add a daily health check cron job after scheduler initialization**

Add after the portal scheduler initialization block:

```typescript
// Schedule daily portal health check
if (process.env.DISABLE_HEALTH_CHECKS !== 'true') {
  const cron = await import('node-cron');

  // Run daily at 7 AM to check for stale portals
  cron.schedule('0 7 * * *', async () => {
    try {
      log('🔍 Running daily portal health check...');
      const { scanAlertService } = await import(
        './services/monitoring/scanAlertService'
      );
      const alerts = await scanAlertService.checkPortalHealth();
      if (alerts.length > 0) {
        log(`⚠️ Portal health check found ${alerts.length} issues`);
      } else {
        log('✅ Portal health check passed - all portals healthy');
      }
    } catch (error) {
      log('⚠️ Portal health check failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }, {
    timezone: 'America/Chicago',
  });
  log('📅 Daily portal health check scheduled (7 AM CT)');
}
```

**Step 2: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add server/index.ts
git commit -m "$(cat <<'EOF'
feat(monitoring): add daily portal health check cron job

Schedules a daily health check at 7 AM CT to detect stale portals
and consecutive failures. Alerts are created as notifications and
critical issues are sent to Sentry.
EOF
)"
```

---

## Task 9: Verify Build and Run Tests

**Files:**
- None (verification only)

**Step 1: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 2: Run linter**

Run: `pnpm run lint`
Expected: No new errors

**Step 3: Run build**

Run: `pnpm run build`
Expected: Build succeeds

**Step 4: Commit any fixes if needed**

If any issues found, fix and commit.

---

## Task 10: Update Scan History Page UI (Optional Enhancement)

**Files:**
- Modify: `client/src/pages/scan-history.tsx` (add scheduler status indicator)

**Step 1: Add scheduler status query to the page**

Add a new query to fetch scheduler status:

```typescript
const { data: schedulerStatus } = useQuery({
  queryKey: ['/api/system/scheduler/status'],
  refetchInterval: 60000,
});
```

**Step 2: Add scheduler status indicator to the header**

Add after the refresh button in the header:

```typescript
{schedulerStatus && (
  <Badge
    variant={schedulerStatus.isRunning ? 'default' : 'destructive'}
    className="ml-2"
  >
    {schedulerStatus.isRunning
      ? `Scheduler Active (${schedulerStatus.jobCount} jobs)`
      : 'Scheduler Inactive'}
  </Badge>
)}
```

**Step 3: Run type-check**

Run: `pnpm run type-check`
Expected: No errors

**Step 4: Commit**

```bash
git add client/src/pages/scan-history.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add scheduler status indicator to scan history page

Shows whether the portal scheduler is running and how many jobs are
scheduled. Helps admins quickly identify if automated scanning is
working correctly.
EOF
)"
```

---

## Task 11: Final Integration Test and Deploy

**Files:**
- None (manual testing)

**Step 1: Start the development server**

Run: `pnpm run dev`

**Step 2: Verify scheduler initializes on startup**

Check server logs for:
- "📡 Initializing portal scheduler..."
- "✅ Portal scheduler initialized with automated scanning"

**Step 3: Verify API endpoints work**

Test the new endpoints:
- `GET /api/scans/history`
- `GET /api/scans/statistics`
- `GET /api/health/portals`
- `GET /api/system/scheduler/status`

**Step 4: Verify Scan History page loads**

Navigate to `/scan-history` and verify:
- Page loads without errors
- Statistics are displayed
- Scan history is shown (may be empty)

**Step 5: Push all changes**

```bash
git push origin main
```

**Step 6: Deploy to production**

Run: `flyctl deploy`

---

## Summary of Changes

| File | Change |
|------|--------|
| `server/index.ts` | Auto-initialize portal scheduler on startup + daily health check |
| `server/routes/scans.routes.ts` | Add `/history` and `/statistics` endpoints |
| `server/routes/health.routes.ts` | Add `/portals` health check endpoint |
| `server/routes/system.routes.ts` | Add `/scheduler/status` endpoint |
| `server/services/monitoring/scanAlertService.ts` | New alert service for failure tracking |
| `server/services/portals/portal-scheduler-service.ts` | Integrate alert service |
| `client/src/pages/scan-history.tsx` | Add scheduler status indicator (optional) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_PORTAL_SCHEDULER` | `true` | Set to `false` to disable auto-starting scheduler |
| `DISABLE_HEALTH_CHECKS` | `false` | Set to `true` to disable daily health checks |
