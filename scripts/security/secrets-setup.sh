#!/bin/bash
# =============================================================================
# Secrets Management Script
# Sets up Kubernetes secrets from 1Password or environment files
# =============================================================================

set -e
set -u
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT="${1:-staging}"
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

# Create secrets from 1Password (if available)
create_from_1password() {
    if ! command -v op &> /dev/null; then
        log_warn "1Password CLI not found. Skipping."
        return 1
    fi

    log_info "Creating secrets from 1Password..."

    # Example: Fetch secrets from 1Password
    DATABASE_URL=$(op read "op://RFP-Agent/${ENVIRONMENT}/database-url")
    SESSION_SECRET=$(op read "op://RFP-Agent/${ENVIRONMENT}/session-secret")
    OPENAI_API_KEY=$(op read "op://RFP-Agent/${ENVIRONMENT}/openai-api-key")
    ANTHROPIC_API_KEY=$(op read "op://RFP-Agent/${ENVIRONMENT}/anthropic-api-key")
    BROWSERBASE_API_KEY=$(op read "op://RFP-Agent/${ENVIRONMENT}/browserbase-api-key")
    BROWSERBASE_PROJECT_ID=$(op read "op://RFP-Agent/${ENVIRONMENT}/browserbase-project-id")
    SAM_GOV_API_KEY=$(op read "op://RFP-Agent/${ENVIRONMENT}/sam-gov-api-key")

    kubectl create secret generic rfp-agent-secrets \
        --from-literal=database-url="${DATABASE_URL}" \
        --from-literal=session-secret="${SESSION_SECRET}" \
        --from-literal=openai-api-key="${OPENAI_API_KEY}" \
        --from-literal=anthropic-api-key="${ANTHROPIC_API_KEY}" \
        --from-literal=browserbase-api-key="${BROWSERBASE_API_KEY}" \
        --from-literal=browserbase-project-id="${BROWSERBASE_PROJECT_ID}" \
        --from-literal=sam-gov-api-key="${SAM_GOV_API_KEY}" \
        -n "${NAMESPACE}" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_info "Secrets created from 1Password"
    return 0
}

# Create secrets from environment file
create_from_env_file() {
    local env_file=".env.${ENVIRONMENT}"

    if [ ! -f "${env_file}" ]; then
        log_error "Environment file ${env_file} not found"
        return 1
    fi

    log_info "Creating secrets from ${env_file}..."

    kubectl create secret generic rfp-agent-secrets \
        --from-env-file="${env_file}" \
        -n "${NAMESPACE}" \
        --dry-run=client -o yaml | kubectl apply -f -

    log_info "Secrets created from environment file"
    return 0
}

# Rotate secrets
rotate_secrets() {
    log_info "Rotating secrets..."

    # Delete existing secrets
    kubectl delete secret rfp-agent-secrets -n "${NAMESPACE}" || true

    # Create new secrets
    if ! create_from_1password; then
        create_from_env_file
    fi

    # Restart pods to pick up new secrets
    kubectl rollout restart deployment/rfp-agent -n "${NAMESPACE}"

    log_info "Secrets rotated successfully"
}

# Verify secrets
verify_secrets() {
    log_info "Verifying secrets..."

    if kubectl get secret rfp-agent-secrets -n "${NAMESPACE}" &> /dev/null; then
        log_info "Secrets exist in namespace ${NAMESPACE}"

        # List secret keys (not values)
        kubectl get secret rfp-agent-secrets -n "${NAMESPACE}" -o jsonpath='{.data}' | jq -r 'keys[]' | while read key; do
            log_info "  - ${key}"
        done
    else
        log_error "Secrets not found in namespace ${NAMESPACE}"
        return 1
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "Secrets Management"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "=========================================="

    case "${2:-setup}" in
        setup)
            if ! create_from_1password; then
                create_from_env_file
            fi
            verify_secrets
            ;;
        rotate)
            rotate_secrets
            ;;
        verify)
            verify_secrets
            ;;
        *)
            log_error "Unknown command: ${2}"
            echo "Usage: $0 <environment> [setup|rotate|verify]"
            exit 1
            ;;
    esac

    log_info "=========================================="
    log_info "Operation completed!"
    log_info "=========================================="
}

main "$@"
