# RFP Agent - DevOps Infrastructure

## Overview

This document describes the complete DevOps infrastructure for the RFP Agent platform, including CI/CD pipelines, deployment strategies, monitoring, and security hardening.

## Quick Start

### One-Click Local Deployment
```bash
# Option 1: Using Makefile
make quick-start

# Option 2: Using Docker Compose
docker-compose up -d

# Option 3: Manual
pnpm install
pnpm dev
```

### One-Click Production Deployment
```bash
# Deploy to staging
make deploy-staging VERSION=v1.0.0

# Deploy to production
make deploy-production VERSION=v1.0.0
```

## Infrastructure Architecture

### Components

```
┌─────────────────────────────────────────────────────┐
│                   Load Balancer                      │
│              (Nginx Ingress / ALB)                   │
└──────────────────┬──────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
┌───────▼────────┐   ┌───────▼────────┐
│   Nginx Proxy  │   │   Kubernetes   │
│   (Container)  │   │    Cluster     │
└───────┬────────┘   └───────┬────────┘
        │                    │
        │            ┌───────┴────────┐
        │            │                │
        │     ┌──────▼─────┐  ┌──────▼─────┐
        │     │  RFP Agent │  │  RFP Agent │
        │     │    Pod 1   │  │    Pod 2   │
        │     └──────┬─────┘  └──────┬─────┘
        │            │                │
        └────────────┴────────────────┘
                     │
        ┌────────────┼────────────┐
        │            │            │
   ┌────▼────┐  ┌───▼────┐  ┌───▼────┐
   │ Postgres│  │ Redis  │  │  GCS   │
   │   (DB)  │  │(Cache) │  │(Files) │
   └─────────┘  └────────┘  └────────┘
```

## File Structure

```
rfpagent/
├── .github/
│   └── workflows/
│       ├── ci-cd.yml              # Main CI/CD pipeline
│       ├── security-scan.yml      # Security scanning
│       ├── code-quality.yml       # Code quality checks
│       └── playwright.yml         # E2E tests
├── k8s/
│   ├── base/                      # Base Kubernetes manifests
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── ingress.yaml
│   │   ├── hpa.yaml
│   │   ├── pdb.yaml
│   │   ├── configmap.yaml
│   │   └── serviceaccount.yaml
│   └── overlays/
│       ├── staging/               # Staging overrides
│       └── production/            # Production overrides
├── monitoring/
│   ├── prometheus/                # Prometheus configuration
│   ├── grafana/                   # Grafana dashboards
│   └── alertmanager/              # Alert configuration
├── scripts/
│   ├── deployment/                # Deployment scripts
│   │   ├── deploy.sh
│   │   └── rollback.sh
│   ├── security/                  # Security scripts
│   │   └── secrets-setup.sh
│   └── backup/                    # Backup scripts
│       └── db-backup.sh
├── nginx/
│   └── nginx.conf                 # Nginx configuration
├── Dockerfile                     # Multi-stage Docker build
├── docker-compose.yml             # Local development setup
├── Makefile                       # Common operations
├── DEPLOYMENT.md                  # Deployment runbook
├── SECURITY.md                    # Security policy
└── DEVOPS.md                      # This file
```

## CI/CD Pipeline

### Pipeline Stages

1. **Quality Checks** (5-10 min)
   - Linting (ESLint, Prettier)
   - Type checking (TypeScript)
   - Code formatting

2. **Testing** (15-20 min)
   - Unit tests (Jest)
   - Integration tests
   - E2E tests (Playwright)
   - Coverage reporting

3. **Security Scanning** (10-15 min)
   - Dependency scanning (npm audit, Snyk)
   - SAST (Semgrep, CodeQL)
   - Secret detection (TruffleHog, GitLeaks)
   - License compliance

4. **Build** (10-15 min)
   - Frontend build (Vite)
   - Backend build (esbuild)
   - Artifact creation

5. **Container Build** (15-20 min)
   - Docker multi-stage build
   - Image scanning (Trivy, Grype)
   - Push to registry (GHCR)

6. **Deployment** (5-10 min)
   - Staging deployment (auto on develop)
   - Production deployment (manual approval)
   - Smoke tests
   - Notifications

### Workflow Triggers

- **Pull Request**: Quality + Tests + Security
- **Push to develop**: Full pipeline + Deploy to Staging
- **Push to main**: Full pipeline + Deploy to Production
- **Manual**: Workflow dispatch with environment selection

### Branch Protection

