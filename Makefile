# =============================================================================
# RFP Agent - Makefile
# Quick commands for development, deployment, and operations
# =============================================================================

.PHONY: help install dev build test clean docker k8s deploy monitor security backup

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

# Variables
ENVIRONMENT ?= staging
VERSION ?= latest
NAMESPACE = rfp-agent-$(ENVIRONMENT)

help: ## Show this help message
	@echo "$(GREEN)RFP Agent - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

# =============================================================================
# Development
# =============================================================================

install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	pnpm install

dev: ## Start development server
	@echo "$(GREEN)Starting development server...$(NC)"
	pnpm dev

build: ## Build application
	@echo "$(YELLOW)Building application...$(NC)"
	pnpm build

test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	pnpm test

test-watch: ## Run tests in watch mode
	@echo "$(YELLOW)Running tests in watch mode...$(NC)"
	pnpm test:watch

test-coverage: ## Run tests with coverage
	@echo "$(YELLOW)Running tests with coverage...$(NC)"
	pnpm test:coverage

lint: ## Run linter
	@echo "$(YELLOW)Running linter...$(NC)"
	pnpm lint

lint-fix: ## Fix linting issues
	@echo "$(YELLOW)Fixing linting issues...$(NC)"
	pnpm lint:fix

format: ## Format code
	@echo "$(YELLOW)Formatting code...$(NC)"
	pnpm format

format-check: ## Check code formatting
	@echo "$(YELLOW)Checking code formatting...$(NC)"
	pnpm format:check

type-check: ## Run TypeScript type checking
	@echo "$(YELLOW)Type checking...$(NC)"
	pnpm type-check

quality: ## Run all quality checks
	@echo "$(YELLOW)Running quality checks...$(NC)"
	pnpm quality

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning build artifacts...$(NC)"
	rm -rf dist/ build/ coverage/ node_modules/.cache/

# =============================================================================
# Docker
# =============================================================================

docker-build: ## Build Docker image
	@echo "$(GREEN)Building Docker image...$(NC)"
	docker build -t rfp-agent:$(VERSION) .

docker-build-prod: ## Build production Docker image
	@echo "$(GREEN)Building production Docker image...$(NC)"
	docker build --target runtime -t rfp-agent:$(VERSION) .

docker-run: ## Run Docker container
	@echo "$(GREEN)Running Docker container...$(NC)"
	docker run -p 5000:5000 --env-file .env rfp-agent:$(VERSION)

docker-compose-up: ## Start all services with Docker Compose
	@echo "$(GREEN)Starting services with Docker Compose...$(NC)"
	docker-compose up -d

docker-compose-down: ## Stop all services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose down

docker-compose-logs: ## View Docker Compose logs
	docker-compose logs -f

docker-push: ## Push Docker image to registry
	@echo "$(GREEN)Pushing Docker image...$(NC)"
	docker tag rfp-agent:$(VERSION) ghcr.io/yourusername/rfp-agent:$(VERSION)
	docker push ghcr.io/yourusername/rfp-agent:$(VERSION)

docker-scan: ## Scan Docker image for vulnerabilities
	@echo "$(YELLOW)Scanning Docker image...$(NC)"
	docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy image rfp-agent:$(VERSION)

# =============================================================================
# Kubernetes
# =============================================================================

k8s-create-namespace: ## Create Kubernetes namespace
	@echo "$(GREEN)Creating namespace $(NAMESPACE)...$(NC)"
	kubectl create namespace $(NAMESPACE) --dry-run=client -o yaml | kubectl apply -f -

k8s-setup-secrets: ## Setup Kubernetes secrets
	@echo "$(GREEN)Setting up secrets for $(ENVIRONMENT)...$(NC)"
	./scripts/security/secrets-setup.sh $(ENVIRONMENT) setup

