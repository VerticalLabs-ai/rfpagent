# Tests Directory - Test Suite and Quality Assurance

**Last Updated**: October 2025

## Overview

The `tests/` directory contains the test suite for the RFP Agent application, including unit tests, integration tests, and end-to-end tests to ensure code quality, reliability, and correctness.

## Purpose

This directory serves to:

- **Unit Testing** - Test individual functions and classes in isolation
- **Integration Testing** - Test component interactions and workflows
- **End-to-End Testing** - Test complete user workflows
- **Quality Assurance** - Maintain code quality and prevent regressions
- **Documentation** - Tests serve as living documentation of expected behavior

## Directory Structure

```
tests/
├── setup.ts                # Test setup and global configuration
├── unit/                  # Unit tests for individual modules
│   ├── services/         # Service layer tests
│   ├── utils/            # Utility function tests
│   └── models/           # Data model tests
├── integration/           # Integration tests
│   ├── api/              # API endpoint tests
│   ├── agents/           # Agent system tests
│   └── workflows/        # Workflow tests
├── e2e/                  # End-to-end tests (Playwright)
│   ├── portal-scanning.spec.ts
│   ├── proposal-generation.spec.ts
│   └── user-workflows.spec.ts
├── fixtures/             # Test data and fixtures
│   ├── rfps/            # Sample RFP data
│   ├── proposals/       # Sample proposals
│   └── portals/         # Portal configurations
└── CLAUDE.md            # This file
```

## Testing Stack

### Unit & Integration Tests

- **Jest 30.2+** - Testing framework
- **ts-jest 29.4+** - TypeScript support for Jest
- **@jest/globals** - Modern Jest imports

### End-to-End Tests

- **Playwright 1.56+** - Browser automation and E2E testing

### Testing Utilities

- **Vitest 3.2+** - Fast unit test runner (alternative to Jest)
- **@testing-library/react** - React component testing (if used)

## Test Organization

### Unit Tests

Test individual functions and classes in isolation:

```
tests/unit/
├── services/
│   ├── aiService.test.ts              # AI service tests
│   ├── documentProcessing.test.ts     # Document processing tests
│   └── proposalGeneration.test.ts     # Proposal generation tests
├── utils/
│   ├── logger.test.ts                 # Logger tests
│   ├── retry.test.ts                  # Retry logic tests
│   └── circuitBreaker.test.ts         # Circuit breaker tests
└── models/
    └── rfp.test.ts                    # RFP model tests
```

**Example Unit Test**:

```typescript
// tests/unit/utils/retry.test.ts
import { describe, it, expect } from '@jest/globals';
import { retry } from '../../../server/utils/retry';

describe('retry utility', () => {
  it('should retry on failure', async () => {
    let attempts = 0;

    const result = await retry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Fail');
        return 'success';
      },
      { maxAttempts: 3, initialDelay: 10 }
    );

    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('should throw after max attempts', async () => {
    await expect(
      retry(
        async () => {
          throw new Error('Always fails');
        },
        { maxAttempts: 2, initialDelay: 10 }
      )
    ).rejects.toThrow('Always fails');
  });
});
```

### Integration Tests

Test interactions between multiple components:

```
tests/integration/
├── api/
│   ├── rfps.test.ts          # RFP API tests
│   ├── proposals.test.ts     # Proposal API tests
│   └── portals.test.ts       # Portal API tests
├── agents/
│   ├── agentRegistry.test.ts # Agent registry tests
│   └── delegation.test.ts    # Agent delegation tests
└── workflows/
    ├── rfpDiscovery.test.ts       # RFP discovery workflow
    └── proposalGeneration.test.ts # Proposal workflow
```

**Example Integration Test**:

```typescript
// tests/integration/api/rfps.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../../server/index';
import { db } from '../../../server/db';

describe('RFP API', () => {
  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
  });

  afterAll(async () => {
    // Cleanup
    await cleanupTestDatabase();
  });

  it('GET /api/rfps should return list of RFPs', async () => {
    const response = await request(app).get('/api/rfps').expect(200);

    expect(response.body).toHaveProperty('rfps');
    expect(response.body).toHaveProperty('total');
    expect(Array.isArray(response.body.rfps)).toBe(true);
  });

  it('POST /api/rfps should create new RFP', async () => {
    const newRFP = {
      title: 'Test RFP',
      agency: 'Test Agency',
      sourceUrl: 'https://test.gov/rfp/123',
      portalId: testPortalId,
    };

    const response = await request(app)
      .post('/api/rfps')
      .send(newRFP)
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.title).toBe('Test RFP');
  });
});
```

### End-to-End Tests

Test complete user workflows with Playwright:

