# Testing with Database

## Overview

The project uses Fly.io PostgreSQL for production and supports flexible database configuration for testing.

## Configuration Files

### `.env` (Production)
Contains Fly.io production database credentials:
```bash
DATABASE_URL="postgresql://fly-user:...@pgbouncer.1zqyxr78xge0wp8m.flympg.net/fly-db"
```

### `.env.test` (Testing)
Configures database for local testing:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rfpagent_test"
```

## Testing Options

### Option 1: Local PostgreSQL (Recommended for Development)

1. **Install PostgreSQL locally**
   ```bash
   # macOS
   brew install postgresql
   brew services start postgresql

   # Ubuntu/Debian
   sudo apt-get install postgresql
   sudo service postgresql start
   ```

2. **Create test database**
   ```bash
   createdb rfpagent_test
   ```

3. **Run tests**
   ```bash
   pnpm run test:coverage
   ```

### Option 2: Fly.io Database via Proxy (Recommended for CI/CD)

1. **Start Fly.io proxy** (in a separate terminal)
   ```bash
   flyctl proxy 5432 -a bidhive-db
   ```

2. **Update `.env.test`** to use proxy:
   ```bash
   DATABASE_URL="postgresql://fly-user:zGcAVWJrGYiTob18Rj3SmzHi@localhost:5432/fly-db"
   ```

3. **Run tests**
   ```bash
   pnpm run test:coverage
   ```

### Option 3: GitHub Actions CI/CD

GitHub Actions workflows automatically use the Fly.io database credentials from repository secrets.

No local setup needed - tests run in CI/CD pipeline.

## Current Test Status

- **Tests Passing**: 160/253 (63%)
- **Tests Failing**: 92 (37%)
  - Most failures: Database connection errors when local DB not configured
  - Some failures: ESM package transformation issues
  - Few failures: Test logic needing updates

## Improving Test Coverage

To fix remaining test failures:

1. **Set up local test database** (see Option 1 above)
2. **Or use Fly.io proxy** (see Option 2 above)
3. **Or skip database tests locally**:
   ```bash
   pnpm test -- --testPathIgnorePatterns="integration|database"
   ```
