# Scripts Directory - Utility and Automation Scripts

**Last Updated**: January 2025

## Overview

The `scripts/` directory contains utility scripts for development, testing, deployment, and maintenance tasks. These scripts automate common operations and provide tools for developers and DevOps engineers.

## Purpose

This directory serves to:

- **Automate repetitive tasks** - Database management, testing, data seeding
- **Development utilities** - Testing endpoints, generating test data
- **Deployment helpers** - Migration runners, health checks
- **Maintenance scripts** - Database cleanup, index creation, backups
- **Testing tools** - Agent testing, proposal generation testing

## Directory Structure

```
scripts/
├── run-migrations.ts              # Database migration runner
├── test-agents-simple.ts         # Test AI agent functionality
├── test-proposal-generation.ts   # Test proposal pipeline
├── test-proposals-api.ts         # Test proposal API endpoints
└── CLAUDE.md                     # This file

server/scripts/  # Additional server-specific scripts
├── apply-gin-indexes.js          # Create PostgreSQL GIN indexes
├── batchProcessCompliance.ts     # Bulk compliance processing
└── testComplianceIntegration.ts  # Test compliance checking
```

## Scripts Reference

### Database Scripts

#### run-migrations.ts
**Purpose**: Runs Drizzle ORM migrations against the database
**Location**: `scripts/run-migrations.ts`
**Usage**:
```bash
npm run db:migrate
# or directly:
tsx scripts/run-migrations.ts
```

**What it does**:
1. Connects to PostgreSQL database via `DATABASE_URL`
2. Reads migration files from `migrations/` directory
3. Applies pending migrations in order
4. Updates migration journal
5. Reports success or failure

**Environment Variables**:
- `DATABASE_URL` - PostgreSQL connection string (required)

**Example output**:
```
✓ Connected to database
✓ Found 3 pending migrations
✓ Applied: 0008_add_rfp_deadline.sql
✓ Applied: 0009_add_proposal_quality_score.sql
✓ Applied: 0010_add_gin_indexes.sql
✓ All migrations complete
```

#### apply-gin-indexes.js
**Purpose**: Creates PostgreSQL GIN indexes for JSONB columns
**Location**: `server/scripts/apply-gin-indexes.js`
**Usage**:
```bash
npm run apply-gin-indexes
# or directly:
node server/scripts/apply-gin-indexes.js
```

**What it does**:
Creates GIN (Generalized Inverted Index) indexes on JSONB columns for fast queries:
```sql
CREATE INDEX IF NOT EXISTS "rfp_requirements_gin_idx"
  ON "rfps" USING GIN ("requirements");

CREATE INDEX IF NOT EXISTS "proposal_compliance_gin_idx"
  ON "proposals" USING GIN ("compliance_matrix");

CREATE INDEX IF NOT EXISTS "portal_selectors_gin_idx"
  ON "portals" USING GIN ("selectors");
```

**Why GIN indexes?**
- Enable fast containment queries (`@>`, `<@`)
- Speed up JSONB key existence checks (`?`)
- Essential for querying nested JSONB data
- Can improve query performance by 100-1000x

### Testing Scripts

#### test-agents-simple.ts
**Purpose**: Tests the 3-tier AI agent system
**Location**: `scripts/test-agents-simple.ts`
**Usage**:
```bash
npm run test-agents
# or directly:
tsx scripts/test-agents-simple.ts
```

**What it does**:
1. Loads agent registry from database
2. Tests each agent's:
   - Registration and discovery
   - Health status
   - Capability matching
   - Task delegation
3. Tests agent coordination:
   - Tier 1 → Tier 2 → Tier 3 delegation
   - Work item creation and tracking
   - Result aggregation

**Example output**:
```
Testing Agent System
====================

✓ Found 11 registered agents
  - 1 Tier-1 (Orchestrator)
  - 3 Tier-2 (Managers)
  - 7 Tier-3 (Specialists)

Testing Primary Orchestrator:
  ✓ Health check passed
  ✓ Can delegate to Portal Manager
  ✓ Can delegate to Proposal Manager

Testing Portal Manager:
  ✓ Can coordinate Portal Scanner
  ✓ Can coordinate Portal Monitor
  ✓ Work items created successfully

All agent tests passed!
```

#### test-proposal-generation.ts
**Purpose**: End-to-end test of proposal generation pipeline
**Location**: `scripts/test-proposal-generation.ts`
**Usage**:
```bash
# Test with mock data
npm run test-proposal

# Test with real RFP
npm run test-proposal-real

# Test fallback mechanisms
npm run test-proposal-fallback
```

