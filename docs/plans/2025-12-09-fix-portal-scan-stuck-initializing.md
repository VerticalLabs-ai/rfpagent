# Implementation Plan: Fix Portal Scan Stuck at "Initializing"

**Date**: 2025-12-09
**Issue**: Portal scan for SAM.gov gets stuck at "Initializing" (0%) and never progresses
**Engineer Context Level**: Zero codebase knowledge assumed

---

## Problem Analysis

### Root Cause Identified

The scan gets stuck because the `portal-monitoring-service.ts` always attempts Browserbase/Stagehand authentication (lines 104-133), even for **public portals** like SAM.gov that:
1. Don't require authentication
2. Should use the REST API directly instead of browser automation

The Activity Feed shows the scan emitting:
```json
{"step":"authenticating","progress":20,"message":"Connecting to portal: https://sam.gov"}
```

This confirms the code reaches `scanPortalWithEvents()` line 120-125 which calls `unifiedBrowserbaseWebScrape()`. However, for SAM.gov:
- The `SAMGovAuthStrategy.ts` exists and uses API key authentication (REST API)
- The `samGovApiClient.ts` provides direct API access to `https://api.sam.gov/opportunities/v2`
- BUT the portal-monitoring-service bypasses both and tries browser automation

### Why It Hangs

1. **No Timeout on Stagehand Tools**: `page-auth-tool.ts` and `executeStagehandTool()` have no timeout wrapper
2. **Public Portal Treated as Auth-Required**: The code path doesn't check `portal.loginRequired` before attempting browser automation
3. **SAM.gov Should Use API, Not Browser**: SAM.gov has a public REST API but the service uses browser automation
4. **No Error Surfacing**: When Browserbase/Stagehand hangs, no error is emitted to the SSE stream

---

## Implementation Tasks

### Task 1: Add Public Portal Detection in `portal-monitoring-service.ts`

**File**: `server/services/monitoring/portal-monitoring-service.ts`

**Lines to modify**: Around lines 104-133

**Current code** (lines 119-133):
```typescript
try {
  scanManager.updateStep(
    scanId,
    'authenticating',
    20,
    `Connecting to portal: ${portal.url}`
  );
  scanManager.log(
    scanId,
    'info',
    `Starting Mastra/Browserbase scraping for: ${portal.url}`
  );

  // The MastraScrapingService handles everything: authentication, navigation, extraction
  await this.mastraService.scrapePortal(portal);
```

**Change to**:
```typescript
try {
  // Check if this is a public portal that doesn't require authentication
  const isPublicPortal = !portal.loginRequired || this.isPublicApiPortal(portal);

  if (isPublicPortal) {
    scanManager.updateStep(
      scanId,
      'authenticated',  // Skip authentication for public portals
      25,
      `Public portal detected - no authentication required`
    );
    scanManager.log(
      scanId,
      'info',
      `Skipping authentication for public portal: ${portal.name}`
    );
  } else {
    scanManager.updateStep(
      scanId,
      'authenticating',
      20,
      `Connecting to portal: ${portal.url}`
    );
    scanManager.log(
      scanId,
      'info',
      `Starting Mastra/Browserbase scraping for: ${portal.url}`
    );
  }

  // The MastraScrapingService handles everything: authentication, navigation, extraction
  await this.mastraService.scrapePortal(portal);
```

**Add new method** at the end of the class (before the closing brace):
```typescript
/**
 * Check if portal uses a public API (no browser auth needed)
 */
private isPublicApiPortal(portal: Portal): boolean {
  const url = portal.url.toLowerCase();
  const name = portal.name.toLowerCase();

  // SAM.gov uses public REST API
  if (url.includes('sam.gov') || name.includes('sam.gov')) {
    return true;
  }

  // Add other public API portals here as needed
  return false;
}
```

---

### Task 2: Add SAM.gov-Specific Fast Path in `mastraScrapingService.ts`

**File**: `server/services/scrapers/mastraScrapingService.ts`

**Location**: In the `scrapePortal()` method (around line 585)

**Find this code** (around lines 596-660):
```typescript
try {
  // Update last scanned timestamp
  await storage.updatePortal(portal.id, {
    lastScanned: new Date(),
    status: 'active',
  });

  // Select appropriate agent based on portal type
  const agent = this.selectAgent(portal);
```

**Add before the agent selection** (after status update):
```typescript
// Update last scanned timestamp
await storage.updatePortal(portal.id, {
  lastScanned: new Date(),
  status: 'active',
});

// SAM.gov special handling - use REST API directly instead of browser automation
if (this.isSAMGovPortal(portal)) {
  console.log(`🏛️ SAM.gov detected: Using REST API for discovery (faster, more reliable)`);
  try {
    const opportunities = await this.scrapeViasSAMGovApi(portal, searchFilter);

    // Process discovered opportunities
    for (const opportunity of opportunities) {
      await this.processOpportunity(opportunity, portal, null);
    }

    console.log(`✅ SAM.gov API scrape completed: found ${opportunities.length} opportunities`);
    return;
  } catch (apiError) {
    console.error(`⚠️ SAM.gov API failed, falling back to browser automation:`, apiError);
    // Continue to browser automation as fallback
  }
}

// Select appropriate agent based on portal type
const agent = this.selectAgent(portal);
```

