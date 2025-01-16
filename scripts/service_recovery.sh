#!/bin/bash

# Service Recovery Script
# This script handles automated recovery of services based on monitoring alerts

# Load environment variables
source ../.env

# Slack webhook for notifications
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL}"

# Function to send Slack notifications
send_slack_notification() {
    local message="$1"
    local color="$2"
    
    curl -X POST -H 'Content-type: application/json' \
        --data "{
            \"attachments\": [
                {
                    \"color\": \"$color\",
                    \"text\": \"$message\",
                    \"footer\": \"Service Recovery Script\",
                    \"ts\": $(date +%s)
                }
            ]
        }" \
        "$SLACK_WEBHOOK_URL"
}

# Function to check container health
check_container_health() {
    local container_name="$1"
    local status=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null)
    local health=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null)
    
    if [ "$status" != "running" ] || [ "$health" != "healthy" ]; then
        return 1
    fi
    return 0
}

# Function to restart unhealthy container
restart_container() {
    local container_name="$1"
    local max_retries=3
    local retry_count=0
    
    while [ $retry_count -lt $max_retries ]; do
        echo "Attempting to restart $container_name (attempt $((retry_count + 1)))"
        docker restart "$container_name"
        
        # Wait for container to start
        sleep 10
        
        if check_container_health "$container_name"; then
            send_slack_notification "✅ Successfully recovered $container_name" "good"
            return 0
        fi
        
        ((retry_count++))
    done
    
    send_slack_notification "❌ Failed to recover $container_name after $max_retries attempts" "danger"
    return 1
}

# Function to check and recover Redis
recover_redis() {
    if ! check_container_health "redis"; then
        echo "Redis is unhealthy, attempting recovery..."
        restart_container "redis"
    fi
}

# Function to check and recover Postgres
recover_postgres() {
    if ! check_container_health "postgres"; then
        echo "Postgres is unhealthy, attempting recovery..."
        restart_container "postgres"
    fi
}

# Function to check and recover Elasticsearch
recover_elasticsearch() {
    if ! check_container_health "elasticsearch"; then
        echo "Elasticsearch is unhealthy, attempting recovery..."
        restart_container "elasticsearch"
        
        # Wait for Elasticsearch to be ready
        sleep 30
        
        # Restart dependent services
        docker restart kibana logstash
    fi
}

# Function to check and recover monitoring stack
recover_monitoring() {
    local monitoring_services=("prometheus" "grafana" "alertmanager" "node-exporter" "cadvisor")
    
    for service in "${monitoring_services[@]}"; do
        if ! check_container_health "$service"; then
            echo "$service is unhealthy, attempting recovery..."
            restart_container "$service"
        fi
    done
}

# Function to check API health
check_api_health() {
    local api_url="http://localhost:8000/health"
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$api_url")
    
    if [ "$response" != "200" ]; then
        echo "API health check failed, attempting recovery..."
        restart_container "api"
    fi
}

# Main recovery loop
main() {
    while true; do
        # Check and recover core services
        recover_redis
        recover_postgres
        recover_elasticsearch
        
        # Check and recover monitoring stack
        recover_monitoring
        
        # Check API health
        check_api_health
        
        # Wait before next check
        sleep 60
    done
}

# Start recovery process
echo "Starting service recovery monitoring..."
send_slack_notification "🔄 Service recovery monitoring started" "good"
main
