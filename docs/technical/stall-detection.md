# Proposal Generation Stall Detection and Recovery

## Overview

The stall detection system monitors RFP proposal generations to detect, alert, and recover from workflows that get stuck in "drafting" status indefinitely. This ensures that proposal generation failures are automatically handled with retries, and users are notified when manual intervention is required.

## Problem Addressed

Before this system, the proposal generation workflow had several critical gaps:

1. **Memory-based pipeline tracking** - The `activePipelines` Map in `proposalGenerationOrchestrator.ts` was lost on server restart, leaving RFPs stuck in "drafting" status
2. **No stall detection** - If AI generation hung or timed out silently, RFPs remained in "drafting" forever
3. **Silent timeouts** - 30-minute phase timeouts failed silently without alerting users
4. **No manual intervention** - No API to restart or cancel stalled drafts
5. **No alerting** - Users weren't notified when generations stalled

## Architecture

### Database-Backed State Tracking

The system uses database fields instead of in-memory tracking to survive server restarts:

```sql
-- New fields added to rfps table
generation_started_at TIMESTAMP,           -- When generation was started (null when not generating)
generation_attempts INTEGER DEFAULT 0,      -- Number of generation attempts made
max_generation_attempts INTEGER DEFAULT 3,  -- Maximum allowed retry attempts
last_generation_error TEXT,                 -- Last error message from generation attempt
generation_timeout_minutes INTEGER DEFAULT 45  -- Timeout before considered stalled
```

### Stall Detection Logic

An RFP is considered "stalled" when:
- `status = 'drafting'`
- `generation_started_at IS NOT NULL`
- `generation_started_at + generation_timeout_minutes < NOW()`

### Automatic Recovery Flow

```
1. Stall detected
   ↓
2. Check attempt count
   ↓
3a. If attempts < max_attempts:
    - Reset status to 'discovered'
    - Increment attempt counter
    - Create retry notification
    - RFP will be re-queued for generation
   ↓
3b. If attempts >= max_attempts:
    - Reset status to 'discovered'
    - Create failure notification
    - Mark for manual intervention
```

## API Endpoints

### GET /api/stall-detection/stalled
Returns list of currently stalled RFPs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "rfp-123",
      "title": "Example RFP",
      "status": "drafting",
      "generationStartedAt": "2025-12-06T10:00:00Z",
      "generationTimeoutMinutes": 45,
      "generationAttempts": 1,
      "maxGenerationAttempts": 3,
      "lastGenerationError": null,
      "progress": 40
    }
  ],
  "message": "Found 1 stalled RFP(s)"
}
```

### POST /api/stall-detection/run-check
Manually triggers a stall check and processes any stalled RFPs.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "rfpId": "rfp-123",
      "action": "retry",
      "newAttemptCount": 2,
      "notificationCreated": true
    }
  ],
  "message": "Processed 1 stalled RFP(s)"
}
```

### POST /api/stall-detection/rfp/:rfpId/restart
Manually restart proposal generation for an RFP with fresh attempt counter.

**Response:**
```json
{
  "success": true,
  "data": {
    "rfpId": "rfp-123",
    "action": "retry",
    "newAttemptCount": 0,
    "notificationCreated": false
  },
  "message": "Proposal generation restarted successfully"
}
```

### POST /api/stall-detection/rfp/:rfpId/cancel
Cancel stalled proposal generation.

**Request Body:**
```json
{
  "reason": "Optional cancellation reason"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "rfpId": "rfp-123",
    "action": "cancelled",
    "notificationCreated": true
  },
  "message": "Proposal generation cancelled successfully"
}
```

### GET /api/stall-detection/status
Get current stall detection monitoring status.

**Response:**
```json
{
  "success": true,
  "data": {
    "isMonitoring": true,
    "checkIntervalMs": 300000,
    "checkIntervalMinutes": 5
  },
  "message": "Stall detection monitoring is active"
}
```

### POST /api/stall-detection/monitoring/start
Start automated stall detection monitoring.

### POST /api/stall-detection/monitoring/stop
Stop automated stall detection monitoring.

## Configuration

### Timeout Configuration

The default timeout is 45 minutes to accommodate premium Claude generation which can take 15+ minutes per section. This can be configured per-RFP via the `generation_timeout_minutes` field.

### Retry Configuration

- Default maximum attempts: 3
- Configurable per-RFP via `max_generation_attempts` field

### Check Interval

The monitoring service checks for stalled RFPs every 5 minutes by default. This can be adjusted via the `setCheckIntervalMs()` method.

## Notifications

The system creates notifications for:

1. **Proposal Generation Retry** - When an RFP is automatically retried
2. **Proposal Generation Failed** - When max attempts are exhausted (requires manual intervention)
3. **Proposal Generation Cancelled** - When a user cancels a stalled generation

All notifications are linked to the RFP entity for easy navigation.

## Audit Logging

All stall detection actions are logged to the audit log:

- `generation_retry` - Automatic or manual retry
- `generation_failed` - Max attempts exhausted
- `generation_cancelled` - User cancelled
- `generation_restart` - Manual restart with reset attempt counter

## Files

### Service
- `server/services/monitoring/stallDetectionService.ts` - Core stall detection and recovery logic

### Routes
- `server/routes/stall-detection.routes.ts` - API endpoints

### Storage
- `server/storage.ts` - Added `getStalledRFPs()` method

### Schema
- `shared/schema.ts` - Added stall detection fields to rfps table

### Frontend Utils
- `client/src/lib/notification-utils.ts` - Helpers for identifying stall-related notifications

## Usage Examples

### Check for Stalled RFPs in Frontend

```typescript
import {
  isStallRelatedNotification,
  getStallNotificationSeverity,
} from '@/lib/notification-utils';

// In a notification component
if (isStallRelatedNotification(notification)) {
  const severity = getStallNotificationSeverity(notification);
  // Handle critical/warning/info differently
}
```

### Manual Restart via API

```bash
curl -X POST http://localhost:3000/api/stall-detection/rfp/rfp-123/restart
```

### Check Monitoring Status

```bash
curl http://localhost:3000/api/stall-detection/status
```

## Deployment Notes

- Stall detection monitoring starts automatically in production (`NODE_ENV=production`)
- The service gracefully shuts down on SIGTERM
- Database migrations must be applied before deployment (`npm run db:push`)

## Related Documentation

- [Proposal Generation Pipeline](./proposal-generation.md)
- [Logging and Observability](./logging-and-observability.md)
- [Agents Architecture](./agents-architecture.md)
