# Route Refactoring Implementation Guide

This guide provides a step-by-step approach to refactor the massive `/server/routes.ts` file (4,395 lines) into maintainable, domain-specific route modules.

## Overview

The refactoring breaks down routes into 11 domain-specific modules, each under 300 lines, with shared middleware for common concerns like authentication, validation, and error handling.

## Implementation Strategy

### Phase 1: Setup Infrastructure

1. ✅ Create the new routes directory structure
2. ✅ Implement shared middleware modules
3. ✅ Create the main router composition pattern
4. ✅ Build sample route modules (RFP and Proposals)

### Phase 2: Module Extraction (Do this for each domain)

1. **Identify Route Groups**: Extract routes by URL prefix pattern
2. **Copy Route Logic**: Move route handlers with minimal changes
3. **Add Middleware**: Apply appropriate validation and rate limiting
4. **Update Imports**: Ensure all dependencies are imported
5. **Test Module**: Verify routes work in isolation

### Phase 3: Integration & Testing

1. **Update Main Routes File**: Replace direct route definitions with module imports
2. **Test Integration**: Ensure all routes still work
3. **Performance Testing**: Verify no performance degradation
4. **Cleanup**: Remove old route definitions

## Detailed Module Breakdown

### 1. System Routes (`system.routes.ts`)

**Routes**: `/api/system/*`, `/api/e2e/*`
**Line Count**: ~50 lines
**Responsibilities**:

- System configuration management
- Health checks and status endpoints
- Service control (start/stop/restart)
- E2E testing endpoints

```typescript
// Extract these route patterns:
app.get("/api/system/config", ...)
app.post("/api/system/services/:service/:action", ...)
app.get("/api/system-health", ...)
app.get("/api/e2e/system-readiness", ...)
```

### 2. Dashboard Routes (`dashboard.routes.ts`)

**Routes**: `/api/dashboard/*`
**Line Count**: ~30 lines
**Responsibilities**:

- Dashboard metrics and analytics
- Real-time system statistics
- Performance monitoring data

```typescript
// Extract these route patterns:
app.get("/api/dashboard/metrics", ...)
```

### 3. Portal Routes (`portals.routes.ts`)

**Routes**: `/api/portals/*`
**Line Count**: ~150 lines
**Responsibilities**:

- Portal CRUD operations
- Portal monitoring and status
- Scanning operations
- Activity tracking
- Discovery management

```typescript
// Extract these route patterns:
app.get("/api/portals", ...)
app.post("/api/portals", ...)
app.put("/api/portals/:id", ...)
app.delete("/api/portals/:id", ...)
app.get("/api/portals/activity", ...)
app.get("/api/portals/monitoring/status", ...)
app.post("/api/portals/:id/scan", ...)
app.get("/api/portals/discoveries/recent", ...)
```

### 4. RFP Routes (`rfps.routes.ts`) ✅ **COMPLETED**

**Routes**: `/api/rfps/*`
**Line Count**: ~250 lines
**Responsibilities**:

- RFP CRUD operations
- Document management
- Manual RFP entry
- Document downloading
- RFP rescaping

### 5. Proposal Routes (`proposals.routes.ts`) ✅ **COMPLETED**

**Routes**: `/api/proposals/*`
**Line Count**: ~200 lines
**Responsibilities**:

- Proposal generation (AI and enhanced)
- Pipeline management
- Submission materials
- Approval workflows

### 6. Submission Routes (`submissions.routes.ts`)

**Routes**: `/api/submissions/*`
**Line Count**: ~180 lines
**Responsibilities**:

- Submission pipeline management
- Status tracking
- Metrics and analytics
- Retry mechanisms

```typescript
// Extract these route patterns:
app.post("/api/submissions/pipeline/start", ...)
app.get("/api/submissions/pipeline/status/:pipelineId", ...)
app.get("/api/submissions/:submissionId/status", ...)
app.delete("/api/submissions/pipeline/:pipelineId", ...)
app.delete("/api/submissions/:submissionId", ...)
app.post("/api/submissions/retry", ...)
app.get("/api/submissions/pipeline/workflows", ...)
app.get("/api/submissions/metrics", ...)
app.post("/api/submissions/:proposalId/submit", ...)
```

### 7. Document Routes (`documents.routes.ts`)

**Routes**: `/api/documents/*`
**Line Count**: ~80 lines
**Responsibilities**:

- Document analysis
- Auto-fill capabilities
- Document intelligence

```typescript
// Extract these route patterns:
app.post("/api/documents/analyze/:rfpId", ...)
app.post("/api/documents/autofill/:rfpId", ...)
```

### 8. AI Routes (`ai.routes.ts`)

**Routes**: `/api/ai/*`
**Line Count**: ~200 lines
**Responsibilities**:

- AI conversation management
- Research findings
- Company data mapping
- RFP analysis
- Proposal generation

