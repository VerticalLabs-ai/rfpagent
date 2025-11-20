#!/bin/bash
# =============================================================================
# Database Backup Script for RFP Agent
# Creates encrypted backups and uploads to cloud storage
# =============================================================================

set -e
set -u
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

ENVIRONMENT="${1:-production}"
BACKUP_DIR="${2:-/tmp/backups}"
RETENTION_DAYS="${3:-30}"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Load database credentials
load_credentials() {
    if [ -f ".env.${ENVIRONMENT}" ]; then
        export $(grep -v '^#' ".env.${ENVIRONMENT}" | xargs)
    else
        log_error "Environment file .env.${ENVIRONMENT} not found"
        exit 1
    fi
}

# Create backup directory
prepare_backup_dir() {
    mkdir -p "${BACKUP_DIR}"
    log_info "Backup directory: ${BACKUP_DIR}"
}

# Perform database backup
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="${BACKUP_DIR}/rfpagent_${ENVIRONMENT}_${timestamp}.sql"
    local compressed_file="${backup_file}.gz"

    log_info "Starting database backup..."

    # Dump database
    pg_dump "${DATABASE_URL}" > "${backup_file}"

    # Compress backup
    gzip "${backup_file}"

    log_info "Backup created: ${compressed_file}"

    # Calculate checksum
    local checksum=$(sha256sum "${compressed_file}" | awk '{print $1}')
    echo "${checksum}" > "${compressed_file}.sha256"

    log_info "Checksum: ${checksum}"

    echo "${compressed_file}"
}

# Encrypt backup
encrypt_backup() {
    local backup_file="$1"
    local encrypted_file="${backup_file}.enc"

    if [ -n "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        log_info "Encrypting backup..."
        openssl enc -aes-256-cbc -salt -in "${backup_file}" -out "${encrypted_file}" -k "${BACKUP_ENCRYPTION_KEY}"
        rm "${backup_file}"
        log_info "Backup encrypted: ${encrypted_file}"
        echo "${encrypted_file}"
    else
        log_warn "BACKUP_ENCRYPTION_KEY not set. Skipping encryption."
        echo "${backup_file}"
    fi
}

# Upload to cloud storage (Google Cloud Storage)
upload_to_gcs() {
    local backup_file="$1"
    local bucket="${GCS_BACKUP_BUCKET:-rfp-agent-backups}"
    local object_name="backups/${ENVIRONMENT}/$(basename ${backup_file})"

    if command -v gsutil &> /dev/null; then
        log_info "Uploading to GCS: gs://${bucket}/${object_name}"
        gsutil cp "${backup_file}" "gs://${bucket}/${object_name}"
        gsutil cp "${backup_file}.sha256" "gs://${bucket}/${object_name}.sha256"
        log_info "Upload completed"
    else
        log_warn "gsutil not found. Skipping cloud upload."
    fi
}

# Clean up old backups
cleanup_old_backups() {
    log_info "Cleaning up backups older than ${RETENTION_DAYS} days..."

    find "${BACKUP_DIR}" -name "rfpagent_${ENVIRONMENT}_*.sql.gz*" -mtime +${RETENTION_DAYS} -delete

    log_info "Cleanup completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"

    log_info "Verifying backup integrity..."

    local stored_checksum=$(cat "${backup_file}.sha256")
    local computed_checksum=$(sha256sum "${backup_file}" | awk '{print $1}')

    if [ "${stored_checksum}" == "${computed_checksum}" ]; then
        log_info "Backup integrity verified"
        return 0
    else
        log_error "Backup integrity check failed!"
        return 1
    fi
}

# Send notification
send_notification() {
    local status="$1"
    local message="$2"

    if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
        curl -X POST "${SLACK_WEBHOOK_URL}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\":\"Database Backup [${ENVIRONMENT}] - ${status}: ${message}\"}"
    fi
}

# Main execution
main() {
    log_info "=========================================="
    log_info "RFP Agent Database Backup"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "=========================================="

    load_credentials
    prepare_backup_dir

    local backup_file=$(backup_database)

    if verify_backup "${backup_file}"; then
        local final_file=$(encrypt_backup "${backup_file}")
        upload_to_gcs "${final_file}"
        cleanup_old_backups

        log_info "=========================================="
        log_info "Backup completed successfully!"
        log_info "=========================================="

        send_notification "SUCCESS" "Backup completed successfully"
    else
        log_error "Backup verification failed"
        send_notification "FAILED" "Backup verification failed"
        exit 1
    fi
}

# Trap errors
trap 'log_error "Backup failed"; send_notification "FAILED" "Backup script error"' ERR

main "$@"