**Add these new methods** at the end of the class:
```typescript
/**
 * Check if portal is SAM.gov
 */
private isSAMGovPortal(portal: Portal): boolean {
  const url = portal.url.toLowerCase();
  const name = portal.name.toLowerCase();
  return url.includes('sam.gov') || name.includes('sam.gov') || name.includes('sam_gov');
}

/**
 * Scrape SAM.gov using REST API (faster, more reliable)
 */
private async scrapeViasSAMGovApi(portal: Portal, searchFilter?: string): Promise<any[]> {
  const { SAMGovApiClient } = await import('./utils/samGovApiClient');
  const client = new SAMGovApiClient();

  // Build search filters
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  const filters: any = {
    postedFrom: thirtyDaysAgo.toISOString().split('T')[0],
    postedTo: today.toISOString().split('T')[0],
    limit: portal.maxRfpsPerScan || 50,
  };

  if (searchFilter) {
    filters.keywords = searchFilter;
  }

  // Use the API client with retry logic
  const results = await client.searchWithRetry(filters);

  // Convert to opportunity format
  return (results.opportunitiesData || []).map((opp: any) => ({
    title: opp.title || opp.solicitationNumber || 'Untitled Opportunity',
    solicitationId: opp.solicitationNumber,
    description: opp.description || opp.additionalInfoLink,
    agency: opp.department || opp.subTier || opp.fullParentPathName,
    deadline: opp.responseDeadLine,
    estimatedValue: opp.award?.amount?.toString(),
    url: `https://sam.gov/opp/${opp.noticeId}/view`,
    category: opp.type,
    confidence: 0.95, // High confidence from official API
  }));
}
```

---

### Task 3: Add Timeout Wrapper for Stagehand Tool Execution

**File**: `server/services/scraping/utils/stagehand.ts`

**Current `executeStagehandTool` function** (lines 76-93):
```typescript
export async function executeStagehandTool<
  TSchema extends z.ZodTypeAny,
  TResult,
>(
  tool: StagehandTool<TSchema>,
  params: z.infer<TSchema>,
  resultSchema?: z.ZodType<TResult>
): Promise<TResult> {
  const { inputSchema, execute } = tool;
  if (!inputSchema || typeof execute !== 'function') {
    throw new Error('Stagehand tool is not initialized');
  }

  const context = buildContext(inputSchema, params);
  const rawResult = await execute(context);

  return resultSchema ? resultSchema.parse(rawResult) : (rawResult as TResult);
}
```

**Replace with**:
```typescript
/**
 * Default timeout for Stagehand tool execution (2 minutes)
 */
const DEFAULT_STAGEHAND_TIMEOUT = 120000;

/**
 * Execute a Stagehand tool with timeout protection
 */
export async function executeStagehandTool<
  TSchema extends z.ZodTypeAny,
  TResult,
