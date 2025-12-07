# Multi-Agent Architecture Visibility Enhancement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Expose the 3-tier multi-agent system capabilities to users with real-time visibility into which agents are working on their RFPs, allowing prioritization, resource allocation, and custom agent behavior per company profile.

**Architecture:** Enhance existing agent monitoring infrastructure with RFP-specific agent tracking, WebSocket-based real-time progress, agent prioritization queue system, and company-profile-linked agent settings. Uses existing React Query polling + WebSocket patterns.

**Tech Stack:** React 18, TypeScript, TanStack Query, WebSocket, Drizzle ORM, PostgreSQL JSONB, shadcn/ui components

---

## Overview

This plan implements 5 key features:
1. **Agent Work Visibility** - Show which AI agents are working on specific RFPs
2. **Real-time Agent Progress** - Display live progress of each agent's work
3. **Agent Prioritization** - Allow users to prioritize agents and allocate resources
4. **Agent Performance in Analytics** - Show agent performance metrics in Analytics page
5. **Custom Agent Behavior** - Let users customize agent prompts per company profile

---

## Task 1: Database Schema - Agent Settings Table

**Files:**
- Modify: `shared/schema.ts:544-600` (after companyProfiles table)
- Test: `tests/unit/schema.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/schema.test.ts
import { describe, it, expect } from 'vitest';
import { companyAgentSettings, insertCompanyAgentSettingsSchema } from '@shared/schema';

describe('companyAgentSettings schema', () => {
  it('should have required fields', () => {
    expect(companyAgentSettings.companyProfileId).toBeDefined();
    expect(companyAgentSettings.agentId).toBeDefined();
    expect(companyAgentSettings.customPrompt).toBeDefined();
    expect(companyAgentSettings.priority).toBeDefined();
    expect(companyAgentSettings.isEnabled).toBeDefined();
  });

  it('should validate insert schema', () => {
    const validData = {
      companyProfileId: 'company-123',
      agentId: 'content-generator',
      customPrompt: 'Focus on technical accuracy',
      priority: 8,
      isEnabled: true,
    };
    const result = insertCompanyAgentSettingsSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it('should reject invalid priority values', () => {
    const invalidData = {
      companyProfileId: 'company-123',
      agentId: 'content-generator',
      priority: 15, // Invalid: must be 1-10
    };
    const result = insertCompanyAgentSettingsSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/schema.test.ts`
Expected: FAIL with "companyAgentSettings is not defined"

**Step 3: Write minimal implementation**

Add to `shared/schema.ts` after line 600 (after companyProfiles relations):

```typescript
// Company-specific Agent Settings
export const companyAgentSettings = pgTable(
  'company_agent_settings',
  {
    id: varchar('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    companyProfileId: varchar('company_profile_id')
      .references(() => companyProfiles.id, { onDelete: 'cascade' })
      .notNull(),
    agentId: varchar('agent_id', { length: 100 }).notNull(), // e.g., 'content-generator', 'compliance-checker'
    customPrompt: text('custom_prompt'), // Custom instructions for this agent
    priority: integer('priority').default(5).notNull(), // 1-10, higher = more priority
    isEnabled: boolean('is_enabled').default(true).notNull(),
    settings: jsonb('settings'), // Additional agent-specific settings
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  table => ({
    uniqueCompanyAgent: unique('unique_company_agent').on(
      table.companyProfileId,
      table.agentId
    ),
    companyProfileIdIdx: index('idx_company_agent_settings_company').on(
      table.companyProfileId
    ),
    agentIdIdx: index('idx_company_agent_settings_agent').on(table.agentId),
  })
);

export const companyAgentSettingsRelations = relations(
  companyAgentSettings,
  ({ one }) => ({
    companyProfile: one(companyProfiles, {
      fields: [companyAgentSettings.companyProfileId],
      references: [companyProfiles.id],
    }),
  })
);

export const insertCompanyAgentSettingsSchema = createInsertSchema(
  companyAgentSettings,
  {
    priority: z.number().int().min(1).max(10).default(5),
  }
);

export type CompanyAgentSettings = typeof companyAgentSettings.$inferSelect;
export type InsertCompanyAgentSettings = typeof companyAgentSettings.$inferInsert;
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add shared/schema.ts tests/unit/schema.test.ts
git commit -m "$(cat <<'EOF'
feat(schema): add companyAgentSettings table for per-company agent customization

Enables users to customize agent behavior (prompts, priority, enabled/disabled)
per company profile. Supports the multi-agent visibility enhancement feature.
EOF
)"
```

---

## Task 2: Database Migration for Agent Settings

**Files:**
- Create: `migrations/0XXX_add_company_agent_settings.sql`

**Step 1: Generate migration**

Run: `npx drizzle-kit generate`
Expected: Creates new migration file

**Step 2: Verify migration content**

Check the generated migration contains:
- CREATE TABLE company_agent_settings
- Foreign key to company_profiles
- Unique constraint on (company_profile_id, agent_id)
- Indexes for performance

**Step 3: Apply migration**

Run: `npm run db:push`
Expected: Table created successfully

**Step 4: Commit**

```bash
git add migrations/
git commit -m "$(cat <<'EOF'
chore(db): add migration for company_agent_settings table
EOF
)"
```

---

## Task 3: Agent Settings Repository

**Files:**
- Create: `server/repositories/AgentSettingsRepository.ts`
- Test: `tests/unit/repositories/agentSettingsRepository.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/repositories/agentSettingsRepository.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentSettingsRepository } from '@/repositories/AgentSettingsRepository';

// Mock the database
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 'test-id' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

describe('AgentSettingsRepository', () => {
  let repository: AgentSettingsRepository;

  beforeEach(() => {
    repository = new AgentSettingsRepository();
  });

  it('should get settings for a company', async () => {
    const settings = await repository.getSettingsForCompany('company-123');
    expect(Array.isArray(settings)).toBe(true);
  });

  it('should create agent settings', async () => {
    const result = await repository.createSettings({
      companyProfileId: 'company-123',
      agentId: 'content-generator',
      customPrompt: 'Be concise',
      priority: 8,
    });
    expect(result).toBeDefined();
  });

  it('should update agent settings', async () => {
    const result = await repository.updateSettings('setting-123', {
      priority: 9,
    });
    expect(result).toBeDefined();
  });

  it('should get settings by agent and company', async () => {
    const settings = await repository.getSettingsByAgentAndCompany(
      'company-123',
      'content-generator'
    );
    expect(settings).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/repositories/agentSettingsRepository.test.ts`
Expected: FAIL with "AgentSettingsRepository is not defined"

**Step 3: Write minimal implementation**

