# API Example Requests

**Valid request examples for RFP Agent Platform API**

---

## RFP Management

### Create RFP (POST /api/rfps)

**Minimal Valid Request** (Required fields only):
```json
{
  "title": "IT Services RFP - Network Upgrade",
  "agency": "Department of Technology",
  "sourceUrl": "https://example.gov/rfps/12345"
}
```

**Complete Valid Request** (All fields):
```json
{
  "title": "IT Services RFP - Network Upgrade Project",
  "agency": "Department of Technology Services",
  "sourceUrl": "https://financeonline.austintexas.gov/rfp/12345",
  "description": "Comprehensive network infrastructure upgrade for government facilities",
  "category": "IT Services",
  "portalId": "550e8400-e29b-41d4-a716-446655440000",
  "deadline": "2025-12-31T23:59:59Z",
  "estimatedValue": 500000,
  "status": "discovered",
  "progress": 0,
  "addedBy": "manual"
}
```

### Get RFPs with Pagination (GET /api/rfps)

**Query Parameters**:
```
GET /api/rfps?page=1&limit=20&status=discovered&portalId=550e8400-e29b-41d4-a716-446655440000
```

**Expected Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "rfp-uuid",
      "title": "IT Services RFP",
      "agency": "Department of Technology",
      "sourceUrl": "https://example.gov/rfps/12345",
      "status": "discovered",
      ...
    }
  ],
  "pagination": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

---

## Portal Management

### Create Portal (POST /api/portals)

**Valid Request**:
```json
{
  "name": "Austin Finance Portal",
  "url": "https://financeonline.austintexas.gov",
  "type": "government",
  "isActive": true,
  "monitoringEnabled": true,
  "loginRequired": false,
  "status": "active",
  "scanFrequency": 24,
  "maxRfpsPerScan": 50
}
```

---

## Discovery Workflows

### Start Discovery Workflow (POST /api/discovery)

**Valid Request**:
```json
{
  "portalIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "priority": 5,
  "options": {
    "deepScan": true,
    "parallelExecution": true
  }
}
```

**Expected Response**:
```json
{
  "success": true,
  "workflowId": "workflow-uuid",
  "createdWorkItems": 2,
  "assignedAgents": ["agent-1", "agent-2"],
  "estimatedCompletion": "2025-11-14T20:00:00Z",
  "message": "Discovery workflow created successfully for 2 portals"
}
```

---

## Proposal Generation

### Enhanced Proposal Generation (POST /api/proposals/enhanced/generate)

**Valid Request**:
```json
{
  "rfpId": "550e8400-e29b-41d4-a716-446655440000",
  "companyProfileId": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "options": {
    "generatePricing": true,
    "generateCompliance": true,
    "qualityThreshold": 0.85
  }
}
```

**Expected Response**:
```json
{
  "success": true,
  "sessionId": "enhanced_550e8400-e29b-41d4-a716-446655440000_1699999999",
  "message": "Enhanced proposal generation started"
}
```

### Pipeline Proposal Generation (POST /api/proposals/pipeline/generate)

**Valid Request**:
```json
{
  "rfpIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8"
  ],
  "companyProfileId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "priority": 8,
  "parallelExecution": true,
  "options": {
    "generatePricing": true,
    "generateCompliance": true,
    "proposalType": "technical",
    "qualityThreshold": 0.9,
    "autoSubmit": false
  }
}
```

---

## Common Validation Errors

### Missing Required Fields

**Request**:
```json
{
  "title": "Test RFP"
  // Missing agency and sourceUrl
}
```

**Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "agency",
      "message": "Agency name is required",
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined"
    },
    {
      "field": "sourceUrl",
      "message": "Must be a valid URL",
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined"
    }
  ],
  "summary": "2 validation error(s) found"
}
```

### Invalid URL Format

**Request**:
```json
{
  "title": "Test RFP",
  "agency": "Test Agency",
  "sourceUrl": "not-a-valid-url"
}
```

**Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "sourceUrl",
      "message": "Must be a valid URL",
      "code": "invalid_string"
    }
  ],
  "summary": "1 validation error(s) found"
}
```

