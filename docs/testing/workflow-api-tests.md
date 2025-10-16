# Workflow API Endpoint Tests
**Date**: October 16, 2025
**Status**: Ready for Testing

---

## 🎯 Overview

Test scripts for the newly added workflow API endpoints:
- Master Orchestration Workflow
- Proposal PDF Assembly Workflow

## 📋 Prerequisites

1. **Server Running**:
   ```bash
   npm run dev
   # Server should be at http://localhost:5001
   ```

2. **Environment Variables**:
   ```bash
   OPENAI_API_KEY="sk-proj-..."
   BROWSERBASE_API_KEY="bb_live_..."
   DATABASE_URL="postgresql://..."
   ```

3. **Test Data**:
   - Valid portal IDs (e.g., from BonfireHub)
   - Valid RFP ID from database
   - Valid company profile ID from database
   - Valid proposal ID from database

---

## 🧪 Test Suite 1: Master Orchestration Workflow

### Test 1.1: Discovery Mode
**Purpose**: Test RFP discovery from government portals

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "portalIds": ["bonfire-portal-123"],
    "options": {
      "deepScan": true,
      "parallel": true,
      "notifyOnCompletion": true
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "mode": "discovery",
  "discoveredRfps": 5,
  "message": "Master orchestration workflow (discovery) completed successfully"
}
```

### Test 1.2: Proposal Mode
**Purpose**: Test proposal generation for single RFP

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "proposal",
    "rfpId": "rfp_abc123",
    "companyProfileId": "company_xyz789",
    "options": {
      "autoSubmit": false
    }
  }'
```

**Expected Response**:
```json
{
  "success": true,
  "mode": "proposal",
  "proposalId": "prop_456",
  "message": "Master orchestration workflow (proposal) completed successfully"
}
```

### Test 1.3: Full Pipeline Mode
**Purpose**: Test end-to-end automation (discovery → proposal)

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full_pipeline",
    "portalIds": ["bonfire-portal-123", "sam-gov-portal-456"],
    "companyProfileId": "company_xyz789",
    "options": {
      "deepScan": true,
      "autoSubmit": false,
      "parallel": true,
      "maxConcurrent": 3
    }
  }'
```

**Expected Response**:
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

### Test 1.4: Error Handling - Invalid Mode
**Purpose**: Verify mode validation

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "invalid_mode",
    "portalIds": ["portal-123"]
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "Valid mode required (discovery, proposal, or full_pipeline)"
}
```

### Test 1.5: Error Handling - Missing Required Parameters
**Purpose**: Verify parameter validation for discovery mode

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery"
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "portalIds array required for discovery mode"
}
```

---

## 🧪 Test Suite 2: Proposal PDF Assembly Workflow

### Test 2.1: Basic PDF Assembly
**Purpose**: Test PDF generation for existing proposal

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

**Expected Response**:
```json
{
  "success": true,
  "proposalId": "prop_abc123",
  "pdfUrl": "https://storage.googleapis.com/proposals/prop_abc123.pdf",
  "message": "Proposal PDF assembled successfully"
}
```

### Test 2.2: Error Handling - Missing proposalId
**Purpose**: Verify parameter validation

```bash
curl -X POST http://localhost:5001/api/workflows/proposal-pdf-assembly/execute \
  -H "Content-Type: application/json" \
  -d '{
    "options": {}
  }'
```

**Expected Response** (400 Bad Request):
```json
{
  "error": "proposalId is required"
}
```

### Test 2.3: Error Handling - Invalid proposalId
**Purpose**: Verify database validation

```bash
curl -X POST http://localhost:5001/api/workflows/proposal-pdf-assembly/execute \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "invalid_proposal_id"
  }'
```

**Expected Response** (500 Internal Server Error):
```json
{
  "error": "Failed to execute PDF assembly workflow",
  "details": "Proposal not found"
}
```

---

## 🧪 Test Suite 3: Integration Tests

### Test 3.1: Full Workflow Chain
**Purpose**: Test complete RFP processing pipeline

**Step 1**: Discovery
```bash
RESPONSE=$(curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "portalIds": ["bonfire-portal-123"]
  }')
echo $RESPONSE
```

**Step 2**: Extract RFP IDs from response and generate proposal
```bash
# Assuming first RFP ID is extracted
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "proposal",
    "rfpId": "rfp_from_discovery",
    "companyProfileId": "company_xyz789"
  }'
