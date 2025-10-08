# Linting Fixes Verification Checklist

**Quick reference for verifying all fixes are safe and working**

---

## Pre-Fix Setup

- [ ] Create baseline documentation checkpoint
  ```bash
  git add TESTING_BASELINE.md TESTING_VERIFICATION.md LINTING_FIXES_RISK_MATRIX.md
  git commit -m "docs: add testing baseline and verification plans"
  ```

- [ ] Create pre-fix git checkpoint
  ```bash
  git checkout -b checkpoint-pre-linting-fixes
  git push origin checkpoint-pre-linting-fixes
  git checkout main  # or your working branch
  ```

- [ ] Document current error count
  ```bash
  pnpm check 2>&1 | grep "error TS" | wc -l
  # Expected: 57
  ```

- [ ] Verify build works
  ```bash
  pnpm build
  # Expected: SUCCESS
  ```

---

## Phase 1: Low Risk Fixes ✅

### After Applying Low Risk Fixes

- [ ] Type check passes or shows reduced errors
  ```bash
  pnpm check
  # Expected: ~32 errors remaining (57 - 25 fixed)
  ```

- [ ] Build still succeeds
  ```bash
  pnpm build
  # Expected: SUCCESS
  ```

- [ ] Lint warnings reduced
  ```bash
  pnpm run lint 2>&1 | grep "warning" | wc -l
  # Expected: <80 warnings (was ~100)
  ```

- [ ] Frontend renders without new errors
  ```bash
  pnpm dev:frontend
  # Check browser console for errors
  ```

### Git Checkpoint
- [ ] Commit Phase 1 fixes
  ```bash
  git add -A
  git commit -m "fix: resolve low-risk linting errors (imports, unused vars, types)"
  git checkout -b checkpoint-phase-1-complete
  ```

---

## Phase 2: Medium Risk Fixes ⚠️

### For EACH Medium Risk Fix

- [ ] Create micro-checkpoint
  ```bash
  git add -A
  git commit -m "fix: resolve [specific error description]"
  ```

- [ ] Run type check
  ```bash
  pnpm check
  # Verify error count decreased
  ```

- [ ] Run relevant test
  ```bash
  # Example for analytics fix
  pnpm test tests/companyProfileAnalytics.test.ts
  ```

- [ ] Test specific functionality
  - [ ] Analytics repository (error 26)
  - [ ] SAFLA monitoring (errors 27-35)
  - [ ] ML model integration (errors 36-38)
  - [ ] RFP scraping service (errors 39-42)
  - [ ] RFP discovery workflow (errors 43-45)

### Git Checkpoint
- [ ] Commit Phase 2 fixes
  ```bash
  git checkout -b checkpoint-phase-2-complete
  ```

---

## Phase 3: High Risk Fixes 🔴

### Before Each High Risk Fix

- [ ] Create fix-specific checkpoint
  ```bash
  git checkout -b checkpoint-before-[fix-name]
  ```

- [ ] Review fix plan
- [ ] Prepare rollback command

### Database Configuration Fix (Error 46)

- [ ] Apply fix to server/db.ts
- [ ] Type check
  ```bash
  pnpm check
  ```
- [ ] Test database connection
  ```bash
  pnpm dev:backend
  # Check logs for "Database connected"
  ```
- [ ] Run database-dependent tests
  ```bash
  pnpm test tests/baseRepository.test.ts
  pnpm test tests/storage.test.ts
  ```
- [ ] Manual verification: Query database
- [ ] Commit if successful
  ```bash
  git add server/db.ts
  git commit -m "fix: resolve database Pool type configuration"
  ```

### Rate Limiting Fix (Error 47)

- [ ] Apply fix to server/routes/middleware/rateLimiting.ts
- [ ] Type check
  ```bash
  pnpm check
  ```
- [ ] Test rate limiting
  ```bash
  # Terminal 1
  pnpm dev:backend

  # Terminal 2
  # Hit endpoint multiple times
  for i in {1..10}; do curl http://localhost:3000/api/rfps; done
  # Should see 429 Too Many Requests
  ```
