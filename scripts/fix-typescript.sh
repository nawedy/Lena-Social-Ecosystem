#!/bin/bash

# Install missing type definitions
npm install --save-dev @types/react-native @types/react-navigation @types/node @types/google-cloud__monitoring @types/google-cloud__vision @types/google-cloud__storage @types/browser-image-compression @types/replicate

# Fix import statements
find src -type f -name "*.ts" -exec sed -i '' 's/import { Monitoring } from "@google-cloud\/monitoring"/import * as monitoring from "@google-cloud\/monitoring"\nconst Monitoring = monitoring.v3/' {} +
find src -type f -name "*.ts" -exec sed -i '' 's/import { CloudVision } from "@google-cloud\/vision"/import * as vision from "@google-cloud\/vision"\nconst CloudVision = vision.v1/' {} +

# Fix type assertions
find src -type f -name "*.ts" -exec sed -i '' 's/as any/as unknown/g' {} +

# Fix null checks
find src -type f -name "*.ts" -exec sed -i '' 's/!\./\?\./g' {} +

# Fix type definitions
cat > src/types/global.d.ts << EOL
declare module "browser-image-compression";
declare module "replicate";
declare module "@google-cloud/video-intelligence";
declare module "openai";
declare module "googleapis";

interface Window {
  localStorage: Storage;
}
EOL

# Run TypeScript compiler
npx tsc --noEmit
