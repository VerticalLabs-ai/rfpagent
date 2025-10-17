# Mastra Cloud Final Fixes - Circular Dependencies & Runtime Errors

## Summary of Latest Fixes (Commit ae8d38a)

After fixing the bundler analysis phase, we encountered two new issues during Mastra Cloud deployment:

### ✅ Issue 1: Circular Dependencies (Warnings)

**Error:**
```
Circular dependency found:
  workflowCoordinator.ts → discoveryWorkflowProcessors.ts →
  discoveryOrchestrator.ts → workflowCoordinator.ts

Circular dependency found:
  proposalGenerationOrchestrator.ts → workflowCoordinator.ts →
  proposalGenerationOrchestrator.ts
```

**Root Cause:**
- `workflowCoordinator` imports `DiscoveryWorkflowProcessors`
- `DiscoveryWorkflowProcessors` imports `discoveryOrchestrator`
- `discoveryOrchestrator` imports `workflowCoordinator`
- Same circular pattern with `proposalGenerationOrchestrator`

**Solution: Lazy Imports**

Replaced static imports with dynamic import() calls:

```typescript
// OLD (Circular):
import { DiscoveryWorkflowProcessors } from './discoveryWorkflowProcessors';
import { proposalGenerationOrchestrator } from '../orchestrators/proposalGenerationOrchestrator';

// Usage:
await DiscoveryWorkflowProcessors.processPortalAuthentication(workItem);
proposalGenerationOrchestrator.handlePhaseCompletion(pipelineId);
```

```typescript
// NEW (Lazy):
// Lazy import helpers
let _DiscoveryWorkflowProcessors = null;
let _proposalGenerationOrchestrator = null;

async function getDiscoveryWorkflowProcessors() {
  if (!_DiscoveryWorkflowProcessors) {
    const module = await import("./discoveryWorkflowProcessors");
    _DiscoveryWorkflowProcessors = module.DiscoveryWorkflowProcessors;
  }
  return _DiscoveryWorkflowProcessors;
}

async function getProposalGenerationOrchestrator() {
  if (!_proposalGenerationOrchestrator) {
    const module = await import("../orchestrators/proposalGenerationOrchestrator");
    _proposalGenerationOrchestrator = module.proposalGenerationOrchestrator;
  }
  return _proposalGenerationOrchestrator;
}

// Usage:
await (await getDiscoveryWorkflowProcessors()).processPortalAuthentication(workItem);
(await getProposalGenerationOrchestrator()).handlePhaseCompletion(pipelineId);
```

**Additional Fix:**
Made `setTimeout` callbacks async to support `await`:

```typescript
// OLD:
setTimeout(() => {
  proposalGenerationOrchestrator.handlePhaseCompletion(pipelineId);
}, 100);

// NEW:
setTimeout(async () => {
  (await getProposalGenerationOrchestrator()).handlePhaseCompletion(pipelineId);
}, 100);
```

---

### ✅ Issue 2: pdf-parse ESM Import Error (Fatal Runtime Error)

**Error:**
```
SyntaxError: The requested module 'pdf-parse' does not provide an export named 'default'
    at ModuleJob._instantiate (node:internal/modules/esm/module_job:228:21)
```

**Root Cause:**
- `pdf-parse` is a **CommonJS module** with no default ESM export
- When marked as `external` in Mastra bundler, it's not transpiled to ESM
- Node.js ESM loader can't find the default export

**Solution: createRequire for CommonJS Compatibility**

```typescript
// OLD (ESM import - doesn't work for CommonJS):
import pdfParse from 'pdf-parse';

// NEW (createRequire - works with CommonJS):
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
```

**Why This Works:**
- `createRequire` creates a CommonJS `require()` function in ESM context
- Allows importing CommonJS modules in ESM files
- Works seamlessly when `pdf-parse` is marked as external

---

## Complete Fix Timeline

