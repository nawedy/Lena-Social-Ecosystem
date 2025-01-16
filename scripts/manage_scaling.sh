#!/bin/bash

# Scaling Management Script
# This script manages scaling thresholds based on current load and time of day

# Load environment variables
source ../.env

# Default thresholds
DEFAULT_CPU_THRESHOLD=70
DEFAULT_MEMORY_THRESHOLD=80
DEFAULT_REQUEST_THRESHOLD=1000
DEFAULT_MIN_REPLICAS=2
DEFAULT_MAX_REPLICAS=10

# Peak hours thresholds (more aggressive scaling)
PEAK_CPU_THRESHOLD=60
PEAK_MEMORY_THRESHOLD=70
PEAK_REQUEST_THRESHOLD=800
PEAK_MIN_REPLICAS=4
PEAK_MAX_REPLICAS=15

# Function to check if current time is during peak hours (9 AM - 6 PM)
is_peak_hours() {
    local current_hour=$(date +%H)
    if [ $current_hour -ge 9 ] && [ $current_hour -lt 18 ]; then
        return 0
    fi
    return 1
}

# Function to update HPA configuration
update_hpa_config() {
    local cpu_threshold=$1
    local memory_threshold=$2
    local request_threshold=$3
    local min_replicas=$4
    local max_replicas=$5
    
    # Update resource-based HPA
    kubectl patch hpa api-hpa --patch "
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: $min_replicas
  maxReplicas: $max_replicas
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: $cpu_threshold
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: $memory_threshold
"
    
    # Update custom metrics HPA
    kubectl patch hpa api-custom-hpa --patch "
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: $min_replicas
  maxReplicas: $max_replicas
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: ${request_threshold}
"
}

# Function to check current load and adjust thresholds
adjust_thresholds() {
    # Get current CPU utilization
    local cpu_util=$(kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes | \
        jq -r '.items[0].usage.cpu' | \
        sed 's/[^0-9]*//g')
    
    # Get current memory utilization
    local mem_util=$(kubectl get --raw /apis/metrics.k8s.io/v1beta1/nodes | \
        jq -r '.items[0].usage.memory' | \
        sed 's/[^0-9]*//g')
    
    # Get current request rate
    local req_rate=$(kubectl get --raw /apis/custom.metrics.k8s.io/v1beta1/namespaces/default/pods/*/http_requests_per_second | \
        jq -r '.items[0].value')
    
    if is_peak_hours; then
        local cpu_threshold=$PEAK_CPU_THRESHOLD
        local memory_threshold=$PEAK_MEMORY_THRESHOLD
        local request_threshold=$PEAK_REQUEST_THRESHOLD
        local min_replicas=$PEAK_MIN_REPLICAS
        local max_replicas=$PEAK_MAX_REPLICAS
    else
        local cpu_threshold=$DEFAULT_CPU_THRESHOLD
        local memory_threshold=$DEFAULT_MEMORY_THRESHOLD
        local request_threshold=$DEFAULT_REQUEST_THRESHOLD
        local min_replicas=$DEFAULT_MIN_REPLICAS
        local max_replicas=$DEFAULT_MAX_REPLICAS
    fi
    
    # Adjust thresholds based on current load
    if [ $cpu_util -gt 90 ] || [ $mem_util -gt 90 ]; then
        cpu_threshold=$((cpu_threshold - 10))
        memory_threshold=$((memory_threshold - 10))
        request_threshold=$((request_threshold - 200))
        min_replicas=$((min_replicas + 2))
    fi
    
    update_hpa_config $cpu_threshold $memory_threshold $request_threshold $min_replicas $max_replicas
}

# Function to log scaling events
log_scaling_event() {
    local message="$1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $message" >> /var/log/scaling.log
    
    # Send to Slack if configured
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"$message\"}" \
            "$SLACK_WEBHOOK_URL"
    fi
}

# Main loop
main() {
    while true; do
        echo "Checking scaling thresholds..."
        
        # Adjust thresholds based on time and load
        adjust_thresholds
        
        # Log current state
        local replicas=$(kubectl get deployment api -o jsonpath='{.spec.replicas}')
        log_scaling_event "Current replicas: $replicas"
        
        # Wait before next check
        sleep 300
    done
}

# Start scaling management
echo "Starting scaling management..."
main
