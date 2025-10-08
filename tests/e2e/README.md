# E2E Tests with Playwright

This directory is for end-to-end (E2E) tests using Playwright.

## Status

🚧 **Not yet implemented** - Playwright is configured but no E2E tests have been written yet.

The project currently uses Jest for unit and integration tests in the `tests/` directory.

## When to Add E2E Tests

Consider adding E2E tests when you need to:

- Test critical user workflows (e.g., login, RFP submission, proposal generation)
- Verify cross-browser compatibility
- Test complex UI interactions
- Validate production-like scenarios

## Getting Started

### 1. Install Playwright Browsers

```bash
pnpm exec playwright install --with-deps
```

### 2. Write Your First Test

Create a test file (e.g., `tests/e2e/auth.spec.ts`):

```typescript
import { test, expect } from '@playwright/test';

test('user can login', async ({ page }) => {
  await page.goto('http://localhost:5000');

  // Click login button
  await page.getByRole('button', { name: 'Login' }).click();

  // Fill in credentials
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');

  // Submit
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Verify redirect to dashboard
  await expect(page).toHaveURL(/.*dashboard/);
});
```

### 3. Run Tests

```bash
# Run all E2E tests
pnpm exec playwright test

# Run in headed mode (see the browser)
pnpm exec playwright test --headed

# Run specific test
pnpm exec playwright test auth.spec.ts

# Debug mode
pnpm exec playwright test --debug
```

### 4. View Test Report

```bash
pnpm exec playwright show-report
```

## Configuration

Playwright configuration is in `playwright.config.ts` at the project root.

Current settings:
- **Browsers**: Chromium, Firefox, WebKit
- **Base URL**: http://localhost:5000 (configurable)
- **Retries**: 2 on CI, 0 locally
- **Trace**: On first retry
- **Screenshots**: On failure

## CI/CD Integration

Once tests are written, enable the Playwright workflow:

1. Edit `.github/workflows/playwright.yml`
2. Uncomment the `on` triggers for push/pull_request
3. Tests will run automatically on every push/PR

## Best Practices

1. **Page Object Model**: Create reusable page objects for common UI elements
2. **Test Data**: Use fixtures for consistent test data
3. **Selectors**: Prefer accessible selectors (role, label) over CSS selectors
4. **Assertions**: Use Playwright's auto-waiting assertions
5. **Cleanup**: Ensure tests are independent and clean up after themselves

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
