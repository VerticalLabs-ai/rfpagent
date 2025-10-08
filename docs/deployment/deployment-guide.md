# Deployment Guide

**Last Updated**: January 2025

Complete guide for deploying the RFP Agent platform to production.

> **Note**: For Sentry error tracking setup, see [SENTRY_SETUP.md](./SENTRY_SETUP.md)

---

## Quick Start

```bash
# Deploy to Fly.io
flyctl deploy

# Check deployment status
flyctl status

# View logs
flyctl logs
```

---

## Fly.io Deployment

### Prerequisites

1. **Fly.io Account**: Sign up at https://fly.io
2. **Flyctl CLI**: Install via `brew install flyctl` (macOS) or https://fly.io/docs/hands-on/install-flyctl/
3. **Docker**: Required for building images

### Initial Setup

```bash
# Login to Fly.io
flyctl auth login

# Initialize app (if not already done)
flyctl launch

# Set secrets
flyctl secrets set DATABASE_URL="your-database-url"
flyctl secrets set OPENAI_API_KEY="your-openai-key"
flyctl secrets set ANTHROPIC_API_KEY="your-anthropic-key"
```

### Environment Variables

Required secrets:

- `DATABASE_URL`: PostgreSQL connection string (Neon Database)
- `OPENAI_API_KEY`: OpenAI API key for GPT-5
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude Sonnet 4.5
- `GOOGLE_CLOUD_STORAGE_BUCKET`: GCS bucket name
- `GOOGLE_CLOUD_STORAGE_KEY`: GCS service account key
- `SENDGRID_API_KEY`: SendGrid API key for notifications

```bash
# Set all secrets at once
flyctl secrets set \
  DATABASE_URL="postgresql://..." \
  OPENAI_API_KEY="sk-..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  GOOGLE_CLOUD_STORAGE_BUCKET="rfp-documents" \
  SENDGRID_API_KEY="SG..."
```

### Deployment Process

```bash
# 1. Ensure tests pass locally
pnpm check && pnpm lint && pnpm build

# 2. Deploy to Fly.io
flyctl deploy

# 3. Monitor deployment
flyctl logs

# 4. Verify deployment
curl https://your-app.fly.dev/api/health
```

### Scaling

```bash
# Scale instances
flyctl scale count 2

# Scale VM resources
flyctl scale vm shared-cpu-1x --memory 512

# View current scaling
flyctl scale show
```

---

## Database Migrations

```bash
# Run migrations on deployment
flyctl ssh console
cd /app
pnpm db:push
```

---

## Monitoring

### Health Checks

- **Endpoint**: `/api/health`
- **Expected Response**: `{ "status": "ok" }`

### Logs

```bash
# Stream logs in real-time
flyctl logs

# Filter by severity
flyctl logs --level error

# View historical logs (last 24h)
flyctl logs --since 24h
```

### Metrics

```bash
# View app metrics
flyctl dashboard

# Check resource usage
flyctl status
```

---

## Rollback Procedure

```bash
# List releases
flyctl releases

# Rollback to previous release
flyctl releases rollback <version>
```

---

## Troubleshooting

### Deployment Fails

1. Check build logs: `flyctl logs`
2. Verify Dockerfile builds locally: `docker build .`
3. Check secrets are set: `flyctl secrets list`

### App Not Responding

1. Check app status: `flyctl status`
2. View logs: `flyctl logs`
3. Restart app: `flyctl apps restart`

### Database Connection Issues

1. Verify `DATABASE_URL` secret
2. Check Neon database status
3. Test connection from local: `psql $DATABASE_URL`

---

## CI/CD Integration

GitHub Actions automatically deploys on push to `main`:

```yaml
# .github/workflows/fly-deploy.yml
name: Deploy to Fly.io
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: superfly/flyctl-actions/setup-flyctl@master
      - run: flyctl deploy --remote-only
```

---

## Security Considerations

1. **Never commit secrets** to git
2. **Use Fly.io secrets** for all sensitive data
3. **Enable HTTPS** (Fly.io handles automatically)
4. **Review access logs** regularly
5. **Keep dependencies updated**

---

For testing deployment changes, see [docs/testing/testing-guide.md](../testing/testing-guide.md)
