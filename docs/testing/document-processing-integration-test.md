# Document Processing Integration Test Plan
**Date**: October 16, 2025
**Feature**: Automatic Analysis Workflow Trigger on Document Download
**Status**: ✅ IMPLEMENTED

---

## 🎯 Test Objective

Verify that downloading RFP documents automatically triggers the AI-powered document analysis workflow, fixing Issue 3 from the integration analysis.

---

## 📋 Test Cases

### Test 1: Successful Document Download Triggers Analysis

**Endpoint**: `POST /api/rfps/:id/download-documents`

**Prerequisites**:
- Valid Philadelphia RFP exists in database
- RFP has at least one downloadable document
- Database is accessible
- Analysis orchestrator is initialized

**Test Steps**:
```bash
# 1. Get an RFP ID from Philadelphia portal
curl http://localhost:5001/api/rfps | jq '.rfps[] | select(.sourceUrl | contains("phlcontracts.phila.gov")) | .id' | head -1

# 2. Download documents for that RFP
curl -X POST http://localhost:5001/api/rfps/{rfp-id}/download-documents \
  -H "Content-Type: application/json" \
  -d '{
    "documentNames": ["Solicitation.pdf", "Scope of Work.pdf"]
  }' | jq .

# 3. Verify response includes analysisWorkflowId
# Expected response:
{
  "success": true,
  "rfpId": "rfp_abc123",
  "results": [...],
  "savedDocuments": [...],
  "summary": {
    "total": 2,
    "successful": 2,
    "failed": 0
  },
  "analysisWorkflowId": "wf_xyz789"  // ✅ This should be present
}

# 4. Check logs for workflow trigger confirmation
# Expected log output:
# 🔍 Starting document analysis workflow for RFP rfp_abc123
# ✅ Analysis workflow started: wf_xyz789
```

**Expected Results**:
- ✅ Documents successfully downloaded
- ✅ Documents saved to database
- ✅ Analysis workflow triggered automatically
- ✅ `analysisWorkflowId` included in response
- ✅ RFP status updated to 'parsing'
- ✅ Analysis work items created in database
- ✅ No errors in console

**SQL Verification**:
```sql
-- Check RFP status changed
SELECT id, status, progress FROM rfps WHERE id = 'rfp_abc123';
-- Expected: status = 'parsing', progress = 40

-- Check documents were saved
SELECT id, filename, object_path FROM documents WHERE rfp_id = 'rfp_abc123';

-- Check work items were created
SELECT id, task_type, status, assigned_agent
FROM work_items
WHERE session_id LIKE 'analysis_rfp_abc123_%'
ORDER BY created_at;
-- Expected: 4 phases of work items (validation, extraction, parsing, compliance)
```

---

### Test 2: Failed Downloads Don't Trigger Analysis

**Test Steps**:
```bash
# 1. Try to download non-existent documents
curl -X POST http://localhost:5001/api/rfps/{rfp-id}/download-documents \
  -H "Content-Type: application/json" \
  -d '{
    "documentNames": ["NonExistent.pdf"]
  }' | jq .
```

**Expected Results**:
- ✅ Download fails gracefully
- ✅ `analysisWorkflowId` is NOT in response (undefined)
- ✅ RFP status remains 'open'
- ✅ No work items created
- ✅ Appropriate error message returned

---

### Test 3: Partial Success Triggers Analysis

**Test Steps**:
```bash
# Mix of valid and invalid document names
curl -X POST http://localhost:5001/api/rfps/{rfp-id}/download-documents \
  -H "Content-Type: application/json" \
  -d '{
    "documentNames": ["Solicitation.pdf", "NonExistent.pdf"]
  }' | jq .
```

**Expected Results**:
- ✅ At least one document downloaded successfully
- ✅ Analysis workflow triggered (successCount > 0)
- ✅ `analysisWorkflowId` present in response
- ✅ RFP status = 'parsing'
- ✅ Work items created for successful documents only

---

### Test 4: Analysis Workflow Failure Doesn't Break Download

**Prerequisites**:
- Temporarily disable analysis orchestrator or simulate failure

**Test Steps**:
```bash
# Download documents normally
curl -X POST http://localhost:5001/api/rfps/{rfp-id}/download-documents \
  -H "Content-Type: application/json" \
  -d '{
    "documentNames": ["Solicitation.pdf"]
  }' | jq .
```

**Expected Results**:
- ✅ Document download completes successfully
- ✅ Error logged: "Error starting analysis workflow"
- ✅ Download response still returns success
- ✅ `analysisWorkflowId` is undefined (not in response)
- ✅ Documents still saved to database
- ✅ No 500 error thrown to client

---

### Test 5: End-to-End Data Flow Verification

