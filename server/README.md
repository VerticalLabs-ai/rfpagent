# RFP Agent Backend Server

## Quick Start

```bash
# Development
pnpm dev

# Production
pnpm build
pnpm start

# Type checking
pnpm check
```

## Architecture Overview

```
server/
├── routes/              # API route handlers
├── services/            # Business logic services
├── utils/               # Utility functions
├── repositories/        # Data access layer
└── index.ts            # Server entry point
```

## New Backend Utilities

### 1. Structured Logging

```typescript
import { logger, createLogger } from './utils/logger';

// Basic logging
logger.info('User action', { userId: '123', action: 'login' });
logger.error('Database error', error, { query: 'SELECT ...' });

// Child logger with context
const requestLogger = logger.child({ requestId: req.id });
requestLogger.info('Processing request');

// Performance tracking
logger.performance('operation-name', 1234, { records: 100 });
```

### 2. API Response Standardization

```typescript
import { ApiResponse } from './utils/apiResponse';

// Success
return ApiResponse.success(res, data, { message: 'Success' });

// Paginated
return ApiResponse.paginated(res, items, { page: 1, limit: 50, total: 245 });

// Errors
return ApiResponse.notFound(res, 'RFP');
return ApiResponse.validationError(res, errors);
return ApiResponse.unauthorized(res);
return ApiResponse.internalError(res, 'Error', details);
```

### 3. Circuit Breaker Pattern

```typescript
import { withCircuitBreaker } from './utils/circuitBreaker';

// Protect external service calls
const result = await withCircuitBreaker(
  'openai-api',
  async () => await openai.chat.completions.create({...}),
  { failureThreshold: 5, timeout: 60000 }
);
```

### 4. Retry Logic

```typescript
import { retry, retryHttp, retryDatabase } from './utils/retry';

// Generic retry
const data = await retry(async () => await fetchData(), {
  maxAttempts: 3,
  initialDelay: 1000,
  backoffMultiplier: 2,
});

// HTTP retry (handles 5xx, 429)
const response = await retryHttp(async () => await fetch(url));

// Database retry (handles connection errors)
const user = await retryDatabase(async () => await db.getUser(id));
```

### 5. WebSocket Service

```typescript
import { websocketService } from './services/websocketService';

// Broadcast to all clients
websocketService.broadcast({
  type: 'notification',
  payload: { message: 'System update' },
  timestamp: new Date().toISOString(),
});

// Broadcast to channel subscribers
websocketService.broadcastToChannel('rfps', {
  type: 'rfp:discovered',
  payload: rfpData,
  timestamp: new Date().toISOString(),
});

// Convenience methods
websocketService.notifyRfpDiscovered(rfpData);
websocketService.notifyProposalGenerated(proposalData);
websocketService.notifyWorkflowProgress(workflowData);
```

## API Endpoints

### Health Checks

```
GET  /api/health              # Quick health check
GET  /api/health/detailed     # Comprehensive health status
GET  /api/health/circuit-breakers  # Circuit breaker stats
GET  /api/health/ready        # Kubernetes readiness probe
GET  /api/health/live         # Kubernetes liveness probe
POST /api/health/cache/clear  # Clear health check cache
```

### WebSocket

```
WS   /ws                      # WebSocket endpoint
```

## Error Handling Best Practices

### Route Handlers

```typescript
import { handleAsyncError } from './routes/middleware/errorHandling';
import { ApiResponse } from './utils/apiResponse';
import { logger } from './utils/logger';

router.get(
  '/example/:id',
  handleAsyncError(async (req, res) => {
    const log = logger.child({ resourceId: req.params.id });

    // Validation
    if (!req.params.id) {
      return ApiResponse.validationError(res, [
        { field: 'id', message: 'ID is required' },
      ]);
    }

    // Business logic
    const resource = await getResource(req.params.id);

    if (!resource) {
      log.warn('Resource not found');
      return ApiResponse.notFound(res, 'Resource');
    }

    log.info('Resource retrieved successfully');
    return ApiResponse.success(res, resource);
  })
);
```

### Service Layer

