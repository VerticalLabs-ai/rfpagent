// Load environment variables FIRST, before any other imports (including Sentry)
import dotenv from 'dotenv';
import path from 'path';

const envLocalPath = path.join(process.cwd(), '.env.local');
const envPath = path.join(process.cwd(), '.env');
dotenv.config({ path: envLocalPath });
dotenv.config({ path: envPath });

// NOW import Sentry instrumentation (after env vars are loaded)
import './instrument';

import { setupExpressErrorHandler } from '@sentry/node';
import express, { NextFunction, type Request, Response } from 'express';
import { createServer } from 'http';
import { configureRoutes } from './routes';
import { agentRegistryService } from './services/agents/agentRegistryService';
import { saflaSystemIntegration } from './services/learning/saflaSystemIntegration';
import { websocketService } from './services/core/websocketService';
import { log, serveStatic, setupVite } from './vite';
import { correlationIdMiddleware } from './middleware/correlationId';
import { logger } from './utils/logger';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(correlationIdMiddleware);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (path.startsWith('/api')) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + '…';
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  log('🚀 Starting BidHive server...');

  // Validate critical environment variables
  const requiredEnvVars = ['DATABASE_URL'];
  const missingEnvVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingEnvVars.length > 0) {
    log(
      `❌ Missing required environment variables: ${missingEnvVars.join(', ')}`
    );
    process.exit(1);
  }

  log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  log(
    `✓ Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'configured'}`
  );

  // Run database migrations in production - NON-BLOCKING for Mastra Cloud
  if (process.env.NODE_ENV === 'production') {
    // Run migrations in background to avoid blocking startup
    (async () => {
      try {
        log('🔄 Running database migrations in background...');
        const { execSync } = await import('child_process');
        // Run drizzle-kit push directly with auto-confirmation via piped yes
        const result = execSync(
          'printf "yes\\n" | /app/node_modules/.bin/drizzle-kit push',
          {
            stdio: 'pipe',
            env: process.env,
            cwd: '/app',
            shell: '/bin/sh',
            timeout: 30000, // 30 second timeout to prevent hanging
          }
        );
        const output = result.toString().trim();
        log('✅ Database migrations completed');
        if (output) {
          output.split('\n').forEach(line => log(`   ${line}`));
        }
      } catch (error) {
        log(
          '⚠️ Database migration error (non-fatal):',
          error instanceof Error ? error.message : String(error)
        );
        if (error && typeof error === 'object') {
          if ('stdout' in error && (error as any).stdout) {
            const stdout = (error as any).stdout.toString().trim();
            if (stdout)
              stdout
                .split('\n')
                .forEach((line: string) => log(`   Output: ${line}`));
          }
          if ('stderr' in error && (error as any).stderr) {
            const stderr = (error as any).stderr.toString().trim();
            if (stderr)
              stderr
                .split('\n')
                .forEach((line: string) => log(`   Error: ${line}`));
          }
        }
        log('   Server operational - migrations may need manual intervention');
      }
    })();
  }

  // Initialize Mastra agent system BEFORE server starts (critical for health checks)
  try {
    log('🤖 Initializing Mastra agent system...');
    const { initializeAgentSystem } = await import('../src/mastra/index');
    await initializeAgentSystem();
    log('✅ Mastra agent system initialized (registry + pools)');

    // Bootstrap default agents (server-side registry)
    await agentRegistryService.bootstrapDefaultAgents();
    log('✅ 3-tier agentic system initialized with default agents');
  } catch (error) {
    log(
      '⚠️ Failed to initialize agent system:',
      error instanceof Error ? error.message : String(error)
    );
    log('   Server will continue but agent features may be unavailable');
  }

  // Initialize SAFLA self-improving system
  try {
    log('🧠 Initializing SAFLA learning system...');
    const saflaResult = await saflaSystemIntegration.initializeSystem();
    if (saflaResult.success) {
      log('✅ SAFLA self-improving system initialized');
    } else {
      log('⚠️ SAFLA initialization completed with warnings');
    }
  } catch (error) {
    log(
      '⚠️ Failed to initialize SAFLA system (non-fatal):',
      error instanceof Error ? error.message : String(error)
    );
  }

  // Configure modular routes
  log('📝 Configuring routes...');
  configureRoutes(app);
  log('✓ Routes configured');

  // Add health endpoint for Fly.io/Render health checks
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // HEAD handler for root path - used by wait-on package during dev
  // This prevents endless polling by returning 200 immediately
  app.head('/', (req, res) => {
    res.status(200).end();
  });

  // API info endpoint (not root - root should serve the frontend)
  app.get('/api/info', (req, res) => {
    res.status(200).json({
      status: 'ok',
      service: 'RFP Agent Platform',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString()
    });
  });

  // Create HTTP server
  const server = createServer(app);

  // Sentry error handler must be registered AFTER all routes but BEFORE custom error handlers
  setupExpressErrorHandler(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    log('🔧 Setting up Vite development server...');
    await setupVite(app, server);
    log('✓ Vite dev server ready');
  } else {
    log('📦 Setting up static file serving...');
    try {
      serveStatic(app);
      log('✓ Static files configured');
    } catch (error) {
      log(
        '⚠️  Static file serving failed (non-fatal):',
        error instanceof Error ? error.message : String(error)
      );
      log('   API endpoints will still work, but frontend may not load');
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Default to 5001 in development (matches wait-on in package.json)
  // Default to 3000 in production (Fly.io/Render standard)
  // This serves both the API and the client.
  const defaultPort = process.env.NODE_ENV === 'production' ? '3000' : '5001';
  const port = parseInt(process.env.PORT || defaultPort, 10);
  server.listen(port, '0.0.0.0', () => {
    log(`✅ Server ready on port ${port}`);
    log(`✅ Health check: http://localhost:${port}/health`);
    log(`✅ API: http://localhost:${port}/api`);
  });

  // Initialize WebSocket server AFTER server is listening
  websocketService.initialize(server);
  log('🔌 WebSocket server initialized on /ws');

  // Graceful shutdown
  process.on('SIGTERM', () => {
    log('SIGTERM received, shutting down gracefully');
    websocketService.shutdown();
    server.close(() => {
      log('Server closed');
      process.exit(0);
    });
  });
})();