**What it does**:
1. Creates or selects a test RFP
2. Triggers enhanced proposal generation
3. Monitors progress via SSE events
4. Validates:
   - Document processing
   - Requirement extraction
   - Compliance matrix generation
   - Content quality
   - PDF assembly
5. Reports results and metrics

**Example output**:
```
Testing Proposal Generation
============================

✓ Using RFP: "Cloud Infrastructure Services - City of Austin"
✓ Selected company profile: "TechCorp Solutions"

Starting generation...
  [1/5] Document processing... ✓ (12.3s)
  [2/5] Requirement extraction... ✓ (8.7s)
  [3/5] Content generation... ✓ (34.2s)
  [4/5] Compliance validation... ✓ (6.1s)
  [5/5] PDF assembly... ✓ (3.4s)

Results:
  - Sections generated: 5/5
  - Quality score: 0.87
  - Compliance: 100% (15/15 requirements)
  - Total time: 64.7s
  - Tokens used: 12,450

✓ Proposal generation successful!
  ID: prop_abc123def456
  File: proposals/prop_abc123def456.pdf
```

#### test-proposals-api.ts
**Purpose**: Tests proposal API endpoints
**Location**: `scripts/test-proposals-api.ts`
**Usage**:
```bash
npm run test-proposals-api
# or directly:
tsx scripts/test-proposals-api.ts
```

**What it does**:
Tests all proposal-related API endpoints:
- `GET /api/proposals` - List proposals
- `GET /api/proposals/:id` - Get proposal details
- `POST /api/proposals/enhanced/generate` - Generate proposal
- `GET /api/proposals/submission-materials/stream/:sessionId` - SSE stream
- `GET /api/proposals/rfp/:rfpId` - Get proposals for RFP

**Example output**:
```
Testing Proposals API
=====================

✓ GET /api/proposals - Status: 200
  - Returned 5 proposals

✓ GET /api/proposals/:id - Status: 200
  - Proposal data valid

✓ POST /api/proposals/enhanced/generate - Status: 200
  - Session ID: enhanced_550e8400_1234567890

✓ GET /api/proposals/submission-materials/stream/:sessionId
  - SSE connection established
  - Received 12 progress events

All API tests passed!
```

### Compliance Scripts

#### batchProcessCompliance.ts
**Purpose**: Bulk process compliance checking for multiple proposals
**Location**: `server/scripts/batchProcessCompliance.ts`
**Usage**:
```bash
npm run batch-compliance
# or directly:
tsx server/scripts/batchProcessCompliance.ts
```

**What it does**:
1. Queries database for proposals needing compliance check
2. Processes in batches (configurable concurrency)
3. For each proposal:
   - Extracts RFP requirements
   - Analyzes proposal content
   - Generates compliance matrix
   - Calculates compliance score
4. Updates database with results
5. Reports summary statistics

**Use cases**:
- Reprocess compliance after requirement updates
- Validate compliance across all proposals
- Generate compliance reports

#### testComplianceIntegration.ts
**Purpose**: Tests compliance checking integration
**Location**: `server/scripts/testComplianceIntegration.ts`
**Usage**:
```bash
npm run test-compliance
# or directly:
tsx server/scripts/testComplianceIntegration.ts
```

**What it does**:
Tests the compliance checking specialist agent:
- Requirement extraction accuracy
- Compliance matrix generation
- Pass/fail determination
- Evidence citation

## Creating New Scripts

### Script Template

```typescript
// scripts/new-script.ts
import { db } from '../server/db';
import { logger } from '../server/utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const log = logger.child({ script: 'new-script' });

async function main() {
  log.info('Starting script');

  try {
    // Your script logic here
    const result = await performTask();

    log.info('Script completed successfully', { result });
    process.exit(0);
  } catch (error) {
    log.error('Script failed', error as Error);
    process.exit(1);
  }
}

async function performTask() {
  // Implementation
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
```

### Add to package.json

```json
{
  "scripts": {
    "new-script": "tsx scripts/new-script.ts"
  }
}
```

### Best Practices

1. **Use structured logging**:
   ```typescript
   import { logger } from '../server/utils/logger';
   const log = logger.child({ script: 'script-name' });
   ```

2. **Handle errors gracefully**:
   ```typescript
   try {
     await task();
     process.exit(0);
   } catch (error) {
     log.error('Task failed', error as Error);
     process.exit(1);
   }
   ```

3. **Load environment variables**:
   ```typescript
   import dotenv from 'dotenv';
   dotenv.config();
   ```

4. **Use database connection from server**:
   ```typescript
   import { db } from '../server/db';
   ```

5. **Make scripts idempotent**:
   - Safe to run multiple times
   - Check state before modifying
   - Use transactions for atomicity