- [ ] Commit if successful
  ```bash
  git add server/routes/middleware/rateLimiting.ts
  git commit -m "fix: add rateLimit property to Express Request type"
  ```

### Workflow Storage Fix (Error 48)

- [ ] Apply fix to server/storage.ts
- [ ] Type check
  ```bash
  pnpm check
  ```
- [ ] Test workflow storage
  ```bash
  pnpm test tests/storage.test.ts
  ```
- [ ] Manual verification: Run workflow
- [ ] Commit if successful
  ```bash
  git add server/storage.ts
  git commit -m "fix: correct workflow insert schema"
  ```

### Circuit Breaker Fix (Error 49)

- [ ] Apply fix to server/utils/circuitBreaker.ts
- [ ] Type check
  ```bash
  pnpm check
  ```
- [ ] Test circuit breaker behavior
  ```bash
  # Create test script to trigger circuit breaker
  tsx scripts/test-circuit-breaker.ts
  ```
- [ ] Commit if successful
  ```bash
  git add server/utils/circuitBreaker.ts
  git commit -m "fix: create custom CircuitBreakerError class"
  ```

### Workflow Configuration Fixes (Errors 50-55)

- [ ] Fix bonfire-auth-workflow.ts
  - [ ] Type check
  - [ ] Test workflow import
  - [ ] Commit

- [ ] Fix master-orchestration-workflow.ts
  - [ ] Type check
  - [ ] Test workflow import
  - [ ] Commit

### Git Checkpoint
- [ ] Create Phase 3 checkpoint
  ```bash
  git checkout -b checkpoint-phase-3-complete
  ```

---

## Phase 4: Critical Fixes ⚫

### ⚠️ EXPERT REVIEW REQUIRED ⚠️

- [ ] Review Mastra documentation
- [ ] Consult with Mastra expert (if available)
- [ ] Create comprehensive test plan

### Page Extract Tool Fix (Error 56)

- [ ] Document current behavior
- [ ] Apply minimal fix
- [ ] Type check
  ```bash
  pnpm check
  ```
- [ ] Test page extraction
  ```bash
  # Create test script
  tsx scripts/test-page-extract.ts
  ```
- [ ] Manual verification with real data
- [ ] Commit only if fully verified
  ```bash
  git add src/mastra/tools/page-extract-tool.ts
  git commit -m "fix: resolve Zod schema type mismatch in page-extract-tool"
  ```

### RFP Discovery Workflow Fix (Error 57)

- [ ] Document current workflow steps
- [ ] Apply minimal fix to each type error
- [ ] Type check after each change
  ```bash
  pnpm check
  ```
- [ ] Test workflow execution
  ```bash
  pnpm test tests/integration/rfp-scraping.test.ts
  ```
- [ ] Manual end-to-end workflow test
- [ ] Commit only if fully verified
  ```bash
  git add src/mastra/workflows/rfp-discovery-workflow.ts
  git commit -m "fix: resolve type mismatches in RFP discovery workflow"
  ```

### Git Checkpoint
- [ ] Create Phase 4 checkpoint
  ```bash
  git checkout -b checkpoint-phase-4-complete
  ```

---

## Final Verification

### Automated Checks

- [ ] Zero TypeScript errors
  ```bash
  pnpm check
  # Expected: 0 errors
  ```

- [ ] Minimal lint warnings
  ```bash
  pnpm run lint
  # Expected: <10 warnings
  ```

- [ ] Build succeeds
  ```bash
  pnpm build
  # Expected: SUCCESS
  ```

- [ ] All tests pass
  ```bash
  pnpm test
  # Expected: All tests passing
  ```

- [ ] Check bundle size
  ```bash
  ls -lh dist/index.js
  # Expected: ~816kb (±10%)
  ```

### Manual Verification

- [ ] Backend starts cleanly
  ```bash
  pnpm dev:backend
  # Check for errors in startup logs
  ```

- [ ] Frontend starts cleanly
  ```bash
  pnpm dev:frontend
  # Check browser console
  ```

- [ ] Database connection works
  ```bash
  # Check backend logs for connection success
  ```

- [ ] Critical API endpoints respond
  ```bash
  curl http://localhost:3000/api/health
  curl http://localhost:3000/api/rfps
  curl http://localhost:3000/api/portals
  ```

