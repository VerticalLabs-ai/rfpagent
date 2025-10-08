#!/bin/bash
# =============================================================================
# RFP Agent Deployment Script
# Usage: ./scripts/deployment/deploy.sh <environment> <version>
# =============================================================================

set -e
set -u
set -o pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENVIRONMENT="${1:-staging}"
VERSION="${2:-latest}"
NAMESPACE="rfp-agent-${ENVIRONMENT}"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    log_info "Checking prerequisites..."

    local missing_tools=()

    command -v kubectl >/dev/null 2>&1 || missing_tools+=("kubectl")
    command -v kustomize >/dev/null 2>&1 || missing_tools+=("kustomize")
    command -v docker >/dev/null 2>&1 || missing_tools+=("docker")

    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi

    log_info "All prerequisites met"
}

validate_environment() {
    log_info "Validating environment: ${ENVIRONMENT}"

    if [[ ! "${ENVIRONMENT}" =~ ^(staging|production)$ ]]; then
        log_error "Invalid environment. Must be 'staging' or 'production'"
        exit 1
    fi

    if [[ "${ENVIRONMENT}" == "production" ]]; then
        read -p "$(echo -e ${YELLOW}Are you sure you want to deploy to PRODUCTION? [yes/no]: ${NC})" confirm
        if [[ "${confirm}" != "yes" ]]; then
            log_warn "Deployment cancelled"
            exit 0
        fi
    fi
}

create_namespace() {
    log_info "Creating namespace: ${NAMESPACE}"

    if kubectl get namespace "${NAMESPACE}" >/dev/null 2>&1; then
        log_info "Namespace ${NAMESPACE} already exists"
    else
        kubectl create namespace "${NAMESPACE}"
        log_info "Namespace ${NAMESPACE} created"
    fi
}

create_secrets() {
    log_info "Creating secrets..."

    # Check if secrets already exist
    if kubectl get secret rfp-agent-secrets -n "${NAMESPACE}" >/dev/null 2>&1; then
        log_warn "Secrets already exist. Skipping creation."
        return
    fi

    # Create secrets from environment variables or .env file
    if [ -f "${PROJECT_ROOT}/.env.${ENVIRONMENT}" ]; then
        kubectl create secret generic rfp-agent-secrets \
            --from-env-file="${PROJECT_ROOT}/.env.${ENVIRONMENT}" \
            -n "${NAMESPACE}"
        log_info "Secrets created from .env.${ENVIRONMENT}"
    else
        log_error "Environment file .env.${ENVIRONMENT} not found"
        exit 1
    fi
}

deploy_application() {
    log_info "Deploying RFP Agent version ${VERSION} to ${ENVIRONMENT}..."

    cd "${PROJECT_ROOT}/k8s/overlays/${ENVIRONMENT}"

    # Update image tag
    kustomize edit set image "ghcr.io/yourusername/rfp-agent:${VERSION}"

    # Apply manifests
    kubectl apply -k . -n "${NAMESPACE}"

    log_info "Deployment initiated"
}

wait_for_rollout() {
    log_info "Waiting for deployment rollout..."

    kubectl rollout status deployment/rfp-agent -n "${NAMESPACE}" --timeout=10m

    log_info "Deployment rollout completed"
}

verify_deployment() {
    log_info "Verifying deployment..."

    # Check pod status
    local ready_pods=$(kubectl get pods -n "${NAMESPACE}" -l app=rfp-agent -o jsonpath='{.items[?(@.status.phase=="Running")].metadata.name}' | wc -w)
    log_info "Ready pods: ${ready_pods}"

    if [ "${ready_pods}" -eq 0 ]; then
        log_error "No pods are ready"
        exit 1
    fi

    # Check service endpoints
    local endpoints=$(kubectl get endpoints rfp-agent-service -n "${NAMESPACE}" -o jsonpath='{.subsets[*].addresses[*].ip}' | wc -w)
    log_info "Service endpoints: ${endpoints}"

    if [ "${endpoints}" -eq 0 ]; then
        log_error "No service endpoints available"
        exit 1
    fi

    log_info "Deployment verification successful"
}

run_smoke_tests() {
    log_info "Running smoke tests..."

    # Get a pod name
    local pod_name=$(kubectl get pods -n "${NAMESPACE}" -l app=rfp-agent -o jsonpath='{.items[0].metadata.name}')

    # Check health endpoint
    kubectl exec -n "${NAMESPACE}" "${pod_name}" -- curl -f http://localhost:5000/health

    log_info "Smoke tests passed"
}

rollback_deployment() {
    log_error "Deployment failed. Rolling back..."

    kubectl rollout undo deployment/rfp-agent -n "${NAMESPACE}"
    kubectl rollout status deployment/rfp-agent -n "${NAMESPACE}" --timeout=5m

    log_info "Rollback completed"
}

# Main execution
main() {
    log_info "=========================================="
    log_info "RFP Agent Deployment"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Version: ${VERSION}"
    log_info "=========================================="

    check_prerequisites
    validate_environment
    create_namespace
    create_secrets

    if deploy_application && wait_for_rollout && verify_deployment; then
        run_smoke_tests
        log_info "=========================================="
        log_info "Deployment completed successfully!"
        log_info "=========================================="
    else
        rollback_deployment
        exit 1
    fi
}

# Trap errors and rollback
trap 'rollback_deployment' ERR

# Run main function
main "$@"
