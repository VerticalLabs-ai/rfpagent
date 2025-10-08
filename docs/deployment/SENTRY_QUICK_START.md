# Sentry Quick Start Guide

**Last Updated**: January 2025

## ✅ Setup Complete!

Sentry error tracking is now configured for your application. Here's how to use it:

## 🚀 Quick Test (Local Development)

1. **Start your dev server:**

   ```bash
   pnpm dev
   ```

2. **Test error capture:**

   ```bash
   # Open in browser or use curl
   curl http://localhost:3000/api/sentry/test-error
   ```

3. **Check Sentry Dashboard:**
   - Go to: https://sentry.io/organizations/ibyte/projects/
   - Look for the test error in the **Issues** tab

## 📦 Deploy to Production

```bash
# Deploy to Fly.io
fly deploy

# Check logs for "Sentry initialized"
fly logs

# Test error tracking (if ENABLE_SENTRY_TEST is set)
curl https://bidhive.fly.dev/api/sentry/test-error
```

## 💻 Using Sentry in Your Code

### Capture Errors

```typescript
import { captureException } from '@sentry/node';

try {
  await riskyOperation();
} catch (error) {
  captureException(error, {
    tags: { feature: 'my-feature' },
    extra: { userId: user.id },
  });
  throw error; // Re-throw or handle as needed
}
```

### Add Context

```typescript
import { setUser, setTag, addBreadcrumb } from '@sentry/node';

// User context
setUser({ id: user.id, email: user.email });

// Custom tags for filtering
setTag('environment', 'production');

// Breadcrumbs for debugging trail
addBreadcrumb({
  category: 'action',
  message: 'User clicked submit button',
  level: 'info',
});
```

### Track Performance

```typescript
import { startSpan } from '@sentry/node';

await startSpan(
  {
    op: 'db.query',
    name: 'Fetch User Data',
  },
  async () => {
    await database.fetchUser(userId);
  }
);
```

## 🧪 Test Routes

Available in development (or with `ENABLE_SENTRY_TEST=true` in production):

| Endpoint                        | Description               |
| ------------------------------- | ------------------------- |
| `/api/sentry/test-error`        | Triggers a basic error    |
| `/api/sentry/test-custom-error` | Error with custom context |
| `/api/sentry/test-performance`  | Performance tracking test |
| `/api/sentry/test-message`      | Message capture test      |
| `/api/sentry/test-success`      | Verify configuration      |

## 📊 Monitoring

### View Errors

1. Open Sentry Dashboard
2. Go to **Issues** tab
3. Filter by environment, tags, or time

### Performance Monitoring

1. Go to **Performance** tab
2. View transaction traces
3. Identify slow operations

### Set Up Alerts

1. Go to **Alerts** → **Create Alert**
2. Configure for:
   - Error rate spikes
   - New error types
   - Performance degradation

## 🔧 Configuration

All configuration is in `server/instrument.ts`:

```typescript
init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1, // 10% in production
  profilesSampleRate: 0.1, // 10% in production
  environment: process.env.NODE_ENV,
});
```

## 📚 Full Documentation

- **Complete Setup Guide**: [SENTRY_SETUP.md](./SENTRY_SETUP.md)
- **Deployment Guide**: [deployment-guide.md](./deployment-guide.md)
- **Sentry Docs**: https://docs.sentry.io/platforms/node/

## 🆘 Troubleshooting

### Errors Not Appearing in Sentry

```bash
# Check DSN is set
fly ssh console -C "printenv | grep SENTRY"

# Check initialization logs
fly logs | grep -i sentry
```

### Test Routes Not Working

- **Development**: Should work by default
- **Production**: Set `ENABLE_SENTRY_TEST=true` in environment

### Need Help?

- Sentry Support: https://sentry.io/support/
- Check logs: `fly logs`
- Review setup: [SENTRY_SETUP.md](./SENTRY_SETUP.md)
