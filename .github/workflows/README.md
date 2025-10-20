# GitHub Actions Workflows

This directory contains the CI/CD workflows for the RFP Agent application.

## Active Workflows (4)

### 1. 🚀 `ci-cd.yml` - Primary CI/CD Pipeline

**Triggers:** Push to main/develop, Pull Requests, Manual dispatch

**Purpose:** Comprehensive CI/CD pipeline covering quality, testing, security, build, and deployment.

**Jobs:**
- **Quality Check** - Linting, type checking, formatting
- **Unit & Integration Tests** - Test suite with coverage reporting
- **E2E Tests** - Playwright end-to-end tests
- **Security Scanning** - Comprehensive security analysis
  - npm audit (dependency vulnerabilities)
  - Semgrep (SAST)
  - CodeQL (code analysis)
  - TruffleHog (secret scanning)
  - Dependency review (on PRs)
- **Build** - Application build with Sentry release tracking
- **Docker** - Multi-platform Docker image build & push
  - Trivy vulnerability scanning
  - Grype vulnerability scanning
- **Deploy Staging** - Automated staging deployment (develop branch)
- **Deploy Production** - Production deployment (main branch)

**Duration:** ~45 minutes (full pipeline)

---

### 2. ⚡ `quick-check.yml` - Fast Quality Checks

**Triggers:** Push to main/master, Pull Requests

**Purpose:** Rapid feedback for code quality issues on PRs.

**Jobs:**
- Lint (ESLint)
- Type Check (TypeScript)
- Format Check (Prettier)

**Duration:** ~5 minutes

**Note:** For comprehensive testing and security, see `ci-cd.yml`

---

### 3. ✈️ `fly-deploy.yml` - Fly.io Deployment

**Triggers:** Push to main branch

**Purpose:** Deploy application to Fly.io hosting platform.

**Jobs:**
- Deploy to Fly.io using `flyctl deploy`

**Duration:** ~3-5 minutes

**Requirements:** Requires `FLY_API_TOKEN` secret

---

### 4. 🎭 `playwright.yml` - Manual E2E Testing

**Triggers:** Manual dispatch only (`workflow_dispatch`)

**Purpose:** Run E2E tests independently for debugging or testing.

**Jobs:**
- Install Playwright browsers
- Run Playwright test suite
- Upload test reports

**Duration:** ~15-20 minutes

**Status:** Currently disabled (no E2E tests written yet)

**Usage:**
```bash
# Enable by uncommenting triggers in the file
# Run manually via GitHub Actions UI
```

---

## Workflow Triggers Summary

| Workflow | Push main | Push develop | Pull Request | Manual | Notes |
|----------|-----------|--------------|--------------|--------|-------|
| `ci-cd.yml` | ✓ | ✓ | ✓ | ✓ | Full pipeline |
| `quick-check.yml` | ✓ | | ✓ | | Fast checks only |
| `fly-deploy.yml` | ✓ | | | | Production deploy |
| `playwright.yml` | | | | ✓ | Manual E2E tests |

---

## Security Coverage

All security features are consolidated in `ci-cd.yml`:

✅ **Dependency Scanning** - npm audit for known vulnerabilities
✅ **SAST** - Semgrep static analysis
✅ **Code Analysis** - CodeQL security queries
✅ **Secret Scanning** - TruffleHog for exposed secrets
✅ **Dependency Review** - GitHub dependency review (PRs only)
✅ **Container Scanning** - Trivy + Grype for Docker images

---

## PR Status Checks

When you create a pull request, you'll see these status checks:

1. **Quick Check (Lint & Type Check)** - Fast feedback (~5 min)
2. **CI/CD Pipeline** - Full test and security suite (~45 min)
   - Quality
   - Tests (Unit, Integration, E2E)
   - Security Scan
   - Build

---

## Environment Variables & Secrets

### Required Secrets

- `FLY_API_TOKEN` - Fly.io deployment token
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `ANTHROPIC_API_KEY` - (Optional) For AI-powered tools
- `SENTRY_AUTH_TOKEN` - (Optional) For error tracking and releases

### Environment Configuration

```yaml
NODE_VERSION: "22"
PNPM_VERSION: "9"
REGISTRY: ghcr.io
IMAGE_NAME: ${{ github.repository }}
```

---

## Deployment Environments

### Staging
- **Branch:** `develop`
- **Trigger:** Automatic on push to develop
- **URL:** (Configure in workflow)

### Production
- **Branch:** `main`
- **Trigger:** Automatic on push to main
- **URL:** https://rfpagent.app (via Fly.io)

