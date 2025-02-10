#!/bin/bash

# Set environment variables
export DEPLOY_ENV=${1:-staging}
export REGISTRY="ghcr.io/your-org"
export IMAGE_TAG=$(git rev-parse --short HEAD)
export DOMAIN="${DEPLOY_ENV}.tiktok-toe.example.com"

# Verify prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required but not installed"; exit 1; }

# Check cluster access
kubectl cluster-info >/dev/null 2>&1 || { echo "Unable to access Kubernetes cluster"; exit 1; }

# Start deployment
echo "Starting deployment to ${DEPLOY_ENV}"
npm run deploy:start

# Check exit status
if [ $? -eq 0 ]; then
    echo "Deployment completed successfully"
else
    echo "Deployment failed"
    exit 1
fi 