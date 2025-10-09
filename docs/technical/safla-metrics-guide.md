# SAFLA Metrics Guide

**Last Updated**: January 2025

## Overview

The SAFLA (Self-Aware Feedback Loop Algorithm) system tracks real-time performance metrics using database queries. This guide explains how each metric is calculated and what the values mean.

## Core Metrics

### System Health (%)

**Current Calculation**: [continuousImprovementMonitor.ts:197-253](../../server/services/continuousImprovementMonitor.ts#L197-L253)

```sql
SELECT
  agentId,
  AVG(metricValue) as avgSuccess,
  AVG(metricValue) as avgEfficiency,
  COUNT(*) as errorCount
FROM agent_performance_metrics
WHERE metricType = 'task_completion'
  AND recordedAt BETWEEN startDate AND endDate
GROUP BY agentId
```

**Formula**:
```
Component Health = (successScore * 40) + (efficiencyScore * 40) + reliabilityScore
  where:
    - successScore = avgSuccess * 40
    - efficiencyScore = avgEfficiency * 40
    - reliabilityScore = MAX(0, 20 - errorCount)

Overall Health = AVG(all component healths) OR 50 (if no data)
```

**What It Means**:
- **90-100%**: Excellent - All agents performing optimally
- **70-89%**: Good - Minor issues, system functioning well
- **50-69%**: Fair - Noticeable issues, investigation needed
- **Below 50%**: Poor - System degraded, immediate attention required

**Why It Shows 50%**:
- Default value when `agent_performance_metrics` table is empty
- NOT a hardcoded placeholder - it's the mathematical fallback
- Will increase as agents complete tasks and record metrics

---

### Learning Rate (events/day)

**Current Calculation**: [continuousImprovementMonitor.ts:258-334](../../server/services/continuousImprovementMonitor.ts#L258-L334)

```sql
SELECT COUNT(*)
FROM agent_memory
WHERE memoryType = 'episodic'
  AND createdAt BETWEEN startDate AND endDate
```

**Formula**:
```
Learning Rate = totalLearningEvents / daysDiff
```

**What It Means**:
- **10+**: Very active learning - system adapting rapidly
- **5-10**: Moderate learning - healthy improvement rate
- **1-5**: Low learning - limited adaptation occurring
- **0**: No learning events - system not yet active

**Why It Shows 0**:
- System just initialized with no learning events yet
- Increases as agents:
  - Complete portal scans
  - Process documents
  - Generate proposals
  - Record outcomes

---

### Knowledge Growth (entries/day)

**Current Calculation**: [continuousImprovementMonitor.ts:281-289](../../server/services/continuousImprovementMonitor.ts#L281-L289)

```sql
SELECT COUNT(*)
FROM agent_knowledge_base
WHERE createdAt BETWEEN startDate AND endDate
```

**Formula**:
```
Knowledge Growth = knowledgeEntries / daysDiff
```

**What It Means**:
- **15+**: Rapid knowledge expansion
- **10-15**: Healthy knowledge building
- **5-10**: Moderate knowledge acquisition
- **0-5**: Minimal new knowledge
- **0**: No knowledge entries yet

**Why It Shows 0**:
- `agent_knowledge_base` table is empty (new system)
- Populated when agents learn from:
  - Successful strategies
  - Failed attempts (what to avoid)
  - Portal navigation patterns
  - Document parsing techniques

---

### Adaptation Success (%)

**Current Calculation**: [continuousImprovementMonitor.ts:292-308](../../server/services/continuousImprovementMonitor.ts#L292-L308)

```sql
SELECT AVG(metricValue)
FROM agent_performance_metrics
WHERE metricType = 'task_completion'
  AND recordedAt BETWEEN startDate AND endDate
```

**Formula**:
```
Adaptation Success = avgImprovement * 100
```

**What It Means**:
- **80-100%**: Excellent adaptation - changes working well
- **60-80%**: Good adaptation - most changes effective
- **40-60%**: Moderate - mixed results from adaptations
- **Below 40%**: Poor - adaptations not effective

**Why It Shows 0%**:
- No performance metrics recorded yet
- Will increase as system adapts strategies based on outcomes

---

## Performance Metrics

### Proposal Win Rate (%)

**Source Table**: `proposals`
**Calculation**: `(approved proposals / total proposals) * 100`
**Query**: [continuousImprovementMonitor.ts:350-368](../../server/services/continuousImprovementMonitor.ts#L350-L368)

### Parsing Accuracy (%)

**Source Table**: `agent_memory` with `metadata.accuracy`
**Calculation**: `AVG(accuracy) * 100 OR 85 (default)`
**Query**: [continuousImprovementMonitor.ts:371-387](../../server/services/continuousImprovementMonitor.ts#L371-L387)

### Portal Navigation Success (%)

**Source Table**: `scans`
**Calculation**: `(completed scans / total scans) * 100`
**Query**: [continuousImprovementMonitor.ts:390-405](../../server/services/continuousImprovementMonitor.ts#L390-L405)

### Document Processing Time (seconds)

**Source Table**: `documents`
**Calculation**: `AVG(processing time) OR 45 (default)`
**Query**: [continuousImprovementMonitor.ts:408-423](../../server/services/continuousImprovementMonitor.ts#L408-L423)

---

## Improvement Opportunities

### How They're Generated

Improvement opportunities are identified by comparing current performance against target thresholds:

**Targets** (from [continuousImprovementMonitor.ts:123-130](../../server/services/continuousImprovementMonitor.ts#L123-L130)):
```typescript
{
  proposalWinRate: 0.25 (25%),
  parsingAccuracy: 0.95 (95%),
  portalNavigationSuccess: 0.95 (95%),
  documentProcessingTime: 30 seconds,
  learningRate: 0.15 events/day,
  knowledgeGrowth: 0.2 entries/day
}
```

### Priority Levels

- **High Priority**: >20% below target, significant impact
- **Medium Priority**: 10-20% below target, moderate impact
- **Low Priority**: <10% below target, minor improvement

### Taking Action on Opportunities

**Current State**: Opportunities are displayed but **no UI controls exist** to execute them.

**How to Execute Improvements** (Manual):

1. **Portal Navigation Enhancement**
   ```bash
   curl -X POST http://localhost:3000/api/safla/record-learning \
     -H "Content-Type: application/json" \
     -d '{
       "portalId": "portal-id",
       "learningType": "portal",
       "data": {...},
       "success": true
     }'
   ```

2. **Document Processing Improvement**
   ```bash
   curl -X POST http://localhost:3000/api/safla/record-learning \
     -H "Content-Type: application/json" \
     -d '{
       "learningType": "document",
       "data": {
         "documentId": "doc-id",
         "accuracy": 0.95
       }
     }'
   ```

3. **Trigger Memory Consolidation**
   ```bash
   curl -X POST http://localhost:3000/api/safla/consolidate-memory
   ```

---

## Getting Real Data

### Option 1: Use Demo Learning Workflows

```bash
# Portal discovery learning
curl -X POST http://localhost:3000/api/safla/demonstrate/portal_discovery

# Document processing learning
curl -X POST http://localhost:3000/api/safla/demonstrate/document_processing

# Proposal generation learning
curl -X POST http://localhost:3000/api/safla/demonstrate/proposal_generation
```

These will create sample learning events and populate metrics.

### Option 2: Run Actual Workflows

1. Scan a portal → Creates `scans` records
2. Process documents → Creates `documents` and `agent_memory` records
3. Generate proposals → Creates `proposals` records
4. Record outcomes → Creates `agent_performance_metrics` records

### Option 3: Seed Database (Recommended for Testing)

Create a seed script that populates:
- `agent_performance_metrics` - Task completion data
- `agent_memory` - Learning events
- `agent_knowledge_base` - Knowledge entries
- `proposals`, `scans`, `documents` - Actual work data

---

## Database Schema Reference

### Tables Used by SAFLA

1. **agent_performance_metrics** - Task completion metrics
2. **agent_memory** - Learning events and memories
3. **agent_knowledge_base** - Accumulated knowledge
4. **proposals** - Proposal outcomes
5. **scans** - Portal scanning results
6. **documents** - Document processing records

### Sample Data Requirements

For meaningful metrics, you need:
- **Minimum**: 10 learning events, 5 completed tasks
- **Recommended**: 50+ events, 20+ tasks
- **Production**: Continuous data from actual workflows

---

## Troubleshooting

### "All metrics show 0"
- **Cause**: Database tables are empty
- **Fix**: Run demo workflows or seed database

### "50% system health never changes"
- **Cause**: No `agent_performance_metrics` records
- **Fix**: Agents need to complete tasks and record metrics

### "Improvement opportunities list but can't execute"
- **Cause**: Missing UI action buttons
- **Fix**: Use API endpoints directly or wait for UI implementation

### "Knowledge growth stays at 0"
- **Cause**: No entries in `agent_knowledge_base`
- **Fix**: Record learning outcomes after task completion

---

## Related Documentation

- [SAFLA System Architecture](./agents-architecture.md)
- [Agent Memory System](./agents-architecture.md#memory-systems)
- [Performance Monitoring API](../guides/api-reference.md#safla-endpoints)

---

## API Endpoints

### Get Dashboard
```
GET /api/safla/dashboard?timeframe=24h
```

### Get System Report
```
GET /api/safla/report
```

### Record Learning Event
```
POST /api/safla/record-learning
Body: { portalId, learningType, data, success }
```

### Trigger Memory Consolidation
```
POST /api/safla/consolidate-memory
```

### Run Demo Workflow
```
POST /api/safla/demonstrate/:scenario
Scenarios: portal_discovery, document_processing, proposal_generation
```
