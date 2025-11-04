# Migrations Directory - Database Schema Evolution

**Last Updated**: October 2025

## Overview

The `migrations/` directory contains database migration SQL scripts that evolve the PostgreSQL database schema over time. These migrations are generated from the Drizzle ORM schema and should be managed carefully to maintain data integrity across deployments.

## Purpose

This directory serves to:

- **Track schema changes** - Version-controlled SQL migration scripts
- **Maintain database evolution** - Ordered sequence of schema modifications
- **Enable rollback** - Revert schema changes if needed
- **Coordinate deployments** - Ensure schema matches code across environments
- **Document history** - Historical record of all database changes

## Directory Structure

```
migrations/
├── 0000_init.sql                    # Initial schema creation
├── 0001_add_rfp_progress.sql        # Add progress tracking
├── 0002_add_agent_registry.sql      # Add agent system tables
├── 0003_add_work_items.sql          # Add agent work coordination
├── 0004_add_compliance_fields.sql   # Add compliance tracking
├── 0005_add_gin_indexes.sql         # Add JSONB indexing
├── meta/                            # Drizzle Kit metadata
│   ├── _journal.json               # Migration journal
│   └── 0000_snapshot.json          # Schema snapshots
└── CLAUDE.md                       # This file

**Note**: Migration files are numbered sequentially (0000, 0001, etc.)
```

## Migration File Naming Convention

Drizzle Kit generates migrations with the following pattern:

```
{sequence}_{description}.sql

Examples:
- 0000_init.sql
- 0001_add_portal_health_status.sql
- 0002_update_rfp_status_enum.sql
- 0003_add_proposal_quality_score.sql
```

- **Sequence number** - 4-digit zero-padded number (0000, 0001, 0002...)
- **Description** - Snake_case description of the change
- **Extension** - Always `.sql`

## How Migrations Work

### 1. Schema Definition (Source of Truth)

The canonical database schema is defined in `shared/schema.ts` using Drizzle ORM:

```typescript
// shared/schema.ts
export const rfps = pgTable('rfps', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  status: text('status', {
    enum: ['discovered', 'parsing', 'drafting', 'review', 'approved'],
  }).notNull(),
  // ...
});
```

### 2. Generate Migration

When you modify `shared/schema.ts`, generate a migration:

```bash
npx drizzle-kit generate
```

This creates a new SQL file in `migrations/` with the changes:

```sql
-- migrations/0006_add_rfp_deadline.sql
ALTER TABLE "rfps" ADD COLUMN "deadline" timestamp with time zone;
```

### 3. Apply Migration

Apply migrations to your database:

```bash
# Development: Push schema directly (no migration file)
npm run db:push

# Production: Run migrations from files
npm run db:migrate
```

### 4. Track Migration State

Drizzle Kit maintains a migration journal in `migrations/meta/_journal.json`:

```json
{
  "version": "6",
  "dialect": "postgresql",
  "entries": [
    {
      "idx": 0,
      "version": "6",
      "when": 1704067200000,
      "tag": "0000_init",
      "breakpoints": true
    },
    {
      "idx": 1,
      "version": "6",
      "when": 1704153600000,
      "tag": "0001_add_rfp_progress",
      "breakpoints": true
    }
  ]
}
```

This tracks which migrations have been applied to the database.

## Common Migration Scenarios

### Adding a Column

**Schema change** (shared/schema.ts):

```typescript
export const rfps = pgTable('rfps', {
  // ... existing columns ...
  estimatedValue: numeric('estimated_value', { precision: 15, scale 2 })  // NEW
});
```

**Generated migration**:

```sql
-- migrations/0007_add_estimated_value.sql
ALTER TABLE "rfps" ADD COLUMN "estimated_value" numeric(15, 2);
```

### Modifying an Enum

**Schema change**:

```typescript
status: text('status', {
  enum: [
    'discovered',
    'parsing',
    'drafting',
    'review',
    'approved',
    'submitted',
  ], // Added 'submitted'
}).notNull();
```

**Generated migration**:

```sql
-- migrations/0008_add_submitted_status.sql
-- Note: Postgres doesn't support ALTER TYPE ... ADD VALUE in a transaction
-- This must be run outside a transaction block
ALTER TYPE "rfp_status" ADD VALUE 'submitted';
```

### Adding an Index

**Schema change**:

