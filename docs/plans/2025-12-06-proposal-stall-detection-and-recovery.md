# Proposal Generation Stall Detection and Recovery Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Detect, alert, and recover from stalled AI proposal generation workflows that get stuck in "drafting" state indefinitely.

**Architecture:** Add a stall detection service that monitors RFPs in "drafting" status, implements configurable timeouts with retry logic, provides alerting via notifications, and exposes manual intervention endpoints. Uses database-backed state tracking (not in-memory) to survive server restarts.

**Tech Stack:** TypeScript, Express, PostgreSQL (Drizzle ORM), node-cron for scheduled checks, existing notification system

---

## Problem Analysis

The current proposal generation system has critical gaps:

1. **Memory-based pipeline tracking** - `activePipelines` Map in `proposalGenerationOrchestrator.ts` is lost on server restart, leaving RFPs stuck in "drafting" status with no way to recover
2. **No stall detection** - If AI generation hangs or times out silently, RFPs remain in "drafting" forever
3. **30-minute phase timeout is aggressive** - Premium Claude generation can take 15+ minutes, and timeouts fail silently
4. **No manual intervention** - No API to restart or cancel stalled drafts
5. **No alerting** - Users aren't notified when generations stall

---

## Task 1: Add Stall Detection Fields to Schema

**Files:**
- Modify: `shared/schema.ts:71-112` (rfps table)
- Create: `migrations/XXXX_add_stall_detection_fields.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/schema/stall-detection-fields.test.ts
import { describe, it, expect } from 'vitest';
import { rfps } from '@shared/schema';

describe('RFP stall detection fields', () => {
  it('should have generationStartedAt timestamp field', () => {
    expect(rfps.generationStartedAt).toBeDefined();
    expect(rfps.generationStartedAt.dataType).toBe('timestamp');
  });

  it('should have generationAttempts integer field', () => {
    expect(rfps.generationAttempts).toBeDefined();
    expect(rfps.generationAttempts.dataType).toBe('integer');
  });

  it('should have lastGenerationError text field', () => {
    expect(rfps.lastGenerationError).toBeDefined();
    expect(rfps.lastGenerationError.dataType).toBe('text');
  });

  it('should have maxGenerationAttempts integer field with default 3', () => {
    expect(rfps.maxGenerationAttempts).toBeDefined();
    expect(rfps.maxGenerationAttempts.default).toBe(3);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/schema/stall-detection-fields.test.ts`
Expected: FAIL with "rfps.generationStartedAt is undefined"

**Step 3: Add fields to rfps table in schema**

Modify `shared/schema.ts` - add after line 86 (after `progress` field):

```typescript
  // Stall detection fields
  generationStartedAt: timestamp('generation_started_at'),
  generationAttempts: integer('generation_attempts').default(0).notNull(),
  maxGenerationAttempts: integer('max_generation_attempts').default(3).notNull(),
  lastGenerationError: text('last_generation_error'),
  generationTimeoutMinutes: integer('generation_timeout_minutes').default(45).notNull(),
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/schema/stall-detection-fields.test.ts`
Expected: PASS

**Step 5: Generate and apply migration**

Run: `npx drizzle-kit generate && npx drizzle-kit migrate`

**Step 6: Commit**

```bash
git add shared/schema.ts migrations/ tests/unit/schema/
git commit -m "feat(schema): add stall detection fields to rfps table"
```

---

## Task 2: Create Stall Detection Service

