# Sentry Error Tracking Setup

**Last Updated**: January 2025

This document describes the Sentry error tracking and performance monitoring setup for the RFP Agent application.

## Overview

Sentry is configured to provide:

- **Error Tracking**: Automatic capture of unhandled errors and exceptions
- **Performance Monitoring**: Transaction tracing and performance metrics
- **Profiling**: CPU and memory profiling for performance optimization
- **Release Tracking**: Version-based error tracking with Fly.io integration

## Configuration

### Files Created/Modified

1. **`server/instrument.ts`** - Sentry initialization (must be imported first)
2. **`server/index.ts`** - Middleware integration
3. **`fly.toml`** - Fly.io environment variable configuration
4. **`.env.example`** - Environment variable template

### Environment Variables

```bash
# Required
SENTRY_DSN="https://315d8fa4019d9670c0496e5f71f562d9@o4510143884296192.ingest.us.sentry.io/4510155732615168"

# Optional (auto-detected from environment)
NODE_ENV="production"
FLY_APP_NAME="bidhive"
FLY_RELEASE_VERSION="auto"
FLY_REGION="auto"
FLY_ALLOC_ID="auto"
```

### Features Enabled

#### 1. Error Tracking

- Automatic capture of all uncaught exceptions
- Custom error boundaries for React components
- Stack traces with source maps (when available)
- Breadcrumbs for debugging context

#### 2. Performance Monitoring

- **Sample Rate**: 10% in production, 100% in development
- HTTP request tracing
- Database query performance
- Custom transaction tracking

#### 3. Profiling

- **Sample Rate**: 10% in production, 100% in development
- CPU profiling for performance bottlenecks
- Memory usage tracking
- Function-level performance metrics

#### 4. Privacy & Security

- **PII (Personal Identifiable Information)**: Enabled for better debugging
- **Data Scrubbing**: Database URLs and sensitive credentials automatically filtered
- **beforeSend Hook**: Custom filtering for sensitive data

#### 5. Fly.io Integration

- Automatic release tracking using `FLY_RELEASE_VERSION`
- Region-based tagging for distributed deployments
- Instance ID tracking via `FLY_ALLOC_ID`

## Middleware Order

The middleware order in `server/index.ts` is critical:

```typescript
// 1. Import Sentry FIRST (before any other imports)
import './instrument';

// 2. Other imports
import express from 'express';
import * as Sentry from '@sentry/node';

const app = express();

// 3. Sentry request handler (FIRST middleware)
app.use(Sentry.Handlers.requestHandler());

// 4. Sentry tracing handler
app.use(Sentry.Handlers.tracingHandler());

// 5. Other middleware (body parser, etc.)
app.use(express.json());

// 6. Your routes
app.use('/api', routes);

// 7. Sentry error handler (BEFORE your error handlers)
app.use(Sentry.Handlers.errorHandler());

// 8. Your custom error handlers
app.use((err, req, res, next) => {
  // Your error handling logic
});
```

## Deployment

### Fly.io Deployment

The Sentry DSN is configured in `fly.toml`:

```toml
[env]
  NODE_ENV = 'production'
  SENTRY_DSN = 'https://...'
```

After updating `fly.toml`, deploy with:

```bash
fly deploy
```

### Manual Secret Configuration (Alternative)

For enhanced security, you can set the DSN as a secret:

```bash
# Set Sentry DSN as a secret
fly secrets set SENTRY_DSN="https://315d8fa4019d9670c0496e5f71f562d9@o4510143884296192.ingest.us.sentry.io/4510155732615168"

# Verify secrets
fly secrets list
```

Then remove it from `fly.toml`:

```toml
[env]
  NODE_ENV = 'production'
  # SENTRY_DSN is set via secrets
```

## Verification

### 1. Test Error Tracking

Create a test endpoint to verify Sentry is capturing errors:

```typescript
// In your routes file
app.get('/api/sentry-test', (req, res) => {
  throw new Error('Test error for Sentry');
});
```