- [ ] Frontend pages render
  - [ ] Dashboard (/)
  - [ ] RFPs (/rfps)
  - [ ] Proposals (/proposals)
  - [ ] Settings (/settings)

- [ ] No console errors in browser
- [ ] No runtime errors in server logs

### Critical Path Testing

- [ ] Database operations work
  - [ ] SELECT queries
  - [ ] INSERT operations
  - [ ] UPDATE operations

- [ ] Authentication flow
  - [ ] Login
  - [ ] Session management

- [ ] Rate limiting enforced
  - [ ] Test with rapid requests

- [ ] Workflows execute
  - [ ] RFP discovery
  - [ ] Proposal generation

---

## Rollback Procedures

### If Type Check Fails

```bash
# Identify problematic commit
git log --oneline -10

# Rollback specific file
git checkout HEAD~1 -- path/to/file.ts

# Or rollback last commit
git reset --soft HEAD~1

# Re-run verification
pnpm check
```

### If Build Fails

```bash
# Stash current changes
git stash

# Verify build works
pnpm build  # Should succeed

# Review stashed changes
git stash show -p

# Apply more carefully
git stash pop
# Fix issues
```

### If Tests Fail

```bash
# Identify failing test
pnpm test  # Note which test fails

# Rollback related changes
git log --oneline -- path/to/failing/test/related/file.ts
git checkout COMMIT_HASH -- path/to/file.ts

# Re-run test
pnpm test tests/specific-test.test.ts
```

### If Critical Path Breaks

```bash
# Immediate rollback to last checkpoint
git checkout checkpoint-phase-X-complete

# Create fix branch
git checkout -b fix-attempt-2

# Try more conservative approach
```

---

## Success Criteria

### Must Pass ✅
- [ ] `pnpm check` → 0 errors
- [ ] `pnpm build` → SUCCESS
- [ ] `pnpm test` → All tests pass
- [ ] Database connection works
- [ ] Dev servers start

### Should Pass ✅
- [ ] <10 ESLint warnings
- [ ] No console errors
- [ ] All API endpoints respond
- [ ] Frontend pages render

### Nice to Have ✅
- [ ] 0 ESLint warnings
- [ ] Improved type coverage
- [ ] Better code documentation

---

## Final Steps

- [ ] Create final checkpoint
  ```bash
  git checkout -b checkpoint-all-fixes-complete
  ```

- [ ] Create summary report
  - [ ] Total errors fixed
  - [ ] Remaining warnings
  - [ ] Test results
  - [ ] Known issues

- [ ] Update documentation
  - [ ] LINTING_FIXES_REPORT.md
  - [ ] Any changed interfaces/APIs

- [ ] Prepare for code review
  - [ ] Clean commit history
  - [ ] Add descriptive commit messages
  - [ ] Document breaking changes (if any)

- [ ] Merge to main (if all checks pass)
  ```bash
  git checkout main
  git merge checkpoint-all-fixes-complete
  git push origin main
  ```

---

## Emergency Contacts

**If you encounter issues:**

1. **Build failures**: Review build output, check imports
2. **Type errors persist**: Consult TypeScript docs, review error message carefully
3. **Mastra framework issues**: Check Mastra documentation, consider skipping critical fixes
4. **Database issues**: Rollback database changes immediately
5. **Production concerns**: Do NOT deploy until fully verified

---

## Quick Command Reference

```bash
# Verification commands
pnpm check                    # Type checking
pnpm run lint                 # Linting
pnpm build                    # Build
pnpm test                     # Run tests
pnpm dev                      # Start dev servers

# Checkpoint commands
git checkout -b checkpoint-NAME
git add -A && git commit -m "checkpoint: NAME"

# Rollback commands
git checkout checkpoint-NAME
git reset --soft HEAD~1
git checkout HEAD~1 -- FILE

# Testing commands
pnpm test tests/FILE.test.ts
pnpm dev:backend
pnpm dev:frontend
curl http://localhost:3000/api/ENDPOINT
```

---

**Status**: Ready for fixes to be applied
**Next**: Begin Phase 1 low-risk fixes