```typescript
import { logger } from './utils/logger';
import { retry } from './utils/retry';
import { withCircuitBreaker } from './utils/circuitBreaker';

export class ExampleService {
  private logger = logger.child({ service: 'ExampleService' });

  async processData(input: any) {
    this.logger.info('Processing started', { inputSize: input.length });

    try {
      // With retry logic
      const data = await retry(async () => await this.fetchData(input), {
        maxAttempts: 3,
      });

      // With circuit breaker
      const result = await withCircuitBreaker(
        'external-api',
        async () => await this.callExternalApi(data)
      );

      this.logger.info('Processing completed', { resultCount: result.length });
      return result;
    } catch (error) {
      this.logger.error('Processing failed', error as Error, { input });
      throw error;
    }
  }
}
```

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development|production

# Logging
LOG_LEVEL=debug|info|warn|error|fatal

# Database
DATABASE_URL=postgresql://...

# External Services
OPENAI_API_KEY=...
BROWSERBASE_API_KEY=...
```

### Rate Limiting

```typescript
import {
  rateLimiter, // Default: 100 req/15min
  strictRateLimiter, // Strict: 20 req/15min
  heavyOperationLimiter, // Heavy: 10 req/hour
  aiOperationLimiter, // AI: 50 req/10min
  uploadLimiter, // Upload: 30 req/15min
  scanLimiter, // Scan: 5 req/30min
} from './routes/middleware/rateLimiting';

// Use in routes
router.post('/heavy-operation', heavyOperationLimiter, handler);
router.post('/ai/generate', aiOperationLimiter, handler);
```

## Monitoring

### Health Checks

```bash
# Quick check
curl http://localhost:3000/api/health

# Detailed health
curl http://localhost:3000/api/health/detailed

# Response
{
  "status": "healthy",
  "uptime": 12345,
  "services": {
    "database": { "status": "up", "responseTime": 45 },
    "agents": { "status": "up", "details": { "activeAgents": 11 } }
  }
}
```

### Logs

```bash
# View logs in development (human-readable)
pnpm dev

# Production logs (JSON format)
pnpm start | jq

# Filter logs by level
pnpm start | grep '"level":"error"'
```

### WebSocket Stats

```bash
# Get connection statistics
curl http://localhost:3000/api/health/detailed | jq '.websocket'
```

## Testing

### Unit Tests

```bash
pnpm test
```

### Integration Tests

```bash
pnpm test:integration
```

### Manual Testing

```bash
# Test health endpoint
curl http://localhost:3000/api/health

# Test WebSocket
wscat -c ws://localhost:3000/ws

# Send subscribe message
{"type":"subscribe","payload":{"channels":["rfps","agents"]}}
```

## Development Guidelines

### Adding New Routes

1. Create route file in `routes/`
2. Use `handleAsyncError` wrapper
3. Use `ApiResponse` for responses
4. Add validation with Zod schemas
5. Add logging with context
6. Register in `routes/index.ts`

### Adding New Services

1. Create service file in `services/`
2. Add structured logging
3. Use retry logic for external calls
4. Use circuit breakers for critical services
5. Export singleton instance
6. Add comprehensive error handling

### Code Quality

```bash
# Lint
pnpm lint

# Format
pnpm format

# Type check
pnpm check

# Run all quality checks
pnpm quality
```

## Troubleshooting

### Circuit Breaker Open

If you see "Circuit breaker is open" errors:

1. Check service health: `GET /api/health/circuit-breakers`
2. Review logs for underlying errors
3. Wait for circuit to enter half-open state
4. Fix underlying issue
5. Reset circuit breaker if needed

### High Memory Usage

1. Check health: `GET /api/health/detailed`
2. Review memory metrics in logs
3. Check for memory leaks in long-running operations
4. Increase heap size if needed: `NODE_OPTIONS="--max-old-space-size=4096"`

### WebSocket Connection Issues

1. Check WebSocket stats: `websocketService.getStats()`
2. Verify ping/pong mechanism
3. Check for firewall/proxy issues
4. Review client-side reconnection logic

## Additional Resources

- [Backend Improvements Documentation](../BACKEND_IMPROVEMENTS.md)
- [API Documentation](../docs/api.md)
- [Testing Guide](../TESTING_GUIDE.md)
- [Architecture Diagram](../docs/architecture.md)
