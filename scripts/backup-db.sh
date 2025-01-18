#!/bin/bash

# Exit on error
set -e

echo "Starting database backup..."

# Load environment variables
source .env

# Create backup directory if it doesn't exist
BACKUP_DIR="./backups/database"
mkdir -p "$BACKUP_DIR"

# Generate timestamp for backup file
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/db_backup_$TIMESTAMP.sql"

# Perform PostgreSQL backup
echo "Backing up PostgreSQL database..."
PGPASSWORD=$POSTGRES_PASSWORD pg_dump \
    -h localhost \
    -U $POSTGRES_USER \
    -F c \
    -b \
    -v \
    -f "$BACKUP_FILE" \
    tiktok_toe

# Compress backup
echo "Compressing backup..."
gzip "$BACKUP_FILE"

# Upload to backup storage if configured
if [ "$BACKUP_STORAGE_PROVIDER" = "aws" ] && [ ! -z "$BACKUP_BUCKET" ]; then
    echo "Uploading to AWS S3..."
    aws s3 cp "${BACKUP_FILE}.gz" "s3://$BACKUP_BUCKET/database_backups/"
fi

# Cleanup old backups (keep last 7 days)
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "db_backup_*.sql.gz" -type f -mtime +7 -delete

echo "Database backup completed successfully!"
echo "Backup saved to: ${BACKUP_FILE}.gz"
