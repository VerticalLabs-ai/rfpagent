# Testing Guide

## Overview
This guide covers testing strategies for the RFP Agent system, including unit tests, integration tests, and manual testing procedures.

## Quick Reference

| Test Type | Command | Duration | Status |
|-----------|---------|----------|--------|
| Unit Tests | `pnpm test` | ~10s | ✅ Passing (9/9) |
| Type Check | `pnpm check` | ~5s | ✅ 0 errors |
| Integration Tests | See below | ~5min | ⚠️ Browserbase session complexity |
| E2E Tests | Manual | Varies | 🎯 Recommended for scraping |

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

### Current Unit Tests
1. **basic.test.ts** - Basic functionality (3 tests) ✅
2. **baseRepository.test.ts** - Database repository (3 tests) ✅
3. **submissionFilters.test.ts** - Submission filtering (3 tests) ✅
4. **storage.test.ts** - File storage operations
5. **agentMonitoringService.test.ts** - Agent monitoring

**Status**: All basic tests passing (9/9)

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
- Frontend: http://localhost:5000
- Backend: http://localhost:5000/api

#### 2. Test RFP Scraping via UI
1. Navigate to http://localhost:5000
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

**Last Updated**: 2025-09-30
**Maintained By**: Development Team