```yaml
main:
  - Require pull request reviews (2)
  - Require status checks to pass
  - Require linear history
  - Require signed commits
  - No force push

develop:
  - Require pull request reviews (1)
  - Require status checks to pass
  - No force push
```

## Docker Containerization

### Multi-Stage Build

```dockerfile
Stage 1: Base           # Install pnpm
Stage 2: Dependencies   # Production dependencies
Stage 3: Build-deps     # All dependencies
Stage 4: Build          # Build application
Stage 5: Runtime        # Production image
```

### Security Features

- Non-root user (nodejs:1001)
- Read-only root filesystem
- Security updates applied
- Minimal base image (Alpine)
- Dumb-init for signal handling
- Health checks built-in

### Image Size Optimization

- Multi-stage builds: ~500MB → ~200MB
- .dockerignore: Excludes unnecessary files
- Layer caching: Faster builds
- Multi-arch support: AMD64 + ARM64

## Kubernetes Deployment

### Resources

```yaml
deployment.yaml      # Application deployment
service.yaml        # ClusterIP service
ingress.yaml        # Nginx ingress
hpa.yaml            # Horizontal autoscaling
pdb.yaml            # Pod disruption budget
configmap.yaml      # Configuration
serviceaccount.yaml # RBAC
```

### Auto-Scaling Configuration

**Staging**:
- Min replicas: 2
- Max replicas: 5
- CPU target: 70%
- Memory target: 80%

**Production**:
- Min replicas: 3
- Max replicas: 10
- CPU target: 70%
- Memory target: 80%

### Resource Limits

**Staging**:
```yaml
requests:
  memory: 512Mi
  cpu: 250m
limits:
  memory: 2Gi
  cpu: 1000m
```

**Production**:
```yaml
requests:
  memory: 1Gi
  cpu: 500m
limits:
  memory: 4Gi
  cpu: 2000m
```

### Health Checks

```yaml
livenessProbe:   # Restart if unhealthy
  path: /health
  initialDelay: 30s
  period: 10s

readinessProbe:  # Remove from service if not ready
  path: /health
  initialDelay: 10s
  period: 5s

startupProbe:    # Allow slow startup
  path: /health
  failureThreshold: 30
  period: 10s
```

### Rolling Update Strategy

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # One extra pod
    maxUnavailable: 0  # Zero downtime
```

## Monitoring & Observability

### Metrics (Prometheus)

**Application Metrics**:
- Request rate, latency, errors
- Database query performance
- AI agent execution times
- Queue depths and processing times

**Infrastructure Metrics**:
- CPU, memory, disk usage
- Network I/O
- Pod restarts
- Container errors

### Dashboards (Grafana)

1. **Overview Dashboard**
   - Request rate and errors
   - Response time (p50, p95, p99)
   - Active pods and health

2. **Performance Dashboard**
   - Database performance
   - Cache hit rates
   - AI agent performance

3. **Infrastructure Dashboard**
   - Resource usage
   - Pod lifecycle
   - Network performance

### Alerting (AlertManager)

**Critical Alerts** (PagerDuty + Slack):
- Pod crash loops
- High error rates (>5%)
- Database connection failures
- All pods down

**Warning Alerts** (Slack):
- High CPU usage (>90%)
- High memory usage (>90%)
- Slow response times (>2s)
- Low cache hit rates

### Log Aggregation

- Centralized logging via stdout/stderr
- Structured logging (JSON)
- Log levels: ERROR, WARN, INFO, DEBUG
- Retention: 30 days

## Security

### Container Security

- **Base Image**: Official Node.js Alpine
- **User**: Non-root (nodejs:1001)
- **Scanning**: Trivy + Grype
- **Updates**: Weekly automated updates

### Kubernetes Security

- **RBAC**: Least privilege service accounts
- **Network Policies**: Restrict pod communication
- **Pod Security**: Restricted security context
- **Secrets**: Encrypted at rest

### Secret Management

```bash
# Setup secrets (1Password or .env)
make k8s-setup-secrets ENVIRONMENT=production

# Rotate secrets
make security-rotate-secrets ENVIRONMENT=production

# Verify secrets
./scripts/security/secrets-setup.sh production verify
```

### Security Scanning

**Daily Scans**:
- Dependency vulnerabilities
- Container image vulnerabilities
- Secret detection
- SAST analysis

**On PR**:
- Dependency review
- CodeQL analysis
- Container scanning

## Backup & Recovery

### Automated Backups

- **Frequency**: Daily at 2 AM UTC
- **Retention**: 30 days
- **Encryption**: AES-256-CBC
- **Storage**: Google Cloud Storage

### Backup Script

```bash
# Manual backup
make backup-db ENVIRONMENT=production

