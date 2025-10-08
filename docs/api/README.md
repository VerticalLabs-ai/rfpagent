# RFP Agent API Documentation

## Overview

Welcome to the RFP Agent API documentation. This comprehensive guide will help you integrate with our AI-powered RFP discovery and proposal generation platform.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Authentication](#authentication)
3. [Core Concepts](#core-concepts)
4. [API Endpoints](#api-endpoints)
5. [Real-time Updates](#real-time-updates)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [Best Practices](#best-practices)
9. [Code Examples](#code-examples)

## Quick Start

### Prerequisites

- Node.js 18+ or Python 3.9+
- API access credentials (contact support@rfpagent.com)
- Basic understanding of REST APIs and Server-Sent Events (SSE)

### Installation

```bash
# Install the SDK (coming soon)
npm install @rfpagent/sdk

# Or use the REST API directly
curl -X GET https://api.rfpagent.com/api/system/health
```

### Your First Request

```javascript
// JavaScript/TypeScript Example
const response = await fetch('http://localhost:3000/api/rfps', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include' // For session-based auth
});

const { rfps, total } = await response.json();
console.log(`Found ${total} RFPs`);
```

```python
# Python Example
import requests

response = requests.get(
    'http://localhost:3000/api/rfps',
    headers={'Content-Type': 'application/json'}
)

data = response.json()
print(f"Found {data['total']} RFPs")
```

## Authentication

Currently, the RFP Agent API uses session-based authentication via cookies.

### Session Authentication

```javascript
// Login to create session
const loginResponse = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include',
  body: JSON.stringify({
    username: 'your-username',
    password: 'your-password'
  })
});

// Future requests will include session cookie automatically
const rfpsResponse = await fetch('http://localhost:3000/api/rfps', {
  credentials: 'include'
});
```

### JWT Authentication (Coming Soon)

```bash
# Future: Bearer token authentication
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
     https://api.rfpagent.com/api/rfps
```

## Core Concepts

### 1. RFPs (Request for Proposals)

RFPs are the core entity representing government procurement opportunities.

**Lifecycle:**
- `discovered` - Found by portal scanning
- `parsing` - Documents being processed
- `drafting` - Proposal being generated
- `review` - Human review pending
- `approved` - Ready for submission
- `submitted` - Submitted to portal
- `closed` - RFP closed or won

### 2. Proposals

AI-generated proposals linked to RFPs.

**Components:**
- Content (narratives, technical sections)
- Pricing tables
- Compliance checklists
- Supporting documents

### 3. Portals

Government procurement portals that are monitored for RFPs.

**Types:**
- Federal (SAM.gov)
- State (various state portals)
- Municipal (city/county portals)

### 4. 3-Tier Agent System

```
┌─────────────────────────────────────┐
│     Tier 1: Orchestrator (1)       │
│     - Primary Orchestrator          │
└─────────────────────────────────────┘
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Portal  │ │Proposal │ │Research │
│ Manager │ │ Manager │ │ Manager │
└─────────┘ └─────────┘ └─────────┘
Tier 2: Managers (3)
                 │
    ┌────────────┼────────────┐
    ▼            ▼            ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Scanner │ │Generator│ │Analyzer │
│ Monitor │ │ Checker │ │ Market  │
│   ...   │ │   ...   │ │  ...    │
└─────────┘ └─────────┘ └─────────┘
Tier 3: Specialists (7)
```

## API Endpoints

### RFP Operations

#### List RFPs

```http
GET /api/rfps?status=discovered&page=1&limit=20
```

**Query Parameters:**
- `status` - Filter by status (discovered, parsing, drafting, review, approved, submitted, closed)
- `portalId` - Filter by portal UUID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response:**
```json
{
  "rfps": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "IT Services Procurement 2024",
      "agency": "City of Austin",
      "category": "Technology",
      "status": "discovered",
      "deadline": "2024-12-31T23:59:59Z",
      "estimatedValue": "500000.00",
      "sourceUrl": "https://financeonline.austintexas.gov/rfp/123",
      "progress": 20
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 20
}
```

#### Create RFP

```http
POST /api/rfps
Content-Type: application/json

{
  "title": "Cloud Infrastructure Services",
  "agency": "City of Philadelphia",
  "category": "Technology",
  "sourceUrl": "https://phlcontracts.phila.gov/contract/123456",
  "deadline": "2024-12-31T23:59:59Z",
  "estimatedValue": "750000.00"
}
```

#### Submit Manual RFP (with AI Processing)

```http
POST /api/rfps/manual
Content-Type: application/json

{
  "url": "https://financeonline.austintexas.gov/rfp/567890",
  "userNotes": "High priority - cloud migration project"
}
```

**Response:**
```json
{
  "success": true,
  "rfpId": "550e8400-e29b-41d4-a716-446655440001",
  "sessionId": "session_abc123",
  "message": "RFP processing started successfully"
}
```

### Portal Operations

#### Start Portal Scan

```http
POST /api/portals/{portalId}/scan
Content-Type: application/json

{
  "searchFilter": "technology services"
}
```

**Response:**
```json
{
  "scanId": "scan_abc123def456",
  "message": "Portal scan started"
}
```

#### Stream Scan Events (SSE)

```http
GET /api/portals/{portalId}/scan/stream?scanId=scan_abc123def456
Accept: text/event-stream
```

**Event Stream:**
```
data: {"type":"scan_started","scanId":"scan_123","portalName":"Austin Finance Online"}

data: {"type":"step_update","step":"authenticating","progress":25}

data: {"type":"rfp_discovered","rfp":{"title":"Cloud Services RFP","agency":"City of Austin"}}

data: {"type":"scan_completed","totalRfps":15}
```

### Proposal Operations

#### Generate Enhanced Proposal

```http
POST /api/proposals/enhanced/generate
Content-Type: application/json

{
  "rfpId": "550e8400-e29b-41d4-a716-446655440000",
  "companyProfileId": "660e8400-e29b-41d4-a716-446655440000",
  "options": {
    "generatePricing": true,
    "generateCompliance": true,
    "proposalType": "technical",
    "qualityThreshold": 0.85
  }
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "enhanced_550e8400_1234567890",
  "message": "Enhanced proposal generation started"
}
```

#### Bulk Proposal Pipeline

```http
POST /api/proposals/pipeline/generate
Content-Type: application/json

{
  "rfpIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ],
  "companyProfileId": "770e8400-e29b-41d4-a716-446655440000",
  "priority": 8,
  "parallelExecution": true,
  "options": {
    "generatePricing": true,
    "generateCompliance": true,
    "autoSubmit": false
  }
}
```

### Submission Pipeline

#### Execute Submission

```http
POST /api/submissions/{submissionId}/execute
Content-Type: application/json

{
  "browserOptions": {
    "headless": true,
    "timeout": 30000
  }
}
```

**Response:**
```json
{
  "success": true,
  "pipelineId": "pipeline_xyz789",
  "message": "Submission pipeline started"
}
```

#### Get Submission Status

```http
GET /api/submissions/{submissionId}/status
```

**Response:**
```json
{
  "id": "sub_123",
  "submissionId": "550e8400-e29b-41d4-a716-446655440000",
  "currentPhase": "uploading",
  "status": "in_progress",
  "progress": 60,
  "preflightChecks": {
    "startedAt": "2024-01-15T10:00:00Z",
    "completedAt": "2024-01-15T10:01:00Z",
    "success": true,
    "summary": "All preflight checks passed"
  },
  "authenticationData": {
    "success": true,
    "summary": "Successfully authenticated to portal"
  }
}
```

### AI Chat

#### Chat with AI Assistant

```http
POST /api/ai/chat
Content-Type: application/json

{
  "message": "Find me technology RFPs from Austin with value over $100k",
  "conversationId": "conv_123"
}
```

**Response:**
```json
{
  "response": "I found 5 technology RFPs from Austin with estimated values over $100,000. The highest value is a Cloud Infrastructure RFP at $500,000 with a deadline of December 31, 2024.",
  "conversationId": "conv_123",
  "metadata": {
    "rfpsFound": 5,
    "totalValue": "1250000.00",
    "relevantRfpIds": ["550e8400-...", "660e8400-..."]
  }
}
```

## Real-time Updates

### Server-Sent Events (SSE)

The API provides real-time updates via SSE for long-running operations:

#### Portal Scan Updates

```javascript
const eventSource = new EventSource(
  `/api/portals/${portalId}/scan/stream?scanId=${scanId}`
);

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  switch(data.type) {
    case 'scan_started':
      console.log(`Scan started for ${data.portalName}`);
      break;
    case 'step_update':
      console.log(`Progress: ${data.progress}% - ${data.step}`);
      break;
    case 'rfp_discovered':
      console.log(`Found RFP: ${data.rfp.title}`);
      break;
    case 'scan_completed':
      console.log(`Scan completed! Found ${data.totalRfps} RFPs`);
      eventSource.close();
      break;
  }
});

eventSource.onerror = (error) => {
  console.error('SSE Error:', error);
  eventSource.close();
};
```

#### Proposal Generation Progress

```javascript
const eventSource = new EventSource(
  `/api/proposals/submission-materials/stream/${sessionId}`
);

eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`${progress.currentStep}: ${progress.progress}%`);

  if (progress.status === 'completed') {
    console.log('Proposal generation completed!');
    eventSource.close();
  }
};
```

## Error Handling

### Error Response Format

All errors follow a consistent format:

```json
{
  "error": "Error message description",
  "details": [
    {
      "field": "url",
      "message": "Must be a valid URL"
    }
  ]
}
```

### HTTP Status Codes

- `200 OK` - Successful request
- `201 Created` - Resource created successfully
- `202 Accepted` - Request accepted for processing
- `400 Bad Request` - Invalid input
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `409 Conflict` - Resource conflict (e.g., duplicate scan)
- `429 Too Many Requests` - Rate limit exceeded
- `500 Internal Server Error` - Server error
- `503 Service Unavailable` - System unhealthy

### Error Handling Best Practices

```javascript
async function handleAPIRequest() {
  try {
    const response = await fetch('/api/rfps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rfpData)
    });

    if (!response.ok) {
      const error = await response.json();

      switch (response.status) {
        case 400:
          console.error('Validation error:', error.details);
          break;
        case 409:
          console.error('Conflict:', error.error);
          break;
        case 429:
          console.error('Rate limited - retry after delay');
          await new Promise(resolve => setTimeout(resolve, 5000));
          return handleAPIRequest(); // Retry
        default:
          console.error('API Error:', error.error);
      }

      throw new Error(error.error);
    }

    return await response.json();
  } catch (error) {
    console.error('Request failed:', error);
    throw error;
  }
}
```

## Rate Limiting

### Current Limits

- **Standard Operations**: 100 requests per minute
- **AI Operations**: 20 requests per minute
- **Heavy Operations** (scans, generation): 5 requests per minute

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642416000
```

### Handling Rate Limits

```javascript
function getRateLimitInfo(headers) {
  return {
    limit: parseInt(headers.get('X-RateLimit-Limit')),
    remaining: parseInt(headers.get('X-RateLimit-Remaining')),
    resetAt: new Date(parseInt(headers.get('X-RateLimit-Reset')) * 1000)
  };
}

async function requestWithBackoff(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const response = await fetch(url, options);

    if (response.status === 429) {
      const rateLimit = getRateLimitInfo(response.headers);
      const waitTime = rateLimit.resetAt - new Date();

      console.log(`Rate limited. Waiting ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      continue;
    }

    return response;
  }

  throw new Error('Max retries exceeded');
}
```

## Best Practices

### 1. Use Pagination for Large Datasets

```javascript
async function getAllRFPs() {
  const allRFPs = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `/api/rfps?page=${page}&limit=100`
    );
    const { rfps, total } = await response.json();

    allRFPs.push(...rfps);
    hasMore = allRFPs.length < total;
    page++;
  }

  return allRFPs;
}
```

### 2. Implement Exponential Backoff for Retries

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      if (response.status >= 500) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      return response; // Don't retry client errors
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

### 3. Use SSE for Long-Running Operations

```javascript
function monitorScan(scanId, portalId) {
  return new Promise((resolve, reject) => {
    const eventSource = new EventSource(
      `/api/portals/${portalId}/scan/stream?scanId=${scanId}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'scan_completed') {
        eventSource.close();
        resolve(data);
      } else if (data.type === 'scan_failed') {
        eventSource.close();
        reject(new Error(data.error));
      }
    };

    eventSource.onerror = (error) => {
      eventSource.close();
      reject(error);
    };

    // Timeout after 10 minutes
    setTimeout(() => {
      eventSource.close();
      reject(new Error('Scan timeout'));
    }, 600000);
  });
}
```

### 4. Batch Operations When Possible

```javascript
// Good: Batch proposal generation
await fetch('/api/proposals/pipeline/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    rfpIds: ['id1', 'id2', 'id3'],
    companyProfileId: 'profile123',
    parallelExecution: true
  })
});

