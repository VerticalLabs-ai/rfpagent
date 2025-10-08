# Sentry Integration Setup

**Last Updated**: January 2025

This document describes how to set up and configure Sentry.io monitoring and releases for the RFP Agent application.

## Overview

Sentry provides:
- Error tracking and monitoring
- Performance monitoring
- Release tracking with source maps
- Deployment notifications

**Organization**: vertical-labs-o2
**Project**: bidhive

## GitHub Secret Setup

Add the following secret to your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secret:

```
Name: SENTRY_AUTH_TOKEN
Value: 2798a308e412cdfb7628f7c767da2d65d168f8bf588b67cb472b65442388e8f2
```

> **Note**: This token is from the "Fly.io Integration Key" internal integration in Sentry.

## CI/CD Integration

The Sentry release workflow is automatically integrated into the CI/CD pipeline:

### Build Job
- Creates a new Sentry release with the Git SHA as the version
- Uploads source maps for error stack traces
- Automatically associates commits with the release

### Deployment Jobs
- **Staging**: Notifies Sentry of staging deployment
- **Production**: Notifies Sentry of production deployment and finalizes the release

## Release Workflow

1. **Build Phase** (`ci-cd.yml` - build job)
   - Version: `${{ github.sha }}`
   - Creates release
   - Uploads source maps from `./dist`
   - Sets commits automatically

2. **Staging Deployment** (`ci-cd.yml` - deploy-staging job)
   - Environment: `staging`
   - Finalizes release for staging environment

3. **Production Deployment** (`ci-cd.yml` - deploy-production job)
   - Environment: `production`
   - Finalizes release for production environment

## Manual Release Creation

If you need to create a release manually:

```bash
# Install Sentry CLI
curl -sL https://sentry.io/get-cli/ | bash

# Setup configuration
export SENTRY_AUTH_TOKEN=2798a308e412cdfb7628f7c767da2d65d168f8bf588b67cb472b65442388e8f2
export SENTRY_ORG=vertical-labs-o2
export SENTRY_PROJECT=bidhive

# Create release
VERSION=$(sentry-cli releases propose-version)
sentry-cli releases new "$VERSION"
sentry-cli releases set-commits "$VERSION" --auto
sentry-cli releases finalize "$VERSION"
```

## Source Maps

Source maps are automatically generated during the build process and uploaded to Sentry from the `./dist` directory. This enables:
- Readable stack traces in production errors
- Accurate line numbers and file names
- Better debugging experience

## Environment Tracking

Releases are tracked separately for each environment:
- **production**: Main branch deployments
- **staging**: Develop branch deployments

This allows you to:
- See which version is deployed to each environment
- Track errors by environment
- Monitor deployment frequency and health

## Verifying Setup

After deploying:

1. **Check Releases**: Go to Sentry → Releases to see the new release
2. **Verify Commits**: Ensure commits are linked to the release
3. **Test Source Maps**: Trigger an error and verify stack traces are readable
4. **Check Deployments**: Verify environment deployments are tracked

## Troubleshooting

### Source Maps Not Working
- Ensure build generates source maps (check Vite config)
- Verify `./dist` directory contains `.map` files
- Check Sentry release has files uploaded

### Release Not Created
- Verify `SENTRY_AUTH_TOKEN` secret is set correctly
- Check workflow logs for authentication errors
- Ensure organization and project names are correct

### Commits Not Linked
- Ensure GitHub repository is connected to Sentry
- Verify `set_commits: auto` is enabled
- Check that Git history is available during build

## Related Documentation

- [Sentry Releases Documentation](https://docs.sentry.io/product/releases/)
- [Sentry GitHub Action](https://github.com/getsentry/action-release)
- [CI/CD Pipeline](../deployment/deployment-guide.md)
