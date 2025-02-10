#!/bin/bash

# Usage: ./rollback.sh <environment> [revision]
ENVIRONMENT=${1:-staging}
REVISION=$2

echo "🔄 Initiating rollback for ${ENVIRONMENT} environment..."

# Set environment variables
export DEPLOY_ENV=$ENVIRONMENT
export NAMESPACE="game-services"
export DEPLOYMENT="tiktok-toe"

# Execute rollback
if [ -z "$REVISION" ]; then
  npm run deploy:rollback
else
  npm run deploy:rollback -- --revision=$REVISION
fi

# Check rollback status
if [ $? -eq 0 ]; then
  echo "✅ Rollback completed successfully"
  exit 0
else
  echo "❌ Rollback failed"
  exit 1
fi 