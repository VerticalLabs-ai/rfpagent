# Testing Guide

**Last Updated**: January 2025

This document consolidates all testing information including verification plans, strategies, baselines, and procedures.

---

## Quick Reference

```bash
# Run all tests
pnpm test

# Type checking
pnpm check

# Linting
pnpm lint

# Full validation pipeline
pnpm check && pnpm lint && pnpm build && pnpm test
```

---

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual functions and components
2. **Integration Tests**: Service interactions, database operations
3. **E2E Tests**: Full user workflows
4. **Type Tests**: TypeScript compilation validation
5. **Lint Tests**: Code quality and consistency

### Coverage Targets

- **Overall**: 80% minimum
- **Critical Services**: 90% minimum
- **Utils/Helpers**: 70% minimum

---

## Verification Checklist

### After Code Changes

- [ ] `pnpm check` passes (0 TypeScript errors)
- [ ] `pnpm lint` passes (<10 warnings acceptable)
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes (if tests exist)
- [ ] Dev server starts: `pnpm dev`

### Before Deployment

- [ ] All verification checks pass
- [ ] Manual smoke tests completed
- [ ] Database migrations tested
- [ ] Environment variables verified

---

## Testing Baseline

### Build Metrics
- **Total Bundle Size**: ~815.9kb
- **Frontend**: ~600kb
- **Backend**: ~215kb

### Performance Targets
- **Dev Server Start**: <10 seconds
- **Production Build**: <60 seconds
- **Type Check**: <15 seconds

---

## Test Organization

```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

---

## Common Test Commands

```bash
# Watch mode for development
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific test file
pnpm test path/to/test.ts

# Integration tests only
pnpm test tests/integration/
```

---

## Troubleshooting

### Tests Failing After Changes

1. Clear node_modules and reinstall
2. Check for TypeScript errors: `pnpm check`
3. Verify database schema: `pnpm db:push`
4. Check environment variables

### Build Issues

1. Clear dist folder: `rm -rf dist`
2. Clear Vite cache: `rm -rf node_modules/.vite`
3. Rebuild: `pnpm build`

---

For deployment-specific testing, see [docs/deployment/deployment-guide.md](../deployment/deployment-guide.md)
