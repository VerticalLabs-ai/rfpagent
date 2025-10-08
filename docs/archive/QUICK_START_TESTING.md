# Portal Scanning Tests - Quick Start Guide

## Getting Started

This guide will help you quickly run the portal scanning tests and understand the results.

## Prerequisites

1. **Node.js 18+** installed
2. **pnpm** package manager installed
3. **PostgreSQL 14+** running
4. Environment variables configured

## Quick Commands

### Run All Portal Scanning Tests

```bash
pnpm test tests/portal-scanning/
```

### Run Specific Test Suite

```bash
# Unit tests only
pnpm test tests/portal-scanning/portal-monitoring.test.ts

# Integration tests only
pnpm test tests/portal-scanning/mastra-integration.test.ts

# Performance tests only
pnpm test tests/portal-scanning/performance.test.ts
```

### Run with Coverage

```bash
pnpm test:coverage tests/portal-scanning/
```

### Watch Mode (for development)

```bash
pnpm test:watch tests/portal-scanning/
```

---

## Understanding Test Output

### Successful Test Run

```
PASS  tests/portal-scanning/portal-monitoring.test.ts
  PortalMonitoringService - Unit Tests
    Initial Portal Scan - No Existing Data
      ✓ should discover all RFPs on first scan (1254ms)
      ✓ should save all discovered RFPs to database (892ms)
      ✓ should update portal lastScanned timestamp (743ms)
    Incremental Scan - Detect New RFPs
      ✓ should detect only new RFPs on subsequent scan (1876ms)
      ✓ should not create duplicate RFP records (1123ms)

Test Suites: 3 passed, 3 total
Tests:       62 passed, 62 total
Snapshots:   0 total
Time:        45.234 s
```

### Test Failure Example

```
FAIL  tests/portal-scanning/portal-monitoring.test.ts
  PortalMonitoringService - Unit Tests
    Initial Portal Scan - No Existing Data
      ✕ should discover all RFPs on first scan (1254ms)

  ● should discover all RFPs on first scan

    expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      122 |       const result = await service.scanPortal(testPortal.id);
      123 |
    > 124 |       expect(result.success).toBe(true);
          |                              ^
```

---

## Test Scenarios Explained

### 1. Initial Portal Scan

**What it tests**: First-time discovery of RFPs from a portal

**Expected outcome**: All RFPs are discovered and saved to database

**How to verify**:
```bash
pnpm test tests/portal-scanning/portal-monitoring.test.ts -t "Initial Portal Scan"
```

### 2. Incremental Scan

**What it tests**: Subsequent scans detect only new/changed RFPs

**Expected outcome**: No duplicate RFPs, efficient change detection

**How to verify**:
```bash
pnpm test tests/portal-scanning/portal-monitoring.test.ts -t "Incremental Scan"
```

### 3. Error Handling

**What it tests**: System handles network failures and invalid data

**Expected outcome**: Graceful error handling, no crashes

**How to verify**:
```bash
pnpm test tests/portal-scanning/portal-monitoring.test.ts -t "Error Handling"
```

### 4. Performance

**What it tests**: System performance with large datasets

**Expected outcome**: Processing within time/memory limits

**How to verify**:
```bash
pnpm test tests/portal-scanning/performance.test.ts
```

---

## Common Test Patterns

### Testing a Portal Scan

```typescript
it('should scan portal successfully', async () => {
  // Arrange: Create test portal
  const portal = await createTestPortal({
    name: 'Test Portal',
    status: 'active',
  });

  // Arrange: Mock RFP data
  const mockRFPs = generateMockRFPs(portal.id, 10);
  jest.spyOn(service as any, 'extractRFPs').mockResolvedValue(mockRFPs);

  // Act: Execute scan
  const result = await service.scanPortal(portal.id);

  // Assert: Verify results
  expect(result.success).toBe(true);
  expect(result.discoveredRFPs.length).toBe(10);
  expect(result.errors.length).toBe(0);
});
```

### Testing Error Scenarios

```typescript
it('should handle network timeout', async () => {
  // Arrange: Setup portal and mock error
  const portal = await createTestPortal();
  jest.spyOn(service as any, 'extractRFPs').mockRejectedValue(
    new Error('Network timeout')
  );

  // Act: Execute scan
  const result = await service.scanPortal(portal.id);

  // Assert: Verify error handling
  expect(result.success).toBe(false);
  expect(result.errors[0]).toContain('timeout');
});
```

---

## Troubleshooting

### Test Fails with Timeout

