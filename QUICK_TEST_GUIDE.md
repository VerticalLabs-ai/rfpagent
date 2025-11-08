# Quick Test Guide - BeaconBid RFP

## 🚀 Quick Start

### 1. Start the Server

```bash
pnpm dev
```

Wait for both backend and frontend to start (usually takes 10-20 seconds).

### 2. Run Automated Tests

In a new terminal:

```bash
tsx scripts/test-beaconbid-rfp.ts
```

This will test:

- ✅ Server connectivity
- ✅ Manual RFP creation
- ✅ Submission endpoint
- ✅ Validation (empty payload, invalid data)
- ✅ 404 error handling

### 3. Test via Frontend

1. Open <http://localhost:5001> (or your dev URL)
2. Click "Manual RFP" button
3. Enter: `https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link`
4. Add notes (optional)
5. Submit and watch for processing

### 4. Test API Directly

```bash
# Test Manual RFP Creation
curl -X POST http://localhost:5001/api/rfps/manual \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.beaconbid.com/solicitations/city-of-houston/737f1bff-2f76-454d-94f8-6d65b7d93a47/single-family-home-development-at-stella-link",
    "userNotes": "Test"
  }'

# Get RFP ID (after RFP is created)
curl http://localhost:5001/api/rfps | jq '.[0].id'

# Test Submission Creation (replace YOUR_RFP_ID)
curl -X POST http://localhost:5001/api/submissions \
  -H "Content-Type: application/json" \
  -d '{
    "rfpId": "YOUR_RFP_ID",
    "proposalData": {
      "title": "Test Proposal",
      "description": "Test"
    }
  }'

# Test Validation (should return 400)
curl -X POST http://localhost:5001/api/submissions \
  -H "Content-Type: application/json" \
  -d '{}'

# Test 404 (should return JSON 404)
curl -X POST http://localhost:5001/api/submissions/invalid \
  -H "Content-Type: application/json" \
  -d '{}'
```

## ✅ What to Verify

### Backend Tests

- [ ] Manual RFP creation returns 202 with sessionId
- [ ] Submission creation returns 201 with submissionId
- [ ] Empty payload returns 400 with error message
- [ ] Invalid RFP ID returns 404 with error message
- [ ] 404 routes return JSON (not empty)

### Frontend Tests

- [ ] Manual RFP form validates URL format
- [ ] Error messages display correctly
- [ ] Activity Feed route works (redirects to Dashboard)
- [ ] Form prevents submission until valid

## 📊 Expected Results

After running the test script, you should see:

```
🧪 Testing BeaconBid RFP Workflow
📍 RFP URL: https://www.beaconbid.com/...
🌐 API Base URL: http://localhost:5001

✅ Server Health Check
✅ Manual RFP Creation
✅ Submission Creation - Valid Data
✅ Validation - Empty Payload
✅ Validation - Invalid RFP ID
✅ Validation - Nested JSON (Missing RFP ID)
✅ 404 Handler - Returns JSON

📊 Test Summary
============================================================
✅ Passed: 7/7
❌ Failed: 0/7
📈 Success Rate: 100%
```

## 🐛 Troubleshooting

**Server not running?**

```bash
pnpm dev
```

**Port already in use?**

```bash
# Check what's using the port
lsof -i :5001

# Kill the process or change PORT in .env
```

**RFP not processing?**

- Check server logs for errors
- Verify URL is accessible
- Check database connection
- Verify scraping service is configured

**Submission fails?**

- Ensure RFP exists and is active
- Check RFP deadline hasn't passed
- Verify proposal data format

## 📝 Notes

- RFP processing is asynchronous (may take 30-60 seconds)
- Use SSE progress stream for real-time updates
- Check server logs for detailed error messages
- Database records are created automatically

---

For detailed testing guide, see: `docs/testing/test-beaconbid-workflow.md`
