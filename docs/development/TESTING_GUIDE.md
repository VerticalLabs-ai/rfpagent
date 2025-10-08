# Testing Guide

## Overview

This guide covers testing strategies for the RFP Agent system, including unit tests, integration tests, and manual testing procedures.

## Quick Reference

**Last Updated**: 2025-10-02

| Test Type         | Command              | Duration | Status                         |
| ----------------- | -------------------- | -------- | ------------------------------ |
| Unit Tests        | `pnpm test`          | ~30s     | ⚠️ 26/41 passing (63%)         |
| Coverage          | `pnpm test:coverage` | ~35s     | 🎯 Target: 80%+                |
| Type Check        | `pnpm check`         | ~5s      | ✅ 0 errors                    |
| Integration Tests | See below            | ~5min    | ⚠️ 5/12 suites failing         |
| E2E Tests         | Manual               | Varies   | 🎯 Recommended for workflows   |

## Unit Tests

### Running Unit Tests

```bash
# Run all unit tests
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest tests/*.test.ts

# Run specific test file
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest tests/basic.test.ts

# Run with coverage
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --coverage
```

### Test Suite Status

#### ✅ Passing Test Suites (7/12)
1. **basic.test.ts** - Basic functionality ✅
2. **baseRepository.test.ts** - Database repository ✅
3. **submissionFilters.test.ts** - Submission filtering ✅
4. **storage.test.ts** - Storage interface **(FIXED)** ✅
5. **storage-minimal.test.ts** - Minimal storage tests ✅
6. **submissionLifecycleData.test.ts** - Lifecycle management ✅
7. **submissionPhaseUtils.test.ts** - Phase utilities ✅

#### ❌ Failing Test Suites (5/12)
1. **agent-coordination.test.ts** (10 failed) - Multi-agent coordination
   - **Issues**: User uniqueness constraints, agentMemoryService missing
   - **Status**: Partially fixed, needs test isolation

2. **agentMonitoringService.test.ts** (2 failed) - Agent monitoring
   - **Issues**: ESM module imports (p-limit)
   - **Status**: Needs transformIgnorePatterns configuration

3. **companyProfileAnalytics.test.ts** (1 failed) - Company analytics
   - **Issues**: Similar ESM import issues

4. **integration/rfp-scraping.test.ts** (1 failed) - RFP scraping
   - **Issues**: ESM module compatibility

5. **integration/simple-portal.test.ts** (1 failed) - Portal scraping
   - **Issues**: Stagehand API incompatibility (extract method)

**Current Status**: 26/41 tests passing (63%)

## Integration Tests

### Browserbase Scraping Tests

#### ⚠️ Current Limitation

Integration tests for Browserbase scraping encounter session management complexity:

- Stagehand library attempts to resume existing sessions
- Session resumption can hang on stale connections
- Tests require 5+ minutes for cloud browser operations

#### Test Files

1. **tests/integration/rfp-scraping.test.ts**
   - Full service-level scraping test
   - Uses `MastraScrapingService`
   - Timeout: 300 seconds

2. **tests/integration/simple-portal.test.ts**
   - Direct Stagehand usage
   - Two tests: basic scraping + RFP extraction
   - Timeout: 300 seconds per test

#### Running Integration Tests

```bash
# Philadelphia portal scraping (may hang on session)
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest \
  tests/integration/rfp-scraping.test.ts \
  --testTimeout=300000

# Simple portal test
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest \
  tests/integration/simple-portal.test.ts \
  --testTimeout=300000
```

**Recommendation**: Use manual testing via development server instead of integration tests until session management is improved.

## Manual Testing

### Prerequisites

```bash
# Ensure environment variables are set
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...
```

### Development Server Testing

#### 1. Start Development Server

```bash
pnpm dev
```

This starts:

- Frontend: <http://localhost:5000>
- Backend: <http://localhost:5000/api>

#### 2. Test RFP Scraping via UI

1. Navigate to <http://localhost:5000>
2. Go to "Portals" section
3. Add a portal URL (e.g., Philadelphia RFP portal)
4. Click "Scan Portal"
5. Monitor terminal logs for:
   - "🌐 Using Browserbase for reliable portal scraping"
   - "📄 Fetched X characters of HTML content"
   - No HTTP hang messages
   - No timeout errors

#### 3. Test Specific Portals

