import { expressIntegration, init } from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

init({
  dsn:
    process.env.SENTRY_DSN ||
    'https://315d8fa4019d9670c0496e5f71f562d9@o4510143884296192.ingest.us.sentry.io/4510155732615168',

  // Set sample rate for production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Enable profiling
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  integrations: [
    // Add Express.js integration
    expressIntegration(),
    // Add profiling integration
    nodeProfilingIntegration(),
  ],

  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,

  // Set environment
  environment: process.env.NODE_ENV || 'development',

  // Release tracking
  release: process.env.FLY_APP_NAME
    ? `${process.env.FLY_APP_NAME}@${process.env.FLY_RELEASE_VERSION || 'unknown'}`
    : undefined,

  // Tag with fly.io specific info
  initialScope: {
    tags: {
      'fly.app': process.env.FLY_APP_NAME,
      'fly.region': process.env.FLY_REGION,
      'fly.alloc_id': process.env.FLY_ALLOC_ID,
    },
  },

  // Before send hook to filter out sensitive data
  beforeSend(event, hint) {
    // Filter out database URLs and other sensitive data from breadcrumbs and context
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
        if (breadcrumb.message && breadcrumb.message.includes('DATABASE_URL')) {
          breadcrumb.message = breadcrumb.message.replace(
            /postgresql:\/\/[^@]+@[^\s]+/,
            'postgresql://***:***@***/***'
          );
        }
        return breadcrumb;
      });
    }

    return event;
  },
});