**Complete Flow Test**:
```bash
# 1. Download documents
RESPONSE=$(curl -s -X POST http://localhost:5001/api/rfps/{rfp-id}/download-documents \
  -H "Content-Type: application/json" \
  -d '{"documentNames": ["Solicitation.pdf"]}')

WORKFLOW_ID=$(echo $RESPONSE | jq -r '.analysisWorkflowId')

# 2. Check workflow status
curl http://localhost:5001/api/workflows/${WORKFLOW_ID}/status | jq .

# 3. Wait for completion (polling)
while true; do
  STATUS=$(curl -s http://localhost:5001/api/workflows/${WORKFLOW_ID}/status | jq -r '.status')
  echo "Workflow status: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 5
done

# 4. Verify extracted data
curl http://localhost:5001/api/rfps/{rfp-id}/documents | jq '.[] | {filename, extractedText: .extractedText[:100]}'

# 5. Check RFP status progression
curl http://localhost:5001/api/rfps/{rfp-id} | jq '{status, progress}'
```

**Expected Results**:
- ✅ Workflow completes successfully
- ✅ Documents have `extractedText` populated
- ✅ RFP status progresses: 'open' → 'parsing' → 'analyzing' → 'review'
- ✅ AI-extracted requirements visible in RFP data
- ✅ Compliance items identified
- ✅ Deadlines extracted

---

## 🔍 Verification Checklist

**Code Integration**:
- [x] `analysisOrchestrator` imported in rfps.routes.ts:11
- [x] Workflow trigger added after successful downloads (lines 394-417)
- [x] Error handling prevents download failure if analysis fails
- [x] `analysisWorkflowId` included in response (line 429)
- [x] High priority (8) set for downloaded documents

**Workflow Behavior**:
- [ ] Analysis workflow starts automatically on download success
- [ ] Work items created for each downloaded document
- [ ] 4-phase workflow executes: validation → extraction → parsing → compliance
- [ ] Progress tracking updates in real-time
- [ ] RFP status transitions correctly

**Error Handling**:
- [ ] Download failures don't trigger analysis
- [ ] Analysis failures don't break download response
- [ ] Errors logged appropriately
- [ ] Client receives meaningful error messages

**Data Flow**:
- [ ] Documents saved to database
- [ ] PDF text extraction works
- [ ] Extracted text stored in `documents.extractedText`
- [ ] RFP data updated with AI analysis results
- [ ] Proposals receive RFP context from analysis

---

## 🚨 Known Issues & Limitations

**Current**:
- Analysis runs asynchronously; client must poll for completion
- No SSE stream for analysis progress (separate from proposal progress)
- Circuit breaker not yet implemented for AI APIs

**Future Enhancements**:
- Add SSE endpoint for analysis progress updates
- Implement circuit breaker for GPT-5 calls
- Add retry logic for transient AI API failures
- Support batch document processing

---

## 📊 Performance Expectations

**Single Document**:
- Download: 2-5 seconds
- PDF parsing: 1-3 seconds
- AI analysis: 5-15 seconds
- Total: ~10-25 seconds

**Multiple Documents (3-5)**:
- Download: 5-10 seconds (parallel)
- PDF parsing: 3-8 seconds (parallel)
- AI analysis: 10-30 seconds (sequential per phase)
- Total: ~20-50 seconds

**Large RFPs (10+ documents)**:
- Download: 15-30 seconds
- PDF parsing: 10-20 seconds
- AI analysis: 30-90 seconds
- Total: ~60-150 seconds

---

## 🐛 Debugging Guide

**Issue**: No analysisWorkflowId in response

**Checks**:
1. Verify documents downloaded successfully (`successCount > 0`)
2. Check console logs for "🔍 Starting document analysis workflow"
3. Verify `analysisOrchestrator` import is present
4. Check database for saved documents

**Issue**: Workflow fails to start

**Checks**:
1. Verify `work_items` table exists
2. Check analysis orchestrator initialization
3. Review error logs for orchestrator failures
4. Verify agent registry is properly configured

**Issue**: PDF text not extracted

**Checks**:
1. Verify `pdf-parse` dependency installed
2. Check document file paths are correct
3. Review PDF processing logs in workflow
4. Verify storage service is accessible

---

## 📈 Success Criteria

**Integration Complete When**:
- ✅ All 5 test cases pass
- ✅ End-to-end flow verified
- ✅ No errors in production logs
- ✅ RFP status transitions correctly
- ✅ Extracted text populated in database
- ✅ Proposals include RFP context

**Performance Acceptable When**:
- ✅ Single document analysis < 30 seconds
- ✅ 5-document batch < 60 seconds
- ✅ No memory leaks during parallel processing
- ✅ Error rate < 1% for valid downloads

---

## 🔗 Related Files

- **Implementation**: `server/routes/rfps.routes.ts` (lines 11, 394-417, 429)
- **Orchestrator**: `server/services/orchestrators/analysisOrchestrator.ts`
- **Workflow**: `src/mastra/workflows/document-processing-workflow.ts`
- **Progress UI**: `client/src/components/ProposalGenerationProgress.tsx`

---

**Test Status**: ⏳ READY FOR EXECUTION
**Next Step**: Run test suite and verify all criteria met