**Philadelphia Portal**:

```
URL: https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978
Expected: Successful scraping with RFP details extracted
Time: 60-90 seconds
```

**Bonfire Portal**:

```
URL: https://bonfirehub.com/... (requires authentication)
Expected: Auth workflow initiated
Time: Varies (may require 2FA)
```

### Manual API Testing

#### Test Scraping Endpoint

```bash
curl -X POST http://localhost:5000/api/portals/scrape \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.phlcontracts.phila.gov/bso/external/bidDetail.sdo?docId=B2624978"
  }'
```

**Expected Response**:

```json
{
  "success": true,
  "data": {
    "title": "...",
    "deadline": "...",
    "description": "...",
    ...
  }
}
```

**Success Indicators**:

- Response within 60-120 seconds
- No timeout errors
- Valid RFP data returned
- Logs show Browserbase usage

## Type Checking

### Run Type Checks

```bash
# Check all TypeScript files
pnpm check

# Check with watch mode
pnpm check --watch
```

**Current Status**: ✅ 0 TypeScript errors

## Testing After Code Changes

### Standard Testing Flow

1. **Type Check**: `pnpm check`
2. **Unit Tests**: `NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest tests/*.test.ts`
3. **Manual Smoke Test**: Start dev server, test one RFP scraping operation
4. **Review Logs**: Ensure Browserbase is used, no HTTP hangs

### Pre-Commit Checklist

- [ ] Type checking passes (`pnpm check`)
- [ ] Unit tests pass (9/9)
- [ ] No console errors in development
- [ ] At least one manual scraping test successful

## Known Issues & Workarounds

### Issue: Browserbase Session Resumption

**Problem**: Stagehand tries to resume existing sessions, may hang on stale connections

**Workaround**: Use manual testing via development server instead of integration tests

**Future Fix**: Implement custom session management or investigate Stagehand configuration

### Issue: Jest ESM Module Support

**Problem**: Some packages (p-limit) are ESM-only

**Solution**: Mocks created in `tests/__mocks__/`

**Configuration**: `jest.config.js` has `transformIgnorePatterns` and `moduleNameMapper`

### Issue: Test Timeouts

**Problem**: Browserbase operations take 60-120 seconds

**Solution**: Use per-test timeout parameter:

```typescript
it('test name', async () => {
  // test code
}, 300000); // 5 minute timeout
```

## Environment Configuration

### Required Environment Variables

```bash
# Browserbase (for web scraping)
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...

# OpenAI (for AI analysis)
OPENAI_API_KEY=sk-proj-...

# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# Google Cloud Storage (for file uploads)
GOOGLE_CLOUD_PROJECT_ID=...
GOOGLE_CLOUD_BUCKET_NAME=...
GOOGLE_CLOUD_CREDENTIALS_PATH=...

# SendGrid (for email notifications)
SENDGRID_API_KEY=...
```

### Test Environment Setup

```bash
# Copy example env file
cp .env.example .env.test

# Edit with test credentials
# Use separate Browserbase project for testing
# Use test database (not production!)
```

## Debugging Tests

### Enable Verbose Logging

```bash
# Jest verbose mode
NODE_OPTIONS="--experimental-vm-modules --no-warnings" npx jest --verbose

# Browserbase verbose logging (already enabled in tests)
# See console.log output for Stagehand operations
```

### Common Test Failures

#### "Cannot find module" Error

**Fix**: Check `jest.config.js` `moduleNameMapper` for correct path aliases

#### "Timeout of 30000ms exceeded"

**Fix**: Add timeout parameter to test: `it('test', async () => {...}, 300000)`

#### "jest is not defined"

**Fix**: Don't use `jest.setTimeout()` in describe block, use per-test timeout instead

#### Browserbase Connection Hangs

**Fix**: Use manual testing instead, or kill stale sessions via Browserbase dashboard

## Continuous Integration

### GitHub Actions

Tests run automatically on:

- Push to main branch
- Pull requests

**Workflows**:

- `.github/workflows/code-quality.yml` - Type checking and linting
- `.github/workflows/playwright.yml` - E2E tests (if configured)

**Current Status**: ✅ CI/CD pipeline working with pnpm

## Performance Testing

### Scraping Performance Metrics

Monitor in production:

- Time to scrape portal: Target <120s
- Browserbase API success rate: Target >95%
- RFP extraction accuracy: Manual review
- Session creation time: Target <30s