```typescript
// server/repositories/AgentSettingsRepository.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../db';
import {
  companyAgentSettings,
  type CompanyAgentSettings,
  type InsertCompanyAgentSettings,
} from '@shared/schema';

export class AgentSettingsRepository {
  async getSettingsForCompany(
    companyProfileId: string
  ): Promise<CompanyAgentSettings[]> {
    return db
      .select()
      .from(companyAgentSettings)
      .where(eq(companyAgentSettings.companyProfileId, companyProfileId));
  }

  async getSettingsByAgentAndCompany(
    companyProfileId: string,
    agentId: string
  ): Promise<CompanyAgentSettings | undefined> {
    const results = await db
      .select()
      .from(companyAgentSettings)
      .where(
        and(
          eq(companyAgentSettings.companyProfileId, companyProfileId),
          eq(companyAgentSettings.agentId, agentId)
        )
      );
    return results[0];
  }

  async createSettings(
    data: InsertCompanyAgentSettings
  ): Promise<CompanyAgentSettings> {
    const [result] = await db
      .insert(companyAgentSettings)
      .values(data)
      .returning();
    return result;
  }

  async updateSettings(
    id: string,
    data: Partial<InsertCompanyAgentSettings>
  ): Promise<CompanyAgentSettings> {
    const [result] = await db
      .update(companyAgentSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(companyAgentSettings.id, id))
      .returning();
    return result;
  }

  async upsertSettings(
    companyProfileId: string,
    agentId: string,
    data: Partial<InsertCompanyAgentSettings>
  ): Promise<CompanyAgentSettings> {
    const existing = await this.getSettingsByAgentAndCompany(
      companyProfileId,
      agentId
    );

    if (existing) {
      return this.updateSettings(existing.id, data);
    }

    return this.createSettings({
      companyProfileId,
      agentId,
      ...data,
    });
  }

  async deleteSettings(id: string): Promise<void> {
    await db
      .delete(companyAgentSettings)
      .where(eq(companyAgentSettings.id, id));
  }

  async getEnabledAgentsForCompany(
    companyProfileId: string
  ): Promise<CompanyAgentSettings[]> {
    return db
      .select()
      .from(companyAgentSettings)
      .where(
        and(
          eq(companyAgentSettings.companyProfileId, companyProfileId),
          eq(companyAgentSettings.isEnabled, true)
        )
      );
  }

  async getAgentPriorityForCompany(
    companyProfileId: string,
    agentId: string
  ): Promise<number> {
    const settings = await this.getSettingsByAgentAndCompany(
      companyProfileId,
      agentId
    );
    return settings?.priority ?? 5; // Default priority
  }
}

export const agentSettingsRepository = new AgentSettingsRepository();
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/repositories/agentSettingsRepository.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/repositories/AgentSettingsRepository.ts tests/unit/repositories/agentSettingsRepository.test.ts
git commit -m "$(cat <<'EOF'
feat(repo): add AgentSettingsRepository for company-specific agent config

Provides CRUD operations for managing agent customization per company profile,
including priority settings and custom prompts.
EOF
)"
```

---

## Task 4: Agent Settings API Routes

**Files:**
- Create: `server/routes/agentSettings.routes.ts`
- Modify: `server/routes/index.ts` (add route registration)
- Test: `tests/integration/agentSettings.routes.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/integration/agentSettings.routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '@/index';

describe('Agent Settings Routes', () => {
  const testCompanyId = 'test-company-123';

  it('GET /api/company/:companyId/agent-settings should return settings', async () => {
    const response = await request(app)
      .get(`/api/company/${testCompanyId}/agent-settings`)
      .expect(200);

    expect(response.body).toHaveProperty('settings');
    expect(Array.isArray(response.body.settings)).toBe(true);
  });

  it('PUT /api/company/:companyId/agent-settings/:agentId should upsert settings', async () => {
    const response = await request(app)
      .put(`/api/company/${testCompanyId}/agent-settings/content-generator`)
      .send({
        customPrompt: 'Focus on government compliance language',
        priority: 8,
        isEnabled: true,
      })
      .expect(200);

    expect(response.body).toHaveProperty('setting');
    expect(response.body.setting.priority).toBe(8);
  });

  it('GET /api/agents/available should return all available agents', async () => {
    const response = await request(app)
      .get('/api/agents/available')
      .expect(200);

    expect(response.body).toHaveProperty('agents');
    expect(response.body.agents.length).toBeGreaterThan(0);
    expect(response.body.agents[0]).toHaveProperty('agentId');
    expect(response.body.agents[0]).toHaveProperty('displayName');
    expect(response.body.agents[0]).toHaveProperty('tier');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/integration/agentSettings.routes.test.ts`
Expected: FAIL with 404 Not Found

**Step 3: Write minimal implementation**

```typescript
// server/routes/agentSettings.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { agentSettingsRepository } from '../repositories/AgentSettingsRepository';
import { agentMonitoringService } from '../services/agents/agentMonitoringService';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

// Available agents that can be customized
const CUSTOMIZABLE_AGENTS = [
  {
    agentId: 'content-generator',
    displayName: 'Content Generator',
    tier: 'specialist',
    description: 'Generates proposal narratives and technical content',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'compliance-checker',
    displayName: 'Compliance Checker',
    tier: 'specialist',
    description: 'Validates proposal compliance with RFP requirements',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'document-processor',
    displayName: 'Document Processor',
    tier: 'specialist',
    description: 'Parses RFP documents and extracts requirements',
    supportsCustomPrompt: false,
  },
  {
    agentId: 'market-analyst',
    displayName: 'Market Analyst',
    tier: 'specialist',
    description: 'Analyzes market conditions and competitive landscape',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'historical-analyzer',
    displayName: 'Historical Analyzer',
    tier: 'specialist',
    description: 'Analyzes past bid performance and win probability',
    supportsCustomPrompt: false,
  },
  {
    agentId: 'proposal-manager',
    displayName: 'Proposal Manager',
    tier: 'manager',
    description: 'Coordinates proposal generation and quality assurance',
    supportsCustomPrompt: true,
  },
  {
    agentId: 'research-manager',
    displayName: 'Research Manager',
    tier: 'manager',
    description: 'Coordinates market research and competitive intelligence',
    supportsCustomPrompt: true,
  },
];

const updateSettingsSchema = z.object({
  customPrompt: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(10).optional(),
  isEnabled: z.boolean().optional(),
  settings: z.record(z.unknown()).optional(),
});

// Get all available agents that can be customized
router.get('/agents/available', async (req, res) => {
  return ApiResponse.success(res, { agents: CUSTOMIZABLE_AGENTS });
});

// Get agent settings for a company
router.get('/company/:companyId/agent-settings', async (req, res) => {
  try {
    const { companyId } = req.params;
    const settings = await agentSettingsRepository.getSettingsForCompany(companyId);

    // Merge with available agents to show all options
    const mergedSettings = CUSTOMIZABLE_AGENTS.map(agent => {
      const companySetting = settings.find(s => s.agentId === agent.agentId);
      return {
        ...agent,
        customPrompt: companySetting?.customPrompt ?? null,
        priority: companySetting?.priority ?? 5,
        isEnabled: companySetting?.isEnabled ?? true,
        settings: companySetting?.settings ?? null,
        hasCustomization: !!companySetting,
      };
    });

    return ApiResponse.success(res, { settings: mergedSettings });
  } catch (error) {
    return ApiResponse.error(res, 'Failed to fetch agent settings', 500);
  }
});

// Update/create agent settings for a company
router.put('/company/:companyId/agent-settings/:agentId', async (req, res) => {
  try {
    const { companyId, agentId } = req.params;
    const validatedData = updateSettingsSchema.parse(req.body);

    const agent = CUSTOMIZABLE_AGENTS.find(a => a.agentId === agentId);
    if (!agent) {
      return ApiResponse.error(res, 'Invalid agent ID', 400);
    }

    if (validatedData.customPrompt && !agent.supportsCustomPrompt) {
      return ApiResponse.error(
        res,
        'This agent does not support custom prompts',
        400
      );
    }

    const setting = await agentSettingsRepository.upsertSettings(
      companyId,
      agentId,
      validatedData
    );

    return ApiResponse.success(res, { setting });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiResponse.error(res, 'Invalid request data', 400);
    }
    return ApiResponse.error(res, 'Failed to update agent settings', 500);
  }
});

// Delete agent customization (reset to defaults)
router.delete('/company/:companyId/agent-settings/:agentId', async (req, res) => {
  try {
    const { companyId, agentId } = req.params;
    const existing = await agentSettingsRepository.getSettingsByAgentAndCompany(
      companyId,
      agentId
    );

    if (existing) {
      await agentSettingsRepository.deleteSettings(existing.id);
    }

    return ApiResponse.success(res, { message: 'Settings reset to defaults' });
  } catch (error) {
    return ApiResponse.error(res, 'Failed to reset agent settings', 500);
  }
});

export default router;
```

