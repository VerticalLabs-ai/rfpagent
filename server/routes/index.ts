import type { Express } from 'express';
import express from 'express';

// Import middleware
import { errorHandler } from '../middleware/errorHandling';
import { rateLimiter } from '../middleware/rateLimiting';

// Import all route modules
import agentRoutes from './agents.routes';
import agentSettingsRoutes from './agentSettings.routes';
import aiRoutes from './ai.routes';
import analysisRoutes from './analysis'; // Existing analysis routes
import auditLogRoutes from './audit-logs.routes';
import companyRoutes from './company.routes';
import complianceRoutes from './compliance.routes';
import dashboardRoutes from './dashboard.routes';
import discoveryRoutes from './discovery.routes';
import documentRoutes from './documents.routes';
import e2eRoutes from './e2e.routes';
import healthRoutes from './health.routes';
import metricsRoutes from './metrics.routes';
import notificationRoutes from './notifications.routes';
import portalRoutes from './portals.routes';
import proposalRoutes from './proposals.routes';
import rfpRoutes from './rfps.routes';
import saflaRoutes from './safla-monitoring';
import scanRoutes from './scans.routes';
import sentryTestRoutes from './sentry-test';
import stallDetectionRoutes from './stall-detection.routes';
import submissionRoutes from './submissions.routes';
import systemRoutes from './system.routes';
import workflowRoutes from './workflows.routes';

/**
 * Configure and mount all API routes
 * @param app Express application instance
 */
export function configureRoutes(app: Express): void {
  // Global middleware
  app.use('/api', rateLimiter);

  // API route mounting with proper prefixes
  const apiRouter = express.Router();

  // Mount all modular routes
  apiRouter.use('/rfps', rfpRoutes);
  apiRouter.use('/proposals', proposalRoutes);
  apiRouter.use('/analysis', analysisRoutes);
  apiRouter.use('/compliance', complianceRoutes);
  apiRouter.use('/system', systemRoutes);
  apiRouter.use('/dashboard', dashboardRoutes);
  apiRouter.use('/portals', portalRoutes);
  apiRouter.use('/submissions', submissionRoutes);
  apiRouter.use('/documents', documentRoutes);
  apiRouter.use('/ai', aiRoutes);
  apiRouter.use('/company', companyRoutes);
  apiRouter.use('/workflows', workflowRoutes);
  apiRouter.use('/scans', scanRoutes);
  apiRouter.use('/discovery', discoveryRoutes);
  apiRouter.use('/notifications', notificationRoutes);
  apiRouter.use('/audit-logs', auditLogRoutes);
  apiRouter.use('/stall-detection', stallDetectionRoutes);

  // Mount agent settings routes - Company-specific agent customization
  // - GET /api/agents/available (list customizable agents)
  // - GET /api/company/:id/agent-settings (get company-specific agent settings)
  // - PUT /api/company/:id/agent-settings/:agentId (update agent settings)
  // - DELETE /api/company/:id/agent-settings/:agentId (reset settings to defaults)
  apiRouter.use('/', agentSettingsRoutes);

  // Mount E2E routes
  apiRouter.use('/e2e', e2eRoutes);

  // Mount SAFLA monitoring routes
  apiRouter.use('/safla', saflaRoutes);

  // Mount health check routes (skip rate limiting for health checks)
  apiRouter.use('/health', healthRoutes);

  // Mount Sentry test routes (development/testing only)
  if (
    process.env.NODE_ENV !== 'production' ||
    process.env.ENABLE_SENTRY_TEST === 'true'
  ) {
    apiRouter.use('/sentry', sentryTestRoutes);
  }

  // Mount the API router
  app.use('/api', apiRouter);

  // Mount special routes that don't follow the standard pattern
  app.use('/api', agentRoutes);
  app.use('/api', metricsRoutes);

  // Global error handler (must be last)
  app.use(errorHandler);
}

/**
 * Route module metadata for documentation and monitoring
 */
export const routeModules = {
  rfps: {
    prefix: '/api/rfps',
    description: 'RFP management, documents, and processing',
    version: '1.0.0',
  },
  proposals: {
    prefix: '/api/proposals',
    description: 'Proposal generation and pipeline management',
    version: '1.0.0',
  },
  analysis: {
    prefix: '/api/analysis',
    description: 'Phase 7 analysis pipeline integration',
    version: '7.0.0',
  },
  compliance: {
    prefix: '/api/compliance',
    description: 'Compliance analysis and tracking',
    version: '1.0.0',
  },
  system: {
    prefix: '/api/system',
    description: 'System configuration and service control',
    version: '1.0.0',
  },
  dashboard: {
    prefix: '/api/dashboard',
    description: 'Dashboard metrics and analytics',
    version: '1.0.0',
  },
  portals: {
    prefix: '/api/portals',
    description: 'Portal management, scanning, and monitoring',
    version: '1.0.0',
  },
  submissions: {
    prefix: '/api/submissions',
    description: 'Proposal submission pipeline and management',
    version: '1.0.0',
  },
  documents: {
    prefix: '/api/documents',
    description: 'Document intelligence and analysis',
    version: '1.0.0',
  },
  ai: {
    prefix: '/api/ai',
    description: 'AI services, chat, and proposal generation',
    version: '1.0.0',
  },
  company: {
    prefix: '/api/company',
    description: 'Company profile and data management',
    version: '1.0.0',
  },
  workflows: {
    prefix: '/api/workflows',
    description: 'Workflow orchestration and management',
    version: '1.0.0',
  },
  scans: {
    prefix: '/api/scans',
    description: 'Portal scanning and monitoring',
    version: '1.0.0',
  },
  discovery: {
    prefix: '/api/discovery',
    description: 'RFP discovery workflows',
    version: '1.0.0',
  },
  notifications: {
    prefix: '/api/notifications',
    description: 'System notifications and alerts',
    version: '1.0.0',
  },
  auditLogs: {
    prefix: '/api/audit-logs',
    description: 'Audit logging and tracking',
    version: '1.0.0',
  },
  agents: {
    prefix: '/api/agent-*',
    description: 'AI agent activity, performance, and coordination',
    version: '1.0.0',
  },
  metrics: {
    prefix: '/api/*-metrics',
    description: 'System metrics and health monitoring',
    version: '1.0.0',
  },
  e2e: {
    prefix: '/api/e2e',
    description: 'End-to-end testing and validation',
    version: '1.0.0',
  },
  safla: {
    prefix: '/api/safla',
    description: 'SAFLA self-improving system monitoring and management',
    version: '1.0.0',
  },
  health: {
    prefix: '/api/health',
    description: 'Health checks and system monitoring',
    version: '1.0.0',
  },
  sentry: {
    prefix: '/api/sentry',
    description: 'Sentry error tracking test routes (dev/test only)',
    version: '1.0.0',
  },
  stallDetection: {
    prefix: '/api/stall-detection',
    description:
      'Stall detection and recovery for proposal generation workflows',
    version: '1.0.0',
  },
} as const;

/**
 * Get route module information
 */
export function getRouteInfo() {
  return {
    modules: routeModules,
    totalModules: Object.keys(routeModules).length,
    timestamp: new Date().toISOString(),
  };
}
