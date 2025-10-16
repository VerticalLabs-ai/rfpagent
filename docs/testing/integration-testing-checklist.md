# Integration Testing Checklist
**Date**: October 16, 2025
**Purpose**: Comprehensive testing guide for Mastra RFP workflow integration

---

## 🎯 Testing Objectives

1. Verify end-to-end workflow execution
2. Validate API endpoint functionality
3. Test phase state machine transitions
4. Confirm error handling and recovery
5. Validate PDF processing capabilities
6. Test workflow coordination and orchestration

---

## ✅ Pre-Test Setup

### Environment Configuration

- [ ] **Database**: PostgreSQL running and accessible
  ```bash
  # Verify connection
  psql $DATABASE_URL -c "SELECT 1;"
  ```

- [ ] **Environment Variables**: All required variables set
  ```bash
  # Required variables
  OPENAI_API_KEY="sk-proj-..."
  ANTHROPIC_API_KEY="sk-ant-..."
  BROWSERBASE_API_KEY="bb_live_..."
  BROWSERBASE_PROJECT_ID="..."
  DATABASE_URL="postgresql://..."
  ```

- [ ] **Dependencies**: All packages installed
  ```bash
  npm install
  # Verify PDF libraries
  npm list pdf-parse pdf-lib
  ```

- [ ] **Server**: Running on expected port
  ```bash
  npm run dev
  # Verify: http://localhost:5001/health
  ```

### Test Data Setup

- [ ] **Portal Configuration**: At least one portal configured
  ```sql
  SELECT id, name, type, url FROM portals LIMIT 1;
  ```

- [ ] **Company Profile**: Test company profile exists
  ```sql
  SELECT id, company_name FROM company_profiles LIMIT 1;
  ```

- [ ] **Test RFP**: Sample RFP with documents
  ```sql
  SELECT id, title, document_urls FROM rfps LIMIT 1;
  ```

---

## 📋 Workflow API Endpoint Tests

### 1. Document Processing Workflow

**Endpoint**: `POST /api/workflows/document-processing/execute`

- [ ] **Test 1.1**: Execute with valid RFP ID
  ```bash
  curl -X POST http://localhost:5001/api/workflows/document-processing/execute \
    -H "Content-Type: application/json" \
    -d '{
      "rfpId": "test-rfp-123",
      "companyProfileId": "company-456",
      "analysisType": "standard",
      "priority": 5
    }'
  ```
  **Expected**: 200 OK, sessionId returned

- [ ] **Test 1.2**: Execute with missing rfpId
  ```bash
  curl -X POST http://localhost:5001/api/workflows/document-processing/execute \
    -H "Content-Type: application/json" \
    -d '{ "companyProfileId": "company-456" }'
  ```
  **Expected**: 400 Bad Request, error message

- [ ] **Test 1.3**: Execute with deadline
  ```bash
  curl -X POST http://localhost:5001/api/workflows/document-processing/execute \
    -H "Content-Type: application/json" \
    -d '{
      "rfpId": "test-rfp-123",
      "companyProfileId": "company-456",
      "deadline": "2025-12-31T23:59:59Z"
    }'
  ```
  **Expected**: 200 OK, deadline acknowledged

- [ ] **Test 1.4**: Verify PDF parsing occurs
  - Check database for extracted text
  - Verify document records updated
  - Confirm storage URL populated

### 2. RFP Discovery Workflow

**Endpoint**: `POST /api/workflows/rfp-discovery/execute`

- [ ] **Test 2.1**: Execute with single portal
  ```bash
  curl -X POST http://localhost:5001/api/workflows/rfp-discovery/execute \
    -H "Content-Type: application/json" \
    -d '{
      "portalIds": ["portal-123"],
      "maxRfps": 10,
      "priority": 8
    }'
  ```
  **Expected**: 200 OK, workflowId returned

