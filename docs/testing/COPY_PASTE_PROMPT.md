# COPY-PASTE PROMPT FOR NEW CLAUDE CODE SESSION

Copy everything below this line and paste into a new Claude Code session:

---

## Task: Fix Remaining 44 TypeScript Errors

**Context**: RFP automation platform. 30 of 74 TypeScript errors already fixed (41% complete). All 44 remaining errors are in `server/services/workflowCoordinator.ts` and require interface/architecture updates.

**Goal**: Fix all 44 TypeScript errors by updating service interfaces, type definitions, and method calls.

## Quick Start

1. Read the detailed guide: `docs/testing/REMAINING_TYPE_ERRORS_PROMPT.md`
2. Run `pnpm type-check 2>&1 | grep "workflowCoordinator.ts" | head -20` to see current errors
3. Follow the 7-step approach below

## 7-Step Fix Plan

### Step 1: Audit Service Interfaces (30 min)
Check these files for actual method signatures and interfaces:
- `server/services/enhancedProposalService.ts`
- `server/services/documentIntelligenceService.ts`
- `server/services/agentMemoryService.ts`

Find out:
- Do `generateComprehensiveProposal` and `performMarketResearch` exist?
- Does `getProcessingStrategies` exist?
- What properties does `LearningOutcome` interface have?
- What properties does `QualityEvaluation` have?

### Step 2: Create Type Definitions (30 min)
Add to `server/services/workflowCoordinator.ts`:

```typescript
import type { WorkItem, Proposal } from '@shared/schema';

interface ProposalGenerationInputs {
  rfpId: string;
  companyProfileId: string;
  outline?: any;
  content?: any;
  pricing?: any;
  compliance?: any;
  forms?: any;
  pipelineId: string;
}

interface WorkItemMetadata {
  [key: string]: any;
  pipelineId?: string;
}
```

### Step 3: Fix Missing Service Methods (20 min)
Fix 3 errors at lines 814, 1094, 2386:
- Replace method calls with correct names from audit OR
- Add stub methods to services if they don't exist

### Step 4: Fix LearningOutcome Interface (30 min)
Fix 4 errors at lines 2185, 2236, 2288, 2354:
- Update `LearningOutcome` interface to make missing properties optional OR
- Add missing properties (`agentId`, `confidenceScore`, `domain`, `category`) to all calls

### Step 5: Fix QualityEvaluation Access (20 min)
Fix 6 errors at lines 2325, 2326, 2327, 2333, 2334, 2335:
- Update `QualityEvaluation` interface with missing properties OR
- Use correct property access pattern

### Step 6: Fix Metadata/Unknown Types (45 min)
Fix 29 errors with type assertions:

```typescript
// Use the interfaces from Step 2
const inputs = workItem.inputs as ProposalGenerationInputs;
const metadata = workItem.metadata as WorkItemMetadata;
```

### Step 7: Verify (15 min)
```bash
pnpm type-check  # Should show 0 errors
pnpm lint        # Should still pass
```

## Error Categories Summary

**Category 1**: Missing service methods (3 errors)
- Lines 814, 1094, 2386

**Category 2**: LearningOutcome type mismatches (4 errors)
- Lines 2185, 2236, 2288, 2354
- Missing: `agentId`, `confidenceScore`, `domain`, `category`

**Category 3**: QualityEvaluation properties (6 errors)
- Lines 2325, 2326, 2327, 2333, 2334, 2335
- Missing: `qualityScore`, `complianceScore`, `competitiveScore`, `winProbability`, `efficiency`

**Category 4**: Type interface issues (2 errors)
- Line 2306: `outcome` not in ProposalOutcome
- Line 2432: `consolidatedMemories` not in MemoryConsolidation

**Category 5**: Metadata/unknown types (29 errors)
- Lines 2758, 2858, 2861, 2987, 2990, 3027, 3030: metadata unknown
- Lines 3067-3073, 3153-3160: property access on unknown
- Lines 3322, 3327: Proposal type issues

## Success Criteria
- [ ] All 44 errors fixed
- [ ] `pnpm type-check` returns 0 errors
- [ ] `pnpm lint` still passes
- [ ] Commit with message: "fix: resolve remaining 44 TypeScript errors in workflowCoordinator"

## Key Instructions

1. **Start with Step 1** - Audit before changing anything
2. **Use TodoWrite** - Track progress through steps
3. **Test after each category** - Run `pnpm type-check 2>&1 | grep "error TS" | wc -l`
4. **Be methodical** - Fix one category completely before moving to next
5. **Make the missing properties optional** - Safest approach for LearningOutcome/QualityEvaluation
6. **Don't remove code** - Fix types to match existing intent
7. **Read the full guide** in `docs/testing/REMAINING_TYPE_ERRORS_PROMPT.md` for detailed context

## Quick Commands

```bash
# Count remaining errors
pnpm type-check 2>&1 | grep "error TS" | wc -l

# See workflowCoordinator errors only
pnpm type-check 2>&1 | grep "workflowCoordinator.ts" | head -30

# Verify lint passes
pnpm lint

# Check specific line numbers
pnpm type-check 2>&1 | grep "workflowCoordinator.ts" | grep -E "(814|1094|2185|2236)"
```

## Expected Time: ~3 hours

Good luck! Once complete, the CI pipeline will fully pass! 🚀
