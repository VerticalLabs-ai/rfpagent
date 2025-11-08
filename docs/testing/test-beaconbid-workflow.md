# BeaconBid RFP Testing Guide

## Overview

This document describes how to test the complete RFP workflow using a real BeaconBid RFP URL before going live.

## Test RFP

**URL**: https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link

**Title**: Single Family Home Development at Stella Link  
**Agency**: City of Houston

## Testing Workflow

### Step 1: Start the Server

```bash
pnpm dev
```

The server should start on `http://localhost:5001` (or the port specified in your `.env`).

### Step 2: Run Automated Tests

```bash
tsx scripts/test-beaconbid-rfp.ts
```

This script will test:
1. ✅ Server health check
2. ✅ Manual RFP creation endpoint
3. ✅ Submission creation endpoint
4. ✅ Validation (empty payload, invalid RFP ID, nested JSON)
5. ✅ 404 error handler

### Step 3: Manual Testing via Frontend

1. **Open the application**: http://localhost:5001 (or your dev URL)

2. **Create Manual RFP**:
   - Navigate to Dashboard
   - Click "Manual RFP" button
   - Enter the BeaconBid URL
   - Add optional notes
   - Submit

3. **Verify RFP Processing**:
   - Check that RFP appears in the Active RFPs table
   - Verify all details are extracted correctly
   - Check that documents are downloaded (if applicable)

4. **Create Submission**:
   - Once RFP is processed, you can create a submission
   - The new POST /api/submissions endpoint should work

### Step 4: Test API Endpoints Directly

#### Test Manual RFP Creation

```bash
curl -X POST http://localhost:5001/api/rfps/manual \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link",
    "userNotes": "Test submission"
  }'
```

Expected response:
```json
{
  "success": true,
  "sessionId": "uuid",
  "message": "RFP processing started. Connect to the progress stream for updates."
}
```

#### Test Submission Creation (after RFP is created)

```bash
# First, get the RFP ID from the response above or by querying RFPs
curl http://localhost:5001/api/rfps | jq '.[0].id'

# Then create a submission
curl -X POST http://localhost:5001/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "rfpId": "YOUR_RFP_ID_HERE",
    "proposalData": {
      "title": "Single Family Home Development Proposal",
      "description": "Test proposal",
      "details": {
        "client": "City of Houston",
        "budget": "1000000.00"
      }
    },
    "userNotes": "Test submission notes"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "submissionId": "uuid",
    "rfpId": "uuid",
    "sessionId": "uuid",
    "proposalId": "uuid"
  }
}
```

#### Test Validation

```bash
# Test empty payload
curl -X POST http://localhost:5001/api/submissions \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 400 with error message
```

#### Test 404 Handler

```bash
curl -X POST http://localhost:5001/api/submissions/invalid-endpoint \
  -H "Content-Type: application/json" \
  -d '{}'

# Should return 404 with JSON error
```

## Expected Results

### ✅ Success Criteria

1. **RFP Creation**:
   - ✅ RFP is created successfully
   - ✅ All metadata is extracted (title, agency, deadline, etc.)
   - ✅ Documents are downloaded (if available)
   - ✅ Progress tracking works via SSE

2. **Submission Creation**:
   - ✅ Submission is created with valid data
   - ✅ Proposal is created automatically
   - ✅ Returns submissionId, rfpId, and sessionId

3. **Validation**:
   - ✅ Empty payload returns 400 with error
   - ✅ Invalid RFP ID returns 404
   - ✅ Missing required fields returns 400
   - ✅ All errors return JSON (never empty)

4. **Error Handling**:
   - ✅ 404 routes return JSON error
   - ✅ All errors include helpful messages
   - ✅ Error format is consistent

### ⚠️ Known Issues

1. **RFP Processing Time**: Manual RFP processing is asynchronous and may take 30-60 seconds. The test script waits 5 seconds, but in production, you should use the SSE progress stream.

2. **reCAPTCHA**: Frontend tests may still trigger reCAPTCHA. This is handled by Google's services and may need test mode configuration.

## Troubleshooting

### Server Not Running

```bash
# Check if server is running
curl http://localhost:5001/api/health

# Start server if not running
pnpm dev
```

### RFP Not Found

If the RFP doesn't appear after creation:
1. Check server logs for errors
2. Verify the URL is accessible
3. Check database for the RFP record
4. Verify portal scraping service is working

### Submission Creation Fails

If submission creation fails:
1. Verify RFP exists: `GET /api/rfps`
2. Check RFP status (must be 'active' or 'approved')
3. Verify RFP deadline hasn't passed
4. Check server logs for detailed errors

## Production Checklist

Before going live, verify:

- [ ] All tests pass
- [ ] RFP processing works with real URLs
- [ ] Submission creation works end-to-end
- [ ] Error handling returns proper JSON responses
- [ ] Frontend form validation works
- [ ] Activity Feed route is accessible
- [ ] 404 handler works correctly
- [ ] Server logs show no errors
- [ ] Database records are created correctly

## Next Steps

After successful testing:

1. Deploy to staging environment
2. Run tests against staging
3. Verify with client
4. Deploy to production
5. Monitor logs for any issues

---

**Last Updated**: November 7, 2025