# Verify backups
make backup-verify ENVIRONMENT=production
```

### Recovery Procedures

1. **Database Recovery**:
   ```bash
   # Download backup
   gsutil cp gs://rfp-agent-backups/backups/production/latest.sql.gz.enc .

   # Decrypt and restore
   openssl enc -aes-256-cbc -d -in latest.sql.gz.enc -out latest.sql.gz
   gunzip latest.sql.gz
   psql $DATABASE_URL < latest.sql
   ```

2. **Application Recovery**:
   ```bash
   # Rollback to previous version
   make deploy-rollback ENVIRONMENT=production
   ```

## Deployment Procedures

### Staging Deployment

```bash
# Automatic on push to develop
git push origin develop

# Manual deployment
make deploy-staging VERSION=v1.0.0
```

### Production Deployment

```bash
# Manual deployment with approval
make deploy-production VERSION=v1.0.0

# Via GitHub Actions
gh workflow run ci-cd.yml -f deploy_environment=production
```

### Rollback

```bash
# Rollback to previous version
make deploy-rollback ENVIRONMENT=production

# Rollback to specific revision
./scripts/deployment/rollback.sh production 3
```

### Smoke Tests

After deployment, automated smoke tests verify:
- Health endpoint responding
- Database connectivity
- API endpoints functional
- Static assets loading

## Operations

### Common Tasks

```bash
# View logs
make logs-app ENVIRONMENT=production

# Check status
make k8s-status ENVIRONMENT=production

# Scale deployment
make k8s-scale REPLICAS=5 ENVIRONMENT=production

# Restart deployment
make k8s-restart ENVIRONMENT=production

# Open shell in pod
make k8s-shell ENVIRONMENT=production
```

### Debugging

```bash
# Port forward for local access
make k8s-port-forward ENVIRONMENT=production

# View recent errors
make logs-errors ENVIRONMENT=production

# Describe pod issues
make k8s-describe ENVIRONMENT=production
```

## Performance Optimization

### Caching Strategy

- **Redis**: Session storage, API caching
- **Nginx**: Static asset caching (30 days)
- **Database**: Connection pooling

### CDN Integration

Static assets should be served via CDN:
- CloudFlare
- AWS CloudFront
- Google Cloud CDN

### Database Optimization

- Connection pooling (max 20 connections)
- Query optimization via Drizzle ORM
- Indexes on frequently queried fields

## Cost Optimization

### Resource Optimization

- Auto-scaling based on load
- Spot instances for non-production
- Aggressive caching strategy
- Right-sized resource limits

### Monitoring Costs

- Prometheus retention: 15 days
- Log retention: 30 days
- Backup retention: 30 days

## Disaster Recovery

### RTO/RPO

- **RTO**: 30 minutes (Recovery Time Objective)
- **RPO**: 24 hours (Recovery Point Objective)

### DR Procedures

1. **Database Failure**: Automatic failover via Neon
2. **Application Failure**: Auto-restart + auto-scaling
3. **Cluster Failure**: Deploy to backup region
4. **Complete Failure**: Restore from backups

## Compliance

### Standards

- SOC 2 Type II
- GDPR compliance
- OWASP Top 10
- CIS Kubernetes Benchmark

### Audit Logging

- All deployments logged
- Secret rotations tracked
- Access logs retained
- Configuration changes versioned

## Support

### Contacts

- **DevOps Team**: devops@rfpagent.app
- **Security Team**: security@rfpagent.app
- **On-Call**: Via PagerDuty

### Resources

- [Deployment Runbook](./DEPLOYMENT.md)
- [Security Policy](./SECURITY.md)
- [Architecture Docs](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)

## Future Improvements

### Planned Enhancements

- [ ] GitOps with ArgoCD
- [ ] Service mesh (Istio/Linkerd)
- [ ] Chaos engineering tests
- [ ] Multi-region deployment
- [ ] Advanced cost optimization
- [ ] ML-based autoscaling
- [ ] Automated canary deployments

## Version History

- **v1.0.0** (2025-10-02): Initial DevOps infrastructure
  - Docker multi-stage builds
  - Kubernetes manifests
  - CI/CD pipeline
  - Monitoring stack
  - Security hardening