**Problem**: Test exceeds default timeout (30 seconds)

**Solution**: Increase timeout for specific test:
```typescript
it('long running test', async () => {
  // test code
}, 60000); // 60 second timeout
```

### Database Connection Error

**Problem**: Cannot connect to test database

**Solution**:
1. Check DATABASE_URL environment variable
2. Verify PostgreSQL is running
3. Ensure test database exists

```bash
# Check PostgreSQL status
psql -U postgres -c "SELECT version();"

# Create test database if needed
createdb rfpagent_test
```

### Memory Issues

**Problem**: Tests fail with out-of-memory

**Solution**: Run with increased memory:
```bash
NODE_OPTIONS=--max-old-space-size=4096 pnpm test tests/portal-scanning/
```

### Flaky Tests

**Problem**: Tests pass/fail inconsistently

**Solution**:
1. Check for race conditions in concurrent tests
2. Ensure proper test cleanup (afterEach)
3. Use deterministic mock data
4. Add small delays for async operations

---

## Viewing Test Coverage

### Generate Coverage Report

```bash
pnpm test:coverage tests/portal-scanning/
```

### View HTML Report

```bash
# After running coverage
open coverage/lcov-report/index.html
```

### Coverage Thresholds

Current thresholds (must pass):
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

---

## Mock Data Generators

### Generate Test RFPs

```typescript
import { generateMockRFP, generateMockRFPs } from './mock-portal-data';

// Single RFP
const rfp = generateMockRFP('portal-id');

// Multiple RFPs
const rfps = generateMockRFPs('portal-id', 50, {
  minDeadline: 10,
  maxDeadline: 90,
  includeDocuments: true,
});
```

### Generate Test Portals

```typescript
import { generateMockPortal } from './mock-portal-data';

const portal = generateMockPortal({
  type: 'federal',
  requiresAuth: false,
  status: 'active',
});
```

### Generate Large Datasets

```typescript
import { generateLargeDataset } from './mock-portal-data';

const dataset = generateLargeDataset({
  portalCount: 10,
  rfpsPerPortal: 100,
});
```

---

## CI/CD Integration

### GitHub Actions

Tests automatically run on:
- Every push to main branch
- Every pull request
- Manual workflow dispatch

View test results in:
- GitHub Actions tab
- Pull request status checks
- Codecov reports

---

## Performance Benchmarks

### Expected Performance

| Scenario | Expected Time | Expected Memory |
|----------|--------------|-----------------|
| 100 RFPs | < 30 seconds | < 100MB |
| 500 RFPs | < 2 minutes | < 200MB |
| 5 concurrent scans | < 15 seconds | < 150MB |

### Monitoring Performance

```typescript
it('should meet performance benchmarks', async () => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage().heapUsed;

  // ... test code ...

  const duration = Date.now() - startTime;
  const memoryUsed = process.memoryUsage().heapUsed - startMemory;

  console.log(`Duration: ${duration}ms, Memory: ${memoryUsed / 1024 / 1024}MB`);

  expect(duration).toBeLessThan(30000);
  expect(memoryUsed).toBeLessThan(100 * 1024 * 1024);
});
```

---

## Next Steps

1. **Run the tests**: Start with `pnpm test tests/portal-scanning/`
2. **Review output**: Check for any failures
3. **Check coverage**: Run `pnpm test:coverage`
4. **Read documentation**: See `PORTAL_SCANNING_TESTS.md` for detailed info
5. **Review validation report**: See `TEST_VALIDATION_REPORT.md`

---

## Getting Help

### Documentation

- Full test documentation: `docs/testing/PORTAL_SCANNING_TESTS.md`
- Validation report: `docs/testing/TEST_VALIDATION_REPORT.md`
- API documentation: `docs/api/`

### Common Commands Reference

```bash
# Run all tests
pnpm test tests/portal-scanning/

# Run specific test file
pnpm test tests/portal-scanning/portal-monitoring.test.ts

# Run tests matching pattern
pnpm test tests/portal-scanning/ -t "Initial Portal Scan"

# Run with coverage
pnpm test:coverage tests/portal-scanning/

# Run in watch mode
pnpm test:watch tests/portal-scanning/

# Run verbose (detailed output)
pnpm test tests/portal-scanning/ --verbose

# Run with increased memory
NODE_OPTIONS=--max-old-space-size=4096 pnpm test tests/portal-scanning/
```

---

**Last Updated**: 2025-10-08
**Version**: 1.0.0
**Maintainer**: QA Team