```typescript
export const rfps = pgTable(
  'rfps',
  {
    // ... columns ...
  },
  table => ({
    titleIdx: index('rfp_title_idx').on(table.title),
    statusIdx: index('rfp_status_idx').on(table.status),
  })
);
```

**Generated migration**:

```sql
-- migrations/0009_add_rfp_indexes.sql
CREATE INDEX "rfp_title_idx" ON "rfps" ("title");
CREATE INDEX "rfp_status_idx" ON "rfps" ("status");
```

### Adding JSONB GIN Indexes (PostgreSQL-specific)

For JSONB columns, GIN indexes enable fast queries:

**Manual migration** (not auto-generated):

```sql
-- migrations/0010_add_gin_indexes.sql
CREATE INDEX IF NOT EXISTS "rfp_requirements_gin_idx"
  ON "rfps" USING GIN ("requirements");

CREATE INDEX IF NOT EXISTS "proposal_compliance_gin_idx"
  ON "proposals" USING GIN ("compliance_matrix");
```

Apply with script:

```bash
npm run apply-gin-indexes
```

### Creating a New Table

**Schema change**:

```typescript
export const scanHistory = pgTable('scan_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  portalId: uuid('portal_id')
    .references(() => portals.id)
    .notNull(),
  scanId: text('scan_id').notNull(),
  status: text('status', {
    enum: ['running', 'completed', 'failed'],
  }).notNull(),
  rfpsDiscovered: integer('rfps_discovered').default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
```

**Generated migration**:

```sql
-- migrations/0011_create_scan_history.sql
CREATE TABLE "scan_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "portal_id" uuid NOT NULL,
  "scan_id" text NOT NULL,
  "status" text NOT NULL,
  "rfps_discovered" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "scan_history" ADD CONSTRAINT "scan_history_portal_id_portals_id_fk"
  FOREIGN KEY ("portal_id") REFERENCES "portals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
```

### Dropping a Column

**Schema change** (remove from schema.ts):

```typescript
export const rfps = pgTable('rfps', {
  // Remove: oldField: text('old_field')
});
```

**Generated migration**:

```sql
-- migrations/0012_drop_old_field.sql
ALTER TABLE "rfps" DROP COLUMN "old_field";
```

⚠️ **Warning**: Dropping columns is destructive. Always backup data first.

## Migration Workflow

### Development Workflow

```bash
# 1. Modify schema in shared/schema.ts
#    Add/remove columns, tables, indexes, etc.

# 2. Generate migration
npx drizzle-kit generate

# 3. Review generated SQL in migrations/
#    Check the SQL file in migrations/XXXX_*.sql

# 4. Apply to local database
npm run db:push

# 5. Test the changes
npm run test
npm run dev

# 6. Commit migration to git
git add shared/schema.ts migrations/
git commit -m "feat: add deadline field to RFPs table"
```

### Production Workflow

```bash
# 1. Pull latest code with migrations
git pull origin main

# 2. Run migrations (NOT db:push)
npm run db:migrate

# 3. Verify migration succeeded
npm run check-db-health

# 4. Deploy application code
npm run build
npm start
```

## Migration Commands

### Generate Migration

```bash
npx drizzle-kit generate
```

Creates a new migration file from schema changes.

### Push Schema (Development Only)

```bash
npm run db:push
```

Directly applies schema to database **without creating migration files**.
⚠️ **Never use in production** - use migrations instead.

### Run Migrations (Production)

```bash
npm run db:migrate
```

Runs all pending migrations from `migrations/` directory.

### View Migration Status

```bash
npx drizzle-kit check
```

Shows which migrations have been applied and which are pending.

### Drop Database (Development Only)

```bash
npx drizzle-kit drop
```

⚠️ **Dangerous**: Drops all tables. Development only.

## Custom Migrations

Sometimes Drizzle Kit cannot auto-generate complex migrations. Create them manually:

### 1. Create Empty Migration

```bash
npx drizzle-kit generate --name "add_custom_logic"
```

This creates a numbered SQL file.

### 2. Add Custom SQL