- [ ] **Test 2.2**: Execute with multiple portals
  ```bash
  curl -X POST http://localhost:5001/api/workflows/rfp-discovery/execute \
    -H "Content-Type: application/json" \
    -d '{
      "portalIds": ["portal-1", "portal-2", "portal-3"],
      "maxRfps": 50,
      "options": {
        "fullScan": true,
        "deepExtraction": true,
        "realTimeNotifications": true
      }
    }'
  ```
  **Expected**: 200 OK, multiple work items created

- [ ] **Test 2.3**: Execute with search criteria
  ```bash
  curl -X POST http://localhost:5001/api/workflows/rfp-discovery/execute \
    -H "Content-Type: application/json" \
    -d '{
      "portalIds": ["portal-123"],
      "searchCriteria": {
        "keywords": "technology services",
        "agency": "Department of Defense",
        "category": "IT Services"
      }
    }'
  ```
  **Expected**: 200 OK, filtered discovery

- [ ] **Test 2.4**: Verify incremental scanning
  - First scan: Discover N RFPs
  - Second scan: Should detect only new/changed RFPs
  - Check deduplication logic

### 3. Proposal Generation Workflow

**Endpoint**: `POST /api/workflows/proposal-generation/execute`

- [ ] **Test 3.1**: Generate standard proposal
  ```bash
  curl -X POST http://localhost:5001/api/workflows/proposal-generation/execute \
    -H "Content-Type: application/json" \
    -d '{
      "rfpId": "test-rfp-123",
      "companyProfileId": "company-456",
      "proposalType": "standard"
    }'
  ```
  **Expected**: 200 OK, pipelineId returned

- [ ] **Test 3.2**: Generate expedited proposal
  ```bash
  curl -X POST http://localhost:5001/api/workflows/proposal-generation/execute \
    -H "Content-Type: application/json" \
    -d '{
      "rfpId": "test-rfp-123",
      "companyProfileId": "company-456",
      "proposalType": "expedited"
    }'
  ```
  **Expected**: 200 OK, faster execution

- [ ] **Test 3.3**: Verify AI proposal generation
  - Check GPT-5 API calls made
  - Verify proposal content created
  - Confirm pricing tables generated
  - Validate database persistence

- [ ] **Test 3.4**: Test with missing company profile
  ```bash
  curl -X POST http://localhost:5001/api/workflows/proposal-generation/execute \
    -H "Content-Type: application/json" \
    -d '{
      "rfpId": "test-rfp-123",
      "companyProfileId": "nonexistent"
    }'
  ```
  **Expected**: 500 Error, descriptive error message

---

## 🔄 Phase State Machine Tests

### 4. Phase Lifecycle

- [ ] **Test 4.1**: Discovery phase initialization
  ```typescript
  // Create workflow in discovery phase
  const workflow = await mastraWorkflowEngine.createWorkflowWithPhaseState(
    'test-workflow-001',
    'discovery',
    { portalIds: ['portal-123'] }
  );
  ```
  **Expected**: Workflow created, status=pending, phase=discovery

- [ ] **Test 4.2**: Automatic transition to analysis
  ```typescript
  // Transition with valid conditions
  const result = await mastraWorkflowEngine.transitionWorkflowPhase(
    'test-workflow-001',
    'analysis',
    'test-system',
    'automatic',
    'Discovery completed',
    { rfpCount: 5, requiredFields: ['title', 'agency', 'deadline'] }
  );
  ```
  **Expected**: success=true, phase=analysis

- [ ] **Test 4.3**: Blocked transition (conditions not met)
  ```typescript
  // Attempt transition without meeting conditions
  const result = await mastraWorkflowEngine.transitionWorkflowPhase(
    'test-workflow-001',
    'proposal_generation',
    'test-system',
    'automatic',
    undefined,
    { complianceScore: 0.5 } // Below threshold of 0.8
  );
  ```
  **Expected**: success=false, blockedReasons populated

- [ ] **Test 4.4**: Manual phase rollback
  ```typescript
  // Rollback to previous phase
  const result = await mastraWorkflowEngine.transitionWorkflowPhase(
    'test-workflow-001',
    'discovery',
    'test-admin',
    'rollback',
    'Need additional data'
  );
  ```
  **Expected**: success=true, phase rolled back

