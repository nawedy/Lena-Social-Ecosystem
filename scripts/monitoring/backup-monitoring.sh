#!/bin/bash

# Configuration
BACKUP_DIR="/backup/monitoring"
ES_HOST="elasticsearch:9200"
KIBANA_HOST="kibana:5601"
S3_BUCKET="your-monitoring-backup-bucket"
RETENTION_DAYS=30
SLACK_WEBHOOK_URL="your-slack-webhook-url"

# Create timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Ensure backup directory exists
mkdir -p ${BACKUP_DIR}

# Function to send Slack notification
send_slack_notification() {
    local status=$1
    local message=$2
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{\"text\":\"Monitoring Backup ${status}: ${message}\"}" \
        ${SLACK_WEBHOOK_URL}
}

# Backup Elasticsearch indices
echo "Starting Elasticsearch backup..."
curl -X PUT "${ES_HOST}/_snapshot/backup_repository" -H 'Content-Type: application/json' -d '{
  "type": "fs",
  "settings": {
    "location": "/backup/elasticsearch"
  }
}'

curl -X PUT "${ES_HOST}/_snapshot/backup_repository/snapshot_${TIMESTAMP}?wait_for_completion=true" -H 'Content-Type: application/json' -d '{
  "indices": ["logstash-*", "metricbeat-*", "filebeat-*"],
  "ignore_unavailable": true,
  "include_global_state": true
}'

if [ $? -eq 0 ]; then
    echo "Elasticsearch backup completed successfully"
    
    # Compress backup
    tar -czf ${BACKUP_DIR}/elasticsearch_${TIMESTAMP}.tar.gz /backup/elasticsearch
    
    # Upload to S3
    aws s3 cp ${BACKUP_DIR}/elasticsearch_${TIMESTAMP}.tar.gz s3://${S3_BUCKET}/elasticsearch/
    
    if [ $? -eq 0 ]; then
        send_slack_notification "Success" "Elasticsearch backup completed and uploaded to S3"
    else
        send_slack_notification "Warning" "Elasticsearch backup completed but S3 upload failed"
    fi
else
    echo "Elasticsearch backup failed"
    send_slack_notification "Failed" "Elasticsearch backup failed"
fi

# Backup Kibana saved objects
echo "Starting Kibana backup..."
curl -X POST "${KIBANA_HOST}/api/saved_objects/_export" -H 'kbn-xsrf: true' -H 'Content-Type: application/json' -d '{
  "type": ["dashboard", "visualization", "index-pattern", "config", "alert"]
}' > ${BACKUP_DIR}/kibana_${TIMESTAMP}.ndjson

if [ $? -eq 0 ]; then
    echo "Kibana backup completed successfully"
    
    # Upload to S3
    aws s3 cp ${BACKUP_DIR}/kibana_${TIMESTAMP}.ndjson s3://${S3_BUCKET}/kibana/
    
    if [ $? -eq 0 ]; then
        send_slack_notification "Success" "Kibana backup completed and uploaded to S3"
    else
        send_slack_notification "Warning" "Kibana backup completed but S3 upload failed"
    fi
else
    echo "Kibana backup failed"
    send_slack_notification "Failed" "Kibana backup failed"
fi

# Backup APM indices
echo "Starting APM backup..."
curl -X PUT "${ES_HOST}/_snapshot/backup_repository/apm_${TIMESTAMP}?wait_for_completion=true" -H 'Content-Type: application/json' -d '{
  "indices": ["apm-*"],
  "ignore_unavailable": true,
  "include_global_state": false
}'

if [ $? -eq 0 ]; then
    echo "APM backup completed successfully"
    send_slack_notification "Success" "APM backup completed"
else
    echo "APM backup failed"
    send_slack_notification "Failed" "APM backup failed"
fi

# Cleanup old backups
echo "Cleaning up old backups..."

# Local cleanup
find ${BACKUP_DIR} -type f -mtime +${RETENTION_DAYS} -delete

# S3 cleanup
aws s3 ls s3://${S3_BUCKET}/elasticsearch/ | while read -r line;
do
    createDate=`echo $line|awk {'print $1" "$2'}`
    createDate=`date -d"$createDate" +%s`
    olderThan=`date -d"-${RETENTION_DAYS} days" +%s`
    if [[ $createDate -lt $olderThan ]]
    then 
        fileName=`echo $line|awk {'print $4'}`
        if [ $fileName != "" ]
        then
            aws s3 rm s3://${S3_BUCKET}/elasticsearch/$fileName
        fi
    fi
done

# List current backups
echo "Current backups:"
ls -lh ${BACKUP_DIR}

# Verify backup integrity
echo "Verifying backup integrity..."
for file in ${BACKUP_DIR}/*; do
    if [[ $file == *.tar.gz ]]; then
        tar -tzf "$file" > /dev/null 2>&1
        if [ $? -eq 0 ]; then
            echo "Verified: $file"
        else
            send_slack_notification "Warning" "Backup integrity check failed for $file"
        fi
    fi
done