// Avoid: Individual requests in a loop
// for (const rfpId of rfpIds) {
//   await generateProposal(rfpId); // DON'T DO THIS
// }
```

## Code Examples

### Complete Workflow Example

```javascript
/**
 * Complete RFP-to-Submission Workflow
 */
class RFPAgent {
  constructor(baseURL = 'http://localhost:3000/api') {
    this.baseURL = baseURL;
  }

  async fetch(path, options = {}) {
    const response = await fetch(`${this.baseURL}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  }

  // 1. Submit manual RFP
  async submitRFP(url, notes) {
    return this.fetch('/rfps/manual', {
      method: 'POST',
      body: JSON.stringify({ url, userNotes: notes })
    });
  }

  // 2. Monitor RFP processing
  async waitForRFPProcessing(rfpId, timeout = 300000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const rfp = await this.fetch(`/rfps/${rfpId}`);

      if (rfp.status === 'parsing' && rfp.progress === 100) {
        return rfp;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('RFP processing timeout');
  }

  // 3. Generate proposal
  async generateProposal(rfpId, companyProfileId) {
    return this.fetch('/proposals/enhanced/generate', {
      method: 'POST',
      body: JSON.stringify({
        rfpId,
        companyProfileId,
        options: {
          generatePricing: true,
          generateCompliance: true,
          proposalType: 'technical',
          qualityThreshold: 0.85
        }
      })
    });
  }

  // 4. Monitor proposal generation
  monitorProposalGeneration(sessionId) {
    return new Promise((resolve, reject) => {
      const eventSource = new EventSource(
        `${this.baseURL}/proposals/submission-materials/stream/${sessionId}`
      );

      eventSource.onmessage = (event) => {
        const progress = JSON.parse(event.data);
        console.log(`Progress: ${progress.progress}% - ${progress.currentStep}`);

        if (progress.status === 'completed') {
          eventSource.close();
          resolve(progress);
        } else if (progress.status === 'failed') {
          eventSource.close();
          reject(new Error(progress.error));
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        reject(error);
      };
    });
  }

  // 5. Create and execute submission
  async submitProposal(rfpId, proposalId, portalId) {
    // Create submission
    const submission = await this.fetch('/submissions', {
      method: 'POST',
      body: JSON.stringify({ rfpId, proposalId, portalId })
    });

    // Execute submission pipeline
    const pipeline = await this.fetch(
      `/submissions/${submission.id}/execute`,
      { method: 'POST' }
    );

    return { submission, pipelineId: pipeline.pipelineId };
  }

  // 6. Monitor submission pipeline
  async monitorSubmission(submissionId, checkInterval = 5000) {
    while (true) {
      const status = await this.fetch(`/submissions/${submissionId}/status`);

      console.log(
        `Submission ${status.currentPhase}: ${status.progress}%`
      );

      if (status.status === 'completed') {
        return status;
      } else if (status.status === 'failed') {
        throw new Error(status.errorData?.error || 'Submission failed');
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
}

// Usage
async function main() {
  const agent = new RFPAgent();

  try {
    // 1. Submit RFP
    console.log('Submitting RFP...');
    const { rfpId, sessionId } = await agent.submitRFP(
      'https://financeonline.austintexas.gov/rfp/123456',
      'High priority cloud services RFP'
    );

    // 2. Wait for processing
    console.log('Waiting for RFP processing...');
    const rfp = await agent.waitForRFPProcessing(rfpId);
    console.log(`RFP processed: ${rfp.title}`);

    // 3. Generate proposal
    console.log('Generating proposal...');
    const { sessionId: proposalSessionId } = await agent.generateProposal(
      rfpId,
      'company-profile-id-123'
    );

    // 4. Monitor generation
    console.log('Monitoring proposal generation...');
    const proposalProgress = await agent.monitorProposalGeneration(
      proposalSessionId
    );
    console.log('Proposal generated successfully!');

    // 5. Get proposal
    const proposals = await agent.fetch(`/proposals/rfp/${rfpId}`);
    const proposal = proposals[0];

    // 6. Submit proposal
    console.log('Submitting proposal...');
    const { submission, pipelineId } = await agent.submitProposal(
      rfpId,
      proposal.id,
      rfp.portalId
    );

    // 7. Monitor submission
    console.log('Monitoring submission...');
    const submissionResult = await agent.monitorSubmission(submission.id);

    console.log('Submission completed!');
    console.log('Receipt:', submissionResult.submissionReceipt);

  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

main();
```

### Python SDK Example

```python
import requests
import time
from typing import Dict, Optional
from sseclient import SSEClient  # pip install sseclient-py

class RFPAgentClient:
    def __init__(self, base_url: str = "http://localhost:3000/api"):
        self.base_url = base_url
        self.session = requests.Session()

    def _request(self, method: str, path: str, **kwargs) -> Dict:
        """Make authenticated request"""
        url = f"{self.base_url}{path}"
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response.json()

    def submit_rfp(self, url: str, notes: Optional[str] = None) -> Dict:
        """Submit manual RFP"""
        return self._request('POST', '/rfps/manual', json={
            'url': url,
            'userNotes': notes
        })

    def get_rfp(self, rfp_id: str) -> Dict:
        """Get RFP details"""
        return self._request('GET', f'/rfps/{rfp_id}')

    def generate_proposal(
        self,
        rfp_id: str,
        company_profile_id: str,
        options: Optional[Dict] = None
    ) -> Dict:
        """Generate enhanced proposal"""
        return self._request('POST', '/proposals/enhanced/generate', json={
            'rfpId': rfp_id,
            'companyProfileId': company_profile_id,
            'options': options or {}
        })

    def monitor_scan(self, portal_id: str, scan_id: str):
        """Monitor portal scan via SSE"""
        url = f"{self.base_url}/portals/{portal_id}/scan/stream"
        params = {'scanId': scan_id}

        messages = SSEClient(url, params=params)
        for msg in messages:
            if msg.data:
                yield json.loads(msg.data)

    def wait_for_rfp_processing(
        self,
        rfp_id: str,
        timeout: int = 300
    ) -> Dict:
        """Wait for RFP processing to complete"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            rfp = self.get_rfp(rfp_id)

            if rfp['status'] == 'parsing' and rfp['progress'] == 100:
                return rfp

            time.sleep(2)

        raise TimeoutError('RFP processing timeout')

# Usage
if __name__ == '__main__':
    client = RFPAgentClient()

    # Submit and process RFP
    result = client.submit_rfp(
        'https://financeonline.austintexas.gov/rfp/123456',
        'High priority RFP'
    )

    rfp_id = result['rfpId']
    print(f"RFP submitted: {rfp_id}")

    # Wait for processing
    rfp = client.wait_for_rfp_processing(rfp_id)
    print(f"RFP processed: {rfp['title']}")

    # Generate proposal
    proposal_result = client.generate_proposal(
        rfp_id,
        'company-profile-id-123',
        {
            'generatePricing': True,
            'proposalType': 'technical'
        }
    )

    print(f"Proposal generation started: {proposal_result['sessionId']}")
```

## Support

- **Documentation**: https://docs.rfpagent.com
- **API Status**: https://status.rfpagent.com
- **Support Email**: support@rfpagent.com
- **GitHub Issues**: https://github.com/rfpagent/api/issues

## Changelog

### Version 1.0.0 (Current)
- Initial API release
- Session-based authentication
- Core RFP, Proposal, and Portal endpoints
- Real-time SSE updates
- 3-tier agent system

### Upcoming Features
- JWT authentication
- Webhooks for async notifications
- GraphQL API
- Advanced analytics endpoints
- Bulk import/export