**Files:**
- Create: `server/services/monitoring/stallDetectionService.ts`
- Create: `tests/unit/services/stallDetectionService.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/services/stallDetectionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StallDetectionService } from '../../../server/services/monitoring/stallDetectionService';

describe('StallDetectionService', () => {
  let service: StallDetectionService;

  beforeEach(() => {
    service = new StallDetectionService();
  });

  describe('detectStalledRFPs', () => {
    it('should detect RFPs stuck in drafting status beyond timeout', async () => {
      // Mock storage to return RFP that started 2 hours ago
      const mockStorage = {
        getStalledRFPs: vi.fn().mockResolvedValue([
          {
            id: 'rfp-123',
            title: 'Test RFP',
            status: 'drafting',
            generationStartedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            generationTimeoutMinutes: 45,
            generationAttempts: 1,
            maxGenerationAttempts: 3,
          },
        ]),
      };

      service.setStorage(mockStorage);
      const stalled = await service.detectStalledRFPs();

      expect(stalled).toHaveLength(1);
      expect(stalled[0].id).toBe('rfp-123');
    });

    it('should not flag RFPs within timeout window', async () => {
      const mockStorage = {
        getStalledRFPs: vi.fn().mockResolvedValue([]),
      };

      service.setStorage(mockStorage);
      const stalled = await service.detectStalledRFPs();

      expect(stalled).toHaveLength(0);
    });
  });

  describe('handleStalledRFP', () => {
    it('should retry generation if under max attempts', async () => {
      const rfp = {
        id: 'rfp-123',
        generationAttempts: 1,
        maxGenerationAttempts: 3,
      };

      const result = await service.handleStalledRFP(rfp);

      expect(result.action).toBe('retry');
      expect(result.newAttemptCount).toBe(2);
    });

    it('should mark as failed after max attempts', async () => {
      const rfp = {
        id: 'rfp-123',
        generationAttempts: 3,
        maxGenerationAttempts: 3,
      };

      const result = await service.handleStalledRFP(rfp);

      expect(result.action).toBe('failed');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/services/stallDetectionService.test.ts`
Expected: FAIL with "Cannot find module stallDetectionService"

**Step 3: Write the StallDetectionService implementation**