---

## Caching Strategy

Workflows use multiple caching layers for performance:

1. **pnpm Store Cache** - Reuses installed packages
2. **Docker Layer Cache** - Speeds up image builds
3. **Playwright Browsers** - Caches browser installations

---

## Workflow Optimization History

**2025-10-20: Major Consolidation**
- Removed 6 redundant workflows (60% reduction)
- Consolidated security scanning from 3 workflows into 1
- Reduced GitHub Actions minutes by ~40-50%
- Improved developer experience with clearer status checks

**Removed Workflows:**
- `security-scan.yml` - Duplicate of ci-cd security job
- `review-security.yml` - Duplicate security scanning
- `review-code.yml` - Minimal value, generic checklist only
- `gen-tests.yml` - Created placeholder stubs only
- `gen-docs.yml` - Minimal automation
- `claude-flow.yml` - Experimental/unused

**Backups:** All original workflows backed up in `.github/workflows-backup/`

---

## Monitoring & Alerts

### Sentry Integration

- **Organization:** vertical-labs-o2
- **Project:** bidhive
- **Features:**
  - Error tracking
  - Release tracking
  - Deployment notifications
  - Source maps upload

### Codecov Integration

- **Coverage Reports:** Uploaded from unit tests
- **Flags:** `unittests`
- **Retention:** 30 days

---

## Common Tasks

### Run Tests Locally

```bash
# Unit tests
pnpm test

# E2E tests (requires Playwright)
pnpm exec playwright install
pnpm exec playwright test

# With coverage
pnpm test:coverage
```

### Run Quality Checks Locally

```bash
# Lint
pnpm lint

# Type check
pnpm type-check

# Format check
pnpm format:check

# All checks (matches quick-check.yml)
pnpm lint && pnpm type-check && pnpm format:check
```

### Build Docker Image Locally

```bash
# Build
docker build -t rfp-agent:local .

# Run
docker run -p 5000:5000 rfp-agent:local
```

### Deploy to Fly.io Manually

```bash
# Requires flyctl installed
flyctl deploy --remote-only
```

---

## Troubleshooting

### Workflow Failed - How to Debug

1. **Check the workflow run logs** in GitHub Actions tab
2. **Identify which job failed** (quality, test, security, build, deploy)
3. **Run the same commands locally:**
   ```bash
   # If quality failed
   pnpm lint && pnpm type-check

   # If tests failed
   pnpm test

   # If security failed
   pnpm audit
   ```

### Common Issues

**Workflow stuck on "Waiting for status checks"**
- Check if required status checks are configured in branch protection
- Ensure all workflows have completed (not just passed)

**Security scan failing**
- Review npm audit output
- Check Semgrep findings
- Update dependencies: `pnpm update`

**Docker build failing**
- Verify Dockerfile syntax
- Check build logs for missing dependencies
- Test build locally: `docker build -t test .`

**Deployment failing**
- Verify FLY_API_TOKEN is set
- Check Fly.io service status
- Review deployment logs in Fly.io dashboard

---

## Best Practices

### 1. Branch Protection

Configure branch protection rules for `main`:
- ✓ Require pull request reviews
- ✓ Require status checks to pass
  - Quick Check (Lint & Type Check)
  - CI/CD Pipeline
- ✓ Require conversation resolution
- ✓ Require linear history

### 2. Pull Request Workflow

1. Create feature branch from `develop`
2. Make changes and commit
3. Push branch and create PR
4. Wait for `quick-check.yml` (~5 min)
5. Wait for full `ci-cd.yml` (~45 min)
6. Address any issues
7. Get review approval
8. Merge to `develop` (staging deployment)
9. Test on staging
10. Merge `develop` to `main` (production deployment)

### 3. Security Best Practices

- Never commit secrets or API keys
- Review security scan results before merging
- Keep dependencies updated
- Use Dependabot for automated updates
- Address high/critical vulnerabilities immediately

### 4. Performance Tips

- Use `quick-check.yml` for rapid feedback
- Run tests locally before pushing
- Leverage workflow caching
- Skip CI on documentation changes: `[skip ci]` in commit message

---

## Related Documentation

- [GitHub Actions Cleanup Analysis](../../docs/github-actions-cleanup-analysis.md)
- [Local Development Setup](../../docs/development-setup.md)
- [Security Guidelines](../../docs/security.md)
- [Deployment Guide](../../docs/deployment.md)

---

## Support

For workflow issues or questions:
1. Check workflow logs in GitHub Actions tab
2. Review this README
3. Check related documentation
4. Open an issue with workflow run link
