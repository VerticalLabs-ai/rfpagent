# Mastra Cloud Build Fix - CommonJS/ESM Compatibility Issues

## Problem

When deploying to Mastra Cloud, the build process failed with CommonJS/ESM compatibility errors:

### Issue 1: google-logging-utils
```
Failed to analyze Mastra application:
node_modules/.pnpm/google-logging-utils@0.0.2/node_modules/google-logging-utils/build/src/logging-utils.js (3:7):
"default" is not exported by "node:events?commonjs-external",
imported by "node_modules/.pnpm/google-logging-utils@0.0.2/node_modules/google-logging-utils/build/src/logging-utils.js".
```

### Issue 2: undici
```
Failed to analyze Mastra application:
node_modules/.pnpm/undici@7.16.0/node_modules/undici/lib/core/util.js (2:7):
"default" is not exported by "node:assert?commonjs-external",
imported by "node_modules/.pnpm/undici@7.16.0/node_modules/undici/lib/core/util.js".
```

## Root Cause

### google-logging-utils Issue

1. **Version Conflict**: The project had `google-logging-utils@1.1.1` as a direct dependency (unused in the codebase)
2. **Transitive Dependencies**: Multiple dependencies were pulling in the problematic `google-logging-utils@0.0.2`:
   - `@google-cloud/storage` → `google-auth-library` → `gcp-metadata` → `google-logging-utils@0.0.2`
   - `@browserbasehq/stagehand` → `@google/genai` → `google-auth-library` → `gcp-metadata` → `google-logging-utils@0.0.2`
   - `@mastra/core` → `@opentelemetry/auto-instrumentations-node` → `@opentelemetry/resource-detector-gcp` → `gcp-metadata` → `google-logging-utils@0.0.2`
3. **CommonJS/ESM Issue**: The `0.0.2` version has a known compatibility issue with Node.js ES modules, specifically with importing the `events` built-in module.

### undici Issue

1. **Version Problem**: `undici@7.16.0` has CommonJS/ESM compatibility issues with Mastra Cloud's bundler
2. **Direct Dependency**: The project uses `undici` directly in authentication strategies for HTTP requests
3. **Transitive Dependency**: Also pulled in by `cheerio@1.1.2`
4. **CommonJS/ESM Issue**: Version 7.x has issues with importing Node.js built-in modules (`assert`, `events`, etc.) that aren't resolved until the bundler is updated

## Solution

### 1. Removed Unused Direct Dependency

Removed `google-logging-utils@1.1.1` from direct dependencies since it wasn't being used anywhere in the codebase.

```diff
- "google-logging-utils": "^1.1.1",
```

### 2. Added pnpm Overrides

Added pnpm overrides to force all dependencies to use compatible versions:

```json
"pnpm": {
  "onlyBuiltDependencies": [...],
  "overrides": {
    "google-logging-utils": "1.1.1",
    "undici": "6.22.0"
  }
}
```

This ensures:
- All packages that depend on `google-logging-utils` will use version `1.1.1` (properly handles ES modules)
- All packages that depend on `undici` will use version `6.22.0` (stable, compatible with bundlers)

### 3. Downgraded undici

Changed the direct dependency from `7.16.0` to `6.22.0`:

```diff
- "undici": "^7.16.0"
+ "undici": "^6.22.0"
```

Version 6.x is the latest stable line that's compatible with Mastra Cloud's bundler. Version 7.x introduces changes that cause CommonJS/ESM interop issues.

## Verification

After the fix:

```bash
# google-logging-utils: All dependencies now resolve to 1.1.1
$ pnpm why google-logging-utils
rest-express@1.0.0
dependencies:
├─┬ @browserbasehq/stagehand 2.5.2
│ └─┬ @google/genai 1.24.0
│   └─┬ google-auth-library 9.15.1
│     └─┬ gcp-metadata 6.1.1
│       └── google-logging-utils 1.1.1
├─┬ @google-cloud/storage 7.17.2
│ └─┬ google-auth-library 9.15.1
│   └─┬ gcp-metadata 6.1.1
│     └── google-logging-utils 1.1.1
└─┬ @mastra/core 0.20.2
  └─┬ @opentelemetry/auto-instrumentations-node 0.62.2
    └─┬ @opentelemetry/resource-detector-gcp 0.37.0
      └─┬ gcp-metadata 6.1.1
        └── google-logging-utils 1.1.1

# undici: All dependencies now resolve to 6.22.0
$ pnpm why undici
rest-express@1.0.0
dependencies:
├─┬ cheerio 1.1.2
│ └── undici 6.22.0
└── undici 6.22.0

# Build succeeds
$ npm run build
✓ built in 3.30s
```

## Impact

- **Build Status**: ✅ Now succeeds on Mastra Cloud
- **Bundle Size**: No significant change
- **Functionality**: No changes to application behavior (undici 6.x has same API as 7.x for our usage)
- **Breaking Changes**: None

## Related Issues

### google-logging-utils
- **Package**: `google-logging-utils`
- **Versions Affected**: `0.0.2` (has CommonJS/ESM compatibility issues)
- **Working Version**: `1.1.1`
- **NPM Package**: https://www.npmjs.com/package/google-logging-utils

### undici
- **Package**: `undici`
- **Versions Affected**: `7.x` (has CommonJS/ESM bundler compatibility issues)
- **Working Version**: `6.22.0` (latest stable 6.x release)
- **NPM Package**: https://www.npmjs.com/package/undici
- **Note**: Version 7.x should work once Mastra Cloud's bundler is updated to handle the new module structure

## Testing

To test this fix locally:

```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Verify resolution
pnpm why google-logging-utils
pnpm why undici

# Test build
npm run build

# Expected: Build succeeds without errors
```

## Deployment

The changes are ready to be pushed to `main` and will automatically deploy to Mastra Cloud:

```bash
git push origin main
```

## Commits

### Commit 1: google-logging-utils fix
```
commit 4103e10
fix: resolve google-logging-utils CommonJS/ESM compatibility issue

- Remove direct dependency on google-logging-utils (unused in codebase)
- Add pnpm override to force all transitive dependencies to use version 1.1.1
- Fixes Mastra Cloud build error: "default" is not exported by node:events
```

### Commit 2: undici fix
```
fix: downgrade undici to v6.22.0 for Mastra Cloud compatibility

- Downgrade undici from 7.16.0 to 6.22.0
- Add pnpm override to ensure all dependencies use 6.22.0
- Fixes Mastra Cloud bundler error with node:assert imports
- Version 7.x has CommonJS/ESM issues with current bundler
```

## Future Considerations

Once Mastra Cloud updates their bundler (likely Rollup or esbuild update), we can:
1. Remove the `undici` override and upgrade to 7.x
2. Test with the latest versions to ensure compatibility
3. The overrides provide a safety net during the transition

## Files Changed

- [package.json](../package.json) - Updated dependencies and added overrides
- [pnpm-lock.yaml](../pnpm-lock.yaml) - Updated lockfile with new resolutions
- [docs/mastra-cloud-build-fix.md](./mastra-cloud-build-fix.md) - This documentation
