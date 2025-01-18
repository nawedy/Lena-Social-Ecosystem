#!/bin/bash

# Exit on error
set -e

echo "Running health checks..."

# Load environment variables
source .env

# Check API endpoints
check_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/$endpoint)
    
    if [ "$response" != "$expected_status" ]; then
        echo "Error: $endpoint endpoint returned $response (expected $expected_status)"
        return 1
    fi
    echo "$endpoint endpoint: OK"
    return 0
}

# Check services
check_service() {
    local service=$1
    local port=$2
    nc -z localhost $port
    if [ $? -ne 0 ]; then
        echo "Error: $service is not running on port $port"
        return 1
    fi
    echo "$service: OK"
    return 0
}

# Check Bluesky Connection
echo "Checking Bluesky connection..."
curl -s "https://bsky.social/xrpc/_health" | grep -q "success" && echo "Bluesky API: OK" || echo "Error: Bluesky API health check failed"

# API Health Checks
check_endpoint "health" 200
check_endpoint "beta/status" 200
check_endpoint "metrics/status" 200

# Service Health Checks
check_service "Frontend" 3000
check_service "Prometheus" 9091
check_service "Grafana" 3000
check_service "Redis" 6379
check_service "APM Server" 8200

# Redis Connectivity Check
echo "Checking Redis connectivity..."
redis-cli ping

# Check Disk Space
echo "Checking disk space..."
df -h | awk '$5 >= "80%" {print "Warning: Disk space usage at " $5 " for " $6}'

# Check Memory Usage
echo "Checking memory usage..."
free -m | awk 'NR==2{printf "Memory Usage: %s/%sMB (%.2f%%)\n", $3,$2,$3*100/$2 }'

# Check CPU Load
echo "Checking CPU load..."
uptime | awk '{print "Load Average: " $(NF-2) " " $(NF-1) " " $NF}'

# Check Log Files
echo "Checking log files..."
for logfile in ./logs/*.log; do
    if [ -f "$logfile" ]; then
        if grep -i "error\|exception\|fatal" "$logfile" > /dev/null; then
            echo "Warning: Found errors in $logfile"
        fi
    fi
done

# Check SSL Certificates
echo "Checking SSL certificates..."
if [ -f "./config/ssl/cert.pem" ]; then
    expiry=$(openssl x509 -enddate -noout -in ./config/ssl/cert.pem | cut -d= -f2)
    echo "SSL certificate expires: $expiry"
else
    echo "Warning: SSL certificate not found"
fi

# Check Monitoring Stack
echo "Checking monitoring stack..."
curl -s http://localhost:9091/-/healthy > /dev/null && echo "Prometheus: OK" || echo "Error: Prometheus health check failed"
curl -s http://localhost:3000/api/health > /dev/null && echo "Grafana: OK" || echo "Error: Grafana health check failed"

# Check Metrics Collection
echo "Checking metrics collection..."
curl -s http://localhost:9091/api/v1/query?query=up | grep -q '"status":"success"' && echo "Metrics collection: OK" || echo "Error: Metrics collection failed"

echo "Health checks completed."