k8s-apply: ## Apply Kubernetes manifests
	@echo "$(GREEN)Applying Kubernetes manifests for $(ENVIRONMENT)...$(NC)"
	kubectl apply -k k8s/overlays/$(ENVIRONMENT)

k8s-delete: ## Delete Kubernetes resources
	@echo "$(RED)Deleting Kubernetes resources for $(ENVIRONMENT)...$(NC)"
	kubectl delete -k k8s/overlays/$(ENVIRONMENT)

k8s-status: ## Check Kubernetes deployment status
	@echo "$(GREEN)Checking deployment status...$(NC)"
	kubectl get all -n $(NAMESPACE)

k8s-logs: ## View application logs
	kubectl logs -f deployment/rfp-agent -n $(NAMESPACE)

k8s-describe: ## Describe deployment
	kubectl describe deployment rfp-agent -n $(NAMESPACE)

k8s-shell: ## Open shell in a pod
	kubectl exec -it deployment/rfp-agent -n $(NAMESPACE) -- /bin/sh

k8s-port-forward: ## Port forward to local machine
	@echo "$(GREEN)Port forwarding to localhost:5000...$(NC)"
	kubectl port-forward deployment/rfp-agent 5000:5000 -n $(NAMESPACE)

k8s-scale: ## Scale deployment (REPLICAS=3 make k8s-scale)
	@echo "$(YELLOW)Scaling to $(REPLICAS) replicas...$(NC)"
	kubectl scale deployment rfp-agent --replicas=$(REPLICAS) -n $(NAMESPACE)

k8s-restart: ## Restart deployment
	@echo "$(YELLOW)Restarting deployment...$(NC)"
	kubectl rollout restart deployment/rfp-agent -n $(NAMESPACE)

k8s-rollback: ## Rollback deployment
	@echo "$(RED)Rolling back deployment...$(NC)"
	kubectl rollout undo deployment/rfp-agent -n $(NAMESPACE)

k8s-history: ## Show rollout history
	kubectl rollout history deployment/rfp-agent -n $(NAMESPACE)

# =============================================================================
# Deployment
# =============================================================================

deploy-staging: ## Deploy to staging
	@echo "$(GREEN)Deploying to staging...$(NC)"
	./scripts/deployment/deploy.sh staging $(VERSION)

deploy-production: ## Deploy to production
	@echo "$(GREEN)Deploying to production...$(NC)"
	./scripts/deployment/deploy.sh production $(VERSION)

deploy-rollback: ## Rollback deployment
	@echo "$(RED)Rolling back $(ENVIRONMENT)...$(NC)"
	./scripts/deployment/rollback.sh $(ENVIRONMENT)

# =============================================================================
# Monitoring
# =============================================================================

monitor-install-prometheus: ## Install Prometheus
	@echo "$(GREEN)Installing Prometheus...$(NC)"
	helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
	helm repo update
	helm install prometheus prometheus-community/prometheus \
		-f monitoring/prometheus/values.yaml \
		-n monitoring --create-namespace

monitor-install-grafana: ## Install Grafana
	@echo "$(GREEN)Installing Grafana...$(NC)"
	helm repo add grafana https://grafana.github.io/helm-charts
	helm repo update
	helm install grafana grafana/grafana -n monitoring

monitor-password: ## Get Grafana admin password
	@echo "$(GREEN)Grafana admin password:$(NC)"
	@kubectl get secret grafana -n monitoring -o jsonpath="{.data.admin-password}" | base64 --decode
	@echo ""

monitor-forward-grafana: ## Port forward Grafana
	@echo "$(GREEN)Grafana available at http://localhost:3000$(NC)"
	kubectl port-forward -n monitoring svc/grafana 3000:80

monitor-forward-prometheus: ## Port forward Prometheus
	@echo "$(GREEN)Prometheus available at http://localhost:9090$(NC)"
	kubectl port-forward -n monitoring svc/prometheus-server 9090:80

# =============================================================================
# Security
# =============================================================================