### Load Testing

Not yet implemented. Future consideration for:

- Multiple concurrent scraping operations
- Portal monitoring at scale
- Database query performance

## Future Improvements

### Short-Term

1. ✅ Fix HTTP hang bug (DONE - migrated to Browserbase)
2. 🎯 Create mock-based unit tests for scraping service
3. 🎯 Document Browserbase session management
4. 🎯 Add session cleanup utilities

### Long-Term

1. Implement custom Browserbase session management
2. Create test fixtures for common portals
3. Add performance benchmarking
4. Set up automated E2E testing

## Related Documentation

- [BROWSERBASE_MIGRATION.md](docs/BROWSERBASE_MIGRATION.md) - Browserbase migration details
- [PRODUCTION_BUG_FIX.md](PRODUCTION_BUG_FIX.md) - HTTP hang bug fix
- [REFACTOR.md](REFACTOR.md) - Refactoring progress
- [CLAUDE.md](CLAUDE.md) - Development commands and architecture

---

## Recent Fixes (2025-10-02)

### ✅ Jest Configuration Fixed
**Problem**: ESM modules (p-limit, nanoid, yocto-queue) were not being transformed properly.

**Solution**: Updated `jest.config.js`:
```javascript
transformIgnorePatterns: [
  'node_modules/(?!(p-limit|yocto-queue|nanoid)/)'
],
```

### ✅ Storage Test Path Mapping Fixed
**Problem**: `@/` alias was mapping to `client/src/` instead of `server/`.

**Solution**: Updated moduleNameMapper:
```javascript
moduleNameMapper: {
  '^@/(.*)$': '<rootDir>/server/$1',
}
```

### ✅ Missing Storage Methods Added
**Problem**: `createCoordinationLog` method was missing from storage interface.

**Solution**: Added method to both `StorageInterface` and `DatabaseStorage` class:
```typescript
async createCoordinationLog(log: {
  sessionId: string;
  workflowId?: string;
  initiatorAgentId: string;
  targetAgentId: string;
  coordinationType: string;
  priority: number;
  payload: any;
  status: string;
}): Promise<any>
```

### ✅ Test Helpers Created
**Problem**: Tests lacked proper database setup and teardown utilities.

**Solution**: Created `tests/helpers/testDatabase.ts` with utilities:
- `createTestUser()` - Creates unique test users
- `createTestSession()` - Creates agent sessions
- `createTestWorkflow()` - Creates test workflows
- `createTestPortal()` - Creates test portals
- `createTestRFP()` - Creates test RFPs
- `seedTestDatabase()` - Seeds minimal test data

### ⚠️ Partially Fixed: Agent Coordination Tests
**Problem**: Work items failing due to missing agent_sessions and duplicate users.

**Solution**:
- Created test sessions using helpers
- Added unique identifiers (nanoid) to prevent duplicates
- **Remaining**: Need better test isolation (transactions or cleanup)

## Next Steps

### High Priority
1. **Implement agentMemoryService stub** - Required for SAFLA learning tests
2. **Fix test isolation** - Use database transactions or proper cleanup
3. **Fix Stagehand API compatibility** - Update to correct extract/observe methods

### Medium Priority
4. **Add service layer tests** - Proposal generation, document processing
5. **Create E2E test suite** - Full workflow tests
6. **Expand coverage to 80%+** - Add missing unit tests

### Low Priority
7. **Performance benchmarks** - Load testing for concurrent operations
8. **Visual regression tests** - UI component testing

## Test Infrastructure Improvements

### Coverage Thresholds Added
```javascript
coverageThreshold: {
  global: {
    statements: 80,
    branches: 75,
    functions: 80,
    lines: 80
  }
}
```

### Test Timeout Configuration
- Global timeout: 30 seconds
- Integration tests: 300 seconds (5 minutes)
- Use per-test timeout for long-running tests

### Mock Structure
```
tests/
├── __mocks__/
│   └── nanoid.ts          # ESM module mock
├── helpers/
│   └── testDatabase.ts    # Test data helpers
├── integration/
│   ├── rfp-scraping.test.ts
│   └── simple-portal.test.ts
└── setup.ts               # Global test setup
```

---

**Last Updated**: 2025-10-02
**Maintained By**: QA Engineering Team
