#!/bin/bash

# Exit on error
set -e

echo "Starting TikTokToe Beta Deployment..."

# 1. Environment Setup
echo "Setting up environment..."
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    exit 1
fi

# Load environment variables
source .env

# 2. Pre-deployment Checks
echo "Running pre-deployment checks..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed!"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Error: Docker Compose is not installed!"
    exit 1
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed!"
    exit 1
fi

# 3. Run Tests
echo "Running test suite..."
npm run test

if [ $? -ne 0 ]; then
    echo "Error: Tests failed!"
    exit 1
fi

# 4. Build Application
echo "Building application..."
npm run build

if [ $? -ne 0 ]; then
    echo "Error: Build failed!"
    exit 1
fi

# 5. Start Monitoring Stack
echo "Starting monitoring stack..."
docker-compose -f docker-compose.monitoring.yml up -d

# 6. Start Metrics Stack
echo "Starting metrics stack..."
docker-compose -f docker-compose.metrics.yml up -d

# 7. Start Tracing Stack
echo "Starting tracing stack..."
docker-compose -f docker-compose.tracing.yml up -d

# 8. Deploy Application
echo "Deploying application..."
docker-compose up -d --build

# 9. Run Health Checks
echo "Running health checks..."
./scripts/health-check.sh

if [ $? -ne 0 ]; then
    echo "Error: Health checks failed!"
    echo "Rolling back deployment..."
    docker-compose down
    docker-compose -f docker-compose.monitoring.yml down
    docker-compose -f docker-compose.metrics.yml down
    docker-compose -f docker-compose.tracing.yml down
    exit 1
fi

# 10. Cache Warming
echo "Warming up cache..."
./scripts/warm-cache.sh

# 11. Enable Beta Features
echo "Enabling beta features..."
curl -X POST http://localhost:3000/api/beta/enable \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"features": ["tiktok_migration", "social_features", "ai_suggestions"]}'

# 12. Send Notifications
echo "Sending deployment notifications..."
curl -X POST http://localhost:3000/api/notifications/send \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${ADMIN_TOKEN}" \
    -d '{"type": "deployment", "message": "Beta environment successfully deployed"}'

echo "Beta deployment completed successfully!"
echo "Monitor the deployment at: http://localhost:3000/monitoring"
echo "View metrics at: http://localhost:3000/metrics"
echo "Access beta dashboard at: http://localhost:3000/beta/dashboard"