security-scan: ## Run all security scans
	@echo "$(YELLOW)Running security scans...$(NC)"
	@make security-audit
	@make security-secrets
	@make docker-scan

security-audit: ## Run npm audit
	@echo "$(YELLOW)Running npm audit...$(NC)"
	pnpm audit --audit-level=moderate

security-secrets: ## Scan for secrets in code
	@echo "$(YELLOW)Scanning for secrets...$(NC)"
	docker run --rm -v $(PWD):/path trufflesecurity/trufflehog:latest filesystem /path --only-verified

security-sast: ## Run SAST with Semgrep
	@echo "$(YELLOW)Running SAST...$(NC)"
	docker run --rm -v $(PWD):/src semgrep/semgrep semgrep --config=auto /src

security-rotate-secrets: ## Rotate Kubernetes secrets
	@echo "$(YELLOW)Rotating secrets for $(ENVIRONMENT)...$(NC)"
	./scripts/security/secrets-setup.sh $(ENVIRONMENT) rotate

# =============================================================================
# Backup & Recovery
# =============================================================================

backup-db: ## Backup database
	@echo "$(GREEN)Backing up database for $(ENVIRONMENT)...$(NC)"
	./scripts/backup/db-backup.sh $(ENVIRONMENT)

backup-verify: ## Verify latest backup
	@echo "$(YELLOW)Verifying latest backup...$(NC)"
	@echo "Listing recent backups:"
	gsutil ls -l gs://rfp-agent-backups/backups/$(ENVIRONMENT)/ | tail -5

# =============================================================================
# Database
# =============================================================================

db-push: ## Push database schema changes
	@echo "$(YELLOW)Pushing database schema...$(NC)"
	pnpm db:push

db-migrate: ## Run database migrations
	@echo "$(YELLOW)Running database migrations...$(NC)"
	pnpm db:migrate

db-studio: ## Open Drizzle Studio
	@echo "$(GREEN)Opening Drizzle Studio...$(NC)"
	pnpm db:studio

db-seed: ## Seed database
	@echo "$(YELLOW)Seeding database...$(NC)"
	pnpm db:seed

# =============================================================================
# CI/CD
# =============================================================================

ci-local: ## Run CI checks locally
	@echo "$(YELLOW)Running CI checks locally...$(NC)"
	@make lint
	@make type-check
	@make test
	@make build

ci-security: ## Run security checks locally
	@echo "$(YELLOW)Running security checks...$(NC)"
	@make security-scan

# =============================================================================
# Utilities
# =============================================================================

logs-app: ## View application logs in K8s
	kubectl logs -f -l app=rfp-agent -n $(NAMESPACE) --max-log-requests=10

logs-errors: ## View error logs
	kubectl logs -l app=rfp-agent -n $(NAMESPACE) --max-log-requests=10 | grep -i error

health-check: ## Check application health
	@echo "$(GREEN)Checking application health...$(NC)"
	@curl -f http://localhost:5000/health || echo "$(RED)Health check failed$(NC)"

version: ## Show version information
	@echo "$(GREEN)RFP Agent Version Information$(NC)"
	@echo "Node: $$(node --version)"
	@echo "pnpm: $$(pnpm --version)"
	@echo "Docker: $$(docker --version)"
	@echo "kubectl: $$(kubectl version --client --short 2>/dev/null || echo 'not installed')"
	@echo "Environment: $(ENVIRONMENT)"
	@echo "Version: $(VERSION)"

# =============================================================================
# Quick Start
# =============================================================================

setup: ## Initial setup (install + build)
	@echo "$(GREEN)Setting up RFP Agent...$(NC)"
	@make install
	@make build
	@echo "$(GREEN)Setup complete!$(NC)"

quick-start: ## Quick start for local development
	@echo "$(GREEN)Quick starting RFP Agent...$(NC)"
	@make install
	@make dev
