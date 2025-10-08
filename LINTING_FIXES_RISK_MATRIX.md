# Linting Fixes Risk Assessment Matrix

**Purpose**: Categorize all 57 TypeScript errors by fix complexity and risk level

---

## Risk Level Definitions

- 🟢 **LOW**: Simple import/declaration fixes, unlikely to cause issues
- 🟡 **MEDIUM**: Type changes, may require testing specific functionality
- 🔴 **HIGH**: Core infrastructure changes, requires extensive testing
- ⚫ **CRITICAL**: Database/security changes, requires manual verification

---

## Error Categorization

### 🟢 LOW RISK (25 errors) - Safe to batch fix

#### Missing Imports

1. **client/src/components/shared/AdvancedFilters.tsx:387**
   - Error: `Cannot find name 'useEffect'`
   - Fix: Add `import { useEffect } from 'react';`
   - Impact: None (obvious import omission)
   - Test: Component renders

2. **client/src/components/NotificationToast.tsx:10**
   - Error: `'React' is not defined`
   - Fix: Add `import React from 'react';`
   - Impact: None
   - Test: Component renders

3. **client/src/components/ScanHistory.tsx:110**
   - Error: `'React' is not defined`
   - Fix: Add `import React from 'react';`
   - Impact: None
   - Test: Component renders

#### Global Type Definitions

4-11. **Multiple files (NotificationToast, ProposalGenerationProgress, RFPProcessingProgress)**

- Errors: `'setTimeout' is not defined`, `'clearTimeout' is not defined`, `'setInterval' is not defined`, `'NodeJS' is not defined`
- Fix: Add type definitions at top of file:

  ```typescript
  /// <reference lib="dom" />
  // Or add to tsconfig.json
  ```

- Impact: None (type-only)
- Test: Component renders

#### Variable Hoisting

12. **client/src/components/shared/BulkOperations.tsx:84**

- Error: `Block-scoped variable 'executeAction' used before its declaration`
- Fix: Move declaration before usage
- Impact: Low (code reordering)
- Test: Bulk operations work

#### React Unescaped Entities

13. **client/src/components/Sidebar.tsx:80**

- Error: `can be escaped with &apos;`
- Fix: Replace `'` with `&apos;` or `&rsquo;`
- Impact: None (cosmetic)
- Test: Visual check

#### Unused Variables (14-25)

**Files**: ActiveRFPsTable, ActivityFeed, Header, ProposalGenerationProgress, RFPProcessingProgress, ScanProgress, SubmissionMaterialsDialog

- Error: `'variable' is assigned/defined but never used`
- Fix: Either use the variable or prefix with `_` (e.g., `_unused`)
- Impact: None (dead code cleanup)
- Test: Component still works

---

### 🟡 MEDIUM RISK (20 errors) - Fix and verify individually

#### Missing Type Exports

26. **server/repositories/AnalyticsRepository.ts:11**

- Error: `Module '"@shared/schema"' has no exported member 'DashboardMetrics'`
- Fix: Either:
  - Export `DashboardMetrics` from schema, OR
  - Create type inline, OR
  - Import from correct location
- Impact: Medium (type definition may need creation)
- Test: Analytics API endpoint works

#### Implicit Any Types

27-35. **server/routes/safla-monitoring.ts, server/services/mlModelIntegration.ts, server/services/rfpScrapingService.ts**

- Error: `Parameter 'x' implicitly has an 'any' type`
- Fix: Add explicit type annotations
- Impact: Medium (may reveal other type issues)
- Test: API endpoints work, services execute correctly

#### Type Narrowing Issues

36. **server/services/mlModelIntegration.ts:140**

- Error: `Argument of type 'K | undefined' is not assignable to parameter of type 'K'`
- Fix: Add null check: `if (key !== undefined) { ... }`
- Impact: Medium (logic change, may affect behavior)
- Test: ML model integration works

37-38. **server/services/mlModelIntegration.ts:355**

- Error: `Property 'filter' does not exist on type`
- Fix: Fix type definition or add type assertion
- Impact: Medium (type system understanding)
- Test: RFP filtering works

#### Missing Schema Properties

39-42. **server/services/rfpScrapingService.ts:139-140, 319-320**

- Error: `Property 'rfps' does not exist on type '{}'`
- Fix: Import proper schema types
- Impact: Medium (schema import)
- Test: RFP scraping service works

#### Property Existence

43. **src/mastra/workflows/rfp-discovery-workflow.ts:155**

- Error: `Property 'getPortalsByStatus' does not exist on type 'DatabaseStorage'`
- Fix: Either:
  - Implement method in DatabaseStorage, OR
  - Use existing method like `getRFPsByStatus`
- Impact: Medium (may require implementation)
- Test: RFP discovery workflow executes

#### Date Comparison

44. **src/mastra/workflows/rfp-discovery-workflow.ts:328**

- Error: `This comparison appears to be unintentional because the types 'Date | null' and 'string' have no overlap`
- Fix: Convert date to string or vice versa
- Impact: Medium (logic correctness)
- Test: RFP discovery date filtering works

