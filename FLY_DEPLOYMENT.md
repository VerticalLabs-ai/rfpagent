# Fly.io Deployment Guide

Complete guide to deploying the RFP Agent Platform on Fly.io.

## Why Fly.io?

✅ **WebSocket Support** - Full support for real-time connections
✅ **Background Processes** - Cron jobs and agent initialization work perfectly
✅ **Global Edge Deployment** - Deploy close to your users worldwide
✅ **Persistent Volumes** - Optional storage for file uploads
✅ **Auto-scaling** - Scale based on demand
✅ **Free Tier** - 3 shared-cpu VMs + 3GB storage free

---

## Prerequisites

1. **Fly.io Account** - You have one already ✓
2. **Fly CLI** - Install if not already done:

   ```bash
   # macOS
   brew install flyctl

   # Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

3. **Login to Fly.io**:

   ```bash
   flyctl auth login
   ```

---

## Step 1: Configure Your App

1. **Update app name in `fly.toml`**:

   ```toml
   app = 'your-unique-app-name'  # Change this!
   ```

2. **Choose your primary region** (optional):

   ```toml
   primary_region = 'iad'  # Options: iad, lhr, syd, fra, etc.
   ```

   See all regions: `flyctl platform regions`

---

## Step 2: Set Environment Variables

Set all required secrets (these are encrypted and not visible in `fly.toml`):

```bash
# Database (required)
flyctl secrets set DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"

# Session (required)
flyctl secrets set SESSION_SECRET="your-random-32-char-secret"

# AI Services (required)
flyctl secrets set OPENAI_API_KEY="sk-proj-..."

# Browserbase (required for portal scraping)
flyctl secrets set BROWSERBASE_API_KEY="bb_live_..."
flyctl secrets set BROWSERBASE_PROJECT_ID="your-project-id"

# Optional services
flyctl secrets set SENDGRID_API_KEY="SG..." # For email notifications
flyctl secrets set ANTHROPIC_API_KEY="sk-ant-..." # If using Claude
flyctl secrets set GOOGLE_API_KEY="AIza..." # If using Gemini

# Internal service key
flyctl secrets set INTERNAL_SERVICE_KEY="your-internal-key"
```

### View current secrets

```bash
flyctl secrets list
```

### Remove a secret

```bash
flyctl secrets unset SECRET_NAME
```

---

## Step 3: Create the App

Initialize your app on Fly.io (this doesn't deploy yet):

```bash
flyctl launch --no-deploy
```

This will:

- Create the app in your Fly.io organization
- Set up your app name
- Configure initial settings

**Note:** Use `--no-deploy` because we want to set secrets first.

---

## Step 4: Optional - Create Persistent Storage

If you need file storage (for uploads, documents, etc.):

```bash
# Create a 10GB volume
flyctl volumes create rfp_storage --size 10 --region iad

# Uncomment the [[mounts]] section in fly.toml
```

---

## Step 5: Deploy

Deploy your application:

```bash
flyctl deploy
```

This will:

1. Build your Docker image
2. Push to Fly.io registry
3. Create and start machines
4. Run health checks
5. Route traffic to your app

### First deployment takes 3-5 minutes

---

## Step 6: Verify Deployment

1. **Check app status**:

   ```bash
   flyctl status
   ```

2. **View logs**:

   ```bash
   flyctl logs
   ```

3. **Open your app**:

   ```bash
   flyctl open
   ```

4. **Test health endpoint**:

   ```bash
   curl https://your-app-name.fly.dev/api/health
   ```

---

## Step 7: Database Migrations (if needed)

If you need to run database migrations:

```bash
# SSH into your app
flyctl ssh console

# Run migrations manually
node dist/migrate.js

# Or use the release_command in fly.toml (uncomment and redeploy)
```

---

## Managing Your Deployment

### Viewing Logs

```bash
# Real-time logs
flyctl logs

# Last 200 lines
flyctl logs -n 200

# Filter by severity
flyctl logs --level error
```

### Scaling

```bash
# Scale to 2 machines
flyctl scale count 2

# Scale to different regions
flyctl scale count 2 --region iad,lhr

# Increase memory
flyctl scale memory 2048