**Step 4: Register routes in index**

Add to `server/routes/index.ts`:

```typescript
import agentSettingsRoutes from './agentSettings.routes';

// In the route registration section:
app.use('/api', agentSettingsRoutes);
```

**Step 5: Run test to verify it passes**

Run: `npm run test -- tests/integration/agentSettings.routes.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add server/routes/agentSettings.routes.ts server/routes/index.ts tests/integration/agentSettings.routes.test.ts
git commit -m "$(cat <<'EOF'
feat(api): add agent settings API routes for company customization

- GET /api/agents/available - List customizable agents
- GET /api/company/:id/agent-settings - Get settings for company
- PUT /api/company/:id/agent-settings/:agentId - Upsert settings
- DELETE /api/company/:id/agent-settings/:agentId - Reset to defaults
EOF
)"
```

---

## Task 5: Shared API Types for Agent Tracking

**Files:**
- Create: `shared/api/agentTracking.ts`
- Modify: `shared/api/index.ts` (export new types)

**Step 1: Write the types file**

```typescript
// shared/api/agentTracking.ts

/**
 * Real-time agent work tracking for RFPs
 */

export interface AgentWorkSession {
  sessionId: string;
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  agentDisplayName: string;
  agentTier: 'orchestrator' | 'manager' | 'specialist';
  taskType: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'paused';
  progress: number; // 0-100
  currentStep: string | null;
  startedAt: string;
  estimatedCompletionAt: string | null;
  completedAt: string | null;
  error: string | null;
  metrics: {
    tokensUsed?: number;
    executionTimeMs?: number;
    retryCount?: number;
  };
}

export interface RfpAgentWorkSummary {
  rfpId: string;
  rfpTitle: string;
  agency: string;
  status: string;
  activeSessions: AgentWorkSession[];
  completedSessions: AgentWorkSession[];
  totalAgentsAssigned: number;
  overallProgress: number; // Aggregate progress 0-100
  estimatedCompletion: string | null;
}

export interface AgentQueueItem {
  id: string;
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  agentDisplayName: string;
  priority: number; // 1-10
  position: number; // Queue position
  estimatedStartTime: string | null;
  createdAt: string;
}

export interface AgentResourceAllocation {
  agentId: string;
  agentDisplayName: string;
  tier: string;
  currentLoad: number; // 0-100
  maxConcurrentTasks: number;
  activeTasks: number;
  queuedTasks: number;
  avgTaskDuration: number; // seconds
}

export interface AgentPriorityUpdate {
  rfpId: string;
  agentId: string;
  newPriority: number;
}

export interface CustomizableAgent {
  agentId: string;
  displayName: string;
  tier: 'orchestrator' | 'manager' | 'specialist';
  description: string;
  supportsCustomPrompt: boolean;
}

export interface CompanyAgentConfig {
  agentId: string;
  displayName: string;
  tier: string;
  description: string;
  supportsCustomPrompt: boolean;
  customPrompt: string | null;
  priority: number;
  isEnabled: boolean;
  settings: Record<string, unknown> | null;
  hasCustomization: boolean;
}

// WebSocket message types for real-time updates
export type AgentTrackingMessage =
  | { type: 'agent:work_started'; payload: AgentWorkSession }
  | { type: 'agent:progress_update'; payload: { sessionId: string; progress: number; currentStep: string } }
  | { type: 'agent:work_completed'; payload: { sessionId: string; result: unknown } }
  | { type: 'agent:work_failed'; payload: { sessionId: string; error: string } }
  | { type: 'agent:queue_updated'; payload: AgentQueueItem[] }
  | { type: 'agent:resource_update'; payload: AgentResourceAllocation[] };
```

**Step 2: Export from index**

Add to `shared/api/index.ts`:

```typescript
export * from './agentTracking';
```

**Step 3: Commit**

```bash
git add shared/api/agentTracking.ts shared/api/index.ts
git commit -m "$(cat <<'EOF'
feat(types): add shared types for agent tracking and customization

Defines interfaces for real-time agent work sessions, queue management,
resource allocation, and WebSocket message types.
EOF
)"
```

---

## Task 6: Agent Tracking Service

**Files:**
- Create: `server/services/agents/agentTrackingService.ts`
- Test: `tests/unit/services/agentTrackingService.test.ts`

**Step 1: Write the failing test**

```typescript
// tests/unit/services/agentTrackingService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AgentTrackingService } from '@/services/agents/agentTrackingService';

describe('AgentTrackingService', () => {
  let service: AgentTrackingService;

  beforeEach(() => {
    service = new AgentTrackingService();
  });

  it('should start a work session', () => {
    const session = service.startWorkSession({
      rfpId: 'rfp-123',
      rfpTitle: 'Test RFP',
      agentId: 'content-generator',
      taskType: 'proposal_generation',
    });

    expect(session.sessionId).toBeDefined();
    expect(session.status).toBe('in_progress');
    expect(session.progress).toBe(0);
  });

  it('should update work progress', () => {
    const session = service.startWorkSession({
      rfpId: 'rfp-123',
      rfpTitle: 'Test RFP',
      agentId: 'content-generator',
      taskType: 'proposal_generation',
    });

    service.updateProgress(session.sessionId, 50, 'Generating executive summary');

    const updated = service.getSession(session.sessionId);
    expect(updated?.progress).toBe(50);
    expect(updated?.currentStep).toBe('Generating executive summary');
  });

  it('should get active sessions for an RFP', () => {
    service.startWorkSession({
      rfpId: 'rfp-123',
      rfpTitle: 'Test RFP',
      agentId: 'content-generator',
      taskType: 'proposal_generation',
    });

    const sessions = service.getActiveSessionsForRfp('rfp-123');
    expect(sessions.length).toBe(1);
  });

  it('should get RFP work summary', () => {
    service.startWorkSession({
      rfpId: 'rfp-123',
      rfpTitle: 'Test RFP',
      agentId: 'content-generator',
      taskType: 'proposal_generation',
    });

    const summary = service.getRfpWorkSummary('rfp-123');
    expect(summary).toBeDefined();
    expect(summary?.totalAgentsAssigned).toBe(1);
  });

  it('should track agent queue', () => {
    service.addToQueue({
      rfpId: 'rfp-456',
      rfpTitle: 'Queued RFP',
      agentId: 'compliance-checker',
      priority: 8,
    });

    const queue = service.getAgentQueue('compliance-checker');
    expect(queue.length).toBe(1);
    expect(queue[0].priority).toBe(8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm run test -- tests/unit/services/agentTrackingService.test.ts`
Expected: FAIL with "AgentTrackingService is not defined"

**Step 3: Write minimal implementation**

