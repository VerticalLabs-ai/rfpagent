# Environment Configuration Guide

## Quick Start

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure for your environment:**
   - For **local development**: Use default local Docker PostgreSQL settings (already configured)
   - For **production/Fly.io**: Use `.env.production` configuration

## Environment Files

### `.env` (Local Development - NOT committed to git)
Your local development configuration with real API keys and local database.

**Default Local Database Settings:**
```bash
DATABASE_URL="postgresql://rfpuser:rfppassword@localhost:5432/rfpagent"
PGDATABASE="rfpagent"
PGHOST="localhost"
PGPORT="5432"
PGUSER="rfpuser"
PGPASSWORD="rfppassword"
```

### `.env.production` (Production - Fly.io)
Production database configuration for Fly.io deployment.

**Fly.io Database (Pooled):**
```bash
DATABASE_URL="postgresql://fly-user:password@pgbouncer.xxx.flympg.net/fly-db"
```

### `.env.test` (Testing - NOT committed to git)
Test database configuration for running test suite.

**Test Database:**
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rfpagent_test"
```

### `.env.example` (Template - committed to git)
Template file with placeholder values. Safe to commit.

## Required API Keys

### AI Services (Choose one or more)

**OpenAI:**
- Get key from: https://platform.openai.com/api-keys
- Set: `OPENAI_API_KEY="sk-..."`

**Anthropic (Claude):**
- Get key from: https://console.anthropic.com/
- Set: `ANTHROPIC_API_KEY="sk-ant-..."`

**Google (Gemini):**
- Get key from: https://aistudio.google.com/app/apikey
- Set: `GOOGLE_API_KEY="AIza..."`

### Portal Scraping

**Browserbase:**
- Sign up at: https://www.browserbase.com/
- Set both:
  - `BROWSERBASE_API_KEY="bb_live_..."`
  - `BROWSERBASE_PROJECT_ID="..."`

### Federal Data (Required for SAM.gov Integration)

**SAM.gov Opportunities API:**
- **Get API Key**: https://open.gsa.gov/api/opportunities-api/
- **Documentation**: https://open.gsa.gov/api/opportunities-api/
- **Rate Limits**: 10 requests/second, 10,000 requests/day
- Set: `SAM_GOV_API_KEY="YOUR-API-KEY-HERE"`
- **Quick Start**: See [SAM.gov Quick Start Guide](sam-gov-quick-start.md)

### Security & Monitoring (Production)

**Sentry Error Tracking:**
- Create project at: https://sentry.io
- Set: `SENTRY_DSN="https://..."`

**1Password (Optional):**
- Service account at: https://1password.com/
- Set: `OP_SERVICE_ACCOUNT_TOKEN="ops_..."`

## Database Setup

### Option 1: Local Docker PostgreSQL (Recommended)

```bash
# Start PostgreSQL container
docker run -d \
  --name rfp-postgres \
  -e POSTGRES_USER=rfpuser \
  -e POSTGRES_PASSWORD=rfppassword \
  -e POSTGRES_DB=rfpagent \
  -p 5432:5432 \
  postgres:15

# Run migrations
pnpm db:push
```

### Option 2: Use Fly.io Database via Proxy

```bash
# In separate terminal: Start proxy to Fly.io database
flyctl proxy 5432 -a bidhive-db

# Update .env DATABASE_URL to:
# DATABASE_URL="postgresql://fly-user:password@localhost:5432/fly-db"
```

## Generate Session Secret

```bash
# Generate random 64-byte session secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## Environment Variables Priority

When running the app, environment variables are loaded in this order:
1. `.env.test` (if running tests)
2. `.env` (local development)
3. Fly.io secrets (in production)

## Security Notes

⚠️ **NEVER commit `.env` files with real credentials to git!**

- `.env` - gitignored ✅
- `.env.test` - gitignored ✅
- `.env.production` - gitignored ✅
- `.env.example` - safe to commit ✅

## Troubleshooting

**"DATABASE_URL not set" error:**
- Ensure `.env` file exists
- Check DATABASE_URL is set correctly
- For tests, ensure `.env.test` exists

**"Connection refused" database error:**
- Start local PostgreSQL: `docker ps` to verify
- Or use Fly.io proxy: `flyctl proxy 5432`

**"Invalid API key" errors:**
- Verify API keys are correctly copied (no extra spaces)
- Check API key is active in provider dashboard
- Ensure billing is set up for paid APIs
