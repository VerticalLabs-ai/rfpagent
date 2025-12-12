# RFP Discovery Process

## Overview

Automated workflow for discovering RFP opportunities from government procurement portals. Integrates with Mastra agents and the rfp-discovery-workflow.

---

## Discovery Workflow Stages

### Stage 1: Portal Initialization

**Agent**: `portal-manager` (Tier 2)

```yaml
inputs:
  - Active portal configurations
  - Scan frequency settings
  - Filter criteria (NAICS, set-aside, value range)

actions:
  - Fetch active portals from database
  - Validate portal credentials
  - Determine scan priority order
```

### Stage 2: Portal Scanning

**Agent**: `portal-scanner` (Tier 3)

```yaml
inputs:
  - Portal configuration
  - Last scan timestamp
  - Max RFPs per scan

actions:
  - Navigate to portal listing page
  - Authenticate if required
  - Extract opportunity listings
  - Download RFP documents

outputs:
  - Raw opportunity data
  - Document attachments
  - Scan metrics
```

### Stage 3: Data Extraction

**Service**: `incrementalPortalScanService`

```yaml
extraction_modes:
  api_first:
    confidence: 0.95
    fallback: html_scraping

  html_scraping:
    confidence: 0.75
    selectors: portal-specific

fields_extracted:
  - title (required)
  - agency (required)
  - sourceUrl (required)
  - deadline
  - estimatedValue
  - description
  - naicsCode
  - setAsideType
```

### Stage 4: Confidence Scoring

**Function**: `calculateConfidence()`

```typescript
// From rfp-discovery-workflow.ts
scoring_factors:
  title_present: +0.20
  title_descriptive: +0.05
  valid_url: +0.15
  valid_deadline: +0.10
  future_deadline: +0.05
  agency_present: +0.08
  description_present: +0.05
  description_detailed: +0.03
  category_present: +0.04
  value_present: +0.04

base_score: 0.50
min_threshold: 0.60  # Below this, flag for review
```

### Stage 5: Deduplication & Storage

**Service**: `storage`

```yaml
deduplication:
  - Match by solicitationNumber
  - Match by sourceUrl
  - Fuzzy match on title + agency

storage_actions:
  new_rfp: INSERT with status='discovered'
  updated_rfp: UPDATE existing record
  unchanged: Skip (no action)
```

### Stage 6: Notification

**Service**: `notifications`

```yaml
notification_triggers:
  - New RFPs discovered (count > 0)
  - RFPs updated (count > 0)
  - High-value opportunities (> threshold)
  - Approaching deadlines (< 7 days)
```

---

## Portal Scanning Triggers

### Scheduled Scanning

```yaml
# Default: Every 24 hours per portal
cron: '0 */24 * * *'
max_concurrent_portals: 5
```

### Manual Trigger

```typescript
// API endpoint: POST /api/portals/:id/scan
// Workflow: rfpDiscoveryWorkflow.execute({ maxPortals: 1 })
```

### Event-Driven

```yaml
triggers:
  - Portal added/activated
  - User requests refresh
  - Deadline approaching (re-scan for updates)
```

---

## Relevance Scoring Criteria

### Business Fit Score

```yaml
factors:
  naics_match: 0.30 # Matches company NAICS codes
  set_aside_eligible: 0.25 # Company qualifies for set-aside
  value_range: 0.20 # Within target contract value
  geographic_fit: 0.15 # Location matches capabilities
  past_performance: 0.10 # Similar work performed before
```

### Opportunity Quality Score

```yaml
factors:
  data_completeness: 0.25 # All fields populated
  deadline_viable: 0.25 # Sufficient time to respond
  clear_requirements: 0.20 # Well-defined scope
  reasonable_terms: 0.15 # Acceptable contract terms
  competition_level: 0.15 # Not overly competitive
```

---

## Alert & Notification Patterns

### Real-Time Alerts

```yaml
high_priority:
  - High-value opportunity (> $1M)
  - Set-aside match for company certifications
  - Deadline < 48 hours

medium_priority:
  - New opportunities in target NAICS
  - Updated RFPs (scope changes)

low_priority:
  - General discovery summary
  - Portal health updates
```

### Notification Channels

```yaml
channels:
  - In-app notifications (notifications table)
  - Email digest (configurable frequency)
  - Webhook (for integrations)
```

---

## Mastra Agent Integration

### Agent Hierarchy

```
Primary Orchestrator (Tier 1)
    └── Portal Manager (Tier 2)
            ├── Portal Scanner (Tier 3)
            └── Portal Monitor (Tier 3)
```

### Coordination Tools

```typescript
// From agent-coordination-tools.ts
sendAgentMessage(); // Inter-agent communication
updateWorkflowProgress(); // Progress tracking
```

### Workflow Binding

```typescript
// From rfp-discovery-workflow.ts
export const rfpDiscoveryWorkflow = createWorkflow({
  id: 'rfp-discovery',
  description: 'Discover RFP opportunities from multiple portals',
  inputSchema: z.object({
    maxPortals: z.number().optional().default(5),
  }),
});
```

---

## Error Handling

### Portal Errors

```yaml
error_types:
  auth_failure:
    action: Retry with fresh credentials
    max_retries: 3
    escalate_after: 3 failures

  rate_limit:
    action: Exponential backoff
    initial_delay: 60s
    max_delay: 3600s

  extraction_failure:
    action: Fall back to HTML scraping
    log: Detailed error for debugging

  network_error:
    action: Retry with timeout increase
    max_retries: 5
```

### Recovery Patterns

```yaml
partial_success:
  - Save successfully extracted RFPs
  - Log failed extractions
  - Continue with next portal

full_failure:
  - Update portal status to 'error'
  - Increment error count
  - Create admin notification
```

---

## Performance Metrics

### Key Metrics

```yaml
metrics:
  - Scan duration per portal
  - RFPs discovered per scan
  - Extraction success rate
  - Deduplication rate
  - False positive rate
```

### Database Tables

```sql
-- From shared/schema.ts
scans: Scan execution records
scanEvents: Detailed scan events
portals.lastScanned: Last successful scan
portals.errorCount: Consecutive errors
```
