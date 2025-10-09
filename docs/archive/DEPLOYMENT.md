# RFP Agent - Deployment Runbook

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Deployment Environments](#deployment-environments)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Rollback Procedures](#rollback-procedures)

## Prerequisites

### Required Tools
- Docker 24+
- Kubernetes 1.28+
- kubectl
- kustomize
- pnpm 9+
- Node.js 20+

### Required Access
- GitHub Container Registry access
- Kubernetes cluster access
- Database credentials (Neon PostgreSQL)
- API keys (OpenAI, Anthropic, BrowserBase)

## Quick Start

### One-Click Deployment (Local Development)

```bash
# Clone repository
git clone https://github.com/yourusername/rfpagent.git
cd rfpagent

# Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# Start with Docker Compose
docker-compose up -d

# Access application
open http://localhost:5000
```

### Production Deployment

```bash
# Deploy to staging
./scripts/deployment/deploy.sh staging v1.0.0

# Deploy to production
./scripts/deployment/deploy.sh production v1.0.0
```

## Deployment Environments

### Staging
- **URL**: https://staging.rfpagent.app
- **Namespace**: rfp-agent-staging
- **Replicas**: 2-5 (auto-scaling)
- **Database**: Neon PostgreSQL (staging)

### Production
- **URL**: https://rfpagent.app
- **Namespace**: rfp-agent-production
- **Replicas**: 3-10 (auto-scaling)
- **Database**: Neon PostgreSQL (production)

## Docker Deployment

### Building the Docker Image

```bash
# Build locally
docker build -t rfp-agent:latest .

# Build with specific version
docker build -t rfp-agent:v1.0.0 .

# Build for multiple architectures
docker buildx build --platform linux/amd64,linux/arm64 -t rfp-agent:latest .
```

### Running with Docker Compose

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Environment Variables

Create `.env` file with required variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
SESSION_SECRET=your-session-secret

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
BROWSERBASE_API_KEY=bb_live_...
BROWSERBASE_PROJECT_ID=...

# Optional
GOOGLE_API_KEY=...
OP_SERVICE_ACCOUNT_TOKEN=...
```

## Kubernetes Deployment

### Initial Setup

1. **Create Namespace**
   ```bash
   kubectl create namespace rfp-agent-production
   ```

2. **Setup Secrets**
   ```bash
   # Using 1Password (recommended)
   ./scripts/security/secrets-setup.sh production setup

   # Or from environment file
   kubectl create secret generic rfp-agent-secrets \
     --from-env-file=.env.production \
     -n rfp-agent-production
   ```

3. **Deploy Application**
   ```bash
   # Using deployment script
   ./scripts/deployment/deploy.sh production v1.0.0

   # Or manually with kustomize
   kubectl apply -k k8s/overlays/production
   ```

### Verify Deployment

```bash
# Check pods
kubectl get pods -n rfp-agent-production

# Check services
kubectl get svc -n rfp-agent-production

# Check ingress
kubectl get ingress -n rfp-agent-production

# View logs
kubectl logs -f deployment/rfp-agent -n rfp-agent-production
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment rfp-agent --replicas=5 -n rfp-agent-production

# Check HPA status
kubectl get hpa -n rfp-agent-production

# Describe HPA
kubectl describe hpa rfp-agent-hpa -n rfp-agent-production
```

## Monitoring

### Prometheus & Grafana Setup

```bash
# Install Prometheus
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/prometheus \
  -f monitoring/prometheus/values.yaml \
  -n monitoring --create-namespace

# Install Grafana
helm repo add grafana https://grafana.github.io/helm-charts
helm install grafana grafana/grafana \
  -n monitoring

# Get Grafana password
kubectl get secret grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode
```

### Access Monitoring

- **Prometheus**: http://prometheus.rfpagent.app
- **Grafana**: http://grafana.rfpagent.app
- **AlertManager**: http://alertmanager.rfpagent.app

### Key Metrics to Monitor

- Request rate and response times
- Error rates (4xx, 5xx)
- Pod CPU and memory usage
- Database connection pool
- AI agent execution times
- Queue depths

## Backup & Recovery

### Automated Backups

Database backups run daily via cron:

```bash
# Manual backup
./scripts/backup/db-backup.sh production

# Verify backups
gsutil ls gs://rfp-agent-backups/backups/production/
```

### Restore from Backup

```bash
# Download backup
gsutil cp gs://rfp-agent-backups/backups/production/backup_file.sql.gz.enc .

# Decrypt
openssl enc -aes-256-cbc -d -in backup_file.sql.gz.enc -out backup_file.sql.gz -k $BACKUP_ENCRYPTION_KEY

# Decompress
gunzip backup_file.sql.gz

# Restore
psql $DATABASE_URL < backup_file.sql
```

### Disaster Recovery

1. **Database Failure**
   - Automatic failover via Neon PostgreSQL
   - Restore from latest backup if needed

2. **Complete Cluster Failure**
   - Deploy to new cluster
   - Restore database from backup
   - Update DNS records

## Troubleshooting

### Common Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl describe pod <pod-name> -n rfp-agent-production

# Check logs
kubectl logs <pod-name> -n rfp-agent-production

# Common fixes:
# - Verify secrets exist
# - Check resource limits
# - Verify database connectivity
```

#### High Memory Usage

```bash
# Check memory usage
kubectl top pods -n rfp-agent-production

# Increase memory limits in k8s/base/deployment.yaml
# Then redeploy
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql $DATABASE_URL -c "SELECT 1"

# Check connection pool
kubectl logs deployment/rfp-agent -n rfp-agent-production | grep "connection pool"
```

#### Slow Response Times

```bash
# Check pod resources
kubectl top pods -n rfp-agent-production

# Check HPA status
kubectl get hpa -n rfp-agent-production

# Scale manually if needed
kubectl scale deployment rfp-agent --replicas=10 -n rfp-agent-production
```

### Debug Mode

```bash
# Enable debug logging
kubectl set env deployment/rfp-agent LOG_LEVEL=debug -n rfp-agent-production

# Port forward for local debugging
kubectl port-forward deployment/rfp-agent 5000:5000 -n rfp-agent-production
```

## Rollback Procedures

### Automatic Rollback

Deployment script automatically rolls back on failure.

### Manual Rollback

```bash
# View rollout history
kubectl rollout history deployment/rfp-agent -n rfp-agent-production

# Rollback to previous version
kubectl rollout undo deployment/rfp-agent -n rfp-agent-production

# Rollback to specific revision
kubectl rollout undo deployment/rfp-agent --to-revision=3 -n rfp-agent-production

# Check rollout status
kubectl rollout status deployment/rfp-agent -n rfp-agent-production
```

### Using Rollback Script

```bash
# Rollback to previous version
./scripts/deployment/rollback.sh production

# Rollback to specific revision
./scripts/deployment/rollback.sh production 3
```

## CI/CD Pipeline

### GitHub Actions Workflow

The CI/CD pipeline automatically:

1. **On Pull Request**:
   - Runs linting and type checking
   - Executes unit tests
   - Runs E2E tests
   - Performs security scanning

2. **On Push to `develop`**:
   - Builds Docker image
   - Deploys to staging
   - Runs smoke tests

3. **On Push to `main`**:
   - Builds production Docker image
   - Deploys to production
   - Sends notifications

### Manual Deployment

```bash
# Trigger manual deployment via GitHub Actions
gh workflow run ci-cd.yml -f deploy_environment=production
```

## Security

### SSL/TLS Certificates

Certificates are automatically managed by cert-manager using Let's Encrypt.

```bash
# Check certificate status
kubectl get certificate -n rfp-agent-production

# Force certificate renewal
kubectl delete certificate rfp-agent-tls -n rfp-agent-production
```

### Secrets Rotation

```bash
# Rotate secrets
./scripts/security/secrets-setup.sh production rotate

# Verify new secrets
./scripts/security/secrets-setup.sh production verify
```

### Security Scanning

```bash
# Scan Docker image
trivy image ghcr.io/yourusername/rfp-agent:latest

# Scan Kubernetes manifests
trivy config k8s/
```

## Performance Optimization

### Database Optimization

```bash
# Check slow queries
kubectl exec -it deployment/rfp-agent -n rfp-agent-production -- \
  psql $DATABASE_URL -c "SELECT * FROM pg_stat_statements ORDER BY total_time DESC LIMIT 10"
```

### Caching

- Redis is configured for session storage
- API responses cached via nginx

### CDN Configuration

Static assets should be served via CDN (Cloudflare, etc.)

## Maintenance Windows

### Planned Maintenance

```bash
# 1. Scale down to minimum replicas
kubectl scale deployment rfp-agent --replicas=1 -n rfp-agent-production

# 2. Perform maintenance
# ...

# 3. Scale back up
kubectl scale deployment rfp-agent --replicas=3 -n rfp-agent-production
```

### Zero-Downtime Updates

Deployment uses rolling updates by default:
- `maxSurge: 1` - One extra pod during update
- `maxUnavailable: 0` - No pods removed until new ones are ready

## Support Contacts

- **DevOps Team**: devops@rfpagent.app
- **On-Call**: +1-XXX-XXX-XXXX
- **Slack**: #rfp-agent-alerts
- **PagerDuty**: https://your-org.pagerduty.com

## Additional Resources

- [Architecture Documentation](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)
- [Security Policy](./SECURITY.md)
- [Contributing Guide](./CONTRIBUTING.md)
