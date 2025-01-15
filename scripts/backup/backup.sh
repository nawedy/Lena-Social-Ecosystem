#!/bin/bash

# Configuration
BACKUP_DIR="/backup"
POSTGRES_HOST="db"
POSTGRES_PORT="5432"
POSTGRES_USER="backup_user"
POSTGRES_DB="tiktok_toe"
RETENTION_DAYS=7
S3_BUCKET="your-backup-bucket"
SLACK_WEBHOOK_URL="your-slack-webhook-url"

# Create backup timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_DIR}/${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

# Function to send Slack notification
send_slack_notification() {
    local status=$1
    local message=$2
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"Database Backup ${status}: ${message}\"}" \
        ${SLACK_WEBHOOK_URL}
}

# Perform backup
echo "Starting backup of ${POSTGRES_DB} at ${TIMESTAMP}"
PGPASSWORD=${POSTGRES_PASSWORD} pg_dump -h ${POSTGRES_HOST} -p ${POSTGRES_PORT} -U ${POSTGRES_USER} \
    -Fc ${POSTGRES_DB} | gzip > ${BACKUP_PATH}

# Check if backup was successful
if [ $? -eq 0 ]; then
    echo "Backup completed successfully"
    
    # Upload to S3
    aws s3 cp ${BACKUP_PATH} s3://${S3_BUCKET}/daily/${POSTGRES_DB}_${TIMESTAMP}.sql.gz
    
    if [ $? -eq 0 ]; then
        send_slack_notification "Success" "Backup completed and uploaded to S3: ${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
    else
        send_slack_notification "Warning" "Backup completed but S3 upload failed: ${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
    fi
    
    # Create weekly backup on Sunday
    if [ $(date +%u) -eq 7 ]; then
        aws s3 cp ${BACKUP_PATH} s3://${S3_BUCKET}/weekly/${POSTGRES_DB}_${TIMESTAMP}.sql.gz
    fi
    
    # Create monthly backup on 1st of the month
    if [ $(date +%d) -eq 01 ]; then
        aws s3 cp ${BACKUP_PATH} s3://${S3_BUCKET}/monthly/${POSTGRES_DB}_${TIMESTAMP}.sql.gz
    fi
else
    echo "Backup failed"
    send_slack_notification "Failed" "Backup failed for ${POSTGRES_DB}"
    exit 1
fi

# Cleanup old backups
find ${BACKUP_DIR} -type f -name "${POSTGRES_DB}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete

# Verify backup integrity
echo "Verifying backup integrity"
gzip -t ${BACKUP_PATH}
if [ $? -eq 0 ]; then
    echo "Backup integrity verified"
else
    send_slack_notification "Failed" "Backup integrity check failed for ${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
    exit 1
fi

# List all backups
echo "Current backups:"
ls -lh ${BACKUP_DIR}
