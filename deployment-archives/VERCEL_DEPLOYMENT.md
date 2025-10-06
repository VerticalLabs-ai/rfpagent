# Vercel Deployment Guide

## Overview

This application has been configured for deployment on Vercel with the following setup:

- **Frontend**: React app built with Vite (served as static files from `dist/public`)
- **Backend**: Express API running as Vercel serverless function (`api/index.ts`)

## Important Limitations

⚠️ **WebSocket Support**: Vercel's serverless functions do not support traditional WebSocket connections. The WebSocket functionality in this app will not work on Vercel.

⚠️ **Background Processes**: Features like agent initialization and cron jobs will not work in Vercel's serverless environment. Each function invocation is stateless and isolated.

⚠️ **Execution Time**: Serverless functions have a maximum execution time of 60 seconds (as configured).

## Required Environment Variables

You must configure the following environment variables in your Vercel project settings:

### Database

- `DATABASE_URL` - PostgreSQL connection string (Neon or other)

### Authentication & Security

- `SESSION_SECRET` - Secret key for session management
- `INTERNAL_SERVICE_KEY` - Internal service authentication key

### External Services

- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_CLOUD_STORAGE_BUCKET` - GCS bucket name
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - GCS credentials (as JSON string)
- `SENDGRID_API_KEY` - SendGrid API key
- `BROWSERBASE_API_KEY` - Browserbase API key (if used)
- `BROWSERBASE_PROJECT_ID` - Browserbase project ID (if used)

### Optional

- `NODE_ENV=production` - Should be set automatically by Vercel

## Deployment Steps

1. **Install Vercel CLI** (if not already installed):

   ```bash
   npm i -g vercel
   ```

2. **Link your project**:

   ```bash
   vercel link
   ```

3. **Configure environment variables**:
   - Go to your Vercel dashboard
   - Navigate to Project Settings → Environment Variables
   - Add all required variables listed above

4. **Deploy**:

   ```bash
   vercel --prod
   ```

## Alternative Deployment Options

Given the limitations above, consider these alternatives if you need:

- **Real-time features**: Deploy to Railway, Render, or Fly.io
- **Background jobs**: Use Vercel with external job queue (like Inngest, Trigger.dev)
- **WebSockets**: Consider using Vercel with a separate WebSocket server or use Pusher/Ably

## Local Testing

To test the Vercel build locally:

```bash
vercel dev
```

This will simulate the Vercel environment on your local machine.

## Build Configuration

The build is configured in `vercel.json`:

- Frontend is built with `vite build` → outputs to `dist/public`
- Backend API is automatically deployed from `api/index.ts`
- All `/api/*` requests are routed to the serverless function

## Post-Deployment

After deployment, verify:

1. Frontend loads correctly at your Vercel domain
2. API endpoints are accessible at `https://yourdomain.vercel.app/api/*`
3. Database connection works
4. Check Vercel function logs for any errors

## Troubleshooting

- **"Function Runtimes must have a valid version"**: This has been fixed by removing explicit runtime specification
- **Module not found**: Ensure all dependencies are in `dependencies` (not `devDependencies`)
- **Timeout errors**: Optimize slow operations or increase `maxDuration` in vercel.json
- **Database connection issues**: Ensure DATABASE_URL is set and using connection pooling
