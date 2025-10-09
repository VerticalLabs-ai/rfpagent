# Logging and Observability

**Last Updated**: January 2025

This document describes the structured logging infrastructure and observability features for the RFP Agent platform.

---

## Table of Contents

- [Overview](#overview)
- [Winston Logger](#winston-logger)
- [Correlation ID Middleware](#correlation-id-middleware)
- [Usage Examples](#usage-examples)
- [Environment Variables](#environment-variables)
- [Best Practices](#best-practices)
- [Related Documentation](#related-documentation)

---

## Overview

The platform uses a comprehensive logging and tracing system built on:

- **Winston** - Production-grade structured logging library
- **Correlation IDs** - Distributed request tracing for debugging across services
- **Context Management** - Child loggers with inherited context for organized logging
- **Environment-aware Output** - JSON in production, colorized human-readable in development

### Key Features

- ✅ **Structured Logging**: Consistent log format with metadata and context
- ✅ **Request Tracing**: Unique correlation IDs track requests across the system
- ✅ **Log Levels**: `debug`, `info`, `warn`, `error`, `fatal` with filtering
- ✅ **Specialized Methods**: Performance, HTTP, database, agent, and workflow logging
- ✅ **Child Loggers**: Scoped logging contexts that inherit parent configuration
- ✅ **File Rotation**: Automatic log file management in production

---

## Winston Logger

### Location

- Implementation: `server/utils/logger.ts`
- Tests: `tests/utils/logger.test.ts`

### Core API

```typescript
import { logger, createLogger } from '../utils/logger';

// Basic logging methods
logger.debug('Debug message', { metadata: 'value' });
logger.info('Info message', { user: 'john' });
logger.warn('Warning message', { threshold: 90 });
logger.error('Error occurred', error, { context: 'data' });
logger.fatal('Fatal error', error, { critical: true });
```

### Context Management

Set global context that appears in all subsequent logs:

```typescript
// Set global context
logger.setContext({
  service: 'portal-scanner',
  module: 'authentication',
});

logger.info('Started scanning');
// Output includes service="portal-scanner" module="authentication"
```

### Child Loggers

Create loggers with additional scoped context:

```typescript
// Create child logger with request-specific context
const requestLogger = logger.child({
  correlationId: 'req-abc-123',
  userId: 'user-456',
  requestId: 'req-789',
});

requestLogger.info('Processing request');
// Output includes all parent context + child context
```

### Specialized Logging Methods

#### Performance Logging

Track operation duration:

```typescript
const startTime = Date.now();
// ... perform operation
const duration = Date.now() - startTime;

logger.performance('database-query', duration, {
  query: 'SELECT * FROM portals',
  rows: 42,
});
```

#### HTTP Request Logging

Automatically logs with appropriate level based on status code:

```typescript
logger.http('GET', '/api/portals', 200, 45); // logs at info
logger.http('POST', '/api/users', 404, 12); // logs at warn
logger.http('GET', '/api/rfps', 500, 100); // logs at error
```

#### Database Query Logging

```typescript
logger.query(
  'SELECT * FROM proposals WHERE rfp_id = $1',
  23.5, // duration in ms
  { rows: 10, cached: false }
);
```

#### Agent Activity Logging

```typescript
logger.agent('agent-portal-123', 'started', {
  portalId: 'portal-456',
  scanType: 'incremental',
});
```

#### Workflow Event Logging

```typescript
logger.workflow('workflow-789', 'completed', {
  duration: 1500,
  tasksCompleted: 5,
  status: 'success',
});
```

---

## Correlation ID Middleware

### Location

- Implementation: `server/middleware/correlationId.ts`
- Tests: `tests/middleware/correlationId.test.ts`

### Purpose

Correlation IDs enable distributed tracing by assigning unique identifiers to each request, making it easy to track a single request across multiple services, logs, and async operations.

### How It Works

1. **Request Received**: Middleware checks for existing `X-Correlation-ID` header
2. **ID Generation**: Creates new correlation ID if none provided (`corr_` prefix + 16-char nanoid)
3. **Propagation**: Adds correlation ID to:
   - Request object (`req.correlationId`)
   - Response headers (`X-Correlation-ID`)
   - Request-scoped logger (`req.logger`)
4. **Logging**: Automatically logs incoming request with correlation context

### Usage

#### Middleware Setup

```typescript
import { correlationIdMiddleware } from './middleware/correlationId';

app.use(correlationIdMiddleware);
```

#### Accessing Correlation ID

```typescript
import { getCorrelationId, getRequestLogger } from './middleware/correlationId';

router.get('/api/example', async (req, res) => {
  // Get correlation ID
  const correlationId = getCorrelationId(req);
  console.log(`Processing request: ${correlationId}`);

  // Use request-scoped logger
  const logger = getRequestLogger(req);
  logger.info('Handling API request', {
    endpoint: '/api/example',
    params: req.params,
  });

  res.json({ correlationId });
});
```

#### Client Usage

Clients can pass their own correlation ID for distributed tracing:

```bash
curl -H "X-Correlation-ID: client-trace-abc-123" \
  https://api.example.com/api/portals
```

The server will use the client-provided ID, enabling end-to-end request tracking.

---

## Usage Examples

### Express Route with Full Logging

```typescript
import { getRequestLogger } from '../middleware/correlationId';

router.post('/api/portals/:id/scan', async (req, res) => {
  const logger = getRequestLogger(req);
  const { id } = req.params;

  logger.info('Starting portal scan', {
    portalId: id,
    userId: req.user?.id,
  });

  try {
    const startTime = Date.now();

    // Perform scan
    const results = await scanPortal(id);

    const duration = Date.now() - startTime;
    logger.performance('portal-scan', duration, {
      portalId: id,
      rfpsFound: results.length,
    });

    logger.info('Portal scan completed successfully', {
      portalId: id,
      rfpCount: results.length,
    });

    res.json({ success: true, results });

  } catch (error) {
    logger.error('Portal scan failed', error, {
      portalId: id,
      errorType: error.name,
    });

    res.status(500).json({
      error: 'Scan failed',
      correlationId: req.correlationId,
    });
  }
});
```

### Background Job with Child Logger

```typescript
import { logger } from '../utils/logger';

async function processRFPQueue() {
  // Create job-specific logger
  const jobLogger = logger.child({
    service: 'queue-processor',
    workflowId: 'rfp-processing',
  });

  jobLogger.info('Starting RFP queue processing');

  for (const rfp of await getRFPQueue()) {
    // Create RFP-specific logger
    const rfpLogger = jobLogger.child({
      rfpId: rfp.id,
      portalId: rfp.portalId,
    });

    rfpLogger.info('Processing RFP', {
      title: rfp.title,
      deadline: rfp.deadline,
    });

    try {
      await processRFP(rfp, rfpLogger);
      rfpLogger.info('RFP processed successfully');
    } catch (error) {
      rfpLogger.error('RFP processing failed', error);
    }
  }

  jobLogger.info('Queue processing completed');
}
```

### Agent System Integration

```typescript
import { createLogger } from '../utils/logger';

class PortalScannerAgent {
  private logger;

  constructor(agentId: string, portalId: string) {
    // Create agent-specific logger
    this.logger = createLogger({
      service: 'agent-system',
      agentId,
      portalId,
    });
  }

  async scan() {
    this.logger.agent(this.agentId, 'started', {
      action: 'portal-scan',
    });

    try {
      // Perform scan
      const results = await this.performScan();

      this.logger.agent(this.agentId, 'completed', {
        rfpsFound: results.length,
        status: 'success',
      });

      return results;

    } catch (error) {
      this.logger.agent(this.agentId, 'failed', {
        error: error.message,
      });
      throw error;
    }
  }
}
```

---

## Environment Variables

### LOG_LEVEL

Controls minimum log level to output.

**Options**: `debug` | `info` | `warn` | `error` | `fatal`

**Default**:
- `debug` in development (`NODE_ENV=development`)
- `info` in production (`NODE_ENV=production`)

**Example**:
```bash
# Show only warnings and errors
LOG_LEVEL=warn pnpm dev

# Show all logs including debug
LOG_LEVEL=debug pnpm dev
```

### NODE_ENV

Controls log output format and file logging.

**Options**: `development` | `production` | `test`

**Behavior**:
- **development**: Colorized console output, human-readable format
- **production**: JSON format, file logging enabled (`logs/` directory)
- **test**: Minimal output, no file logging

**Production Log Files**:
- `logs/combined.log` - All logs (max 10MB, 5 files)
- `logs/error.log` - Error and fatal logs only (max 10MB, 5 files)

---

## Best Practices

### ✅ DO

1. **Use request-scoped loggers in routes**:
   ```typescript
   const logger = getRequestLogger(req);
   logger.info('Processing request');
   ```

2. **Create child loggers for different contexts**:
   ```typescript
   const agentLogger = logger.child({ agentId, workflowId });
   ```

3. **Include correlation IDs in error responses**:
   ```typescript
   res.status(500).json({
     error: 'Internal server error',
     correlationId: req.correlationId,
   });
   ```

4. **Log errors with full context**:
   ```typescript
   logger.error('Database query failed', error, {
     query: sql,
     params: queryParams,
     userId: req.user?.id,
   });
   ```

5. **Use specialized logging methods**:
   ```typescript
   logger.performance('api-call', duration, { endpoint });
   logger.http(req.method, req.path, res.statusCode, duration);
   ```

6. **Set appropriate log levels**:
   - `debug`: Detailed diagnostic information
   - `info`: General informational messages
   - `warn`: Warning messages for potential issues
   - `error`: Error messages for failures
   - `fatal`: Critical errors requiring immediate attention

### ❌ DON'T

1. **Don't use console.log/console.error**:
   ```typescript
   // ❌ Bad
   console.log('User logged in:', userId);

   // ✅ Good
   logger.info('User logged in', { userId });
   ```

2. **Don't log sensitive data**:
   ```typescript
   // ❌ Bad
   logger.info('User login', { password: req.body.password });

   // ✅ Good
   logger.info('User login', {
     userId: req.body.userId,
     // No password logged
   });
   ```

3. **Don't create loggers in tight loops**:
   ```typescript
   // ❌ Bad
   for (const item of items) {
     const logger = createLogger({ itemId: item.id });
     logger.info('Processing item');
   }

   // ✅ Good
   const logger = createLogger({ batchId });
   for (const item of items) {
     logger.info('Processing item', { itemId: item.id });
   }
   ```

4. **Don't ignore correlation IDs in async operations**:
   ```typescript
   // ❌ Bad
   setTimeout(() => {
     logger.info('Delayed operation'); // Lost correlation context
   }, 1000);

   // ✅ Good
   const reqLogger = getRequestLogger(req);
   setTimeout(() => {
     reqLogger.info('Delayed operation'); // Maintains correlation
   }, 1000);
   ```

---

## Related Documentation

- [Testing Guide](../testing/testing-guide.md) - Testing logging and correlation ID features
- [Models Reference](models-reference.md) - AI models configuration
- [Agents Architecture](agents-architecture.md) - Agent system logging patterns
- [API Documentation](../api/README.md) - API logging standards
- [Deployment Guide](../deployment/deployment-guide.md) - Production log management

---

## Database Performance

The logging improvements work in conjunction with **GIN indexes** for better JSONB query performance. See migration: `migrations/add_gin_indexes.sql`

GIN indexes optimize queries on:
- `rfps.requirements`
- `rfps.compliance_items`
- `proposals.proposal_data`
- `portals.selectors`
- `submissions.submission_data`
- `work_items.inputs` and `work_items.metadata`

---

**Questions or Issues?**

Open an issue in the repository with the `documentation` or `logging` label.