#### Property Name Mismatch

45. **src/mastra/workflows/rfp-discovery-workflow.ts:319**

- Error: `'aiAnalysis' does not exist in type`. Meant 'analysis'?
- Fix: Rename `aiAnalysis` to `analysis`
- Impact: Medium (property naming)
- Test: RFP analysis data saved correctly

---

### 🔴 HIGH RISK (10 errors) - Fix with extreme caution

#### Database Configuration

46. **server/db.ts:78**

- Error: Pool type mismatch in drizzle initialization
- Fix: Adjust drizzle initialization:

  ```typescript
  // Before
  export const db = drizzle(pool, { schema });

  // After (likely)
  export const db = drizzle(pool as any, { schema });
  // OR fix Pool import/type
  ```

- Impact: HIGH - Database connection affects entire app
- Test: Database connection test, all DB operations

#### Rate Limiting Middleware

47. **server/routes/middleware/rateLimiting.ts:91,94**

- Error: `Property 'rateLimit' does not exist on type 'Request'`
- Fix: Extend Request type:

  ```typescript
  declare module 'express' {
    interface Request {
      rateLimit?: {
        limit: number;
        current: number;
        remaining: number;
      };
    }
  }
  ```

- Impact: HIGH - Affects rate limiting security
- Test: Rate limiting works, API throttling enforced

#### Workflow Storage Schema

48. **server/storage.ts:1688**

- Error: Schema mismatch in workflow insert - `workflowId` doesn't exist
- Fix: Remove `workflowId` from insert object or add to schema
- Impact: HIGH - Workflow state persistence
- Test: Workflow execution and resume

#### Circuit Breaker Error Handling

49. **server/utils/circuitBreaker.ts:136**

- Error: `'service' does not exist in type 'Error'`
- Fix: Create custom error class:

  ```typescript
  class CircuitBreakerError extends Error {
    service: string;
    constructor(message: string, service: string) {
      super(message);
      this.service = service;
    }
  }
  ```

- Impact: HIGH - Error handling affects reliability
- Test: Circuit breaker trip/reset behavior

#### Mastra Workflow Context

50-51. **src/mastra/workflows/bonfire-auth-workflow.ts:1,22**

- Error: Missing `WorkflowContext` export, `execute` doesn't exist
- Fix: Update Mastra imports or workflow structure
- Impact: HIGH - Core workflow functionality
- Test: Bonfire auth workflow executes

52. **src/mastra/workflows/master-orchestration-workflow.ts:32**

- Error: `'execute' does not exist in type 'WorkflowConfig'`
- Fix: Update workflow definition structure
- Impact: HIGH - Master orchestration broken
- Test: Master workflow orchestration

#### Workflow Context Properties

53-55. **src/mastra/workflows/master-orchestration-workflow.ts:118,164,218,247,293**

- Error: Properties don't exist on workflow context (portalId, portalIds, rfpId, metadata)
- Fix: Define proper context type or use different approach
- Impact: HIGH - Workflow data passing
- Test: Workflow step data passing, context preservation

---

### ⚫ CRITICAL RISK (2 errors) - Requires manual review

#### Mastra Tool Execution

56. **src/mastra/tools/page-extract-tool.ts:68**

- Error: Complex Zod schema type mismatch
- Fix: Adjust Zod schema definition to match expected types
- Impact: CRITICAL - Page extraction tool (core functionality)
- Test: Page extraction works, schema validation works
- **Requires**: Mastra framework expert review

#### Workflow Step Type Mismatch

57. **src/mastra/workflows/rfp-discovery-workflow.ts:178,199,216,380,382,418**

- Error: Complex type mismatches in workflow steps
- Fix: Multiple issues:
  - Step input/output schema mismatches
  - Tool execution context incorrect
  - Missing properties in execution params
- Impact: CRITICAL - RFP discovery workflow (core feature)
- Test: Full RFP discovery workflow execution
- **Requires**: Mastra framework expert review

---

## Fix Priority Order

### Phase 1: Low Risk Batch Fix (Safe to do together)

1. All missing imports (errors 1-3)
2. All global type definitions (errors 4-11)
3. Variable hoisting (error 12)
4. React entities (error 13)
5. Unused variables (errors 14-25)

**Verification**:

```bash
pnpm check  # Should reduce errors by ~25
pnpm build  # Should still succeed
```

---

### Phase 2: Medium Risk Individual Fixes

Fix one at a time, verify after each:

1. DashboardMetrics export (error 26)
   - Fix → `pnpm check` → `pnpm test tests/companyProfileAnalytics.test.ts`

2. Implicit any types (errors 27-35)
   - Fix → `pnpm check` → Test relevant service

3. Type narrowing (errors 36-38)
   - Fix → `pnpm check` → `pnpm test tests/mlModelIntegration.test.ts`

