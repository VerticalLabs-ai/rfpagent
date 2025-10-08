# Post-Fix Verification Plan

**Purpose**: Ensure all linting error fixes don't break existing functionality

---

## Automated Verification Suite

### Step 1: Type Checking

```bash
pnpm check
```

**Expected Outcome**: ✅ 0 errors
**Success Criteria**: TypeScript compilation succeeds without errors
**Failure Action**: Review error output, identify which fix caused regression

---

### Step 2: Linting

```bash
pnpm run lint
```

**Expected Outcome**: ✅ <10 warnings (ideally 0)
**Success Criteria**: All `@typescript-eslint` errors resolved
**Failure Action**: Review remaining warnings, ensure they're acceptable

---

### Step 3: Build Verification

```bash
pnpm build
```

**Expected Outcome**: ✅ Build completes successfully
**Success Criteria**:

- Frontend bundle created in `dist/public/`
- Backend bundle created in `dist/index.js`
- No build errors
- Bundle size similar to baseline (±10%)

**Baseline**: 815.9kb total bundle

**Failure Action**:

1. Check build output for errors
2. Verify all imports are resolved
3. Check for circular dependencies

---

### Step 4: Test Suite Execution

```bash
pnpm test
```

**Expected Outcome**: ✅ All tests pass
**Success Criteria**:

- All test suites pass
- No new test failures
- Coverage maintained or improved

**Known Test Files**:

- `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/tests/basic.test.ts`
- `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/tests/storage.test.ts`
- `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/tests/agentMonitoringService.test.ts`
- `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/tests/baseRepository.test.ts`
- `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/tests/integration/rfp-scraping.test.ts`

**Failure Action**:

1. Review test output for specific failures
2. Identify which fix caused test failure
3. Rollback specific fix or adjust test

---

### Step 5: Development Server Start

```bash
# Terminal 1: Backend
pnpm dev:backend

# Terminal 2: Frontend
pnpm dev:frontend
```

**Expected Outcome**: ✅ Both servers start without errors
**Success Criteria**:

- Backend starts on port 3000
- Frontend Vite server starts (default: 5173)
- No runtime errors in console
- No import/module resolution errors

**Failure Action**:

1. Check server startup logs
2. Verify environment variables
3. Check database connection

---

## Manual Verification - Critical Paths

### Critical Path 1: Database Connection

**File**: `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/db.ts`
**Risk Level**: 🔴 HIGH

**Verification Steps**:

1. Start backend server: `pnpm dev:backend`
2. Check logs for database connection success
3. Test basic query (via API or script)

**Test Script**:

```bash
# Create a simple test script
cat > /tmp/test-db-connection.ts << 'EOF'
import { db } from './server/db';
import { users } from './shared/schema';

async function testConnection() {
  try {
    const result = await db.select().from(users).limit(1);
    console.log('✅ Database connection successful');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
}

testConnection();
EOF

tsx /tmp/test-db-connection.ts
```

**Success**: No errors, connection established
**Failure**: Rollback `server/db.ts` changes

---

### Critical Path 2: Mastra Workflows

**Files**: `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/src/mastra/workflows/*.ts`
**Risk Level**: 🔴 HIGH

**Verification Steps**:

1. Import workflow modules without errors
2. Verify workflow definitions load
3. Test basic workflow execution (if safe)

**Test Commands**:

```bash
# Test workflow imports
node -e "
const { rfpDiscoveryWorkflow } = require('./src/mastra/workflows/rfp-discovery-workflow.ts');
console.log('✅ Workflow imports successful');
"
```

**Success**: Workflows load without import errors
**Failure**: Review workflow type fixes, ensure context objects match

---

### Critical Path 3: API Endpoints

**Files**: `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/server/routes/*.ts`
**Risk Level**: 🟡 MEDIUM

**Verification Steps**:

1. Start backend server
2. Test critical endpoints:

```bash
# Health check
curl http://localhost:3000/api/health

# RFPs endpoint (requires auth)
curl http://localhost:3000/api/rfps

# Portals endpoint
curl http://localhost:3000/api/portals
```

**Success**: Endpoints respond (200 or expected status codes)
**Failure**: Check route middleware changes, especially rate limiting

---

### Critical Path 4: Frontend Components

**Files**: `/Users/mgunnin/Developer/08_Clients/ibyte/rfpagent/client/src/components/*.tsx`
**Risk Level**: 🟡 MEDIUM

**Verification Steps**:

1. Start frontend server: `pnpm dev:frontend`
2. Open browser to frontend URL
3. Check browser console for errors
4. Navigate through key pages:
   - Dashboard (`/`)
   - RFPs (`/rfps`)
   - Proposals (`/proposals`)
   - Settings

**Success**: No console errors, pages render
**Failure**: Review component fixes, check for missing imports

---

## Rollback Strategy

### Git Checkpoint System

**Before Fixes**:

```bash
# Create checkpoint branch
git checkout -b checkpoint-pre-linting-fixes
git push origin checkpoint-pre-linting-fixes
```

**After Fixes** (if all tests pass):

```bash
# Create checkpoint for post-fixes
git checkout -b checkpoint-post-linting-fixes
git push origin checkpoint-post-linting-fixes
```

### Selective Rollback