Visit the endpoint and check your Sentry dashboard.

### 2. Test Transaction Tracking

Make API requests and verify they appear in Sentry's Performance tab:

```bash
curl https://bidhive.fly.dev/api/health/live
```

### 3. Check Console Output

On startup, you should see:

```
🚀 Starting BidHive server...
✓ Sentry initialized
```

### 4. View in Sentry Dashboard

Visit your Sentry project:

- https://sentry.io/organizations/ibyte/projects/
- Check **Issues** for errors
- Check **Performance** for transactions
- Check **Profiling** for performance data

## Best Practices

### 1. Custom Error Context

Add custom context to errors:

```typescript
import { setUser, setTag, addBreadcrumb } from '@sentry/node';

// Set user context
setUser({
  id: user.id,
  email: user.email,
  username: user.username,
});

// Set custom tags
setTag('feature', 'rfp-processing');

// Add breadcrumbs
addBreadcrumb({
  category: 'action',
  message: 'User uploaded RFP document',
  level: 'info',
});
```

### 2. Capture Custom Errors

Explicitly capture errors with additional context:

```typescript
import { captureException } from '@sentry/node';

try {
  await processRFP(rfpId);
} catch (error) {
  captureException(error, {
    tags: { rfp_id: rfpId },
    extra: { metadata: rfpMetadata },
  });
  throw error;
}
```

### 3. Custom Spans

Create custom spans for important operations:

```typescript
import { startSpan } from '@sentry/node';

await startSpan(
  {
    op: 'rfp.processing',
    name: 'Process RFP Document',
  },
  async span => {
    await startSpan(
      {
        op: 'ai.analysis',
        name: 'Analyze RFP with AI',
      },
      async () => {
        await analyzeRFP(rfpId);
      }
    );
  }
);
```

### 4. Environment-Specific Configuration

The configuration automatically adjusts based on `NODE_ENV`:

- **Development**: 100% sampling, verbose logging
- **Production**: 10% sampling, optimized performance

## Monitoring & Alerts

### Recommended Alerts

Configure alerts in Sentry for:

1. **Error Rate Spike**: > 10 errors/minute
2. **New Error Type**: First occurrence of new error
3. **Performance Degradation**: p95 response time > 2s
4. **High Volume**: > 1000 events/hour

### Notification Channels

Configure notifications in Sentry:

- Email
- Slack
- PagerDuty (for critical issues)

## Troubleshooting

### Sentry Not Capturing Errors

1. **Check DSN**: Verify `SENTRY_DSN` is set correctly

   ```bash
   fly ssh console -C "printenv | grep SENTRY"
   ```

2. **Check Import Order**: Ensure `instrument.ts` is imported first
3. **Check Network**: Verify outbound HTTPS is allowed

4. **Check Logs**: Look for Sentry initialization errors
   ```bash
   fly logs
   ```

### High Event Volume

If you're hitting rate limits:

1. **Adjust Sample Rates**: Lower `tracesSampleRate` and `profilesSampleRate`
2. **Filter Noisy Errors**: Use `beforeSend` hook to filter
3. **Upgrade Plan**: Consider Sentry plan upgrade

### Missing Source Maps

To enable source maps for better stack traces:

1. **Build with source maps**:

   ```json
   // tsconfig.json
   {
     "compilerOptions": {
       "sourceMap": true
     }
   }
   ```

2. **Upload to Sentry** (optional):
   ```bash
   npx @sentry/cli releases files VERSION upload-sourcemaps ./dist
   ```

## Related Documentation

- [Sentry Node.js Documentation](https://docs.sentry.io/platforms/node/)
- [Fly.io Environment Variables](https://fly.io/docs/reference/configuration/#the-env-section)
- [Deployment Guide](./deployment-guide.md)

## Support

For Sentry-related issues:

- Sentry Support: https://sentry.io/support/
- Internal: Contact DevOps team