4. Schema properties (errors 39-42)
   - Fix → `pnpm check` → `pnpm test tests/integration/rfp-scraping.test.ts`

5. Workflow property fixes (errors 43-45)
   - Fix → `pnpm check` → Test workflow execution

**Verification after each**:

```bash
pnpm check
pnpm run lint
pnpm test  # Relevant test file
```

---

### Phase 3: High Risk Controlled Fixes

Fix one at a time with full test suite:

1. **Database configuration** (error 46)
   - Create git checkpoint
   - Fix
   - Run database connection test
   - Run full test suite
   - Manual verification

2. **Rate limiting** (error 47)
   - Create git checkpoint
   - Fix
   - Test API endpoints with rate limiting
   - Manual verification with curl

3. **Workflow storage** (error 48)
   - Create git checkpoint
   - Fix
   - Test workflow execution
   - Verify workflow resume works

4. **Circuit breaker** (error 49)
   - Create git checkpoint
   - Fix
   - Test error scenarios
   - Verify circuit opens/closes

5. **Mastra workflow configs** (errors 50-55)
   - Create git checkpoint per file
   - Fix each workflow separately
   - Test workflow execution
   - Verify all steps execute

**Verification after each**:

```bash
git checkout -b checkpoint-before-fix-XX
# Apply fix
pnpm check
pnpm build
pnpm test
pnpm dev  # Manual testing
```

---

### Phase 4: Critical Risk - Expert Review Required

**DO NOT FIX WITHOUT**:

1. Mastra framework documentation review
2. Expert consultation (if available)
3. Comprehensive test plan
4. Rollback plan

5. **Page extract tool** (error 56)
   - Research Mastra Zod schema requirements
   - Test with sample data
   - Verify schema validation works

6. **RFP discovery workflow** (error 57)
   - Research Mastra workflow step API
   - Review tool execution context requirements
   - Create minimal reproduction
   - Test incrementally

**Verification**:

- Full test suite
- Integration tests
- Manual workflow execution
- Production simulation

---

## Testing Matrix

| Error # | Risk    | Fix Type         | Test Method      | Test File                       |
| ------- | ------- | ---------------- | ---------------- | ------------------------------- |
| 1-25    | 🟢 LOW  | Import/syntax    | Component render | Manual browser test             |
| 26      | 🟡 MED  | Type export      | Unit test        | companyProfileAnalytics.test.ts |
| 27-35   | 🟡 MED  | Type annotation  | Unit test        | Per service test                |
| 36-38   | 🟡 MED  | Type narrowing   | Unit test        | mlModelIntegration.test.ts      |
| 39-42   | 🟡 MED  | Schema import    | Integration test | rfp-scraping.test.ts            |
| 43-45   | 🟡 MED  | Property fix     | Integration test | Manual workflow test            |
| 46      | 🔴 HIGH | DB config        | Connection test  | Manual DB test                  |
| 47      | 🔴 HIGH | Middleware type  | API test         | Manual curl test                |
| 48      | 🔴 HIGH | Schema fix       | Workflow test    | Manual workflow test            |
| 49      | 🔴 HIGH | Error class      | Unit test        | Manual error scenario           |
| 50-55   | 🔴 HIGH | Workflow config  | Integration test | Manual workflow execution       |
| 56-57   | ⚫ CRIT | Mastra framework | Full integration | Expert review required          |

---

## Rollback Points

Create git checkpoint before:

1. Starting Phase 2 (medium risk)
2. Each Phase 3 fix (high risk)
3. Each Phase 4 fix (critical risk)

```bash
# Checkpoint naming convention
git checkout -b checkpoint-phase-1-complete
git checkout -b checkpoint-before-db-fix
git checkout -b checkpoint-before-workflow-fix-bonfire
git checkout -b checkpoint-before-critical-mastra-fixes
```

---

## Emergency Stop Conditions

**STOP ALL FIXES IF**:

1. Any fix causes build to fail
2. Database connection breaks
3. Test suite shows >3 new failures
4. Development server won't start
5. Any critical path breaks

**Recovery**:

```bash
git checkout checkpoint-last-working
# Re-evaluate approach
```

---

## Success Metrics by Phase

### Phase 1 (Low Risk)

- ✅ 25 errors resolved
- ✅ Build still succeeds
- ✅ No new test failures

### Phase 2 (Medium Risk)

- ✅ 20 errors resolved
- ✅ All tests pass
- ✅ Services function correctly

### Phase 3 (High Risk)

- ✅ 10 errors resolved
- ✅ Database works
- ✅ Workflows execute
- ✅ Rate limiting works

### Phase 4 (Critical)

- ✅ 2 errors resolved
- ✅ Full test suite passes
- ✅ Integration tests pass
- ✅ Manual verification complete

### Overall Success

- ✅ 0 TypeScript errors
- ✅ <10 ESLint warnings
- ✅ 100% existing tests pass
- ✅ All critical paths verified
- ✅ Production-ready code

---

**Recommended Approach**: Fix in phases, verify incrementally, maintain rollback points.