```
tests/e2e/
├── portal-scanning.spec.ts      # Portal scanning flow
├── proposal-generation.spec.ts  # Proposal generation flow
├── rfp-submission.spec.ts       # Manual RFP submission
└── ai-chat.spec.ts             # AI chat interaction
```

**Example E2E Test**:

```typescript
// tests/e2e/portal-scanning.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Portal Scanning', () => {
  test('should scan portal and discover RFPs', async ({ page }) => {
    // Navigate to portal scanner
    await page.goto('http://localhost:3000/portals/scanner');

    // Select portal
    await page.selectOption('[data-testid="portal-select"]', 'austin-finance');

    // Enter search filter
    await page.fill('[data-testid="search-filter"]', 'technology');

    // Start scan
    await page.click('[data-testid="start-scan-button"]');

    // Wait for scan to start
    await expect(page.locator('[data-testid="scan-status"]')).toHaveText(
      'Scanning...'
    );

    // Wait for RFPs to appear
    await page.waitForSelector('[data-testid="discovered-rfp"]', {
      timeout: 30000,
    });

    // Verify RFPs discovered
    const rfpCards = page.locator('[data-testid="discovered-rfp"]');
    expect(await rfpCards.count()).toBeGreaterThan(0);
  });
});
```

## Test Fixtures

Reusable test data stored in `tests/fixtures/`:

```typescript
// tests/fixtures/rfps/sample-rfp.ts
export const sampleRFP = {
  id: 'test-rfp-123',
  title: 'Cloud Infrastructure Services',
  agency: 'City of Austin',
  category: 'Technology',
  sourceUrl: 'https://financeonline.austintexas.gov/rfp/123',
  status: 'discovered',
  deadline: new Date('2024-12-31'),
  estimatedValue: '500000.00',
  requirements: [
    {
      id: 'req-1',
      section: 'Technical Requirements',
      text: 'Must support OAuth 2.0 authentication',
      mandatory: true,
    },
  ],
};

// tests/fixtures/portals/test-portal.ts
export const testPortal = {
  id: 'test-portal-123',
  name: 'Test Portal',
  url: 'https://test.portal.gov',
  type: 'federal' as const,
  requiresAuth: false,
  scanEnabled: false, // Don't actually scan in tests
  selectors: {
    rfpListContainer: '.opportunity-list',
    rfpTitle: '.opportunity-title',
  },
};
```

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm test tests/unit
```

### Integration Tests

```bash
npm test tests/integration
```

### End-to-End Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run in UI mode (interactive)
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/portal-scanning.spec.ts
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: [
    'server/**/*.ts',
    '!server/**/*.d.ts',
    '!server/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
};
```

### Playwright Configuration

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  retries: 2,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
```

### Test Setup

```typescript
// tests/setup.ts
import { beforeAll, afterAll, afterEach } from '@jest/globals';
import { db } from '../server/db';

beforeAll(async () => {
  // Setup test database
  await db.execute('CREATE SCHEMA IF NOT EXISTS test');
  // Run migrations
  // Seed test data
});

afterEach(async () => {
  // Clean up after each test
  await db.execute('TRUNCATE TABLE rfps CASCADE');
  await db.execute('TRUNCATE TABLE proposals CASCADE');
});

afterAll(async () => {
  // Cleanup and close connections
  await db.execute('DROP SCHEMA test CASCADE');
});
```

## Test Best Practices

### DO

✅ **Write descriptive test names**

```typescript
// Good
it('should return 404 when RFP not found', async () => {});

// Bad
it('test rfp', async () => {});
```

✅ **Use AAA pattern (Arrange, Act, Assert)**

```typescript
it('should calculate proposal quality score', () => {
  // Arrange
  const proposal = {
    sections: [
      /* ... */
    ],
  };

  // Act
  const score = calculateQualityScore(proposal);

  // Assert
  expect(score).toBeGreaterThan(0.8);
});
```

✅ **Test edge cases**

```typescript
it('should handle empty RFP list', async () => {
  const { rfps } = await getRFPs({ status: 'nonexistent' });
  expect(rfps).toEqual([]);
});
```

✅ **Use fixtures for complex test data**

```typescript
import { sampleRFP } from '../fixtures/rfps/sample-rfp';

it('should process RFP', async () => {
  const result = await processRFP(sampleRFP);
  expect(result).toBeDefined();
});
```

✅ **Clean up after tests**

```typescript
afterEach(async () => {
  await cleanupTestData();
});
```

### DON'T

❌ **Don't test implementation details**

```typescript
// Bad - testing private method
it('should call _internalHelper', () => {
  expect(service._internalHelper).toHaveBeenCalled();
});