```typescript
// server/services/agents/agentTrackingService.ts
import { EventEmitter } from 'events';
import { nanoid } from 'nanoid';
import type {
  AgentWorkSession,
  RfpAgentWorkSummary,
  AgentQueueItem,
  AgentResourceAllocation,
  AgentTrackingMessage,
} from '@shared/api/agentTracking';

const AGENT_DISPLAY_NAMES: Record<string, { displayName: string; tier: 'orchestrator' | 'manager' | 'specialist' }> = {
  'primary-orchestrator': { displayName: 'Primary Orchestrator', tier: 'orchestrator' },
  'portal-manager': { displayName: 'Portal Manager', tier: 'manager' },
  'proposal-manager': { displayName: 'Proposal Manager', tier: 'manager' },
  'research-manager': { displayName: 'Research Manager', tier: 'manager' },
  'portal-scanner': { displayName: 'Portal Scanner', tier: 'specialist' },
  'portal-monitor': { displayName: 'Portal Monitor', tier: 'specialist' },
  'content-generator': { displayName: 'Content Generator', tier: 'specialist' },
  'compliance-checker': { displayName: 'Compliance Checker', tier: 'specialist' },
  'document-processor': { displayName: 'Document Processor', tier: 'specialist' },
  'market-analyst': { displayName: 'Market Analyst', tier: 'specialist' },
  'historical-analyzer': { displayName: 'Historical Analyzer', tier: 'specialist' },
};

interface StartSessionParams {
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  taskType: string;
}

interface QueueParams {
  rfpId: string;
  rfpTitle: string;
  agentId: string;
  priority: number;
}

export class AgentTrackingService extends EventEmitter {
  private sessions: Map<string, AgentWorkSession> = new Map();
  private queue: Map<string, AgentQueueItem[]> = new Map(); // agentId -> queue
  private completedSessions: Map<string, AgentWorkSession[]> = new Map(); // rfpId -> completed sessions

  constructor() {
    super();
  }

  startWorkSession(params: StartSessionParams): AgentWorkSession {
    const { rfpId, rfpTitle, agentId, taskType } = params;
    const agentInfo = AGENT_DISPLAY_NAMES[agentId] ?? { displayName: agentId, tier: 'specialist' as const };

    const session: AgentWorkSession = {
      sessionId: nanoid(),
      rfpId,
      rfpTitle,
      agentId,
      agentDisplayName: agentInfo.displayName,
      agentTier: agentInfo.tier,
      taskType,
      status: 'in_progress',
      progress: 0,
      currentStep: null,
      startedAt: new Date().toISOString(),
      estimatedCompletionAt: null,
      completedAt: null,
      error: null,
      metrics: {},
    };

    this.sessions.set(session.sessionId, session);
    this.emit('message', {
      type: 'agent:work_started',
      payload: session,
    } as AgentTrackingMessage);

    return session;
  }

  getSession(sessionId: string): AgentWorkSession | undefined {
    return this.sessions.get(sessionId);
  }

  updateProgress(sessionId: string, progress: number, currentStep: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.progress = Math.min(100, Math.max(0, progress));
    session.currentStep = currentStep;

    this.emit('message', {
      type: 'agent:progress_update',
      payload: { sessionId, progress: session.progress, currentStep },
    } as AgentTrackingMessage);
  }

  completeSession(sessionId: string, result?: unknown): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'completed';
    session.progress = 100;
    session.completedAt = new Date().toISOString();
    session.metrics.executionTimeMs =
      new Date().getTime() - new Date(session.startedAt).getTime();

    // Move to completed sessions
    const completed = this.completedSessions.get(session.rfpId) ?? [];
    completed.push(session);
    this.completedSessions.set(session.rfpId, completed);

    this.sessions.delete(sessionId);

    this.emit('message', {
      type: 'agent:work_completed',
      payload: { sessionId, result },
    } as AgentTrackingMessage);
  }

  failSession(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'failed';
    session.error = error;
    session.completedAt = new Date().toISOString();

    const completed = this.completedSessions.get(session.rfpId) ?? [];
    completed.push(session);
    this.completedSessions.set(session.rfpId, completed);

    this.sessions.delete(sessionId);

    this.emit('message', {
      type: 'agent:work_failed',
      payload: { sessionId, error },
    } as AgentTrackingMessage);
  }

  getActiveSessionsForRfp(rfpId: string): AgentWorkSession[] {
    return Array.from(this.sessions.values()).filter(s => s.rfpId === rfpId);
  }

  getCompletedSessionsForRfp(rfpId: string): AgentWorkSession[] {
    return this.completedSessions.get(rfpId) ?? [];
  }

  getAllActiveSessions(): AgentWorkSession[] {
    return Array.from(this.sessions.values());
  }

  getRfpWorkSummary(rfpId: string): RfpAgentWorkSummary | null {
    const activeSessions = this.getActiveSessionsForRfp(rfpId);
    const completedSessions = this.getCompletedSessionsForRfp(rfpId);

    if (activeSessions.length === 0 && completedSessions.length === 0) {
      return null;
    }

    const allSessions = [...activeSessions, ...completedSessions];
    const firstSession = allSessions[0];

    const totalProgress = activeSessions.length > 0
      ? activeSessions.reduce((sum, s) => sum + s.progress, 0) / activeSessions.length
      : 100;

    return {
      rfpId,
      rfpTitle: firstSession.rfpTitle,
      agency: '', // Would need to fetch from RFP
      status: activeSessions.length > 0 ? 'processing' : 'completed',
      activeSessions,
      completedSessions,
      totalAgentsAssigned: new Set(allSessions.map(s => s.agentId)).size,
      overallProgress: Math.round(totalProgress),
      estimatedCompletion: null,
    };
  }

  // Queue management
  addToQueue(params: QueueParams): AgentQueueItem {
    const { rfpId, rfpTitle, agentId, priority } = params;
    const agentInfo = AGENT_DISPLAY_NAMES[agentId] ?? { displayName: agentId };

    const currentQueue = this.queue.get(agentId) ?? [];

    const item: AgentQueueItem = {
      id: nanoid(),
      rfpId,
      rfpTitle,
      agentId,
      agentDisplayName: agentInfo.displayName,
      priority,
      position: currentQueue.length + 1,
      estimatedStartTime: null,
      createdAt: new Date().toISOString(),
    };

    // Insert in priority order (higher priority = earlier in queue)
    const insertIndex = currentQueue.findIndex(q => q.priority < priority);
    if (insertIndex === -1) {
      currentQueue.push(item);
    } else {
      currentQueue.splice(insertIndex, 0, item);
    }

    // Update positions
    currentQueue.forEach((q, i) => { q.position = i + 1; });

    this.queue.set(agentId, currentQueue);

    this.emit('message', {
      type: 'agent:queue_updated',
      payload: currentQueue,
    } as AgentTrackingMessage);

    return item;
  }

  removeFromQueue(queueItemId: string): void {
    for (const [agentId, queue] of this.queue.entries()) {
      const index = queue.findIndex(q => q.id === queueItemId);
      if (index !== -1) {
        queue.splice(index, 1);
        queue.forEach((q, i) => { q.position = i + 1; });
        this.queue.set(agentId, queue);

        this.emit('message', {
          type: 'agent:queue_updated',
          payload: queue,
        } as AgentTrackingMessage);
        return;
      }
    }
  }

  getAgentQueue(agentId: string): AgentQueueItem[] {
    return this.queue.get(agentId) ?? [];
  }

  getAllQueues(): Map<string, AgentQueueItem[]> {
    return this.queue;
  }

  updateQueuePriority(queueItemId: string, newPriority: number): void {
    for (const [agentId, queue] of this.queue.entries()) {
      const item = queue.find(q => q.id === queueItemId);
      if (item) {
        item.priority = newPriority;
        // Re-sort by priority
        queue.sort((a, b) => b.priority - a.priority);
        queue.forEach((q, i) => { q.position = i + 1; });
        this.queue.set(agentId, queue);

        this.emit('message', {
          type: 'agent:queue_updated',
          payload: queue,
        } as AgentTrackingMessage);
        return;
      }
    }
  }

  getResourceAllocation(): AgentResourceAllocation[] {
    const allocations: AgentResourceAllocation[] = [];

    for (const [agentId, info] of Object.entries(AGENT_DISPLAY_NAMES)) {
      const activeTasks = Array.from(this.sessions.values()).filter(
        s => s.agentId === agentId && s.status === 'in_progress'
      ).length;
      const queuedTasks = (this.queue.get(agentId) ?? []).length;
      const maxConcurrent = info.tier === 'specialist' ? 3 : 1;

      allocations.push({
        agentId,
        agentDisplayName: info.displayName,
        tier: info.tier,
        currentLoad: Math.min(100, (activeTasks / maxConcurrent) * 100),
        maxConcurrentTasks: maxConcurrent,
        activeTasks,
        queuedTasks,
        avgTaskDuration: 0, // Would calculate from historical data
      });
    }

    return allocations;
  }
}

export const agentTrackingService = new AgentTrackingService();
```

