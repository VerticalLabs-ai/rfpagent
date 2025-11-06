import express, { type Express } from 'express';
import fs from 'fs';
import { type Server } from 'http';
import { nanoid } from 'nanoid';
import path from 'path';
import { createLogger, createServer as createViteServer } from 'vite';
import viteConfig from '../vite.config';

const viteLogger = createLogger();

export function log(message: string, source = 'express') {
  const formattedTime = new Date().toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: 'custom',
  });

  app.use(vite.middlewares);
  // Express 5.x requires named wildcards: /*splat syntax
  // This catches all routes and serves the Vite-transformed index.html
  app.get('/*splat', async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        '..',
        'client',
        'index.html'
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, 'utf-8');
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ 'Content-Type': 'text/html' }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production, the bundled server is at dist/index.js
  // and the frontend build is at dist/public/
  // So from dist/index.js perspective, public is a sibling directory
  const distPath = path.resolve(import.meta.dirname, 'public');

  // Fallback: if public doesn't exist at dist/public, try ../dist/public
  const fallbackPath = path.resolve(import.meta.dirname, '..', 'dist', 'public');

  let publicPath = distPath;
  if (!fs.existsSync(distPath) && fs.existsSync(fallbackPath)) {
    publicPath = fallbackPath;
  }

  if (!fs.existsSync(publicPath)) {
    console.warn(`⚠️  Could not find the build directory: ${distPath}`);
    console.warn(`   Also tried: ${fallbackPath}`);
    console.warn('   Frontend will not be served, but API endpoints will work');
    console.warn('   Make sure to build the client first: pnpm build');

    // Serve a simple message for non-API routes (Express 5.x named wildcard)
    app.get('/*splat', (_req, res, next) => {
      if (_req.path.startsWith('/api')) {
        // Let API routes through
        return next();
      }
      res.status(503).send('Frontend not available - build in progress');
    });
    return;
  }

  console.log(`✓ Serving static files from: ${publicPath}`);
  app.use(express.static(publicPath));

  // fall through to index.html if the file doesn't exist (Express 5.x named wildcard)
  // IMPORTANT: Only serve index.html for non-API routes
  app.get('/*splat', (_req, res, next) => {
    // Skip catch-all for API routes - let them 404 properly
    if (_req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.resolve(publicPath, 'index.html'));
  });
}