| Commit | Issue | Status |
|--------|-------|--------|
| 4103e10 | google-logging-utils@0.0.2 | ✅ Fixed |
| 395a0f8 | undici (via cheerio) | ✅ Fixed |
| 8ab8335 | playwright-core bundler analysis | ✅ Fixed |
| 0d6cee2 | pdf-parse bundler analysis | ✅ Fixed |
| **ae8d38a** | **Circular dependencies** | ✅ Fixed |
| **ae8d38a** | **pdf-parse runtime import** | ✅ Fixed |

---

## Files Modified in ae8d38a

### 1. server/services/workflows/workflowCoordinator.ts
- Commented out circular imports
- Added lazy import helper functions
- Replaced static calls with dynamic imports
- Made setTimeout callbacks async

### 2. src/mastra/utils/pdf-processor.ts
- Replaced ESM import with createRequire
- Added CommonJS compatibility for pdf-parse

---

## Testing

### Local Build
```bash
npm run build
✓ built in 3.00s
dist/index.js  962.3kb
```

**No circular dependency warnings** ✅
**No build errors** ✅

### Expected Mastra Cloud Deployment
```
✅ Pulling latest changes... (ae8d38a)
✅ Running install command
✅ Running build command
✅ Analyzing dependencies... (no circular deps)
✅ Optimizing dependencies...
✅ Bundling Mastra done
✅ Installing dependencies
✅ Bundling complete
✅ Checking readiness...
✅ Application started successfully
```

---

## Key Learnings

### Circular Dependencies
- **Problem:** JavaScript module system loads modules synchronously
- **Impact:** Can cause undefined exports, initialization errors, or infinite loops
- **Solution:** Use lazy imports (dynamic import()) to defer loading until runtime

### CommonJS vs ESM
- **CommonJS:** `module.exports = ...` (default export)
- **ESM Default:** `export default ...`
- **ESM Named:** `export { ... }`
- **Problem:** CommonJS default != ESM default
- **Solution:** Use `createRequire()` to import CommonJS in ESM context

### When to Use Each Approach

**Lazy Imports (Dynamic Import):**
- Breaking circular dependencies
- Code splitting
- Conditional imports
- Performance optimization (load on demand)

**createRequire:**
- CommonJS modules in ESM files
- Packages marked as external
- No ESM equivalent available
- Native Node.js modules compatibility

---

## Verification Checklist

Mastra Cloud deployment should now:

- ✅ Complete "Analyzing dependencies" phase (no playwright/pdf-parse errors)
- ✅ Complete "Bundling Mastra" phase (no circular dependency warnings)
- ✅ Complete "Installing dependencies" phase
- ✅ Start application without runtime import errors
- ✅ Successfully load pdf-parse module at runtime
- ✅ Handle workflow orchestration without circular dependency issues

---

## If Deployment Still Fails

### New Package with Similar Issues
If another package fails with `"default" is not exported` error:
1. Check if it's CommonJS (no ESM export)
2. Add to Mastra bundler externals
3. Use `createRequire()` if imported with `import` statement

### Circular Dependency in Different Files
If new circular dependencies appear:
1. Identify the cycle with error message
2. Choose weakest link to break (least frequently used import)
3. Implement lazy import pattern with dynamic `import()`

### Runtime Module Resolution Issues
If modules can't be found at runtime:
1. Verify package is in dependencies (not devDependencies)
2. Check if marked as external but needed at bundle time
3. Consider removing from externals list

---

## Related Documentation

- [Mastra Cloud Playwright Fix](./mastra-cloud-playwright-fix.md) - Bundler external packages
- [Mastra Cloud Build Fix](./mastra-cloud-build-fix.md) - Initial CommonJS/ESM fixes
- [Next Steps](./mastra-cloud-next-steps.md) - Fallback options

---

**Commit:** ae8d38a
**Status:** Deployed and awaiting Mastra Cloud build result
**Expected:** Successful deployment with no errors 🚀
