# Mastra Cloud Build - Next Steps

## Current Status

We've fixed two major issues:
1. ✅ `google-logging-utils` - Fixed by forcing version 1.1.1
2. ⚠️ `undici` - Replaced direct usage with axios, but cheerio still depends on it

## If Build Still Fails on Mastra Cloud

The remaining issue is that **cheerio depends on undici**, and Mastra's bundler may try to analyze it.

### Option 1: Contact Mastra Support (RECOMMENDED)

Ask Mastra to:
1. Mark `undici` as an external dependency (don't bundle it)
2. Provide a `.mastraignore` file or bundler config option
3. Update their bundler to handle Node.js built-in module imports properly

**Support Request Template:**
```
Subject: Bundler fails to analyze undici package

Our application build fails during the "Analyzing dependencies" phase with:

"default" is not exported by "node:assert?commonjs-external",
imported by "node_modules/.pnpm/undici@6.22.0/node_modules/undici/lib/core/util.js"

Issue: Your bundler is trying to analyze `undici` (a Node.js HTTP client) as application code,
but `undici` uses Node.js built-in modules (node:assert, node:events) that your bundler
can't handle in CommonJS/ESM interop.

Request:
1. Mark `undici` as external (don't analyze/bundle it)
2. Provide configuration option to exclude specific packages from bundling
3. Update bundler to properly handle Node.js built-in module imports

Package: undici (all versions - both 6.x and 7.x fail)
Source: Transitive dependency via cheerio@1.1.2

Project ID: 75ac1e18-0a86-49e2-b4d1-00def7a9aa78
```

### Option 2: Replace Cheerio

If Mastra can't fix the bundler, we can replace cheerio with a parser that doesn't depend on undici.

**Alternatives:**
1. **parse5** + custom wrapper
   - Pure JavaScript HTML parser
   - No external dependencies
   - Good performance

2. **htmlparser2** + cheerio-like API
   - Fast and lightweight
   - Similar API to cheerio
   - No undici dependency

3. **jsdom**
   - Full DOM implementation
   - Heavier but more complete
   - May have other dependencies

**Implementation:**
```bash
# Install parse5
pnpm add parse5

# Create wrapper in server/utils/htmlParser.ts
# Replace cheerio imports throughout codebase
```

### Option 3: Custom Bundler Configuration

If Mastra supports custom bundler config, create a config file:

**.mastrarc.json** (hypothetical):
```json
{
  "bundler": {
    "external": ["undici"],
    "ignore": ["node_modules/undici"],
    "platform": "node"
  }
}
```

**vite.config.ts update** (if Mastra respects it):
```typescript
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['undici']
    }
  }
})
```

## Testing Locally

To test if the axios changes work correctly:

```bash
# Run the scraping service
npm run dev:backend

# Test authentication endpoints
curl -X POST http://localhost:3000/api/auth/test \
  -H "Content-Type: application/json" \
  -d '{"portalUrl":"https://example.com","username":"test","password":"test"}'
```

## Deployment Strategy

1. **Push current changes** to see if axios replacement is sufficient
2. **If still fails**: Implement Option 1 or 2
3. **Monitor** Mastra Cloud logs for new error messages
4. **Document** any additional issues found

## Files to Watch

If replacing cheerio becomes necessary:
- `server/services/scrapers/*.ts` - 5 files use cheerio
- `server/services/scraping/authentication/**/*.ts` - 3 files use cheerio
- `package.json` - Update dependencies

## Success Metrics

✅ Build completes "Analyzing dependencies" phase
✅ Build completes "Optimizing dependencies" phase
✅ Application starts successfully on Mastra Cloud
✅ HTTP requests work (axios functionality)
✅ HTML parsing works (cheerio or replacement)

## Timeline

- **Immediate**: Push current changes and test
- **Day 1**: Contact Mastra support if build fails
- **Day 2-3**: Implement Option 2 if needed
- **Week 1**: Full testing and validation

##Related Commits

1. [4103e10](commit:4103e10) - Fixed google-logging-utils
2. [ba62d0b](commit:ba62d0b) - Attempted undici downgrade (didn't work)
3. [55c9799](commit:55c9799) - Replaced undici with axios (current)