6. **Add progress reporting**:
   ```typescript
   console.log(`Processing 1/100...`);
   console.log(`Processing 2/100...`);
   ```

7. **Document usage in script header**:
   ```typescript
   /**
    * Script: Generate test data
    *
    * Usage:
    *   npm run generate-test-data
    *   tsx scripts/generate-test-data.ts --count 100
    *
    * Environment:
    *   DATABASE_URL - Required
    *   OPENAI_API_KEY - Optional (for AI features)
    */
   ```

## Common Script Patterns

### Database Query Script

```typescript
import { db } from '../server/db';
import { rfps } from '@shared/schema';
import { eq } from 'drizzle-orm';

async function queryRFPs() {
  const activeRFPs = await db
    .select()
    .from(rfps)
    .where(eq(rfps.status, 'discovered'));

  console.log(`Found ${activeRFPs.length} active RFPs`);

  for (const rfp of activeRFPs) {
    console.log(`- ${rfp.title} (${rfp.agency})`);
  }
}
```

### Batch Processing Script

```typescript
import pLimit from 'p-limit';

async function batchProcess(items: any[]) {
  const limit = pLimit(5); // Process 5 concurrently

  const results = await Promise.all(
    items.map(item =>
      limit(async () => {
        console.log(`Processing ${item.id}...`);
        const result = await processItem(item);
        console.log(`✓ Completed ${item.id}`);
        return result;
      })
    )
  );

  console.log(`Processed ${results.length} items`);
}
```

### API Testing Script

```typescript
async function testAPI() {
  const baseUrl = process.env.API_URL || 'http://localhost:3000';

  // Test health endpoint
  const health = await fetch(`${baseUrl}/api/health`);
  console.log(`Health: ${health.status}`);

  // Test RFP listing
  const rfps = await fetch(`${baseUrl}/api/rfps`);
  const { rfps: rfpList } = await rfps.json();
  console.log(`RFPs: ${rfpList.length} found`);
}
```

### Data Seeding Script

```typescript
import { db } from '../server/db';
import { rfps, portals } from '@shared/schema';

async function seedTestData() {
  // Create test portal
  const [portal] = await db.insert(portals).values({
    name: 'Test Portal',
    url: 'https://test.portal.gov',
    type: 'federal',
    scanEnabled: false // Don't actually scan
  }).returning();

  // Create test RFPs
  const testRFPs = Array.from({ length: 10 }, (_, i) => ({
    title: `Test RFP ${i + 1}`,
    agency: 'Test Agency',
    sourceUrl: `https://test.portal.gov/rfp/${i + 1}`,
    portalId: portal.id,
    status: 'discovered' as const
  }));

  await db.insert(rfps).values(testRFPs);
  console.log(`Created ${testRFPs.length} test RFPs`);
}
```

## Environment Variables

Scripts use environment variables from `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rfpagent

# API (for testing scripts)
API_URL=http://localhost:3000

# AI Services (for generation scripts)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Script-specific
BATCH_SIZE=10
CONCURRENCY_LIMIT=5
```

## How This Applies to the RFP Agent App

### Development Workflow

```
Developer workflow:
1. Make schema changes → shared/schema.ts
2. Generate migration → npm run db:migrate
3. Test agents → npm run test-agents
4. Test proposals → npm run test-proposal
5. Create PR with passing tests
```

### Deployment Workflow

```
CI/CD pipeline:
1. Run migrations → npm run db:migrate
2. Apply indexes → npm run apply-gin-indexes
3. Run tests → npm test
4. Deploy application
5. Verify with test scripts
```

### Maintenance Tasks

```
Weekly:
- npm run batch-compliance (revalidate compliance)

Monthly:
- Review slow queries
- Rebuild indexes if needed
- Cleanup old test data
```

## Troubleshooting

### Script Fails to Connect to Database

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Run script with debug logging
LOG_LEVEL=debug tsx scripts/your-script.ts
```

### Script Times Out

```bash
# Increase timeout (if script supports it)
tsx scripts/your-script.ts --timeout 600000

# Or run in background
nohup tsx scripts/your-script.ts > output.log 2>&1 &
```

### Import Errors

```typescript
// Use correct import paths
import { db } from '../server/db';  // Relative to scripts/
import { rfps } from '@shared/schema';  // Path alias
```

## Related Documentation

- **Server**: See [server/CLAUDE.md](../server/CLAUDE.md) for server architecture
- **Database**: See [shared/CLAUDE.md](../shared/CLAUDE.md) for schema reference
- **Migrations**: See [migrations/CLAUDE.md](../migrations/CLAUDE.md) for database changes
- **Testing**: See [tests/CLAUDE.md](../tests/CLAUDE.md) for test suite

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