```sql
-- migrations/0013_add_custom_logic.sql

-- Example: Add a computed column
ALTER TABLE "proposals" ADD COLUMN "sections_count" integer
  GENERATED ALWAYS AS (
    CASE
      WHEN executive_summary IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN technical_approach IS NOT NULL THEN 1 ELSE 0 END +
      CASE WHEN pricing IS NOT NULL THEN 1 ELSE 0 END
  ) STORED;

-- Example: Create a view
CREATE OR REPLACE VIEW "active_rfps_with_proposals" AS
SELECT
  r.*,
  COUNT(p.id) as proposal_count
FROM rfps r
LEFT JOIN proposals p ON p.rfp_id = r.id
WHERE r.status IN ('discovered', 'parsing', 'drafting')
GROUP BY r.id;
```

### 3. Run Migration

```bash
npm run db:migrate
```

## Best Practices

### DO

✅ **Always generate migrations from schema changes**

```bash
# Good
npx drizzle-kit generate
```

✅ **Use `db:migrate` in production**

```bash
# Good - production
npm run db:migrate
```

✅ **Review generated SQL before applying**

- Check the migration file in `migrations/`
- Verify it matches your intentions
- Look for potential data loss

✅ **Test migrations locally first**

```bash
# Test on local database
npm run db:push
npm run test
```

✅ **Commit migrations with code changes**

```bash
git add shared/schema.ts migrations/
git commit -m "feat: add rfp deadline tracking"
```

✅ **Backup before production migrations**

```bash
pg_dump -h localhost -U user -d rfpagent > backup_$(date +%Y%m%d).sql
npm run db:migrate
```

### DON'T

❌ **Don't use `db:push` in production**

```bash
# Bad - production
npm run db:push  # This skips migration files!
```

❌ **Don't edit migration files after applying**

```bash
# Once applied to any environment, migrations are immutable
# Create a new migration instead
```

❌ **Don't delete migration files**

```bash
# Don't delete migrations/0005_*.sql
# This breaks migration history
```

❌ **Don't modify the migration journal manually**

```bash
# Don't edit migrations/meta/_journal.json
# Let Drizzle Kit manage this
```

❌ **Don't skip migration numbering**

```bash
# Bad
migrations/0001_*.sql
migrations/0003_*.sql  # Skipped 0002!

# Good
migrations/0001_*.sql
migrations/0002_*.sql
migrations/0003_*.sql
```

## Troubleshooting

### Migration Failed Mid-Execution

If a migration fails partway through:

```bash
# 1. Check database state
psql -U rfpuser -d rfpagent -c "\dt"

# 2. Check migration journal
cat migrations/meta/_journal.json

# 3. If needed, manually fix the database
psql -U rfpuser -d rfpagent

# 4. Update migration journal or re-run
npm run db:migrate
```

### Schema Drift

If database schema differs from code:

```bash
# 1. Generate missing migration
npx drizzle-kit generate

# 2. Or introspect database to sync
npx drizzle-kit introspect
```

### Rollback a Migration

Drizzle Kit doesn't support automatic rollbacks. Manual process:

```bash
# 1. Create a "down" migration manually
-- migrations/0014_rollback_deadline.sql
ALTER TABLE "rfps" DROP COLUMN "deadline";

# 2. Apply rollback migration
npm run db:migrate

# 3. Remove the original migration from journal
# Edit migrations/meta/_journal.json carefully
```

## Integration with RFP Agent

### Key Migrations

1. **0000_init.sql** - Initial schema with core tables (rfps, proposals, portals)
2. **Agent system** - agent_registry, work_items tables
3. **JSONB indexing** - GIN indexes for fast JSONB queries
4. **Compliance tracking** - Compliance-related fields and tables
5. **Performance indexes** - Indexes on frequently queried columns

### Typical Migration Cycle

```
Developer modifies schema.ts
    ↓
npx drizzle-kit generate
    ↓
Review generated SQL
    ↓
Test with npm run db:push (local)
    ↓
Commit to repository
    ↓
CI/CD pipeline runs tests
    ↓
Deploy to staging
    ↓
npm run db:migrate (staging)
    ↓
Verify migration success
    ↓
Deploy to production
    ↓
npm run db:migrate (production)
```

## Related Documentation

- **Schema Definition**: See [shared/CLAUDE.md](../shared/CLAUDE.md) for complete database schema
- **Database Setup**: See [docs/development-setup.md](../docs/development-setup.md)
- **Server Usage**: See [server/CLAUDE.md](../server/CLAUDE.md) for database queries
- **Scripts**: See [scripts/CLAUDE.md](../scripts/CLAUDE.md) for migration utilities

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