- [ ] **Test 4.5**: Phase timeout enforcement
  - Create workflow in discovery phase
  - Wait for 61 minutes (timeout: 60 min)
  - Verify automatic cancellation or alert

### 5. Workflow State Management

- [ ] **Test 5.1**: Suspend workflow
  ```bash
  curl -X POST http://localhost:5001/api/workflows/test-workflow-001/suspend \
    -H "Content-Type: application/json" \
    -d '{ "reason": "Manual review required" }'
  ```
  **Expected**: 200 OK, status=suspended

- [ ] **Test 5.2**: Resume workflow
  ```bash
  curl -X POST http://localhost:5001/api/workflows/test-workflow-001/resume \
    -H "Content-Type: application/json" \
    -d '{ "resumeData": { "reason": "Review completed" } }'
  ```
  **Expected**: 200 OK, status=in_progress

- [ ] **Test 5.3**: Cancel workflow
  ```bash
  curl -X POST http://localhost:5001/api/workflows/test-workflow-001/cancel \
    -H "Content-Type: application/json" \
    -d '{ "reason": "RFP deadline passed" }'
  ```
  **Expected**: 200 OK, status=cancelled

- [ ] **Test 5.4**: Cascading cancellation
  - Create parent workflow with child workflows
  - Cancel parent
  - Verify all children also cancelled

---

## 📄 PDF Processing Tests

### 6. PDF Text Extraction

- [ ] **Test 6.1**: Extract text from simple PDF
  ```typescript
  const result = await parsePDFFile('/path/to/simple.pdf');
  ```
  **Expected**: text extracted, pages counted

- [ ] **Test 6.2**: Extract text from complex PDF (multi-column)
  ```typescript
  const result = await parsePDFFile('/path/to/complex.pdf');
  ```
  **Expected**: text extracted preserving structure

- [ ] **Test 6.3**: Handle PDF with no text (scanned images)
  ```typescript
  const result = await parsePDFFile('/path/to/scanned.pdf');
  ```
  **Expected**: Empty text, no crash

- [ ] **Test 6.4**: Extract from password-protected PDF
  ```typescript
  const result = await parsePDFFile('/path/to/protected.pdf');
  ```
  **Expected**: Error or empty result

### 7. PDF Form Detection

- [ ] **Test 7.1**: Detect form fields in fillable PDF
  ```typescript
  const fields = await getPDFFormFields('/path/to/form.pdf');
  ```
  **Expected**: Array of form fields with types

- [ ] **Test 7.2**: Identify field types correctly
  - Text fields → type: 'text'
  - Checkboxes → type: 'checkbox'
  - Radio buttons → type: 'radio'
  - Dropdowns → type: 'dropdown'

- [ ] **Test 7.3**: Extract field values
  ```typescript
  const fields = await getPDFFormFields('/path/to/filled-form.pdf');
  ```
  **Expected**: Field values populated

### 8. PDF Form Filling

- [ ] **Test 8.1**: Fill text fields
  ```typescript
  await fillPDFForm(
    '/path/to/form.pdf',
    { 'company_name': 'Acme Corp', 'contact_email': 'test@acme.com' },
    '/path/to/filled.pdf'
  );
  ```
  **Expected**: PDF created with filled fields

- [ ] **Test 8.2**: Check checkboxes
  ```typescript
  await fillPDFForm(
    '/path/to/form.pdf',
    { 'agree_terms': true, 'subscribe_newsletter': true },
    '/path/to/filled.pdf'
  );
  ```
  **Expected**: Checkboxes marked

- [ ] **Test 8.3**: Handle missing fields gracefully
  ```typescript
  await fillPDFForm(
    '/path/to/form.pdf',
    { 'nonexistent_field': 'value' },
    '/path/to/filled.pdf'
  );
  ```
  **Expected**: Warning logged, no crash

### 9. Proposal PDF Assembly

- [ ] **Test 9.1**: Assemble basic proposal
  ```typescript
  const pdfBuffer = await assembleProposalPDF({
    title: 'Test Proposal',
    sections: [
      { title: 'Executive Summary', content: 'Lorem ipsum...' },
      { title: 'Technical Approach', content: 'Our approach...' }
    ]
  });
  ```
  **Expected**: PDF buffer generated

