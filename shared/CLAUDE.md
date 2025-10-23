# Shared Directory - Common Code & Database Schema

**Last Updated**: January 2025

## Overview

The `shared/` directory contains code and type definitions shared between the frontend (client) and backend (server). Most importantly, it contains the complete database schema definition using Drizzle ORM, which serves as the single source of truth for the application's data model.

## Purpose

This directory serves as the central location for:

- **Database Schema** - Complete Drizzle ORM schema with all tables and relationships
- **Type Definitions** - TypeScript types derived from database schema
- **Zod Schemas** - Runtime validation schemas generated from Drizzle
- **API Contracts** - Shared interfaces between client and server
- **Constants** - Application-wide constants and enumerations

## Directory Structure

```
shared/
├── schema.ts              # Complete Drizzle ORM database schema
├── api/                   # API type definitions
│   └── types.ts          # Shared API request/response types
└── CLAUDE.md             # This file
```

## Database Schema (schema.ts)

The `schema.ts` file contains the complete database schema using Drizzle ORM. This is the **single source of truth** for the application's data model.

### Core Tables

#### RFPs Table

**Purpose**: Stores Request for Proposal opportunities discovered from various portals

```typescript
export const rfps = pgTable('rfps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  agency: text('agency').notNull(),
  category: text('category'),
  sourceUrl: text('source_url').notNull(),

  // Status tracking
  status: text('status', {
    enum: [
      'discovered',
      'parsing',
      'drafting',
      'review',
      'approved',
      'submitted',
      'closed',
    ],
  })
    .default('discovered')
    .notNull(),
  progress: integer('progress').default(0).notNull(),

  // Important dates
  deadline: timestamp('deadline', { withTimezone: true }),
  publishedDate: timestamp('published_date', { withTimezone: true }),

  // Financial
  estimatedValue: numeric('estimated_value', { precision: 15, scale: 2 }),

  // Relations
  portalId: uuid('portal_id').references(() => portals.id),

  // Metadata
  description: text('description'),
  requirements: jsonb('requirements'),
  complianceRequirements: jsonb('compliance_requirements'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Key Fields**:

- `status` - Workflow state: discovered → parsing → drafting → review → approved → submitted → closed
- `progress` - Percentage completion (0-100)
- `requirements` - JSONB containing extracted RFP requirements
- `complianceRequirements` - JSONB containing compliance checklist

#### Proposals Table

**Purpose**: Stores AI-generated proposals linked to RFPs

```typescript
export const proposals = pgTable('proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfpId: uuid('rfp_id')
    .references(() => rfps.id)
    .notNull(),
  companyProfileId: uuid('company_profile_id').references(
    () => companyProfiles.id
  ),

  // Proposal content
  title: text('title').notNull(),
  content: text('content'), // Full proposal text

  // Structured sections (JSONB)
  executiveSummary: jsonb('executive_summary'),
  technicalApproach: jsonb('technical_approach'),
  pricing: jsonb('pricing'),
  complianceMatrix: jsonb('compliance_matrix'),

  // Status and quality
  status: text('status', {
    enum: ['draft', 'generating', 'review', 'approved', 'submitted'],
  })
    .default('draft')
    .notNull(),
  qualityScore: numeric('quality_score', { precision: 3, scale: 2 }),

  // AI metadata
  aiModel: text('ai_model'), // e.g., 'gpt-4', 'claude-3-5-sonnet'
  generationMetadata: jsonb('generation_metadata'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Key Fields**:

- `content` - Full generated proposal text
- `executiveSummary`, `technicalApproach`, `pricing` - Structured JSONB sections
- `complianceMatrix` - Requirements checklist with pass/fail status
- `qualityScore` - AI-generated quality score (0.00-1.00)
- `generationMetadata` - Includes model version, tokens used, generation time

#### Portals Table

**Purpose**: Stores government procurement portal configurations

```typescript
export const portals = pgTable('portals', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  type: text('type', { enum: ['federal', 'state', 'municipal'] }).notNull(),

  // Authentication
  requiresAuth: boolean('requires_auth').default(false).notNull(),
  authType: text('auth_type', {
    enum: ['basic', 'oauth', 'saml', 'two_factor'],
  }),
  credentialsId: uuid('credentials_id'),

  // Scanning configuration
  scanSchedule: text('scan_schedule'), // Cron expression
  scanEnabled: boolean('scan_enabled').default(true).notNull(),
  lastScanAt: timestamp('last_scan_at', { withTimezone: true }),
  nextScanAt: timestamp('next_scan_at', { withTimezone: true }),

  // Portal-specific selectors
  selectors: jsonb('selectors'), // CSS/XPath selectors for scraping

  // Health monitoring
  healthStatus: text('health_status', {
    enum: ['healthy', 'degraded', 'down'],
  }).default('healthy'),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Key Fields**:

- `type` - Portal jurisdiction level (federal, state, municipal)
- `scanSchedule` - Cron expression for automated scanning
- `selectors` - Portal-specific CSS/XPath selectors for scraping
- `healthStatus` - Current portal health (healthy, degraded, down)

#### Agent Registry Table

**Purpose**: Tracks all AI agents in the 3-tier system

```typescript
export const agentRegistry = pgTable('agent_registry', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  tier: integer('tier').notNull(), // 1 (Orchestrator), 2 (Manager), 3 (Specialist)
  type: text('type').notNull(), // e.g., 'portal-manager', 'content-generator'

  // Capabilities
  capabilities: jsonb('capabilities').notNull(), // Array of capability strings

  // Status
  status: text('status', { enum: ['active', 'idle', 'busy', 'offline'] }).default('idle').notNull(),
  currentTaskId: uuid('current_task_id'),

  // Performance metrics
  tasksCompleted: integer('tasks_completed').default(0).notNull(),
  tasksF Failed: integer('tasks_failed').default(0).notNull(),
  averageExecutionTime: numeric('average_execution_time', { precision: 10, scale: 2 }),

  // Health
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  healthStatus: text('health_status', { enum: ['healthy', 'degraded', 'unhealthy'] }).default('healthy'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});
```

**Key Fields**:

- `tier` - Agent hierarchy level (1=Orchestrator, 2=Manager, 3=Specialist)
- `capabilities` - Array of tasks this agent can perform
- `status` - Current agent state (active, idle, busy, offline)
- Performance metrics for monitoring agent effectiveness

#### Work Items Table

**Purpose**: Tracks delegated tasks between agents

```typescript
export const workItems = pgTable('work_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: text('session_id').notNull(),
  workflowId: text('workflow_id'),

  // Task details
  taskType: text('task_type').notNull(),
  taskDescription: text('task_description').notNull(),
  inputs: jsonb('inputs').notNull(),

  // Agent assignment
  assignedAgentId: uuid('assigned_agent_id').references(() => agentRegistry.id),
  requestedByAgentId: uuid('requested_by_agent_id'),

  // Status
  status: text('status', {
    enum: ['pending', 'in_progress', 'completed', 'failed', 'cancelled'],
  })
    .default('pending')
    .notNull(),
  progress: integer('progress').default(0).notNull(),

  // Results
  results: jsonb('results'),
  error: jsonb('error'),

  // Timing
  priority: integer('priority').default(5).notNull(),
  deadline: timestamp('deadline', { withTimezone: true }),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Key Fields**:

- `taskType` - Type of work (e.g., 'portal_scan', 'proposal_generation')
- `assignedAgentId` - Which agent is handling this work
- `requestedByAgentId` - Which agent delegated this work
- `priority` - Task priority (1-10, higher = more urgent)

#### Company Profiles Table

**Purpose**: Stores company information for proposal generation

```typescript
export const companyProfiles = pgTable('company_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),

  // Company details
  capabilities: jsonb('capabilities'),
  pastPerformance: jsonb('past_performance'),
  certifications: jsonb('certifications'),
  teamMembers: jsonb('team_members'),

  // Templates
  proposalTemplates: jsonb('proposal_templates'),
  pricingModels: jsonb('pricing_models'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

#### Documents Table

**Purpose**: Stores RFP attachments and generated documents

```typescript
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  rfpId: uuid('rfp_id').references(() => rfps.id),
  proposalId: uuid('proposal_id').references(() => proposals.id),

  // File details
  filename: text('filename').notNull(),
  fileType: text('file_type').notNull(), // pdf, docx, etc.
  fileSize: integer('file_size').notNull(),
  storageUrl: text('storage_url').notNull(),

  // Document type
  documentType: text('document_type', {
    enum: [
      'rfp_attachment',
      'proposal_draft',
      'proposal_final',
      'supporting_doc',
    ],
  }).notNull(),

  // Processing status
  processingStatus: text('processing_status', {
    enum: ['pending', 'processing', 'completed', 'failed'],
  })
    .default('pending')
    .notNull(),

  // Extracted data
  extractedText: text('extracted_text'),
  extractedData: jsonb('extracted_data'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

### Relationships

Drizzle ORM relationships are defined using `relations()`:

```typescript
export const rfpsRelations = relations(rfps, ({ one, many }) => ({
  portal: one(portals, {
    fields: [rfps.portalId],
    references: [portals.id],
  }),
  proposals: many(proposals),
  documents: many(documents),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  rfp: one(rfps, {
    fields: [proposals.rfpId],
    references: [rfps.id],
  }),
  companyProfile: one(companyProfiles, {
    fields: [proposals.companyProfileId],
    references: [companyProfiles.id],
  }),
  documents: many(documents),
}));
```

### Inferred TypeScript Types

Drizzle automatically generates TypeScript types from the schema:

```typescript
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

// Select types (what you get from DB)
export type RFP = InferSelectModel<typeof rfps>;
export type Proposal = InferSelectModel<typeof proposals>;
export type Portal = InferSelectModel<typeof portals>;
export type AgentRegistry = InferSelectModel<typeof agentRegistry>;
export type WorkItem = InferSelectModel<typeof workItems>;

// Insert types (what you send to DB)
export type InsertRFP = InferInsertModel<typeof rfps>;
export type InsertProposal = InferInsertModel<typeof proposals>;
export type InsertPortal = InferInsertModel<typeof portals>;
export type InsertAgentRegistry = InferInsertModel<typeof agentRegistry>;
export type InsertWorkItem = InferInsertModel<typeof workItems>;
```

### Zod Schemas

Generate Zod schemas from Drizzle for runtime validation:

```typescript
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

export const insertRFPSchema = createInsertSchema(rfps);
export const selectRFPSchema = createSelectSchema(rfps);

export const insertProposalSchema = createInsertSchema(proposals);
export const selectProposalSchema = createSelectSchema(proposals);
```

## How This Applies to the RFP Agent App

### Data Flow

1. **Portal Scanning**:

   ```
   Portal Scanner Agent → Creates RFP record with status='discovered'
   → Updates portals.lastScanAt
   → Creates work_items for document processing
   ```

2. **Document Processing**:

   ```
   Document Processor Agent → Downloads files
   → Creates documents records with processingStatus='processing'
   → Extracts text and requirements
   → Updates RFP.requirements (JSONB)
   → Updates RFP.status='parsing', progress=100
   ```

3. **Proposal Generation**:

   ```
   Proposal Manager → Creates proposal record with status='generating'
   → Delegates to Content Generator (work_items)
   → Populates executiveSummary, technicalApproach, pricing (JSONB)
   → Updates proposal.status='review'
   → Updates proposal.qualityScore
   ```

4. **Agent Coordination**:
   ```
   Primary Orchestrator → Creates work_items for manager agents
   → Managers create work_items for specialists
   → Specialists update work_items.status='completed'
   → Results flow back up the hierarchy
   → agent_registry tracks performance metrics
   ```

### JSONB Usage

The schema makes extensive use of PostgreSQL's JSONB type for flexible, structured data:

- **RFPs.requirements**: Array of extracted requirements with metadata

  ```json
  [
    {
      "id": "req-1",
      "section": "Technical Requirements",
      "text": "Must support OAuth 2.0 authentication",
      "mandatory": true,
      "category": "security"
    }
  ]
  ```

- **Proposals.complianceMatrix**: Compliance checklist

  ```json
  {
    "req-1": {
      "requirementText": "OAuth 2.0 support",
      "status": "compliant",
      "evidencePage": 12,
      "notes": "Using Auth0 implementation"
    }
  }
  ```

- **Portals.selectors**: Portal-specific scraping selectors
  ```json
  {
    "rfpListContainer": ".opportunity-list",
    "rfpTitle": ".opportunity-title",
    "rfpDeadline": ".deadline-date",
    "downloadButton": "button[aria-label='Download RFP']"
  }
  ```

## Database Migrations

Schema changes are managed through Drizzle Kit:

### Creating Migrations

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# This creates a new SQL file in migrations/ directory
```

### Applying Migrations

```bash
# Push schema directly to database (development)
npm run db:push

# Run migrations (production)
npm run db:migrate
```

See [migrations/CLAUDE.md](../migrations/CLAUDE.md) for migration management details.

## Querying the Database

### Server-side (Node.js)

```typescript
import { db } from '../db';
import { rfps, proposals } from '@shared/schema';
import { eq, and, gte } from 'drizzle-orm';

// Simple query
const allRFPs = await db.select().from(rfps);

// With filter
const activeRFPs = await db
  .select()
  .from(rfps)
  .where(eq(rfps.status, 'discovered'));

// With relations
const rfpWithProposals = await db.query.rfps.findFirst({
  where: eq(rfps.id, rfpId),
  with: {
    proposals: true,
    documents: true,
    portal: true,
  },
});

// Complex query
const urgentRFPs = await db
  .select()
  .from(rfps)
  .where(
    and(
      eq(rfps.status, 'discovered'),
      gte(rfps.estimatedValue, '100000')
      // deadline within 30 days
    )
  )
  .orderBy(rfps.deadline);
```

### Client-side (React Query)

```typescript
import { useQuery } from '@tanstack/react-query';
import type { RFP } from '@shared/schema';

function useRFPs(filters: { status?: string }) {
  return useQuery({
    queryKey: ['rfps', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters);
      const response = await fetch(`/api/rfps?${params}`);
      return response.json() as Promise<{ rfps: RFP[]; total: number }>;
    },
  });
}
```

## Best Practices

### Schema Design

1. **Use appropriate data types**:
   - `uuid` for all primary keys
   - `timestamp with timezone` for all dates
   - `numeric` for monetary values (precision 15, scale 2)
   - `jsonb` for flexible, structured data

2. **Always include timestamps**:

   ```typescript
   createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
   updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
   ```

3. **Use enums for fixed value sets**:

   ```typescript
   status: text('status', {
     enum: ['discovered', 'parsing', 'drafting', 'review', 'approved'],
   }).notNull();
   ```

4. **Define relationships explicitly**:
   ```typescript
   portalId: uuid('portal_id').references(() => portals.id);
   ```

### Type Safety

Always use the inferred types from Drizzle:

```typescript
import type { RFP, InsertRFP } from '@shared/schema';

// Good
function createRFP(data: InsertRFP): Promise<RFP> {
  return db.insert(rfps).values(data).returning();
}

// Avoid
function createRFP(data: any): Promise<any> {
  // Don't do this
  return db.insert(rfps).values(data).returning();
}
```

## Related Documentation

- **Server**: See [server/CLAUDE.md](../server/CLAUDE.md) for database usage in backend
- **Client**: See [client/CLAUDE.md](../client/CLAUDE.md) for API consumption
- **Migrations**: See [migrations/CLAUDE.md](../migrations/CLAUDE.md) for schema evolution
- **API Reference**: See [docs/api/README.md](../docs/api/README.md) for API contracts

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
