# Local Docker Database Setup - Migration Summary

## Overview

The RFP Agent application has been successfully migrated from using a deprecated NeonDB cloud database to using local Docker PostgreSQL and Redis containers for development.

## Changes Made

### 1. Environment Configuration

#### `.env.local` (Primary Development Config)

- Updated `DATABASE_URL` to point to local Docker Postgres: `postgresql://rfpuser:rfppassword@localhost:5432/rfpagent`
- Added `USE_NEON="false"` to force use of standard PostgreSQL driver
- Updated `REDIS_URL` to `redis://localhost:6379`
- Added comments for production database configuration

#### `.env` (Docker Compose Config)

- Updated to match `.env.local` configuration for consistency
- Docker Compose uses this file for container environment variables

#### `.env.example` (Template)

- Updated with Docker-first defaults
- Added comprehensive documentation for `USE_NEON` variable
- Included examples for both Fly.io Postgres and Neon Database production setups

### 2. Code Updates

#### `server/db.ts`

**Before:**

```typescript
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });
```

**After:**

```typescript
dotenv.config({ path: envPath });
dotenv.config({ path: envLocalPath, override: true });
```

**Reason:** The `override: true` option ensures `.env.local` values take precedence over `.env` values, allowing local development settings to properly override base configuration.

#### `scripts/run-migrations.ts`

- Applied the same dotenv loading pattern as `server/db.ts`
- Ensures migrations run against the correct local database

### 3. Docker Services

#### PostgreSQL Container

- **Image:** `postgres:16-alpine`
- **Container Name:** `rfp-agent-postgres`
- **Port:** `5432`
- **Credentials:**
  - Database: `rfpagent`
  - User: `rfpuser`
  - Password: `rfppassword`
- **Volume:** `postgres-data` (persistent storage)

#### Redis Container

- **Image:** `redis:7-alpine`
- **Container Name:** `rfp-agent-redis`
- **Port:** `6379`
- **Volume:** `redis-data` (persistent storage)
- **Configuration:** 256MB max memory with LRU eviction policy

### 4. Database Schema

Successfully migrated all tables to local Docker PostgreSQL:

- 27+ tables including users, portals, RFPs, proposals, documents, etc.
- All indexes and foreign key constraints preserved
- Agent coordination, memory, and knowledge base tables
- Workflow and submission pipeline tables

## Setup Instructions

### Initial Setup

1. **Start Docker Services:**

   ```bash
   docker-compose up -d postgres redis
   ```

2. **Verify Services:**

   ```bash
   docker-compose ps
   ```

3. **Run Database Migrations:**

   ```bash
   pnpm db:migrate
   ```

4. **Start Development Server:**

   ```bash
   pnpm dev
   ```

### Reset Database

If you need to start fresh:

```bash
docker-compose down -v
docker-compose up -d postgres redis
pnpm db:migrate
```

## Database Driver Selection

The application in [server/db.ts](/server/db.ts) automatically selects the appropriate driver:

- **Local Development** (default): Uses `node-postgres` (standard PostgreSQL driver)
- **Neon Cloud**: Uses `@neondatabase/serverless` (serverless driver)

Detection logic:

1. Checks if `DATABASE_URL` contains localhost, 127.0.0.1, or `.local` domains
2. Can be overridden with `USE_NEON` environment variable

## Production Deployment

### Fly.io with Postgres

```env
DATABASE_URL="postgresql://user:password@your-app.internal:5432/rfpagent?sslmode=require"
USE_NEON="false"
REDIS_URL="redis://:password@your-redis-host:6379"
```

### Neon Database (if needed)

```env
DATABASE_URL="postgresql://user:password@ep-xxxxx.aws.neon.tech/database?sslmode=require"
USE_NEON="true"
```

## Troubleshooting

### Connection Issues

If you see `ECONNREFUSED` errors:

1. Verify Docker services:

   ```bash
   docker-compose ps
   ```

2. Check if ports are available:

   ```bash
   lsof -i :5432  # PostgreSQL
   lsof -i :6379  # Redis
   ```

3. Restart services:

   ```bash
   docker-compose restart postgres redis
   ```

### Migration Errors

If `pnpm db:migrate` fails:

1. Check database connection:

   ```bash
   docker exec rfp-agent-postgres psql -U rfpuser -d rfpagent -c "SELECT version();"
   ```

2. Verify environment variables:

   ```bash
   grep DATABASE_URL .env.local
   ```

3. Reset and retry:

   ```bash
   docker-compose down -v
   docker-compose up -d postgres redis
   sleep 10
   pnpm db:migrate
   ```

## Benefits

1. **Faster Development:** Local database eliminates network latency
2. **Cost Savings:** No cloud database costs during development
3. **Offline Development:** Work without internet connection
4. **Consistent Environment:** Same database version across team
5. **Easy Reset:** Quick database reset for testing

## Migration Timeline

- **Before:** NeonDB cloud database (deprecated for local dev)
- **After:** Docker PostgreSQL + Redis (local development)
- **Production:** Fly.io Postgres (unchanged)

## Related Documentation

- [Development Setup Guide](/docs/development-setup.md)
- [Database Schema](/docs/architecture/database-schema.md)
- [Docker Compose Reference](/docker-compose.yml)
- [Environment Variables](/docs/configuration/environment-variables.md)
