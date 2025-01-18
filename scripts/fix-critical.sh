#!/bin/bash

# Fix TypeScript import errors
find src -type f -name "*.ts" -exec sed -i '' 's/import { Monitoring } from "@google-cloud\/monitoring"/import Monitoring from "@google-cloud\/monitoring"/' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/import { CloudVision } from "@google-cloud\/vision"/import CloudVision from "@google-cloud\/vision"/' {} +

# Fix missing property errors
find src -type f -name "*.ts" -exec sed -i '' 's/config.GCP_PROJECT_ID/config.gcp.projectId/g' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/config.GCP_KEY_FILE/config.gcp.keyFile/g' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/config.GCP_STORAGE_BUCKET/config.gcp.storageBucket/g' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/config.ENVIRONMENT/config.app.env/g' {} +

# Fix null assertions
find src -type f -name "*.ts" -exec sed -i '' 's/!}/? }/g' {} +

# Fix React Hook dependencies
find src -type f -name "*.tsx" -exec sed -i '' 's/useEffect(\[\])/useEffect(() => {}, [])/g' {} +

# Run TypeScript compiler to check remaining issues
npx tsc --noEmit