// Good - test public interface
it('should process data correctly', () => {
  const result = service.processData(input);
  expect(result).toEqual(expectedOutput);
});
```

❌ **Don't have tests depend on each other**

```typescript
// Bad - tests share state
let userId;

it('should create user', () => {
  userId = createUser();
});

it('should get user', () => {
  const user = getUser(userId); // Depends on previous test
});

// Good - each test is independent
it('should get user', () => {
  const userId = createUser(); // Create within test
  const user = getUser(userId);
});
```

❌ **Don't use setTimeout for async tests**

```typescript
// Bad
it('should complete async operation', done => {
  asyncOperation();
  setTimeout(() => {
    expect(result).toBeDefined();
    done();
  }, 1000);
});

// Good
it('should complete async operation', async () => {
  const result = await asyncOperation();
  expect(result).toBeDefined();
});
```

## Testing Patterns

### Mocking External Services

```typescript
import { jest } from '@jest/globals';

jest.mock('../../../server/services/core/aiService', () => ({
  AIService: jest.fn().mockImplementation(() => ({
    generateText: jest.fn().mockResolvedValue({
      text: 'Generated content',
      tokensUsed: 100,
    }),
  })),
}));
```

### Testing Agent System

```typescript
import { agentRegistryService } from '../../server/services/agents/agentRegistryService';

describe('Agent Registry', () => {
  it('should register agent', async () => {
    const agent = await agentRegistryService.registerAgent({
      name: 'test-agent',
      tier: 3,
      type: 'specialist',
      capabilities: ['test-capability'],
    });

    expect(agent.id).toBeDefined();
    expect(agent.status).toBe('idle');
  });
});
```

### Testing Workflows

```typescript
import { workflowCoordinator } from '../../server/services/workflows/workflowCoordinator';

describe('RFP Discovery Workflow', () => {
  it('should complete RFP discovery workflow', async () => {
    const result = await workflowCoordinator.executeWorkflow('rfp-discovery', {
      portalId: 'test-portal',
      searchFilter: 'technology',
    });

    expect(result.status).toBe('completed');
    expect(result.rfpsDiscovered).toBeGreaterThan(0);
  });
});
```

## Continuous Integration

Tests run automatically on every push and pull request:

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - name: Install dependencies
        run: npm install

      - name: Run type check
        run: npm run type-check

      - name: Run linter
        run: npm run lint

      - name: Run unit tests
        run: npm run test:coverage

      - name: Run E2E tests
        run: npm run test:e2e
```

## Coverage Requirements

Maintain high code coverage:

- **Overall**: 70%+
- **Critical paths**: 90%+ (proposal generation, portal scanning)
- **Utilities**: 80%+

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/index.html
```

## How This Applies to the RFP Agent App

### Key Test Scenarios

1. **Portal Scanning**:
   - Authentication flow (including 2FA)
   - RFP discovery and extraction
   - Incremental scanning
   - Error handling

2. **Document Processing**:
   - PDF parsing
   - Word document parsing
   - Requirement extraction
   - Compliance matrix generation

3. **Proposal Generation**:
   - Content generation for each section
   - Quality scoring
   - Compliance validation
   - PDF assembly

4. **Agent Coordination**:
   - Agent registration and discovery
   - Task delegation (Tier 1 → 2 → 3)
   - Work item management
   - Result aggregation

### Test Data Management

Tests use a combination of:

- **Fixtures** - Static test data in `tests/fixtures/`
- **Factories** - Dynamic test data generation
- **Mocks** - External service responses
- **Seeded database** - Prepopulated test database

## Troubleshooting

### Tests Failing Locally

```bash
# Clear Jest cache
npx jest --clearCache

# Run with verbose output
npm test -- --verbose

# Run specific test file
npm test tests/unit/services/aiService.test.ts
```

### Database Connection Issues

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Check database is running
psql $DATABASE_URL -c "SELECT 1"

# Reset test database
npm run db:reset-test
```

### E2E Tests Timing Out

```bash
# Increase timeout in playwright.config.ts
timeout: 60000  // 60 seconds

# Run with UI mode to debug
npx playwright test --ui
```

## Related Documentation

- **Server**: See [server/CLAUDE.md](../server/CLAUDE.md) for tested services
- **API**: See [docs/api/README.md](../docs/api/README.md) for API endpoints
- **Testing Guide**: See [docs/testing/testing-guide.md](../docs/testing/testing-guide.md)
- **CI/CD**: See [docs/deployment/deployment-guide.md](../docs/deployment/deployment-guide.md)

---

**For the main RFP Agent configuration and SPARC workflow, see the root [CLAUDE.md](../CLAUDE.md)**