- [ ] **Test 9.2**: Assemble with custom formatting
  ```typescript
  const pdfBuffer = await assembleProposalPDF(
    { title: 'Test Proposal', sections: [...] },
    {
      includeTableOfContents: true,
      includeHeaders: true,
      includeFooters: true,
      pageNumbers: true
    }
  );
  ```
  **Expected**: Formatted PDF with headers/footers

- [ ] **Test 9.3**: Verify page breaks
  - Long sections should paginate correctly
  - No orphaned headings
  - Table of contents accurate

- [ ] **Test 9.4**: Merge multiple PDFs
  ```typescript
  const merged = await mergePDFs([
    '/path/to/proposal.pdf',
    '/path/to/appendix.pdf',
    '/path/to/terms.pdf'
  ]);
  ```
  **Expected**: Single combined PDF

---

## 🔗 Workflow Coordination Tests

### 10. Master Orchestration (When API Available)

- [ ] **Test 10.1**: Discovery mode
  ```bash
  curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
    -H "Content-Type: application/json" \
    -d '{
      "mode": "discovery",
      "portalIds": ["portal-123"],
      "options": { "deepScan": true }
    }'
  ```
  **Expected**: RFPs discovered and returned

- [ ] **Test 10.2**: Proposal mode
  ```bash
  curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
    -H "Content-Type: application/json" \
    -d '{
      "mode": "proposal",
      "rfpId": "test-rfp-123",
      "companyProfileId": "company-456"
    }'
  ```
  **Expected**: Proposal generated

- [ ] **Test 10.3**: Full pipeline mode
  ```bash
  curl -X POST http://localhost:5001/api/workflows/master-orchestration/execute \
    -H "Content-Type: application/json" \
    -d '{
      "mode": "full_pipeline",
      "portalIds": ["portal-1", "portal-2"],
      "companyProfileId": "company-456",
      "options": {
        "autoSubmit": false,
        "parallel": true
      }
    }'
  ```
  **Expected**: Complete pipeline execution

- [ ] **Test 10.4**: BonfireHub authentication caching
  - First call: Authenticates
  - Second call (within 24h): Uses cached session
  - Third call (after 24h): Re-authenticates

### 11. Work Item Coordination

- [ ] **Test 11.1**: Parallel work item execution
  - Create 5 work items
  - Verify concurrent execution
  - Check completion order

- [ ] **Test 11.2**: Sequential work item execution
  - Create dependent work items
  - Verify order of execution
  - Check dependency resolution

- [ ] **Test 11.3**: Work item retry on failure
  - Simulate transient failure
  - Verify exponential backoff
  - Confirm eventual success

- [ ] **Test 11.4**: Dead Letter Queue (DLQ)
  - Simulate permanent failure
  - Verify move to DLQ
  - Check DLQ processing

---

## 🛡️ Error Handling Tests

### 12. Workflow Error Recovery

- [ ] **Test 12.1**: Handle API timeout
  - Simulate GPT-5 timeout
  - Verify retry mechanism
  - Check fallback behavior

- [ ] **Test 12.2**: Handle database connection loss
  - Disconnect database
  - Verify error handling
  - Check graceful degradation

- [ ] **Test 12.3**: Handle missing document
  - Request processing for non-existent document
  - Verify error message
  - Check workflow continuation

- [ ] **Test 12.4**: Handle malformed PDF
  - Process corrupted PDF
  - Verify error capture
  - Check logging

### 13. Phase Transition Errors

- [ ] **Test 13.1**: Invalid transition attempt
  ```typescript
  // Try to skip phases
  const result = await mastraWorkflowEngine.transitionWorkflowPhase(
    'workflow-001',
    'submission', // Skip proposal_generation
    'test-system',
    'automatic'
  );
  ```
  **Expected**: success=false, error message