If specific fixes cause issues:

```bash
# Rollback specific file
git checkout checkpoint-pre-linting-fixes -- path/to/problematic/file.ts

# Or use git restore
git restore --source=checkpoint-pre-linting-fixes path/to/file.ts
```

### Full Rollback

If widespread issues:

```bash
git checkout checkpoint-pre-linting-fixes
git checkout -b fix-linting-errors-v2
# Start over with more conservative approach
```

---

## Verification Checklist

Run this checklist after all fixes are applied:

- [ ] **Step 1**: `pnpm check` passes (0 TypeScript errors)
- [ ] **Step 2**: `pnpm run lint` shows <10 warnings
- [ ] **Step 3**: `pnpm build` succeeds
- [ ] **Step 4**: `pnpm test` all tests pass
- [ ] **Step 5**: Dev servers start without errors
- [ ] **Step 6**: Database connection works
- [ ] **Step 7**: API endpoints respond
- [ ] **Step 8**: Frontend renders without console errors
- [ ] **Step 9**: No regression in critical workflows
- [ ] **Step 10**: Git checkpoint created

---

## High-Risk Fixes - Special Attention

### 1. server/db.ts - Database Pool Configuration

**Fix Required**: Type mismatch in drizzle Pool initialization
**Risk**: Database connection failure would break entire app
**Test**: Connection test script (see Critical Path 1)

### 2. src/mastra/workflows/bonfire-auth-workflow.ts

**Fix Required**: Missing WorkflowContext import
**Risk**: Workflow execution failures
**Test**: Import test, workflow definition validation

### 3. server/routes/middleware/rateLimiting.ts

**Fix Required**: Missing rateLimit property on Request type
**Risk**: Rate limiting middleware failure, potential DOS vulnerability
**Test**: API endpoint test with rate limiting enabled

### 4. server/storage.ts - Workflow Insert

**Fix Required**: Schema mismatch in workflow insert
**Risk**: Storage operations fail, workflow state not persisted
**Test**: Workflow storage operations

---

## Performance Regression Checks

### Bundle Size

```bash
# Before fixes
ls -lh dist/index.js
# Expected: ~816kb

# After fixes - should be similar (±10%)
```

### Build Time

```bash
# Before fixes: ~3.5s total
time pnpm build
# After fixes: should be similar (±20%)
```

### Test Execution Time

```bash
time pnpm test
# Monitor for significant slowdowns (>50% increase)
```

---

## Success Metrics

### Minimum Acceptable (Go/No-Go)

1. ✅ Zero TypeScript errors (`pnpm check`)
2. ✅ Build succeeds (`pnpm build`)
3. ✅ No new test failures
4. ✅ Dev server starts
5. ✅ Database connection works

### Target Goals

1. ✅ <10 ESLint warnings
2. ✅ All existing tests pass
3. ✅ No console errors in development
4. ✅ Bundle size within 10% of baseline
5. ✅ Build time within 20% of baseline

### Stretch Goals

1. ✅ Zero ESLint warnings
2. ✅ Improved type coverage
3. ✅ Test coverage maintained/improved
4. ✅ Code quality metrics improved

---

## Emergency Procedures

### If Critical Issues Found

1. **Stop**: Don't proceed with more fixes
2. **Isolate**: Identify which fix caused the issue
3. **Document**: Record the error and steps to reproduce
4. **Rollback**: Use git to restore the problematic file(s)
5. **Re-plan**: Adjust approach for that specific fix
6. **Communicate**: Update team on status

### If Build Breaks

```bash
# Quick recovery
git stash
pnpm build  # Should work now

# Review what was stashed
git stash show -p

# Apply fixes more carefully
git stash pop
# Fix issues one by one
```

---

## Post-Verification Documentation

After successful verification, document:

1. **Changes Summary**: List of all files modified
2. **Error Resolution**: Which errors were fixed and how
3. **Test Results**: All verification step outcomes
4. **Known Issues**: Any remaining warnings/issues
5. **Recommendations**: Suggestions for future improvements

**Template**: Create `LINTING_FIXES_REPORT.md` with results.

---

## Continuous Monitoring

After deployment:

1. Monitor error tracking (if configured)
2. Check server logs for runtime errors
3. Review user reports for UI issues
4. Monitor API response times
5. Check database query performance

**Duration**: 24-48 hours post-deployment

---

## Command Quick Reference

```bash
# Full verification suite (run in order)
pnpm check                    # Step 1: Type checking
pnpm run lint                 # Step 2: Linting
pnpm build                    # Step 3: Build
pnpm test                     # Step 4: Tests
pnpm dev                      # Step 5: Dev servers

# Individual component testing
pnpm dev:backend              # Backend only
pnpm dev:frontend             # Frontend only
pnpm db:push                  # Database schema push

# Code quality
pnpm run format:check         # Check formatting
pnpm run format               # Auto-format
pnpm run type-check           # Type check without emit

# Git checkpoints
git checkout -b checkpoint-pre-linting-fixes
git checkout -b checkpoint-post-linting-fixes

# Rollback examples
git checkout checkpoint-pre-linting-fixes -- server/db.ts
git restore --source=HEAD~1 path/to/file.ts
```

---

**Next**: Execute verification steps after fixes are completed.