# Increase CPU
flyctl scale vm shared-cpu-2x
```

### SSH Access

```bash
# Interactive shell
flyctl ssh console

# Run a command
flyctl ssh console -C "node dist/scripts/check-db.js"
```

### Monitoring

```bash
# Dashboard
flyctl dashboard

# Machine status
flyctl status

# App info
flyctl info
```

---

## CI/CD with GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Fly.io

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - run: flyctl deploy --remote-only
        env:
          FLY_API_TOKEN: \${{ secrets.FLY_API_TOKEN }}
```

Get your API token:

```bash
flyctl auth token
```

Add it to GitHub Secrets as `FLY_API_TOKEN`.

---

## Cost Estimation

### Free Tier (included)

- 3 shared-cpu-1x VMs (256MB RAM each)
- 3GB persistent storage
- 160GB outbound data transfer

### Typical Production Costs

**Small (1 machine, 1GB RAM):**

- ~$15-20/month
- Good for: MVP, testing, low traffic

**Medium (2 machines, 2GB RAM each):**

- ~$40-50/month
- Good for: Production, moderate traffic

**Large (3 machines, 4GB RAM each):**

- ~$100-120/month
- Good for: High traffic, global deployment

**Additional costs:**

- Persistent volumes: $0.15/GB/month
- Outbound bandwidth: $0.02/GB (after free tier)

---

## Troubleshooting

### Build Failures

```bash
# View build logs
flyctl logs --app your-app-name

# Local build test
flyctl deploy --local-only
```

### Health Check Failures

- Ensure `/api/health` endpoint exists and returns 200
- Check if app is binding to PORT=3000
- View logs: `flyctl logs`

### Out of Memory

```bash
# Increase memory
flyctl scale memory 2048

# Check current usage
flyctl ssh console -C "free -h"
```

### Database Connection Issues

- Verify DATABASE_URL is set: `flyctl secrets list`
- Check if Neon database allows connections from Fly.io IPs
- Test connection: `flyctl ssh console -C "node -e \"require('./dist/test-db.js')\""`

### WebSocket Issues

- Ensure `force_https = true` in fly.toml
- Check if client uses `wss://` (not `ws://`)
- Verify WebSocket endpoint in logs

---

## Environment-Specific Features

### What Works on Fly.io ✅

- ✅ WebSockets (real-time agent updates)
- ✅ Background processes (cron jobs, agent initialization)
- ✅ Persistent connections
- ✅ File uploads (with volumes)
- ✅ Puppeteer/Chromium (included in Dockerfile)
- ✅ Long-running requests (up to 300s)

### What Doesn't Work ❌

- ❌ Replit Object Storage (use AWS S3 or Fly.io volumes instead)
- ❌ Replit-specific features (sidecar endpoints)

---

## Production Checklist

Before going live:

- [ ] Set all required environment variables
- [ ] Configure custom domain (optional)
- [ ] Set up SSL certificate (automatic with custom domain)
- [ ] Configure autoscaling (if needed)
- [ ] Set up monitoring/alerts
- [ ] Test health checks
- [ ] Run database migrations
- [ ] Test WebSocket connections
- [ ] Configure backups (database)
- [ ] Set up CI/CD pipeline
- [ ] Load test your application

---

## Useful Commands

```bash
# Quick reference
flyctl status              # App status
flyctl logs                # View logs
flyctl ssh console         # SSH into app
flyctl scale memory 2048   # Increase memory
flyctl restart             # Restart app
flyctl destroy             # Delete app (careful!)
flyctl info                # App details
flyctl regions list        # Available regions
flyctl secrets list        # List secrets (not values)

# Advanced
flyctl image show          # Current image
flyctl releases            # Deployment history
flyctl scale show          # Current scaling
flyctl doctor              # Diagnose issues
```

---

## Support

- **Fly.io Docs**: <https://fly.io/docs/>
- **Community Forum**: <https://community.fly.io/>
- **Status Page**: <https://status.flyio.net/>

---

## Next Steps

1. Deploy your app: `flyctl deploy`
2. Set up custom domain (optional): `flyctl certs add yourdomain.com`
3. Configure monitoring
4. Set up automated backups for your database
5. Consider adding a CDN for static assets

Happy deploying! 🚀
