# Mastra Cloud Playwright Bundling Fix

## Problem Summary

Mastra Cloud build was failing during the "Analyzing dependencies" phase with:
```
Failed to analyze Mastra application:
node_modules/.pnpm/playwright-core@1.56.0/.../utilsBundleImpl/index.js (17:7):
"default" is not exported by "node:events?commonjs-external"
```

## Root Cause Discovery

**Initial Assumption:** We thought we were directly using Playwright when we have Browserbase/Stagehand.

**Reality:**
- **Stagehand REQUIRES Playwright** as its core dependency
- From Stagehand docs: "This project heavily relies on Playwright as a resilient backbone to automate the web"
- Dependency chain: `@browserbasehq/stagehand@2.5.2 → playwright@1.56.0 → playwright-core@1.56.0`

**Why We Use Stagehand:**
- Provides AI-powered browser automation via Browserbase cloud
- Used in production code:
  - [server/services/scrapers/philadelphiaDocumentDownloader.ts](../server/services/scrapers/philadelphiaDocumentDownloader.ts) - RFP document downloads
  - [server/services/core/stagehandTools.ts](../server/services/core/stagehandTools.ts) - Browser automation tools
- Cannot be replaced without major refactoring

## Why Mastra's Bundler Fails

Mastra Cloud's bundler analyzes **installed dependencies** (not just bundled code) to optimize deployment. When it encounters playwright-core:

1. Playwright uses Node.js built-in modules (`node:events`, `node:assert`)
2. The bundler tries to analyze these with CommonJS/ESM interop
3. Node.js built-in modules don't export as CommonJS modules
4. Bundler fails with "default is not exported" error

## Solution: Mastra Bundler Configuration

Added `bundler.externals` configuration to [src/mastra/index.ts:68-77](../src/mastra/index.ts#L68-L77):

```typescript
export const mastra = new Mastra({
  // ... agents and workflows ...

  // Bundler Configuration - Mark browser automation tools as external
  bundler: {
    externals: [
      'playwright',
      'playwright-core',
      '@playwright/test',
      '@browserbasehq/stagehand',
      'puppeteer',          // Also used in production
      'puppeteer-core',
    ],
  },
});
```

This tells Mastra's bundler:
- ✅ Do NOT analyze these packages
- ✅ Treat them as runtime-only dependencies
- ✅ Skip CommonJS/ESM interop for Node.js built-ins

## What We Tried (That Didn't Work)

### ❌ Attempt 1: vite.config.ts external declarations
- **Why it failed:** Vite only bundles frontend code
- Mastra analyzes backend dependencies separately
- Commit: 9d6e12e (reverted in 8ab8335)

### ❌ Attempt 2: Downgrading cheerio to remove undici
- **Why it helped:** Fixed undici issue
- **Why insufficient:** Didn't fix playwright issue
- Commit: 395a0f8

## Build Process Flow

```
1. Local Build (npm run build)
   ├─ Vite builds frontend → dist/public/
   └─ esbuild builds backend → dist/index.js
      └─ Uses --packages=external (all node_modules external)

2. Mastra Cloud Deployment
   ├─ Runs build command ✅
   ├─ Analyzes dependencies ❌ (playwright-core fails here)
   ├─ Optimizes dependencies
   └─ Deploys application
```

## Key Learnings

1. **Stagehand is not optional** - It's our browser automation tool
2. **Playwright is not optional** - Required by Stagehand
3. **Mastra analyzes node_modules** - Not just bundled code
4. **Browser automation tools should be external** - They're runtime tools with Node.js APIs

## Files Modified

1. [src/mastra/index.ts](../src/mastra/index.ts) - Added `bundler.externals` config
2. [vite.config.ts](../vite.config.ts) - Reverted unnecessary frontend-only changes

## Testing

### Local Build
```bash
npm run build
# ✅ Succeeded - builds to dist/
```

### Mastra Cloud Deployment
- Commit: 8ab8335
- Pushed: 2025-10-17
- Status: ⏳ Awaiting deployment result
- Expected: "Analyzing dependencies" phase should skip playwright packages

## If This Fix Doesn't Work

### Option 1: Contact Mastra Support
See [docs/mastra-cloud-next-steps.md](./mastra-cloud-next-steps.md) for support template.

### Option 2: Replace Stagehand
**NOT RECOMMENDED** - Would require:
- Rewriting philadelphiaDocumentDownloader.ts
- Rewriting stagehandTools.ts
- Finding alternative AI-powered browser automation
- Losing Browserbase cloud integration
- Estimated effort: 2-3 days

## Success Criteria

✅ Mastra Cloud build passes "Analyzing dependencies" phase
✅ Mastra Cloud build passes "Optimizing dependencies" phase
✅ Application deploys successfully
✅ Stagehand/Playwright tools work at runtime
✅ Document downloads work for Philadelphia portal

## Related Documentation

- [Mastra Cloud Build Fix](./mastra-cloud-build-fix.md) - Previous fixes
- [Next Steps](./mastra-cloud-next-steps.md) - Fallback options
- [Stagehand GitHub](https://github.com/browserbase/stagehand) - Why Playwright is required

## Commit History

1. 4103e10 - Fixed google-logging-utils
2. ba62d0b - Attempted undici downgrade
3. 55c9799 - Replaced undici with axios
4. 5878c99 - Updated documentation
5. 395a0f8 - Downgraded cheerio (removed undici)
6. 9d6e12e - Attempted vite.config.ts fix (didn't work)
7. 8ab8335 - Added Mastra bundler.externals for playwright
8. **0d6cee2 - Added document processing packages to externals (current fix)**

## Update: Document Processing Packages

After fixing playwright, Mastra's bundler encountered the same issue with `pdf-parse`:

```
Failed to analyze Mastra application:
"default" is not exported by "pdf-parse/dist/esm/index.js"
```

**Solution:** Added all document processing packages to externals list:
- `pdf-parse` - PDF text extraction (failed in deployment)
- `pdf-lib` - PDF manipulation (preemptive)
- `mammoth` - Word document processing (preemptive)
- `adm-zip` - ZIP file handling (preemptive)

These packages have CommonJS/ESM export issues similar to playwright.