```typescript
// Extract these route patterns:
app.post("/api/ai/analyze-rfp", ...)
app.post("/api/ai/generate-proposal", ...)
app.post("/api/ai/map-company-data", ...)
app.post("/api/ai/execute-action", ...)
app.get("/api/ai/conversations", ...)
app.post("/api/ai/conversations", ...)
app.get("/api/ai/research-findings", ...)
app.post("/api/ai/research-findings", ...)
app.post("/api/ai/chat", ...)
```

### 9. Company Routes (`company.routes.ts`)

**Routes**: `/api/company-*/*`
**Line Count**: ~120 lines
**Responsibilities**:

- Company profile management
- Address management
- Contact management
- Certification tracking
- Insurance information

```typescript
// Extract these route patterns:
app.get("/api/company-profiles", ...)
app.post("/api/company-profiles", ...)
app.get("/api/company-addresses/:profileId", ...)
app.post("/api/company-addresses", ...)
app.get("/api/company-contacts/:profileId", ...)
app.post("/api/company-contacts", ...)
app.get("/api/company-identifiers/:profileId", ...)
app.post("/api/company-identifiers", ...)
app.get("/api/company-certifications/:profileId", ...)
app.post("/api/company-certifications", ...)
app.get("/api/company-insurance/:profileId", ...)
app.post("/api/company-insurance", ...)
```

### 10. Workflow Routes (`workflows.routes.ts`)

**Routes**: `/api/workflows/*`
**Line Count**: ~150 lines
**Responsibilities**:

- Workflow orchestration
- State management
- Execution tracking
- Suspended workflow handling

```typescript
// Extract these route patterns:
app.get("/api/workflows/state", ...)
app.post("/api/workflows/state", ...)
app.get("/api/workflows/state/:workflowId", ...)
app.get("/api/workflows/suspended", ...)
app.post("/api/workflows/rfp-discovery/execute", ...)
app.post("/api/workflows/document-processing/execute", ...)
app.post("/api/workflows/proposal-generation/execute", ...)
app.get("/api/workflows/phase-stats", ...)
```

### 11. Scan Routes (`scans.routes.ts`)

**Routes**: `/api/scans/*`
**Line Count**: ~100 lines
**Responsibilities**:

- Scan status tracking
- Active scan monitoring
- Scan result management

```typescript
// Extract these route patterns:
app.get("/api/scans/:scanId/status", ...)
app.get("/api/scans/active", ...)
app.get("/api/portals/:id/scan/stream", ...)
```

## Middleware Strategy

### Common Middleware Applied to Routes

1. **Error Handling**: All routes use `handleAsyncError` wrapper
2. **Rate Limiting**: Applied based on operation type:
   - `aiOperationLimiter`: AI-related endpoints
   - `heavyOperationLimiter`: Resource-intensive operations
   - `uploadLimiter`: File upload endpoints
   - `scanLimiter`: Portal scanning operations
3. **Validation**: Use `validateRequest` with appropriate Zod schemas
4. **Authentication**: Applied where needed using JWT or API key auth

### Middleware Examples

```typescript
// AI operations with rate limiting
router.post('/generate',
  aiOperationLimiter,
  validateRequest(proposalGenerationSchema),
  handleAsyncError(async (req, res) => { ... })
);

// Heavy operations with strict limits
router.post('/pipeline/start',
  heavyOperationLimiter,
  requirePermission('proposals:create'),
  validateRequest(pipelineStartSchema),
  handleAsyncError(async (req, res) => { ... })
);

// File uploads with validation
router.post('/documents/upload',
  uploadLimiter,
  validateFileUpload(['pdf', 'doc', 'docx'], 10 * 1024 * 1024),
  handleAsyncError(async (req, res) => { ... })
);
```

## Migration Checklist

### For Each Module

- [ ] Extract routes from main file
- [ ] Add appropriate imports
- [ ] Apply middleware patterns
- [ ] Add error handling
- [ ] Test route functionality
- [ ] Update main routes file
- [ ] Remove old route definitions

### Testing Strategy

1. **Unit Tests**: Test each route module in isolation
2. **Integration Tests**: Verify router composition works
3. **API Tests**: Ensure all endpoints remain functional
4. **Performance Tests**: Validate no performance degradation

### Rollback Strategy

1. Keep original `routes.ts` as `routes.ts.backup`
2. Use feature flags to switch between old and new routing
3. Monitor error rates during migration
4. Have quick rollback procedure ready

## Benefits Achieved

1. **Maintainability**: Each module is <300 lines and focused on single domain
2. **Testability**: Routes can be tested in isolation
3. **Reusability**: Middleware is shared and composable
4. **Scalability**: Easy to add new routes and modify existing ones
5. **Team Collaboration**: Different developers can work on different modules
6. **Code Organization**: Clear separation of concerns

## Next Steps

1. **Complete Module Extraction**: Create remaining 9 route modules
2. **Update Main Routes**: Modify `/server/routes.ts` to use new modules
3. **Add Tests**: Create comprehensive test suite for each module
4. **Documentation**: Update API documentation to reflect new structure
5. **Monitoring**: Add route-level monitoring and analytics