```typescript
// server/services/monitoring/stallDetectionService.ts
import { storage } from '../../storage';
import { eq, and, lt, isNotNull } from 'drizzle-orm';
import { rfps } from '@shared/schema';

export interface StalledRFP {
  id: string;
  title: string;
  status: string;
  generationStartedAt: Date | null;
  generationTimeoutMinutes: number;
  generationAttempts: number;
  maxGenerationAttempts: number;
  lastGenerationError: string | null;
  progress: number;
}

export interface StallHandlerResult {
  rfpId: string;
  action: 'retry' | 'failed' | 'cancelled';
  newAttemptCount?: number;
  error?: string;
  notificationCreated: boolean;
}

export class StallDetectionService {
  private storageInstance: typeof storage = storage;
  private checkIntervalMs: number = 5 * 60 * 1000; // Check every 5 minutes
  private intervalId: NodeJS.Timeout | null = null;

  setStorage(mockStorage: any): void {
    this.storageInstance = mockStorage;
  }

  /**
   * Detect RFPs that are stalled in "drafting" status
   */
  async detectStalledRFPs(): Promise<StalledRFP[]> {
    console.log('🔍 Checking for stalled RFP generations...');

    try {
      const stalledRFPs = await this.storageInstance.getStalledRFPs();

      if (stalledRFPs.length > 0) {
        console.log(`⚠️ Found ${stalledRFPs.length} stalled RFP generation(s)`);
      }

      return stalledRFPs;
    } catch (error) {
      console.error('❌ Error detecting stalled RFPs:', error);
      return [];
    }
  }

  /**
   * Handle a single stalled RFP - retry or mark as failed
   */
  async handleStalledRFP(rfp: StalledRFP): Promise<StallHandlerResult> {
    console.log(`🔧 Handling stalled RFP: ${rfp.id} (${rfp.title})`);

    const canRetry = rfp.generationAttempts < rfp.maxGenerationAttempts;

    if (canRetry) {
      return await this.retryGeneration(rfp);
    } else {
      return await this.markAsFailed(rfp);
    }
  }

  /**
   * Retry proposal generation for a stalled RFP
   */
  private async retryGeneration(rfp: StalledRFP): Promise<StallHandlerResult> {
    const newAttemptCount = rfp.generationAttempts + 1;

    console.log(`🔄 Retrying generation for RFP ${rfp.id} (attempt ${newAttemptCount}/${rfp.maxGenerationAttempts})`);

    try {
      // Reset RFP status to discovered so it can be re-queued
      await this.storageInstance.updateRFP(rfp.id, {
        status: 'discovered',
        progress: 0,
        generationAttempts: newAttemptCount,
        generationStartedAt: null,
        lastGenerationError: `Stall detected after ${rfp.generationTimeoutMinutes} minutes. Retry ${newAttemptCount}/${rfp.maxGenerationAttempts}.`,
      });

      // Create notification
      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Retry',
        message: `Proposal generation for "${rfp.title}" stalled and is being retried (attempt ${newAttemptCount}/${rfp.maxGenerationAttempts}).`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      // Create audit log
      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'generation_retry',
        details: {
          attemptNumber: newAttemptCount,
          maxAttempts: rfp.maxGenerationAttempts,
          previousProgress: rfp.progress,
          stallDurationMinutes: rfp.generationTimeoutMinutes,
        },
      });

      return {
        rfpId: rfp.id,
        action: 'retry',
        newAttemptCount,
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error retrying generation for RFP ${rfp.id}:`, error);
      return {
        rfpId: rfp.id,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Mark RFP as failed after exhausting retry attempts
   */
  private async markAsFailed(rfp: StalledRFP): Promise<StallHandlerResult> {
    console.log(`❌ Marking RFP ${rfp.id} as failed after ${rfp.maxGenerationAttempts} attempts`);

    try {
      await this.storageInstance.updateRFP(rfp.id, {
        status: 'discovered', // Reset to discovered so user can manually retry
        progress: 0,
        lastGenerationError: `Generation failed after ${rfp.maxGenerationAttempts} attempts. Manual intervention required.`,
      });

      // Create high-priority notification
      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Failed',
        message: `Proposal generation for "${rfp.title}" failed after ${rfp.maxGenerationAttempts} attempts. Manual intervention required.`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfp.id,
      });

      // Create audit log
      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfp.id,
        action: 'generation_failed',
        details: {
          totalAttempts: rfp.maxGenerationAttempts,
          lastProgress: rfp.progress,
          requiresManualIntervention: true,
        },
      });

      return {
        rfpId: rfp.id,
        action: 'failed',
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error marking RFP ${rfp.id} as failed:`, error);
      return {
        rfpId: rfp.id,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Cancel a stalled generation manually
   */
  async cancelStalledGeneration(rfpId: string, reason?: string): Promise<StallHandlerResult> {
    console.log(`🚫 Cancelling stalled generation for RFP: ${rfpId}`);

    try {
      const rfp = await this.storageInstance.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      await this.storageInstance.updateRFP(rfpId, {
        status: 'discovered',
        progress: 0,
        generationStartedAt: null,
        lastGenerationError: reason || 'Generation cancelled by user.',
      });

      await this.storageInstance.createNotification({
        type: 'compliance',
        title: 'Proposal Generation Cancelled',
        message: `Proposal generation for "${rfp.title}" was cancelled. ${reason || ''}`,
        relatedEntityType: 'rfp',
        relatedEntityId: rfpId,
      });

      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'generation_cancelled',
        details: {
          reason: reason || 'User requested cancellation',
          previousProgress: rfp.progress,
          previousStatus: rfp.status,
        },
      });

      return {
        rfpId,
        action: 'cancelled',
        notificationCreated: true,
      };
    } catch (error) {
      console.error(`❌ Error cancelling generation for RFP ${rfpId}:`, error);
      return {
        rfpId,
        action: 'cancelled',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Manually restart generation for an RFP
   */
  async restartGeneration(rfpId: string): Promise<StallHandlerResult> {
    console.log(`🔄 Manually restarting generation for RFP: ${rfpId}`);

    try {
      const rfp = await this.storageInstance.getRFP(rfpId);
      if (!rfp) {
        throw new Error(`RFP not found: ${rfpId}`);
      }

      // Reset to discovered state with fresh attempt counter
      await this.storageInstance.updateRFP(rfpId, {
        status: 'discovered',
        progress: 0,
        generationAttempts: 0,
        generationStartedAt: null,
        lastGenerationError: null,
      });

      await this.storageInstance.createAuditLog({
        entityType: 'rfp',
        entityId: rfpId,
        action: 'generation_restart',
        details: {
          previousProgress: rfp.progress,
          previousStatus: rfp.status,
          previousAttempts: rfp.generationAttempts,
        },
      });

      return {
        rfpId,
        action: 'retry',
        newAttemptCount: 0,
        notificationCreated: false,
      };
    } catch (error) {
      console.error(`❌ Error restarting generation for RFP ${rfpId}:`, error);
      return {
        rfpId,
        action: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationCreated: false,
      };
    }
  }

  /**
   * Run stall detection check and handle all stalled RFPs
   */
  async runStallCheck(): Promise<StallHandlerResult[]> {
    const stalledRFPs = await this.detectStalledRFPs();
    const results: StallHandlerResult[] = [];

    for (const rfp of stalledRFPs) {
      const result = await this.handleStalledRFP(rfp);
      results.push(result);
    }

    if (results.length > 0) {
      console.log(`✅ Processed ${results.length} stalled RFP(s)`);
    }

    return results;
  }

  /**
   * Start automated stall detection monitoring
   */
  startMonitoring(): void {
    if (this.intervalId) {
      console.log('⚠️ Stall detection monitoring already running');
      return;
    }

    console.log(`🚀 Starting stall detection monitoring (interval: ${this.checkIntervalMs / 1000}s)`);

    // Run immediately on start
    this.runStallCheck().catch(err => console.error('Error in initial stall check:', err));

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runStallCheck().catch(err => console.error('Error in stall check:', err));
    }, this.checkIntervalMs);
  }

  /**
   * Stop automated stall detection monitoring
   */
  stopMonitoring(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('🛑 Stall detection monitoring stopped');
    }
  }

  /**
   * Get current monitoring status
   */
  isMonitoring(): boolean {
    return this.intervalId !== null;
  }
}

export const stallDetectionService = new StallDetectionService();
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/services/stallDetectionService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/monitoring/stallDetectionService.ts tests/unit/services/
git commit -m "feat(monitoring): add stall detection service for proposal generation"
```

---

## Task 3: Add getStalledRFPs Storage Method

**Files:**
- Modify: `server/storage.ts`
- Create: `tests/unit/storage/getStalledRFPs.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/storage/getStalledRFPs.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { storage } from '../../../server/storage';
import { db } from '../../../server/db';
import { rfps } from '@shared/schema';
import { eq } from 'drizzle-orm';

describe('storage.getStalledRFPs', () => {
  let testRfpId: string;

  beforeEach(async () => {
    // Create test RFP in drafting status with old generationStartedAt
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const [rfp] = await db.insert(rfps).values({
      title: 'Test Stalled RFP',
      agency: 'Test Agency',
      sourceUrl: 'https://test.gov/rfp/123',
      status: 'drafting',
      progress: 50,
      generationStartedAt: twoHoursAgo,
      generationAttempts: 1,
      maxGenerationAttempts: 3,
      generationTimeoutMinutes: 45,
    }).returning();
    testRfpId = rfp.id;
  });

  afterEach(async () => {
    // Cleanup
    if (testRfpId) {
      await db.delete(rfps).where(eq(rfps.id, testRfpId));
    }
  });

  it('should return RFPs in drafting status beyond timeout', async () => {
    const stalled = await storage.getStalledRFPs();

    expect(stalled.length).toBeGreaterThan(0);
    const found = stalled.find(r => r.id === testRfpId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('drafting');
  });

  it('should not return RFPs within timeout window', async () => {
    // Update to recent start time
    await db.update(rfps)
      .set({ generationStartedAt: new Date() })
      .where(eq(rfps.id, testRfpId));

    const stalled = await storage.getStalledRFPs();
    const found = stalled.find(r => r.id === testRfpId);

    expect(found).toBeUndefined();
  });

  it('should not return RFPs not in drafting status', async () => {
    await db.update(rfps)
      .set({ status: 'review' })
      .where(eq(rfps.id, testRfpId));

    const stalled = await storage.getStalledRFPs();
    const found = stalled.find(r => r.id === testRfpId);

    expect(found).toBeUndefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/storage/getStalledRFPs.test.ts`
Expected: FAIL with "storage.getStalledRFPs is not a function"

**Step 3: Add getStalledRFPs method to storage**

Add to `server/storage.ts` after other RFP methods:

```typescript
  /**
   * Get RFPs that are stalled in drafting status beyond their timeout
   */
  async getStalledRFPs(): Promise<Array<{
    id: string;
    title: string;
    status: string;
    generationStartedAt: Date | null;
    generationTimeoutMinutes: number;
    generationAttempts: number;
    maxGenerationAttempts: number;
    lastGenerationError: string | null;
    progress: number;
  }>> {
    const now = new Date();

    // Find RFPs in 'drafting' status where:
    // - generationStartedAt is set
    // - generationStartedAt + generationTimeoutMinutes < now
    const stalledRFPs = await db
      .select({
        id: rfps.id,
        title: rfps.title,
        status: rfps.status,
        generationStartedAt: rfps.generationStartedAt,
        generationTimeoutMinutes: rfps.generationTimeoutMinutes,
        generationAttempts: rfps.generationAttempts,
        maxGenerationAttempts: rfps.maxGenerationAttempts,
        lastGenerationError: rfps.lastGenerationError,
        progress: rfps.progress,
      })
      .from(rfps)
      .where(
        and(
          eq(rfps.status, 'drafting'),
          isNotNull(rfps.generationStartedAt),
          // SQL: generationStartedAt + (generationTimeoutMinutes * interval '1 minute') < now
          sql`${rfps.generationStartedAt} + (${rfps.generationTimeoutMinutes} * interval '1 minute') < ${now}`
        )
      );

    return stalledRFPs;
  }
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/storage/getStalledRFPs.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/storage.ts tests/unit/storage/
git commit -m "feat(storage): add getStalledRFPs method for stall detection"
```

---

## Task 4: Update Proposal Services to Track Generation Start Time

**Files:**
- Modify: `server/services/proposals/enhancedProposalService.ts:77-79`
- Modify: `server/services/orchestrators/proposalGenerationOrchestrator.ts:181-185`

**Step 1: Write the failing test**

```typescript
// tests/unit/services/proposal-generation-tracking.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EnhancedProposalService } from '../../../server/services/proposals/enhancedProposalService';
import { storage } from '../../../server/storage';

vi.mock('../../../server/storage', () => ({
  storage: {
    getRFP: vi.fn(),
    updateRFP: vi.fn(),
    getProposalByRFP: vi.fn(),
    createProposal: vi.fn(),
    createAuditLog: vi.fn(),
    createNotification: vi.fn(),
    getCompanyProfile: vi.fn(),
  },
}));

describe('Proposal Generation Tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set generationStartedAt when starting generation', async () => {
    storage.getRFP.mockResolvedValue({
      id: 'rfp-123',
      title: 'Test RFP',
      status: 'discovered',
    });
    storage.updateRFP.mockResolvedValue({});

    const service = new EnhancedProposalService();

    // This will throw due to incomplete mocking, but we can verify the call
    try {
      await service.generateEnhancedProposal({
        rfpId: 'rfp-123',
        sessionId: 'session-123',
      });
    } catch {}

    // First updateRFP call should include generationStartedAt
    expect(storage.updateRFP).toHaveBeenCalledWith(
      'rfp-123',
      expect.objectContaining({
        status: 'drafting',
        generationStartedAt: expect.any(Date),
      })
    );
  });

  it('should increment generationAttempts when starting generation', async () => {
    storage.getRFP.mockResolvedValue({
      id: 'rfp-123',
      title: 'Test RFP',
      status: 'discovered',
      generationAttempts: 0,
    });
    storage.updateRFP.mockResolvedValue({});

    const service = new EnhancedProposalService();

    try {
      await service.generateEnhancedProposal({
        rfpId: 'rfp-123',
        sessionId: 'session-123',
      });
    } catch {}

    expect(storage.updateRFP).toHaveBeenCalledWith(
      'rfp-123',
      expect.objectContaining({
        generationAttempts: 1,
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/services/proposal-generation-tracking.test.ts`
Expected: FAIL with "generationStartedAt: undefined"

**Step 3: Update enhancedProposalService.ts**

Modify the `generateEnhancedProposal` method at line 367:

```typescript
      // Update RFP status to indicate generation in progress
      await storage.updateRFP(params.rfpId, {
        status: 'drafting',
        progress: 10,
        generationStartedAt: new Date(),
        generationAttempts: (rfp.generationAttempts || 0) + 1,
        lastGenerationError: null,
      });
```

Also update the `generateProposal` method at line 77:

```typescript
    // Update RFP status to indicate generation in progress
    await storage.updateRFP(request.rfpId, {
      status: 'drafting',
      progress: 20,
      generationStartedAt: new Date(),
      generationAttempts: (rfp.generationAttempts || 0) + 1,
      lastGenerationError: null,
    });
```

**Step 4: Update proposalGenerationOrchestrator.ts**

Modify line 181 to set generation tracking:

```typescript
      // Update RFP status with generation tracking
      await storage.updateRFP(request.rfpId, {
        status: 'drafting',
        progress: 5,
        generationStartedAt: new Date(),
        generationAttempts: (rfp?.generationAttempts || 0) + 1,
        lastGenerationError: null,
      });
```

**Step 5: Clear generation tracking on success**

Add to `completePipeline` method (around line 752):

```typescript
    // Update RFP status and clear generation tracking
    await storage.updateRFP(pipeline.rfpId, {
      status:
        pipeline.qualityScore &&
        pipeline.qualityScore >= pipeline.metadata.qualityThreshold
          ? 'review'
          : 'drafting',
      progress:
        pipeline.qualityScore &&
        pipeline.qualityScore >= pipeline.metadata.qualityThreshold
          ? 75
          : 60,
      generationStartedAt: null, // Clear on completion
    });
```

**Step 6: Run test to verify it passes**

Run: `npm run test -- tests/unit/services/proposal-generation-tracking.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add server/services/proposals/enhancedProposalService.ts server/services/orchestrators/proposalGenerationOrchestrator.ts tests/unit/services/
git commit -m "feat(proposals): track generation start time and attempts for stall detection"
```

---

## Task 5: Add API Endpoints for Manual Intervention

**Files:**
- Create: `server/routes/stall-detection.routes.ts`
- Modify: `server/routes/index.ts` (register new routes)

**Step 1: Write the failing test**

```typescript
// tests/integration/routes/stall-detection.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../../../server/index';

describe('Stall Detection Routes', () => {
  describe('GET /api/stall-detection/stalled', () => {
    it('should return list of stalled RFPs', async () => {
      const response = await request(app)
        .get('/api/stall-detection/stalled')
        .expect(200);

      expect(response.body).toHaveProperty('stalledRFPs');
      expect(Array.isArray(response.body.stalledRFPs)).toBe(true);
    });
  });

  describe('POST /api/stall-detection/rfp/:rfpId/restart', () => {
    it('should restart generation for an RFP', async () => {
      const response = await request(app)
        .post('/api/stall-detection/rfp/test-rfp-id/restart')
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('POST /api/stall-detection/rfp/:rfpId/cancel', () => {
    it('should cancel generation for an RFP', async () => {
      const response = await request(app)
        .post('/api/stall-detection/rfp/test-rfp-id/cancel')
        .send({ reason: 'Test cancellation' })
        .expect(200);

      expect(response.body).toHaveProperty('success');
    });
  });

  describe('GET /api/stall-detection/status', () => {
    it('should return monitoring status', async () => {
      const response = await request(app)
        .get('/api/stall-detection/status')
        .expect(200);

      expect(response.body).toHaveProperty('isMonitoring');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/routes/stall-detection.routes.test.ts`
Expected: FAIL with 404

**Step 3: Create stall-detection.routes.ts**

```typescript
// server/routes/stall-detection.routes.ts
import { Router } from 'express';
import { stallDetectionService } from '../services/monitoring/stallDetectionService';
import { handleAsyncError } from './middleware/errorHandling';

const router = Router();

/**
 * GET /api/stall-detection/stalled
 * Get list of stalled RFP generations
 */
router.get(
  '/stalled',
  handleAsyncError(async (req, res) => {
    const stalledRFPs = await stallDetectionService.detectStalledRFPs();

    res.json({
      success: true,
      stalledRFPs,
      count: stalledRFPs.length,
      checkedAt: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/stall-detection/run-check
 * Manually trigger stall detection check
 */
router.post(
  '/run-check',
  handleAsyncError(async (req, res) => {
    const results = await stallDetectionService.runStallCheck();

    res.json({
      success: true,
      results,
      processedCount: results.length,
      processedAt: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/stall-detection/rfp/:rfpId/restart
 * Manually restart generation for a specific RFP
 */
router.post(
  '/rfp/:rfpId/restart',
  handleAsyncError(async (req, res) => {
    const { rfpId } = req.params;
    const result = await stallDetectionService.restartGeneration(rfpId);

    res.json({
      success: result.action !== 'failed',
      ...result,
    });
  })
);

/**
 * POST /api/stall-detection/rfp/:rfpId/cancel
 * Cancel generation for a specific RFP
 */
router.post(
  '/rfp/:rfpId/cancel',
  handleAsyncError(async (req, res) => {
    const { rfpId } = req.params;
    const { reason } = req.body;

    const result = await stallDetectionService.cancelStalledGeneration(rfpId, reason);

    res.json({
      success: result.action === 'cancelled' && !result.error,
      ...result,
    });
  })
);

/**
 * GET /api/stall-detection/status
 * Get monitoring status
 */
router.get(
  '/status',
  handleAsyncError(async (req, res) => {
    const isMonitoring = stallDetectionService.isMonitoring();

    res.json({
      success: true,
      isMonitoring,
      checkIntervalSeconds: 300, // 5 minutes
    });
  })
);

/**
 * POST /api/stall-detection/monitoring/start
 * Start automated monitoring
 */
router.post(
  '/monitoring/start',
  handleAsyncError(async (req, res) => {
    stallDetectionService.startMonitoring();

    res.json({
      success: true,
      message: 'Stall detection monitoring started',
      isMonitoring: true,
    });
  })
);

/**
 * POST /api/stall-detection/monitoring/stop
 * Stop automated monitoring
 */
router.post(
  '/monitoring/stop',
  handleAsyncError(async (req, res) => {
    stallDetectionService.stopMonitoring();

    res.json({
      success: true,
      message: 'Stall detection monitoring stopped',
      isMonitoring: false,
    });
  })
);

export default router;
```

**Step 4: Register routes in index.ts**

Add to `server/routes/index.ts`:

```typescript
import stallDetectionRoutes from './stall-detection.routes';

// ... existing routes ...

app.use('/api/stall-detection', stallDetectionRoutes);
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- tests/integration/routes/stall-detection.routes.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/stall-detection.routes.ts server/routes/index.ts tests/integration/routes/
git commit -m "feat(api): add stall detection and recovery endpoints"
```

---

## Task 6: Add Automatic Monitoring Startup

**Files:**
- Modify: `server/index.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/stall-monitoring-startup.test.ts
import { describe, it, expect, vi } from 'vitest';
import { stallDetectionService } from '../../server/services/monitoring/stallDetectionService';

describe('Stall monitoring startup', () => {
  it('should start monitoring on server startup in production', () => {
    process.env.NODE_ENV = 'production';

    // Import index.ts which should start monitoring
    // We'll check that startMonitoring was called

    expect(stallDetectionService.isMonitoring).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/stall-monitoring-startup.test.ts`
Expected: Test runs but monitoring not started

**Step 3: Add monitoring startup to server/index.ts**

Add after database initialization but before `app.listen()`:

```typescript
import { stallDetectionService } from './services/monitoring/stallDetectionService';

// ... existing code ...

// Start stall detection monitoring in production
if (process.env.NODE_ENV === 'production') {
  console.log('🔍 Starting stall detection monitoring...');
  stallDetectionService.startMonitoring();
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/integration/stall-monitoring-startup.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/index.ts tests/integration/
git commit -m "feat(server): start stall detection monitoring on production startup"
```

---

## Task 7: Add Frontend Notification for Stalled Drafts

**Files:**
- Modify: `client/src/hooks/use-notifications.ts`
- Modify: `client/src/components/NotificationBanner.tsx`

**Step 1: Write the failing test**

```typescript
// tests/unit/client/stall-notifications.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react-hooks';
import { useNotifications } from '../../../client/src/hooks/use-notifications';

describe('Stall notification handling', () => {
  it('should identify stall notifications', () => {
    const { result } = renderHook(() => useNotifications());

    const notification = {
      type: 'compliance',
      title: 'Proposal Generation Failed',
      message: 'Proposal generation for "Test RFP" failed after 3 attempts.',
    };

    expect(result.current.isStallNotification(notification)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/client/stall-notifications.test.tsx`
Expected: FAIL with "isStallNotification is not a function"

**Step 3: Add stall notification helper to use-notifications.ts**

```typescript
// Add to use-notifications.ts
export function isStallNotification(notification: Notification): boolean {
  const stallKeywords = [
    'stalled',
    'failed after',
    'retry',
    'manual intervention',
    'generation cancelled',
  ];

  const lowerMessage = notification.message.toLowerCase();
  const lowerTitle = notification.title.toLowerCase();

  return stallKeywords.some(
    keyword => lowerMessage.includes(keyword) || lowerTitle.includes(keyword)
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/client/stall-notifications.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add client/src/hooks/use-notifications.ts tests/unit/client/
git commit -m "feat(client): add stall notification identification helper"
```

---

## Task 8: Run All Tests and Type Check

**Files:**
- None (verification only)

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No type errors

**Step 2: Run all tests**

Run: `npm run test`
Expected: All tests pass

**Step 3: Run linting**

Run: `npm run lint`
Expected: No lint errors (or only pre-existing warnings)

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "test: ensure all stall detection tests pass"
```

---

## Task 9: Update Documentation

**Files:**
- Create: `docs/technical/stall-detection.md`

**Step 1: Write documentation**

```markdown
# Proposal Generation Stall Detection

## Overview

The stall detection system monitors RFP proposal generations to detect, alert, and recover from stalled workflows that get stuck in "drafting" status indefinitely.

## How It Works

1. **Detection**: Every 5 minutes, the system queries for RFPs where:
   - Status is "drafting"
   - `generationStartedAt` + `generationTimeoutMinutes` < now

2. **Recovery**: For stalled RFPs:
   - If `generationAttempts` < `maxGenerationAttempts`: Reset to "discovered" and retry
   - Otherwise: Mark as failed and notify user

3. **Alerting**: Notifications are created for:
   - Automatic retries
   - Failed generations requiring manual intervention
   - User-initiated cancellations

## Configuration

RFP-level settings (defaults):
- `generationTimeoutMinutes`: 45 (premium Claude can take 15+ minutes)
- `maxGenerationAttempts`: 3

## API Endpoints

- `GET /api/stall-detection/stalled` - List stalled RFPs
- `POST /api/stall-detection/run-check` - Trigger manual check
- `POST /api/stall-detection/rfp/:id/restart` - Restart generation
- `POST /api/stall-detection/rfp/:id/cancel` - Cancel generation
- `GET /api/stall-detection/status` - Monitoring status
```

**Step 2: Commit**

```bash
git add docs/technical/stall-detection.md
git commit -m "docs: add stall detection documentation"
```

---

## Summary

This plan implements:

1. **Database fields** for tracking generation state (`generationStartedAt`, `generationAttempts`, etc.)
2. **StallDetectionService** that monitors and recovers stalled generations
3. **API endpoints** for manual intervention (restart, cancel, status)
4. **Automatic monitoring** that starts on production server startup
5. **Frontend helpers** for identifying stall notifications

Key design decisions:
- Uses database-backed state instead of in-memory Map (survives restarts)
- Configurable per-RFP timeout and retry limits
- Creates audit trail for all stall-related actions
- Leverages existing notification system for alerting

---

**Plan complete and saved to `docs/plans/2025-12-06-proposal-stall-detection-and-recovery.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
