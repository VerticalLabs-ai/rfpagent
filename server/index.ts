import 'dotenv/config';
import express, { type Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { configureRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { agentRegistryService } from './services/agentRegistryService';
import { websocketService } from './services/websocketService';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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
  const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

  if (missingEnvVars.length > 0) {
    log(`❌ Missing required environment variables: ${missingEnvVars.join(', ')}`);
    process.exit(1);
  }

  log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`✓ Database: ${process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || 'configured'}`);

  // Configure modular routes
  log('📝 Configuring routes...');
  configureRoutes(app);
  log('✓ Routes configured');

  // Create HTTP server
  const server = createServer(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';

    res.status(status).json({ message });
    throw err;
  });

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
      log('⚠️  Static file serving failed (non-fatal):', error instanceof Error ? error.message : String(error));
      log('   API endpoints will still work, but frontend may not load');
    }
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '3000', 10);
  server.listen(port, '0.0.0.0', () => {
    log(`serving on port ${port}`);
  });

  // Initialize WebSocket server AFTER server is listening
  websocketService.initialize(server);
  log('🔌 WebSocket server initialized on /ws');

  // Bootstrap 3-tier agentic system with default agents in background
  // This allows the server to respond to requests while agents initialize
  setImmediate(async () => {
    try {
      await agentRegistryService.bootstrapDefaultAgents();
      log('🤖 3-tier agentic system initialized with default agents');
    } catch (error) {
      log(
        '⚠️ Failed to bootstrap default agents:',
        error instanceof Error ? error.message : String(error)
      );
    }
  });

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