- [ ] **Test 13.2**: Transition with missing data
  ```typescript
  const result = await mastraWorkflowEngine.transitionWorkflowPhase(
    'workflow-001',
    'analysis',
    'test-system',
    'automatic',
    undefined,
    {} // Empty context
  );
  ```
  **Expected**: success=false, validation error

- [ ] **Test 13.3**: Rollback failure
  - Attempt rollback to invalid phase
  - Verify error handling
  - Check state consistency

---

## 📊 Performance Tests

### 14. Load Testing

- [ ] **Test 14.1**: Concurrent workflow execution
  - Launch 10 workflows simultaneously
  - Monitor resource usage
  - Verify completion

- [ ] **Test 14.2**: Large document processing
  - Process PDF > 100 pages
  - Monitor memory usage
  - Verify completion time

- [ ] **Test 14.3**: Batch RFP discovery
  - Scan 10+ portals in parallel
  - Monitor API rate limits
  - Check success rate

- [ ] **Test 14.4**: Proposal generation stress test
  - Generate 20 proposals consecutively
  - Monitor AI API usage
  - Check quality consistency

---

## 🔍 Monitoring & Observability Tests

### 15. Metrics Collection

- [ ] **Test 15.1**: Phase statistics endpoint
  ```bash
  curl http://localhost:5001/api/workflows/phase-stats
  ```
  **Expected**: Statistics per phase

- [ ] **Test 15.2**: Workflow state endpoint
  ```bash
  curl http://localhost:5001/api/workflows/state
  ```
  **Expected**: Overview of all workflows

- [ ] **Test 15.3**: Work item progress tracking
  - Start workflow
  - Monitor progress updates
  - Verify accuracy

- [ ] **Test 15.4**: Phase history tracking
  ```bash
  curl http://localhost:5001/api/workflows/workflow-001/status
  ```
  **Expected**: Complete phase history

---

## ✅ Integration Test Summary

### Test Categories

| Category | Total Tests | Priority |
|----------|-------------|----------|
| Workflow APIs | 12 | High |
| Phase State Machine | 9 | High |
| PDF Processing | 13 | High |
| Workflow Coordination | 8 | Medium |
| Error Handling | 7 | High |
| Performance | 4 | Medium |
| Monitoring | 4 | Low |
| **TOTAL** | **57** | - |

### Success Criteria

- ✅ All High priority tests pass (41 tests)
- ⚠️ 90%+ Medium priority tests pass (11 tests)
- ℹ️ 50%+ Low priority tests pass (2 tests)

### Test Execution

```bash
# Run all tests
npm test -- --grep "Integration"

# Run specific category
npm test -- --grep "Workflow API"
npm test -- --grep "Phase State"
npm test -- --grep "PDF Processing"

# Run with coverage
npm run test:coverage
```

---

## 📝 Test Results Template

```markdown
## Test Run: [Date]
**Tester**: [Name]
**Environment**: [Dev/Staging/Prod]

### Results Summary
- Total Tests: 57
- Passed: __
- Failed: __
- Skipped: __
- Coverage: __%

### Failed Tests
1. [Test ID]: [Test Name]
   - Error: [Error message]
   - Expected: [Expected behavior]
   - Actual: [Actual behavior]
   - Root Cause: [Analysis]
   - Fix: [Proposed solution]

### Performance Notes
- Average workflow execution time: __s
- PDF processing time: __s
- API response time: __ms

### Recommendations
1. [Action item 1]
2. [Action item 2]
```

---

## 🚀 Next Steps After Testing

1. **Fix Identified Issues**: Address all failed tests
2. **Update Documentation**: Reflect any new findings
3. **Performance Optimization**: Based on load test results
4. **CI/CD Integration**: Add tests to pipeline
5. **Monitoring Setup**: Configure alerts for failures

---

## 📚 Related Documentation

- **Workflow Integration Summary**: `/docs/architecture/workflow-integration-summary.md`
- **Mastra Integration Status**: `/docs/MASTRA_INTEGRATION_STATUS.md`
- **PDF Processing Guide**: `/docs/pdf-processing.md`
- **Integration Review**: `/docs/architecture/mastra-integration-review.md`
