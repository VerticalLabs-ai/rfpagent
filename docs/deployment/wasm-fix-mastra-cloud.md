# WASM File Fix for Mastra Cloud Deployment

**Issue**: Mastra Cloud build fails with:

```
Error: ENOENT: no such file or directory, open '/data/project/.mastra/output/core_bg.wasm'
```

## Root Cause

The `@1password/sdk` package requires a WASM file (`core_bg.wasm`) at runtime. The file is located in `public/core_bg.wasm`, but Mastra Cloud's build process doesn't properly copy it to the `.mastra/output/` directory where the bundled application runs.

## Mastra Cloud Build Process

Mastra Cloud follows this build sequence:

1. `pnpm install` - Install dependencies
2. `pnpm run build` - Run your build command (vite + esbuild + postbuild)
3. **Mastra bundler** - Bundle Mastra application → creates `.mastra/output/`
4. **Copy public/** - Copies `public/` folder to `.mastra/output/`
5. **Install deps** - Installs runtime dependencies in `.mastra/output/`
6. **Start server** - Runs `node .mastra/output/index.mjs`

## Solution

We've implemented a multi-layered approach:

### 1. ✅ Postbuild Script (copy-wasm-to-root.js)

Runs after `vite build` to copy WASM to multiple locations:

```javascript
// Copies to:
- /core_bg.wasm                   (project root)
- /src/mastra/core_bg.wasm        (mastra source)
- /.mastra/output/core_bg.wasm    (if directory exists)
```

**File**: `scripts/copy-wasm-to-root.js`

### 2. ✅ Post-Mastra-Build Hook (post-mastra-build.js)

Runs after `mastra build` to ensure WASM is in output:

```javascript
// Checks multiple sources:
- /public/core_bg.wasm
- /core_bg.wasm
- /src/mastra/core_bg.wasm

// Copies to:
- /.mastra/output/core_bg.wasm
```

**File**: `scripts/post-mastra-build.js`

### 3. ✅ Package.json Hooks

```json
{
  "scripts": {
    "postbuild": "node scripts/copy-wasm-to-root.js",
    "mastra:build": "mastra build && node scripts/post-mastra-build.js",
    "mastra:postbuild": "node scripts/post-mastra-build.js"
  }
}
```

## Verification

### Local Build Test:

```bash
# Clean build
rm -rf .mastra dist

# Run build
npm run build

# Run Mastra build
npm run mastra:build

# Verify WASM is in output
ls -lh .mastra/output/core_bg.wasm
# Expected: ~8.9 MB file

# Test the build
node .mastra/output/index.mjs
```

### Mastra Cloud Test:

After pushing these changes, Mastra Cloud should:

1. Run `pnpm run build` → triggers `postbuild` script
2. Run Mastra bundler → creates `.mastra/output/`
3. Copy `public/` → `.mastra/output/`
4. WASM file should be available at runtime

## Why This Approach

1. **Multiple Fallbacks**: If one copy mechanism fails, others will catch it
2. **Mastra Cloud Compatible**: Works with Mastra's build process
3. **Local Development**: Also works for local `mastra build`
4. **Non-Breaking**: Doesn't modify core Mastra configuration

## What Changed

### New Files:

- `scripts/post-mastra-build.js` - Post-build WASM copy hook

### Modified Files:

- `scripts/copy-wasm-to-root.js` - Now copies to 3 locations including `.mastra/output/`
- `scripts/copy-wasm.js` - More robust error handling
- `package.json` - Added `mastra:postbuild` script

## Monitoring

After deployment, check Mastra Cloud logs for:

```
✅ Copying core_bg.wasm for Mastra Cloud...
   Source: /data/project/public/core_bg.wasm (8.90 MB)
   ✓ Copied to: /data/project/core_bg.wasm
   ✓ Copied to: /data/project/src/mastra/core_bg.wasm
   ✓ Copied to: /data/project/.mastra/output/core_bg.wasm
```

Or:

```
🔧 Post-Mastra-Build: Ensuring WASM file is in correct location...
✅ Found WASM source: /data/project/public/core_bg.wasm
✅ Copied WASM to .mastra/output/ (8.90 MB)
```

## Alternative Solution (If Above Doesn't Work)

If Mastra Cloud still can't find the WASM file, we can:

1. **Move WASM to node_modules**: Copy to `@1password/sdk` package location
2. **Bundle inline**: Base64 encode and include in bundle (not recommended - 8.9MB)
3. **External CDN**: Host WASM on CDN and load at runtime
4. **Remove @1password/sdk**: If not critical, remove the dependency

## Testing Checklist

- [ ] `npm run build` completes successfully
- [ ] `npm run mastra:build` completes successfully
- [ ] `ls .mastra/output/core_bg.wasm` shows 8.9MB file
- [ ] `node .mastra/output/index.mjs` starts without WASM errors
- [ ] Mastra Cloud deployment succeeds
- [ ] Mastra Cloud application starts without errors

## Related Files

- `scripts/copy-wasm-to-root.js` - Postbuild WASM copy
- `scripts/copy-wasm.js` - Legacy WASM copy (still used)
- `scripts/post-mastra-build.js` - Post-Mastra-build hook
- `package.json` - Build scripts configuration
- `public/core_bg.wasm` - Source WASM file (8.9 MB)

## Deployment

```bash
# Commit all changes
git add .
git commit -m "fix: ensure WASM file is copied to Mastra output directory

- Add post-mastra-build hook for WASM copy
- Update copy-wasm-to-root to include .mastra/output
- Add fallback mechanisms for WASM file location
- Fix Mastra Cloud ENOENT error for core_bg.wasm"

# Push to trigger Mastra Cloud deployment
git push origin main
```

## Expected Result

Mastra Cloud build should complete successfully with:

- ✅ Build completes
- ✅ Readiness probe succeeds
- ✅ Application starts
- ✅ No WASM file errors

---

**Status**: Ready for deployment
**Last Updated**: October 24, 2025