### Invalid UUID Format

**Request**:
```json
{
  "portalIds": ["not-a-uuid", "also-invalid"]
}
```

**Response** (400):
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    {
      "field": "portalIds.0",
      "message": "Invalid uuid",
      "code": "invalid_string"
    },
    {
      "field": "portalIds.1",
      "message": "Invalid uuid",
      "code": "invalid_string"
    }
  ],
  "summary": "2 validation error(s) found"
}
```

---

## Field Requirements Reference

### RFP Creation Fields

| Field | Type | Required | Validation | Example |
|-------|------|----------|------------|---------|
| `title` | string | ✅ Yes | Min 3, Max 500 chars | "IT Services RFP" |
| `agency` | string | ✅ Yes | Min 2, Max 200 chars | "Dept of Technology" |
| `sourceUrl` | string | ✅ Yes | Valid URL | "https://example.gov/rfp/123" |
| `description` | string | ❌ No | - | "Detailed description..." |
| `category` | string | ❌ No | - | "IT Services" |
| `portalId` | string | ❌ No | Valid UUID | "550e8400-e29b-41d4-a716-446655440000" |
| `deadline` | string | ❌ No | ISO 8601 date | "2025-12-31T23:59:59Z" |
| `estimatedValue` | number | ❌ No | Positive number | 500000 |
| `status` | string | ❌ No | Enum | "discovered" (default) |
| `progress` | number | ❌ No | 0-100 | 0 (default) |
| `addedBy` | string | ❌ No | "manual" or "automatic" | "manual" (default) |

### Discovery Workflow Fields

| Field | Type | Required | Validation | Example |
|-------|------|----------|------------|---------|
| `portalIds` | array | ✅ Yes | Array of UUIDs, min 1 | ["uuid1", "uuid2"] |
| `sessionId` | string | ❌ No | - | "session-123" |
| `workflowId` | string | ❌ No | - | "workflow-456" |
| `priority` | number | ❌ No | 1-10 | 5 (default) |
| `deadline` | string | ❌ No | ISO 8601 date | "2025-12-31T23:59:59Z" |
| `options` | object | ❌ No | - | {} (default) |

---

## Testing Tips

1. **Use Valid UUIDs**: Generate UUIDs for testing or use existing ones from GET endpoints
2. **ISO 8601 Dates**: Always use format like "2025-12-31T23:59:59Z"
3. **Check Pagination**: List endpoints return paginated responses with `{ success, data, pagination }`
4. **Handle Validation Errors**: Parse the `details` array for field-specific errors
5. **Test Edge Cases**: Empty strings, null values, invalid types
6. **Create Test Data First**: Create portals before RFPs, RFPs before proposals

---

## Example Test Flow

```python
# 1. Create a portal
portal_response = POST /api/portals
portal_id = portal_response['data']['id']

# 2. Create an RFP
rfp_payload = {
    "title": "Test RFP",
    "agency": "Test Agency",
    "sourceUrl": "https://example.gov/rfp/test",
    "portalId": portal_id
}
rfp_response = POST /api/rfps
rfp_id = rfp_response['data']['id']

# 3. Get RFPs (paginated)
rfps_response = GET /api/rfps?page=1&limit=20
assert rfps_response['success'] == True
assert 'pagination' in rfps_response

# 4. Start discovery workflow
workflow_payload = {
    "portalIds": [portal_id],
    "priority": 5
}
workflow_response = POST /api/discovery
workflow_id = workflow_response['workflowId']

# 5. Generate proposal
proposal_payload = {
    "rfpId": rfp_id,
    "options": {}
}
proposal_response = POST /api/proposals/enhanced/generate
```

---

*Use these examples as a reference for all API interactions.*