>(
  tool: StagehandTool<TSchema>,
  params: z.infer<TSchema>,
  resultSchema?: z.ZodType<TResult>,
  timeoutMs: number = DEFAULT_STAGEHAND_TIMEOUT
): Promise<TResult> {
  const { inputSchema, execute } = tool;
  if (!inputSchema || typeof execute !== 'function') {
    throw new Error('Stagehand tool is not initialized');
  }

  const context = buildContext(inputSchema, params);

  // Execute with timeout protection
  const rawResult = await Promise.race([
    execute(context),
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Stagehand tool timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);

  return resultSchema ? resultSchema.parse(rawResult) : (rawResult as TResult);
}
```

---

### Task 4: Update `browserbaseOps.ts` to Skip Auth for Public Portals

**File**: `server/services/mastra/core/browserbaseOps.ts`

**Modify `unifiedBrowserbaseWebScrape` function** (around lines 75-115):

**Current code**:
```typescript
// Handle authentication if required
if (loginRequired && credentials?.username && credentials?.password) {
  console.log(`🔐 Authentication required for portal: ${portalType}`);

  const authResult = await executeStagehandTool(
```

**Change to**:
```typescript
// Handle authentication if required (skip for public portals)
const isPublicPortal = !loginRequired ||
  portalType?.toLowerCase().includes('sam.gov') ||
  portalType?.toLowerCase().includes('sam_gov');

if (!isPublicPortal && loginRequired && credentials?.username && credentials?.password) {
  console.log(`🔐 Authentication required for portal: ${portalType}`);

  const authResult = await executeStagehandTool(
```

Also add a log when skipping auth:
```typescript
} else if (loginRequired && isPublicPortal) {
  console.log(`✅ Skipping authentication for public portal: ${portalType}`);
}
```

---

### Task 5: Add Timeout to `scanPortalWithEvents()` Call

**File**: `server/routes/portals.routes.ts`

**Current code** (lines 150-172):
```typescript
// Use new monitoring service for enhanced scanning with scan context
portalMonitoringService
  .scanPortalWithEvents(portal.id, scanId)
  .catch(error => {
    console.error(
      `Portal scan error for ${portal.name} (${portal.id}):`,
      error
    );
    // Ensure scan manager is notified of failure
    try {
      scanManager.log(
        scanId,
        'error',
        `Fatal scan error: ${error instanceof Error ? error.message : String(error)}`
      );
      scanManager.completeScan(scanId, false);
    } catch (managerError) {
      console.error(
        'Failed to update scan manager with error:',
        managerError
      );
    }
  });
```

**Change to**:
```typescript
// Use new monitoring service for enhanced scanning with scan context
// Add a 5-minute timeout to prevent indefinite hanging
const SCAN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const scanPromise = portalMonitoringService.scanPortalWithEvents(portal.id, scanId);
const timeoutPromise = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Portal scan timed out after 5 minutes')), SCAN_TIMEOUT_MS)
);

Promise.race([scanPromise, timeoutPromise])
  .catch(error => {
    console.error(
      `Portal scan error for ${portal.name} (${portal.id}):`,
      error
    );
    // Ensure scan manager is notified of failure
    try {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isTimeout = errorMessage.includes('timed out');

      scanManager.log(
        scanId,
        'error',
        isTimeout
          ? `Scan timed out - portal may be unresponsive or blocking automated access`
          : `Fatal scan error: ${errorMessage}`
      );
      scanManager.completeScan(scanId, false);
    } catch (managerError) {
      console.error(
        'Failed to update scan manager with error:',
        managerError
      );
    }
  });
```

---

### Task 6: Improve Error Messaging in `scan-manager.ts`

**File**: `server/services/portals/scan-manager.ts`

**Add a new method** to provide better error context (after `completeScan` method around line 284):

```typescript
/**
 * Mark scan as timed out with appropriate error messaging
 */
timeoutScan(scanId: string, reason?: string): void {
  const scan = this.activeScans.get(scanId);
  if (!scan || scan.status !== 'running') {
    return;
  }

  const timeoutMessage = reason || 'Scan timed out - the portal may be unresponsive or blocking automated access';

  scan.errors.push(timeoutMessage);
  this.log(scanId, 'error', timeoutMessage);

  scan.currentStep = {
    step: 'failed',
    progress: scan.currentStep.progress, // Keep last known progress
    message: timeoutMessage,
  };

  this.completeScan(scanId, false);
}
```

---

### Task 7: Add Import for SAMGovApiClient (if not present)

**File**: `server/services/scrapers/mastraScrapingService.ts`

**Verify this import exists** at the top of the file (if not, it will be dynamically imported in the method):
```typescript
import { SAMGovApiClient } from './utils/samGovApiClient';
```

The current code at line 33 shows:
```typescript
import { SAMGovDocumentDownloader } from './samGovDocumentDownloader';
```

The `samGovApiClient.ts` exists at `server/services/scraping/utils/samGovApiClient.ts` - the import path should be:
```typescript
import { SAMGovApiClient } from '../scraping/utils/samGovApiClient';
```

However, since we used dynamic import in the method, this is optional.

---

## Verification Steps

After implementing these changes:

1. **Restart the server**:
   ```bash
   npm run dev
   ```

2. **Test SAM.gov scan**:
   - Navigate to Portals page
   - Click "Scan Now" on SAM.gov portal
   - Verify scan progresses past "Initializing"
   - Verify scan either completes with discovered RFPs or fails with a meaningful error

3. **Check the Activity Feed** for these expected events:
   - `Skipping authentication for public portal: SAM.gov` (if using API path)
   - OR `Public portal detected - no authentication required`
   - Progress should advance to `extracting`, `parsing`, then `completed`

4. **Verify timeout works**:
   - If scan still hangs, it should fail after 5 minutes with a timeout error
   - The error should surface in the UI as "Scan timed out..."

5. **Check server logs** for:
   - `🏛️ SAM.gov detected: Using REST API for discovery`
   - OR `✅ Skipping authentication for public portal`

---

## Files Modified Summary

| File | Change |
|------|--------|
| `server/services/monitoring/portal-monitoring-service.ts` | Add public portal detection, skip auth step |
| `server/services/scrapers/mastraScrapingService.ts` | Add SAM.gov API fast path |
| `server/services/scraping/utils/stagehand.ts` | Add timeout wrapper |
| `server/services/mastra/core/browserbaseOps.ts` | Skip auth for public portals |
| `server/routes/portals.routes.ts` | Add 5-minute scan timeout |
| `server/services/portals/scan-manager.ts` | Add timeoutScan method |

---

## Rollback Plan

If issues occur, revert all changes in the files listed above. The system will return to the previous behavior (hanging on SAM.gov scans).

---

## Future Improvements (Out of Scope)

1. Add portal-specific timeout configurations in the database
2. Implement circuit breaker for repeatedly failing portals
3. Add SAM.gov API key validation on portal creation
4. Create a portal health dashboard showing scan success rates