**Step 4: Run test to verify it passes**

Run: `npm run test -- tests/unit/services/agentTrackingService.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add server/services/agents/agentTrackingService.ts tests/unit/services/agentTrackingService.test.ts
git commit -m "$(cat <<'EOF'
feat(service): add AgentTrackingService for real-time agent work visibility

Tracks active work sessions per RFP, manages agent queues with priority,
emits events for WebSocket broadcasting, and provides resource allocation data.
EOF
)"
```

---

## Task 7: Agent Tracking API Routes

**Files:**
- Create: `server/routes/agentTracking.routes.ts`
- Modify: `server/routes/index.ts` (add route registration)

**Step 1: Write the routes**

```typescript
// server/routes/agentTracking.routes.ts
import { Router } from 'express';
import { z } from 'zod';
import { agentTrackingService } from '../services/agents/agentTrackingService';
import { ApiResponse } from '../utils/apiResponse';

const router = Router();

// Get all active work sessions
router.get('/agent-work/active', async (req, res) => {
  const sessions = agentTrackingService.getAllActiveSessions();
  return ApiResponse.success(res, { sessions });
});

// Get active work sessions for a specific RFP
router.get('/rfps/:rfpId/agent-work', async (req, res) => {
  const { rfpId } = req.params;
  const activeSessions = agentTrackingService.getActiveSessionsForRfp(rfpId);
  const completedSessions = agentTrackingService.getCompletedSessionsForRfp(rfpId);
  const summary = agentTrackingService.getRfpWorkSummary(rfpId);

  return ApiResponse.success(res, {
    activeSessions,
    completedSessions,
    summary,
  });
});

// Get work summary for multiple RFPs
router.post('/agent-work/summaries', async (req, res) => {
  const { rfpIds } = req.body as { rfpIds: string[] };

  const summaries = rfpIds
    .map(rfpId => agentTrackingService.getRfpWorkSummary(rfpId))
    .filter(Boolean);

  return ApiResponse.success(res, { summaries });
});

// Get agent queues
router.get('/agent-queues', async (req, res) => {
  const queues: Record<string, unknown> = {};
  for (const [agentId, queue] of agentTrackingService.getAllQueues()) {
    queues[agentId] = queue;
  }
  return ApiResponse.success(res, { queues });
});

// Get queue for specific agent
router.get('/agent-queues/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const queue = agentTrackingService.getAgentQueue(agentId);
  return ApiResponse.success(res, { queue });
});

// Update queue priority
router.put('/agent-queues/:queueItemId/priority', async (req, res) => {
  const { queueItemId } = req.params;
  const { priority } = req.body as { priority: number };

  if (priority < 1 || priority > 10) {
    return ApiResponse.error(res, 'Priority must be between 1 and 10', 400);
  }

  agentTrackingService.updateQueuePriority(queueItemId, priority);
  return ApiResponse.success(res, { message: 'Priority updated' });
});

// Get resource allocation
router.get('/agent-resources', async (req, res) => {
  const allocations = agentTrackingService.getResourceAllocation();
  return ApiResponse.success(res, { allocations });
});

// SSE endpoint for real-time agent work updates
router.get('/agent-work/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial state
  const initialData = {
    activeSessions: agentTrackingService.getAllActiveSessions(),
    allocations: agentTrackingService.getResourceAllocation(),
  };
  res.write(`data: ${JSON.stringify({ type: 'init', payload: initialData })}\n\n`);

  // Listen for updates
  const onMessage = (message: unknown) => {
    res.write(`data: ${JSON.stringify(message)}\n\n`);
  };

  agentTrackingService.on('message', onMessage);

  // Heartbeat
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 30000);

  // Cleanup
  req.on('close', () => {
    agentTrackingService.off('message', onMessage);
    clearInterval(heartbeat);
  });
});

export default router;
```

**Step 2: Register routes**

Add to `server/routes/index.ts`:

```typescript
import agentTrackingRoutes from './agentTracking.routes';

// In the route registration section:
app.use('/api', agentTrackingRoutes);
```

**Step 3: Commit**

```bash
git add server/routes/agentTracking.routes.ts server/routes/index.ts
git commit -m "$(cat <<'EOF'
feat(api): add agent tracking routes with SSE real-time updates

- GET /api/agent-work/active - All active work sessions
- GET /api/rfps/:id/agent-work - Agent work for specific RFP
- GET /api/agent-queues - All agent queues
- PUT /api/agent-queues/:id/priority - Update queue priority
- GET /api/agent-resources - Resource allocation overview
- GET /api/agent-work/stream - SSE for real-time updates
EOF
)"
```

---

## Task 8: Frontend - Agent Work Panel Component

**Files:**
- Create: `client/src/components/agents/AgentWorkPanel.tsx`
- Create: `client/src/components/agents/AgentSessionCard.tsx`

**Step 1: Create AgentSessionCard component**

```typescript
// client/src/components/agents/AgentSessionCard.tsx
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { AgentWorkSession } from '@shared/api/agentTracking';
import { Bot, Clock, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AgentSessionCardProps {
  session: AgentWorkSession;
  compact?: boolean;
}

const tierColors = {
  orchestrator: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  manager: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  specialist: 'bg-green-500/10 text-green-500 border-green-500/20',
};

const statusIcons = {
  queued: Clock,
  in_progress: Loader2,
  completed: CheckCircle,
  failed: AlertCircle,
  paused: Clock,
};

export function AgentSessionCard({ session, compact = false }: AgentSessionCardProps) {
  const StatusIcon = statusIcons[session.status];
  const isActive = session.status === 'in_progress';

  return (
    <Card className={cn(
      'transition-all duration-200',
      isActive && 'ring-1 ring-primary/50'
    )}>
      <CardContent className={cn('p-4', compact && 'p-3')}>
        <div className="flex items-start gap-3">
          <div className={cn(
            'p-2 rounded-lg',
            tierColors[session.agentTier]
          )}>
            <Bot className="h-4 w-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium text-sm truncate">
                {session.agentDisplayName}
              </h4>
              <Badge
                variant={session.status === 'completed' ? 'default' : 'secondary'}
                className="text-xs"
              >
                <StatusIcon className={cn(
                  'h-3 w-3 mr-1',
                  isActive && 'animate-spin'
                )} />
                {session.status.replace('_', ' ')}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground mt-1">
              {session.taskType.replace(/_/g, ' ')}
            </p>

            {session.currentStep && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {session.currentStep}
              </p>
            )}

            {isActive && (
              <div className="mt-2">
                <Progress value={session.progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {session.progress}%
                </p>
              </div>
            )}

            {session.error && (
              <p className="text-xs text-destructive mt-2 truncate">
                {session.error}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Create AgentWorkPanel component**

```typescript
// client/src/components/agents/AgentWorkPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AgentSessionCard } from './AgentSessionCard';
import type { AgentWorkSession, RfpAgentWorkSummary } from '@shared/api/agentTracking';
import { Bot, Activity } from 'lucide-react';

interface AgentWorkPanelProps {
  rfpId: string;
  showCompleted?: boolean;
}