```

**Step 3**: Assemble PDF
```bash
# Assuming proposal ID is extracted
curl -X POST http://localhost:5001/api/workflows/proposal-pdf-assembly/execute \
  -H "Content-Type: application/json" \
  -d '{
    "proposalId": "prop_from_generation"
  }'
```

### Test 3.2: BonfireHub Authentication Caching
**Purpose**: Verify 24-hour auth cache works

**First Call** (should authenticate):
```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "portalIds": ["bonfire-portal-123"]
  }'
# Check logs for: "Authenticating to BonfireHub"
```

**Second Call** (within 24 hours, should use cache):
```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "discovery",
    "portalIds": ["bonfire-portal-123"]
  }'
# Check logs for: "✅ Valid authentication found, skipping re-auth"
```

### Test 3.3: Parallel RFP Processing
**Purpose**: Verify batch processing with maxConcurrent

```bash
curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full_pipeline",
    "portalIds": ["bonfire-1", "bonfire-2", "sam-gov-1"],
    "companyProfileId": "company_xyz789",
    "options": {
      "parallel": true,
      "maxConcurrent": 3
    }
  }'
```

**Expected**: Server logs show 3 RFPs processed in parallel

---

## 📊 Test Results Template

### Test Execution Log

| Test ID | Test Name | Status | Response Time | Notes |
|---------|-----------|--------|---------------|-------|
| 1.1 | Discovery Mode | ⏳ | - | - |
| 1.2 | Proposal Mode | ⏳ | - | - |
| 1.3 | Full Pipeline Mode | ⏳ | - | - |
| 1.4 | Invalid Mode Error | ⏳ | - | - |
| 1.5 | Missing Params Error | ⏳ | - | - |
| 2.1 | Basic PDF Assembly | ⏳ | - | - |
| 2.2 | Missing proposalId Error | ⏳ | - | - |
| 2.3 | Invalid proposalId Error | ⏳ | - | - |
| 3.1 | Full Workflow Chain | ⏳ | - | - |
| 3.2 | Auth Caching | ⏳ | - | - |
| 3.3 | Parallel Processing | ⏳ | - | - |

### Success Criteria

✅ **Pass Criteria**:
- All 200/400/500 status codes match expected
- Response JSON structure matches expected
- Master orchestration handles all 3 modes correctly
- PDF assembly generates valid PDF URLs
- Authentication caching works (2nd call uses cache)
- Parallel processing respects maxConcurrent limit

❌ **Fail Criteria**:
- Any unexpected 500 errors
- Missing required response fields
- Authentication fails on 2nd call (cache not working)
- PDF URLs are invalid or inaccessible

---

## 🔍 Debugging Tips

### View Server Logs
```bash
# Terminal running npm run dev will show:
🎯 Starting master orchestration workflow in discovery mode
✅ Valid authentication found, skipping re-auth
📄 Starting PDF assembly for proposal: prop_abc123
```

### Check Workflow Status
```bash
# Get workflow status by ID
curl http://localhost:5001/api/workflows/{workflowId}/status
```

### Check Phase Statistics
```bash
# Get overall phase stats
curl http://localhost:5001/api/workflows/phase-stats
```

### Common Issues

**Issue**: "Cannot import masterOrchestrationWorkflow"
**Solution**: Ensure `src/mastra/index.ts` exports it:
```typescript
export { masterOrchestrationWorkflow } from './workflows/master-orchestration-workflow';
```

**Issue**: "Database connection error"
**Solution**: Verify DATABASE_URL in .env

**Issue**: "PDF assembly fails"
**Solution**: Check proposal exists in database and has content

---

## 📝 Next Steps

1. **Run Tests**: Execute all test suites
2. **Document Results**: Fill in test results template
3. **Fix Issues**: Address any failing tests
4. **Update Docs**: Update API documentation with examples
5. **Frontend Integration**: Connect UI to new endpoints

---

## 📚 Related Documentation

- **Integration Complete**: `/docs/INTEGRATION_COMPLETE.md`
- **Workflow Integration**: `/docs/architecture/workflow-integration-summary.md`
- **API Routes**: `/server/routes/workflows.routes.ts`
- **Master Orchestration**: `/src/mastra/workflows/master-orchestration-workflow.ts`

**Last Updated**: October 16, 2025
