#!/bin/bash
# =============================================================================
# RFP Agent Rollback Script
# Usage: ./scripts/deployment/rollback.sh <environment> [revision]
# =============================================================================

set -e
set -u
set -o pipefail

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT="${1:-staging}"
REVISION="${2:-0}"  # 0 means previous revision
NAMESPACE="rfp-agent-${ENVIRONMENT}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Show deployment history
show_history() {
    log_info "Deployment history for ${ENVIRONMENT}:"
    kubectl rollout history deployment/rfp-agent -n "${NAMESPACE}"
}

# Confirm rollback
confirm_rollback() {
    if [[ "${ENVIRONMENT}" == "production" ]]; then
        log_warn "WARNING: Rolling back PRODUCTION deployment!"
    fi

    read -p "$(echo -e ${YELLOW}Are you sure you want to rollback? [yes/no]: ${NC})" confirm
    if [[ "${confirm}" != "yes" ]]; then
        log_warn "Rollback cancelled"
        exit 0
    fi
}

# Perform rollback
perform_rollback() {
    log_info "Rolling back deployment in ${ENVIRONMENT}..."

    if [ "${REVISION}" -eq 0 ]; then
        kubectl rollout undo deployment/rfp-agent -n "${NAMESPACE}"
    else
        kubectl rollout undo deployment/rfp-agent -n "${NAMESPACE}" --to-revision="${REVISION}"
    fi

    log_info "Waiting for rollback to complete..."
    kubectl rollout status deployment/rfp-agent -n "${NAMESPACE}" --timeout=10m

    log_info "Rollback completed successfully"
}

# Main execution
main() {
    log_info "=========================================="
    log_info "RFP Agent Rollback"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "=========================================="

    show_history
    confirm_rollback
    perform_rollback

    log_info "=========================================="
    log_info "Rollback completed!"
    log_info "=========================================="
}

main "$@"