export function AgentWorkPanel({ rfpId, showCompleted = false }: AgentWorkPanelProps) {
  const [realtimeSessions, setRealtimeSessions] = useState<AgentWorkSession[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['/api/rfps', rfpId, 'agent-work'],
    queryFn: async () => {
      const response = await fetch(`/api/rfps/${rfpId}/agent-work`);
      if (!response.ok) throw new Error('Failed to fetch agent work');
      return response.json() as Promise<{
        activeSessions: AgentWorkSession[];
        completedSessions: AgentWorkSession[];
        summary: RfpAgentWorkSummary | null;
      }>;
    },
    refetchInterval: 10000, // Fallback polling
  });

  // SSE for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/api/agent-work/stream');

    eventSource.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'init') {
        setRealtimeSessions(message.payload.activeSessions.filter(
          (s: AgentWorkSession) => s.rfpId === rfpId
        ));
      } else if (message.type === 'agent:work_started') {
        if (message.payload.rfpId === rfpId) {
          setRealtimeSessions(prev => [...prev, message.payload]);
        }
      } else if (message.type === 'agent:progress_update') {
        setRealtimeSessions(prev =>
          prev.map(s =>
            s.sessionId === message.payload.sessionId
              ? { ...s, progress: message.payload.progress, currentStep: message.payload.currentStep }
              : s
          )
        );
      } else if (message.type === 'agent:work_completed' || message.type === 'agent:work_failed') {
        setRealtimeSessions(prev =>
          prev.filter(s => s.sessionId !== message.payload.sessionId)
        );
      }
    };

    return () => {
      eventSource.close();
    };
  }, [rfpId]);

  // Merge API data with realtime updates
  const activeSessions = realtimeSessions.length > 0
    ? realtimeSessions
    : (data?.activeSessions ?? []);

  const completedSessions = data?.completedSessions ?? [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalAgents = new Set([
    ...activeSessions.map(s => s.agentId),
    ...completedSessions.map(s => s.agentId),
  ]).size;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Agents Working
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeSessions.length > 0 && (
              <Badge variant="default" className="gap-1">
                <Activity className="h-3 w-3 animate-pulse" />
                {activeSessions.length} active
              </Badge>
            )}
            <Badge variant="secondary">
              {totalAgents} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {activeSessions.length === 0 && completedSessions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No agents have worked on this RFP yet
              </p>
            )}

            {activeSessions.map(session => (
              <AgentSessionCard key={session.sessionId} session={session} />
            ))}

            {showCompleted && completedSessions.length > 0 && (
              <>
                <div className="text-xs text-muted-foreground mt-4 mb-2">
                  Completed ({completedSessions.length})
                </div>
                {completedSessions.map(session => (
                  <AgentSessionCard
                    key={session.sessionId}
                    session={session}
                    compact
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Commit**

```bash
git add client/src/components/agents/AgentWorkPanel.tsx client/src/components/agents/AgentSessionCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add AgentWorkPanel and AgentSessionCard components

Displays real-time agent work sessions for an RFP with SSE updates,
progress tracking, and status indicators per agent tier.
EOF
)"
```

---

## Task 9: Frontend - Agent Queue Management Component

**Files:**
- Create: `client/src/components/agents/AgentQueueManager.tsx`
- Create: `client/src/components/agents/PrioritySlider.tsx`

**Step 1: Create PrioritySlider component**

```typescript
// client/src/components/agents/PrioritySlider.tsx
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface PrioritySliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const priorityLabels = {
  1: 'Lowest',
  2: 'Very Low',
  3: 'Low',
  4: 'Below Normal',
  5: 'Normal',
  6: 'Above Normal',
  7: 'High',
  8: 'Very High',
  9: 'Critical',
  10: 'Urgent',
};

export function PrioritySlider({ value, onChange, disabled }: PrioritySliderProps) {
  const getPriorityColor = (priority: number) => {
    if (priority >= 9) return 'text-red-500';
    if (priority >= 7) return 'text-orange-500';
    if (priority >= 5) return 'text-yellow-500';
    if (priority >= 3) return 'text-blue-500';
    return 'text-gray-500';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Priority</span>
        <span className={cn('text-sm font-medium', getPriorityColor(value))}>
          {value} - {priorityLabels[value as keyof typeof priorityLabels]}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={1}
        max={10}
        step={1}
        disabled={disabled}
        className="w-full"
      />
    </div>
  );
}
```

**Step 2: Create AgentQueueManager component**

```typescript
// client/src/components/agents/AgentQueueManager.tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PrioritySlider } from './PrioritySlider';
import type { AgentQueueItem, AgentResourceAllocation } from '@shared/api/agentTracking';
import { ListOrdered, Settings, Gauge } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';

export function AgentQueueManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedItem, setSelectedItem] = useState<AgentQueueItem | null>(null);
  const [newPriority, setNewPriority] = useState(5);

  const { data: queuesData, isLoading: queuesLoading } = useQuery({
    queryKey: ['/api/agent-queues'],
    queryFn: async () => {
      const response = await fetch('/api/agent-queues');
      if (!response.ok) throw new Error('Failed to fetch queues');
      return response.json() as Promise<{ queues: Record<string, AgentQueueItem[]> }>;
    },
    refetchInterval: 15000,
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
    queryKey: ['/api/agent-resources'],
    queryFn: async () => {
      const response = await fetch('/api/agent-resources');
      if (!response.ok) throw new Error('Failed to fetch resources');
      return response.json() as Promise<{ allocations: AgentResourceAllocation[] }>;
    },
    refetchInterval: 15000,
  });

  const updatePriorityMutation = useMutation({
    mutationFn: async ({ queueItemId, priority }: { queueItemId: string; priority: number }) => {
      const response = await fetch(`/api/agent-queues/${queueItemId}/priority`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (!response.ok) throw new Error('Failed to update priority');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agent-queues'] });
      toast({ title: 'Priority updated successfully' });
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: 'Failed to update priority', variant: 'destructive' });
    },
  });

  const queues = queuesData?.queues ?? {};
  const allocations = resourcesData?.allocations ?? [];

  const totalQueued = Object.values(queues).reduce(
    (sum, queue) => sum + queue.length,
    0
  );

  if (queuesLoading || resourcesLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Agent Queue & Resources
          </CardTitle>
          <Badge variant="secondary">
            {totalQueued} queued
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Resource allocation overview */}
        <div className="mb-4">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Agent Load
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {allocations
              .filter(a => a.activeTasks > 0 || a.queuedTasks > 0)
              .slice(0, 4)
              .map(allocation => (
                <div
                  key={allocation.agentId}
                  className="p-2 rounded-lg bg-muted/50 text-xs"
                >
                  <div className="font-medium truncate">
                    {allocation.agentDisplayName}
                  </div>
                  <div className="flex items-center justify-between mt-1 text-muted-foreground">
                    <span>{allocation.activeTasks} active</span>
                    <span>{allocation.queuedTasks} queued</span>
                  </div>
                  <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${allocation.currentLoad}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Queue items */}
        <ScrollArea className="h-[200px]">
          <div className="space-y-2">
            {Object.entries(queues).map(([agentId, queue]) =>
              queue.map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">
                      {item.rfpTitle}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {item.agentDisplayName} • Position #{item.position}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={item.priority >= 8 ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      P{item.priority}
                    </Badge>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => {
                            setSelectedItem(item);
                            setNewPriority(item.priority);
                          }}
                        >
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Adjust Priority</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div>
                            <p className="text-sm font-medium">{item.rfpTitle}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.agentDisplayName}
                            </p>
                          </div>
                          <PrioritySlider
                            value={newPriority}
                            onChange={setNewPriority}
                          />
                          <Button
                            className="w-full"
                            onClick={() => {
                              updatePriorityMutation.mutate({
                                queueItemId: item.id,
                                priority: newPriority,
                              });
                            }}
                            disabled={updatePriorityMutation.isPending}
                          >
                            Update Priority
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              ))
            )}

            {totalQueued === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No items in queue
              </p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Commit**

```bash
git add client/src/components/agents/AgentQueueManager.tsx client/src/components/agents/PrioritySlider.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add AgentQueueManager and PrioritySlider components

Allows users to view agent queues, see resource allocation, and
adjust task priorities with visual feedback.
EOF
)"
```

---

## Task 10: Frontend - Agent Settings Component for Company Profile

**Files:**
- Create: `client/src/components/company/AgentSettingsPanel.tsx`
- Create: `client/src/components/company/AgentSettingCard.tsx`

**Step 1: Create AgentSettingCard component**

```typescript
// client/src/components/company/AgentSettingCard.tsx
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { PrioritySlider } from '../agents/PrioritySlider';
import type { CompanyAgentConfig } from '@shared/api/agentTracking';
import { Bot, ChevronDown, ChevronUp, Save, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface AgentSettingCardProps {
  companyId: string;
  config: CompanyAgentConfig;
}

const tierColors = {
  orchestrator: 'bg-purple-500/10 text-purple-500',
  manager: 'bg-blue-500/10 text-blue-500',
  specialist: 'bg-green-500/10 text-green-500',
};

export function AgentSettingCard({ companyId, config }: AgentSettingCardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEnabled, setIsEnabled] = useState(config.isEnabled);
  const [priority, setPriority] = useState(config.priority);
  const [customPrompt, setCustomPrompt] = useState(config.customPrompt ?? '');
  const [hasChanges, setHasChanges] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: { isEnabled: boolean; priority: number; customPrompt: string | null }) => {
      const response = await fetch(
        `/api/company/${companyId}/agent-settings/${config.agentId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }
      );
      if (!response.ok) throw new Error('Failed to update settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/company', companyId, 'agent-settings'],
      });
      toast({ title: 'Agent settings updated' });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: 'Failed to update settings', variant: 'destructive' });
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `/api/company/${companyId}/agent-settings/${config.agentId}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to reset settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['/api/company', companyId, 'agent-settings'],
      });
      toast({ title: 'Agent settings reset to defaults' });
      setIsEnabled(true);
      setPriority(5);
      setCustomPrompt('');
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: 'Failed to reset settings', variant: 'destructive' });
    },
  });

  const handleChange = () => {
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate({
      isEnabled,
      priority,
      customPrompt: customPrompt.trim() || null,
    });
  };

  return (
    <Card className={cn(!isEnabled && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              tierColors[config.tier as keyof typeof tierColors] ?? tierColors.specialist
            )}>
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm font-medium">
                {config.displayName}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {config.tier}
            </Badge>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => {
                setIsEnabled(checked);
                handleChange();
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-4 space-y-4 border-t">
          <PrioritySlider
            value={priority}
            onChange={(value) => {
              setPriority(value);
              handleChange();
            }}
          />

          {config.supportsCustomPrompt && (
            <div className="space-y-2">
              <Label htmlFor={`prompt-${config.agentId}`}>
                Custom Instructions
              </Label>
              <Textarea
                id={`prompt-${config.agentId}`}
                placeholder="Add custom instructions for this agent (e.g., 'Focus on government compliance terminology', 'Emphasize cost efficiency')"
                value={customPrompt}
                onChange={(e) => {
                  setCustomPrompt(e.target.value);
                  handleChange();
                }}
                className="min-h-[80px] text-sm"
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be appended to the agent's default prompts when processing RFPs for this company.
              </p>
            </div>
          )}

          <div className="flex justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => resetMutation.mutate()}
              disabled={!config.hasCustomization || resetMutation.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to Defaults
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              <Save className="h-3.5 w-3.5 mr-1" />
              Save Changes
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
```

**Step 2: Create AgentSettingsPanel component**

```typescript
// client/src/components/company/AgentSettingsPanel.tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentSettingCard } from './AgentSettingCard';
import type { CompanyAgentConfig } from '@shared/api/agentTracking';
import { Bot, Settings } from 'lucide-react';

interface AgentSettingsPanelProps {
  companyId: string;
}

export function AgentSettingsPanel({ companyId }: AgentSettingsPanelProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['/api/company', companyId, 'agent-settings'],
    queryFn: async () => {
      const response = await fetch(`/api/company/${companyId}/agent-settings`);
      if (!response.ok) throw new Error('Failed to fetch agent settings');
      return response.json() as Promise<{ settings: CompanyAgentConfig[] }>;
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const settings = data?.settings ?? [];

  // Group by tier
  const managers = settings.filter(s => s.tier === 'manager');
  const specialists = settings.filter(s => s.tier === 'specialist');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Settings className="h-4 w-4" />
          AI Agent Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Customize how AI agents work for this company profile
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {managers.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-blue-500" />
                  Manager Agents
                </h4>
                <div className="space-y-3">
                  {managers.map(config => (
                    <AgentSettingCard
                      key={config.agentId}
                      companyId={companyId}
                      config={config}
                    />
                  ))}
                </div>
              </div>
            )}

            {specialists.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Bot className="h-4 w-4 text-green-500" />
                  Specialist Agents
                </h4>
                <div className="space-y-3">
                  {specialists.map(config => (
                    <AgentSettingCard
                      key={config.agentId}
                      companyId={companyId}
                      config={config}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
```

**Step 3: Commit**

```bash
git add client/src/components/company/AgentSettingsPanel.tsx client/src/components/company/AgentSettingCard.tsx
git commit -m "$(cat <<'EOF'
feat(ui): add AgentSettingsPanel for company-specific agent customization

Allows users to enable/disable agents, set priorities, and add custom
prompts per company profile. Supports reset to defaults.
EOF
)"
```

---

## Task 11: Add Agent Performance to Analytics Page

**Files:**
- Modify: `client/src/pages/analytics.tsx`
- Create: `client/src/components/analytics/AgentPerformanceSection.tsx`

**Step 1: Create AgentPerformanceSection component**

```typescript
// client/src/components/analytics/AgentPerformanceSection.tsx
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AgentPerformanceMetric, AgentResourceAllocation } from '@shared/api';
import { Bot, TrendingUp, Clock, CheckCircle, XCircle, Activity } from 'lucide-react';
import { useState } from 'react';

type Timeframe = '24h' | '7d' | '30d';

export function AgentPerformanceSection() {
  const [timeframe, setTimeframe] = useState<Timeframe>('24h');

  const { data: performanceData, isLoading: perfLoading } = useQuery({
    queryKey: ['/api/agent-performance', timeframe],
    queryFn: async () => {
      const response = await fetch(`/api/agent-performance?timeframe=${timeframe}`);
      if (!response.ok) throw new Error('Failed to fetch performance');
      return response.json() as Promise<AgentPerformanceMetric[]>;
    },
  });

  const { data: resourcesData, isLoading: resourcesLoading } = useQuery({
    queryKey: ['/api/agent-resources'],
    queryFn: async () => {
      const response = await fetch('/api/agent-resources');
      if (!response.ok) throw new Error('Failed to fetch resources');
      return response.json() as Promise<{ allocations: AgentResourceAllocation[] }>;
    },
    refetchInterval: 30000,
  });

  const isLoading = perfLoading || resourcesLoading;
  const allocations = resourcesData?.allocations ?? [];
  const metrics = performanceData ?? [];

  // Aggregate metrics by agent
  const agentMetrics = new Map<string, {
    displayName: string;
    tier: string;
    tasksCompleted: number;
    tasksFailed: number;
    avgExecutionTime: number;
    successRate: number;
  }>();

  for (const metric of metrics) {
    const existing = agentMetrics.get(metric.agentId) ?? {
      displayName: metric.agentId,
      tier: 'specialist',
      tasksCompleted: 0,
      tasksFailed: 0,
      avgExecutionTime: 0,
      successRate: 0,
    };

    if (metric.metricType === 'tasks_completed') {
      existing.tasksCompleted = metric.metricValue;
    } else if (metric.metricType === 'tasks_failed') {
      existing.tasksFailed = metric.metricValue;
    } else if (metric.metricType === 'avg_execution_time') {
      existing.avgExecutionTime = metric.metricValue;
    }

    agentMetrics.set(metric.agentId, existing);
  }

  // Merge with allocations for display names and tiers
  for (const allocation of allocations) {
    const existing = agentMetrics.get(allocation.agentId);
    if (existing) {
      existing.displayName = allocation.agentDisplayName;
      existing.tier = allocation.tier;
    }
  }

  // Calculate success rates
  for (const [agentId, data] of agentMetrics) {
    const total = data.tasksCompleted + data.tasksFailed;
    data.successRate = total > 0 ? (data.tasksCompleted / total) * 100 : 100;
    agentMetrics.set(agentId, data);
  }

  const sortedAgents = Array.from(agentMetrics.entries())
    .sort((a, b) => b[1].tasksCompleted - a[1].tasksCompleted);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Agent Performance
          </CardTitle>
          <Select value={timeframe} onValueChange={(v) => setTimeframe(v as Timeframe)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedAgents.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No performance data available for this period
            </p>
          )}

          {sortedAgents.map(([agentId, data]) => (
            <div key={agentId} className="p-4 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Bot className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="font-medium text-sm">{data.displayName}</span>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {data.tier}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle className="h-3.5 w-3.5" />
                    {data.tasksCompleted}
                  </div>
                  {data.tasksFailed > 0 && (
                    <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                      {data.tasksFailed}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {Math.round(data.avgExecutionTime / 1000)}s avg
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Success Rate</span>
                  <span>{data.successRate.toFixed(1)}%</span>
                </div>
                <Progress
                  value={data.successRate}
                  className="h-1.5"
                />
              </div>
            </div>
          ))}

          {/* Current Load Summary */}
          {allocations.length > 0 && (
            <div className="pt-4 border-t">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Current Load
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {allocations
                  .filter(a => a.activeTasks > 0)
                  .map(allocation => (
                    <div key={allocation.agentId} className="text-center p-2 rounded bg-muted/50">
                      <div className="text-lg font-semibold">{allocation.activeTasks}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {allocation.agentDisplayName}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

**Step 2: Add to analytics page**

Modify `client/src/pages/analytics.tsx` to add a new tab:

```typescript
// Add import at top
import { AgentPerformanceSection } from '@/components/analytics/AgentPerformanceSection';

// Add new tab trigger in TabsList (after 'trends'):
<TabsTrigger value="agents" data-testid="tab-agents">
  Agent Performance
</TabsTrigger>

// Add new TabsContent (after trends):
<TabsContent value="agents" className="space-y-6">
  <AgentPerformanceSection />
</TabsContent>
```

**Step 3: Commit**

```bash
git add client/src/components/analytics/AgentPerformanceSection.tsx client/src/pages/analytics.tsx
git commit -m "$(cat <<'EOF'
feat(analytics): add Agent Performance section with metrics visualization

Shows task completion rates, success rates, average execution times,
and current load per agent. Supports 24h/7d/30d timeframe filtering.
EOF
)"
```

---

## Task 12: Integrate Agent Work Panel into RFP Detail Page

**Files:**
- Modify: `client/src/pages/rfp-detail.tsx` (or equivalent RFP detail page)

**Step 1: Add AgentWorkPanel to RFP detail**

Find the RFP detail page and add the AgentWorkPanel component in the sidebar or as a collapsible section:

```typescript
// Add import
import { AgentWorkPanel } from '@/components/agents/AgentWorkPanel';

// Add in the page layout (e.g., in a sidebar or below RFP info):
<AgentWorkPanel rfpId={rfpId} showCompleted />
```

**Step 2: Commit**

```bash
git add client/src/pages/rfp-detail.tsx
git commit -m "$(cat <<'EOF'
feat(rfp): integrate AgentWorkPanel into RFP detail page

Shows real-time agent work sessions and completed tasks directly
on the RFP detail view for transparency into AI processing.
EOF
)"
```

---

## Task 13: Integrate Agent Settings into Company Profile Page

**Files:**
- Modify: `client/src/pages/company-profiles.tsx` (or equivalent page)

**Step 1: Add AgentSettingsPanel to company profile**

```typescript
// Add import
import { AgentSettingsPanel } from '@/components/company/AgentSettingsPanel';

// Add as a tab or section in the company profile edit view:
// (assuming tabs structure exists or create one)
<TabsContent value="agent-settings">
  <AgentSettingsPanel companyId={companyId} />
</TabsContent>
```

**Step 2: Commit**

```bash
git add client/src/pages/company-profiles.tsx
git commit -m "$(cat <<'EOF'
feat(company): add Agent Settings tab to company profile management

Users can now customize AI agent behavior per company profile,
including priorities, custom prompts, and enable/disable toggles.
EOF
)"
```

---

## Task 14: Update Agent Monitoring Page

**Files:**
- Modify: `client/src/pages/agent-monitoring.tsx`

**Step 1: Add AgentQueueManager component**

```typescript
// Add import
import { AgentQueueManager } from '@/components/agents/AgentQueueManager';

// Add in the appropriate tab (e.g., create new "Queue Management" tab or add to existing):
<TabsContent value="queues" className="space-y-6">
  <AgentQueueManager />
</TabsContent>

// Or add alongside existing content in the Activities tab
```

**Step 2: Commit**

```bash
git add client/src/pages/agent-monitoring.tsx
git commit -m "$(cat <<'EOF'
feat(monitoring): add AgentQueueManager to agent monitoring page

Users can now view and manage agent queues, see resource allocation,
and adjust task priorities from the monitoring dashboard.
EOF
)"
```

---

## Task 15: Type-check and Lint

**Step 1: Run type check**

Run: `npm run type-check`
Expected: No TypeScript errors

**Step 2: Run lint**

Run: `npm run lint`
Expected: No linting errors (or only pre-existing warnings)

**Step 3: Fix any issues**

If there are errors, fix them in the affected files.

**Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: fix type-check and lint issues from agent visibility feature
EOF
)"
```

---

## Task 16: Final Integration Test

**Step 1: Start the development server**

Run: `npm run dev`

**Step 2: Manual verification checklist**

- [ ] Navigate to Agent Monitoring page - verify new queue section appears
- [ ] Navigate to RFP detail page - verify AgentWorkPanel shows
- [ ] Navigate to Company Profile - verify Agent Settings tab works
- [ ] Navigate to Analytics - verify Agent Performance tab shows data
- [ ] Test priority slider updates queue position
- [ ] Test custom prompt saves correctly
- [ ] Test enable/disable toggle works
- [ ] Verify SSE updates work (start a proposal generation and watch live updates)

**Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
test: verify multi-agent visibility feature integration
EOF
)"
```

---

## Summary

This plan implements 5 key features for exposing the multi-agent architecture:

1. **Agent Work Visibility** (Tasks 5-8, 12)
   - Real-time tracking of which agents are working on each RFP
   - SSE-based live updates for progress
   - AgentWorkPanel component on RFP detail pages

2. **Real-time Agent Progress** (Tasks 6-7)
   - AgentTrackingService with EventEmitter for real-time events
   - SSE endpoint for streaming updates
   - Progress bars and status indicators

3. **Agent Prioritization** (Tasks 9, 14)
   - Queue management with priority levels 1-10
   - PrioritySlider for intuitive adjustment
   - AgentQueueManager for viewing and managing queues

4. **Agent Performance in Analytics** (Task 11)
   - AgentPerformanceSection in Analytics page
   - Task completion rates, success rates, execution times
   - Current load visualization
   - Timeframe filtering (24h/7d/30d)

5. **Custom Agent Behavior** (Tasks 1-4, 10, 13)
   - companyAgentSettings database table
   - Per-company agent customization (prompts, priority, enable/disable)
   - AgentSettingsPanel in company profile management
   - AgentSettingCard with expandable settings

---

**Plan complete and saved to `docs/plans/2025-12-07-multi-agent-visibility-enhancement.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
