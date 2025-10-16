# Workflow API Endpoints
**Version**: 1.1.0
**Date**: October 16, 2025
**Base URL**: `http://localhost:5001/api/workflows`

---

## 📋 Table of Contents

1. [Workflow Execution Endpoints](#workflow-execution-endpoints)
2. [Workflow Management Endpoints](#workflow-management-endpoints)
3. [Phase Management Endpoints](#phase-management-endpoints)
4. [Response Formats](#response-formats)
5. [Error Handling](#error-handling)

---

## 🚀 Workflow Execution Endpoints

### 1. Master Orchestration Workflow ✨ **NEW**

**Endpoint**: `POST /api/workflows/master-orchestration/execute`

**Description**: Executes the master orchestration workflow with support for 3 operational modes: discovery, proposal generation, and full pipeline automation.

**Modes**:
- `discovery`: Scan government portals for RFPs
- `proposal`: Generate proposal for specific RFP
- `full_pipeline`: End-to-end automation (discovery + proposal generation)

**Request Body**:
```typescript
{
  mode: 'discovery' | 'proposal' | 'full_pipeline';
  portalIds?: string[];           // Required for discovery & full_pipeline
  rfpId?: string;                 // Required for proposal mode
  companyProfileId?: string;      // Required for proposal & full_pipeline
  options?: {
    deepScan?: boolean;           // Deep portal scanning
    autoSubmit?: boolean;         // Auto-submit proposals
    parallel?: boolean;           // Parallel processing
    maxConcurrent?: number;       // Max concurrent RFPs (default: 3)
    notifyOnCompletion?: boolean; // Send notifications
  };
}
```

**Examples**:

**Discovery Mode**:
```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "portalIds": ["bonfire-123", "sam-gov-456"],
    "options": {
      "deepScan": true,
      "parallel": true
    }
  }'
```

**Proposal Mode**:
```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "proposal",
    "rfpId": "rfp_abc123",
    "companyProfileId": "company_xyz789"
  }'
```

**Full Pipeline Mode**:
```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full_pipeline",
    "portalIds": ["bonfire-123"],
    "companyProfileId": "company_xyz789",
    "options": {
      "deepScan": true,
      "autoSubmit": false,
      "maxConcurrent": 3
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "mode": "full_pipeline",
  "discoveredRfps": 8,
  "processedRfps": 8,
  "proposalsGenerated": 5,
  "message": "Master orchestration workflow (full_pipeline) completed successfully"
}
```

**Features**:
- ✅ BonfireHub authentication caching (24-hour TTL)
- ✅ Batch RFP processing with concurrency control
- ✅ Automatic error recovery and retry logic
- ✅ Progress tracking integration

---

### 2. Proposal PDF Assembly Workflow ✨ **NEW**

**Endpoint**: `POST /api/workflows/proposal-pdf-assembly/execute`

**Description**: Assembles a professional PDF document from proposal content with custom formatting and branding.

**Request Body**:
```typescript
{
  proposalId: string;            // Required
  options?: {
    includeExecutiveSummary?: boolean;
    includePricingTable?: boolean;
    customHeader?: string;
    customFooter?: string;
    pageMargins?: {
      top: number;
      bottom: number;
      left: number;
      right: number;
    };
  };
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/proposal-pdf-assembly/execute \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "prop_abc123",
    "options": {
      "includeExecutiveSummary": true,
      "includePricingTable": true,
      "customHeader": "Company Logo"
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "proposalId": "prop_abc123",
  "pdfUrl": "https://storage.googleapis.com/proposals/prop_abc123.pdf",
  "message": "Proposal PDF assembled successfully"
}
```

**Features**:
- ✅ Professional PDF formatting
- ✅ Automatic page breaks and section organization
- ✅ Custom headers and footers
- ✅ Pricing table generation
- ✅ Automatic upload to object storage

---

### 3. Document Processing Workflow

**Endpoint**: `POST /api/workflows/document-processing/execute`

**Description**: Processes RFP documents with PDF extraction and AI analysis.

**Request Body**:
```typescript
{
  rfpId: string;                  // Required
  companyProfileId?: string;
  analysisType?: 'standard' | 'deep';
  priority?: number;              // 1-10 (default: 5)
  deadline?: string;              // ISO 8601 date
  options?: Record<string, any>;
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/document-processing/execute \
  -H "Content-Type: application/json" \
  -d '{
    "rfpId": "rfp_abc123",
    "companyProfileId": "company_xyz789",
    "analysisType": "deep",
    "priority": 8
  }'
```

**Response**:
```json
{
  "success": true,
  "workflowId": "wf_12345",
  "sessionId": "analysis_rfp_abc123_1697472000000",
  "message": "Document processing workflow started successfully"
}
```

---

### 4. RFP Discovery Workflow

**Endpoint**: `POST /api/workflows/rfp-discovery/execute`

**Description**: Discovers RFPs from specified government portals with configurable search criteria.

**Request Body**:
```typescript
{
  portalIds: string[];            // Required
  searchCriteria?: {
    keywords?: string[];
    categories?: string[];
    dateRange?: {
      start: string;
      end: string;
    };
  };
  maxRfps?: number;               // Default: 50
  sessionId?: string;
  workflowId?: string;
  priority?: number;              // 1-10 (default: 5)
  deadline?: string;              // ISO 8601 date
  options?: {
    fullScan?: boolean;
    deepExtraction?: boolean;
    realTimeNotifications?: boolean;
    maxRetries?: number;
  };
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/rfp-discovery/execute \
  -H "Content-Type: application/json" \
  -d '{
    "portalIds": ["bonfire-123", "sam-gov-456"],
    "maxRfps": 50,
    "options": {
      "fullScan": true,
      "deepExtraction": true,
      "realTimeNotifications": true
    }
  }'
```

**Response**:
```json
{
  "success": true,
  "workflowId": "wf_67890",
  "createdWorkItems": 3,
  "assignedAgents": ["agent_portal_scanner", "agent_portal_monitor"],
  "message": "RFP discovery workflow started successfully"
}
```

---

### 5. Proposal Generation Workflow

**Endpoint**: `POST /api/workflows/proposal-generation/execute`

**Description**: Generates AI-powered proposal content for a specific RFP.

**Request Body**:
```typescript
{
  rfpId: string;                  // Required
  companyProfileId: string;       // Required
  proposalType?: 'standard' | 'expedited';
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/proposal-generation/execute \
  -H "Content-Type: application/json" \
  -d '{
    "rfpId": "rfp_abc123",
    "companyProfileId": "company_xyz789",
    "proposalType": "standard"
  }'
```

**Response**:
```json
{
  "success": true,
  "pipelineId": "pipeline_12345",
  "message": "Proposal generation pipeline started successfully"
}
```

---

## 🎛️ Workflow Management Endpoints

### Get Workflow Status

**Endpoint**: `GET /api/workflows/:workflowId/status`

**Example**:
```bash
curl http://localhost:5001/api/workflows/wf_12345/status
```

**Response**:
```json
{
  "workflowId": "wf_12345",
  "status": "running",
  "currentPhase": "analysis",
  "progress": 45,
  "createdAt": "2025-10-16T10:00:00Z",
  "updatedAt": "2025-10-16T10:15:00Z"
}
```

---

### Get All Suspended Workflows

**Endpoint**: `GET /api/workflows/suspended`

**Example**:
```bash
curl http://localhost:5001/api/workflows/suspended
```

**Response**:
```json
[
  {
    "workflowId": "wf_99999",
    "status": "suspended",
    "reason": "Waiting for user approval",
    "suspendedAt": "2025-10-16T09:00:00Z"
  }
]
```

---

### Get Workflow State Overview

**Endpoint**: `GET /api/workflows/state`

**Example**:
```bash
curl http://localhost:5001/api/workflows/state
```

**Response**:
```json
{
  "totalWorkflows": 15,
  "activeWorkflows": 8,
  "suspendedWorkflows": 2,
  "completedWorkflows": 5,
  "phases": {
    "discovery": 3,
    "analysis": 2,
    "proposal_generation": 2,
    "submission": 1
  }
}
```

---

### Get Phase Statistics

**Endpoint**: `GET /api/workflows/phase-stats`

**Example**:
```bash
curl http://localhost:5001/api/workflows/phase-stats
```

**Response**:
```json
{
  "discovery": {
    "active": 3,
    "avgDuration": 1200000,
    "successRate": 0.95
  },
  "analysis": {
    "active": 2,
    "avgDuration": 2400000,
    "successRate": 0.92
  }
}
```

---

## 🔄 Phase Management Endpoints

### Suspend Workflow

**Endpoint**: `POST /api/workflows/:workflowId/suspend`

**Request Body**:
```typescript
{
  reason?: string;
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/wf_12345/suspend \
  -H "Content-Type: application/json" \
  -d '{"reason": "Awaiting stakeholder approval"}'
```

---

### Resume Workflow

**Endpoint**: `POST /api/workflows/:workflowId/resume`

**Request Body**:
```typescript
{
  resumeData?: {
    reason?: string;
  };
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/wf_12345/resume \
  -H "Content-Type: application/json" \
  -d '{"resumeData": {"reason": "Approval granted"}}'
```

---

### Cancel Workflow

**Endpoint**: `POST /api/workflows/:workflowId/cancel`

**Request Body**:
```typescript
{
  reason?: string;
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/wf_12345/cancel \
  -H "Content-Type: application/json" \
  -d '{"reason": "RFP deadline passed"}'
```

---

### Transition Workflow Phase

**Endpoint**: `POST /api/workflows/:workflowId/transition`

**Description**: Manually transition workflow to a specific phase.

**Request Body**:
```typescript
{
  targetPhase: 'discovery' | 'analysis' | 'proposal_generation' | 'submission' | 'monitoring';
  transitionData?: Record<string, any>;
}
```

**Example**:
```bash
curl -X POST http://localhost:5001/api/workflows/wf_12345/transition \
  -H "Content-Type: application/json" \
  -d '{
    "targetPhase": "proposal_generation",
    "transitionData": {
      "skipAnalysis": false
    }
  }'
```

---

## 📊 Response Formats

### Success Response

```typescript
{
  success: true;
  [key: string]: any;  // Additional response data
  message?: string;
}
```

### Error Response

```typescript
{
  error: string;       // Error message
  details?: string;    // Detailed error information
}
```

**HTTP Status Codes**:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (workflow/resource not found)
- `500` - Internal Server Error

---

## 🛡️ Error Handling

### Validation Errors (400)

**Missing Required Parameters**:
```json
{
  "error": "portalIds array required for discovery mode"
}
```

**Invalid Mode**:
```json
{
  "error": "Valid mode required (discovery, proposal, or full_pipeline)"
}
```

### Not Found Errors (404)

```json
{
  "error": "Workflow not found"
}
```

### Internal Errors (500)

```json
{
  "error": "Failed to execute master orchestration workflow",
  "details": "Database connection timeout"
}
```

---

## 🔐 Authentication

Currently, workflows API does not require authentication. **Production deployment should implement**:
- API key authentication
- Rate limiting per user/API key
- JWT token validation

---

## 📈 Rate Limits

**Current**: No rate limits (development)

**Recommended for Production**:
- 100 requests per minute per IP
- 1000 workflow executions per day per user
- Exponential backoff for retry logic

---

## 📝 Changelog

### Version 1.1.0 (October 16, 2025)
- ✨ **NEW**: Master Orchestration Workflow endpoint
  - 3 execution modes: discovery, proposal, full_pipeline
  - BonfireHub authentication caching
  - Batch processing with concurrency control
- ✨ **NEW**: Proposal PDF Assembly Workflow endpoint
  - Professional PDF generation
  - Custom formatting options
  - Automatic storage upload

### Version 1.0.0 (Initial Release)
- Document Processing Workflow
- RFP Discovery Workflow
- Proposal Generation Workflow
- Workflow management endpoints
- Phase transition controls

---

## 📚 Related Documentation

- **Integration Complete**: `/docs/INTEGRATION_COMPLETE.md`
- **Test Suite**: `/docs/testing/workflow-api-tests.md`
- **Error Handling**: `/docs/architecture/error-handling-review.md`
- **Workflow Integration**: `/docs/architecture/workflow-integration-summary.md`

---

**Last Updated**: October 16, 2025
**Maintained By**: RFP Automation Team
