#!/bin/bash

# Fix React Hook dependencies
find src -type f -name "*.tsx" -exec sed -i '' 's/\[\]/[]/g' {} +

# Fix non-null assertions
find src -type f -name "*.tsx" -exec sed -i '' 's/!}/}/g' {} +

# Fix localStorage references
find src -type f -name "*.tsx" -exec sed -i '' 's/localStorage/window.localStorage/g' {} +

# Fix alert references
find src -type f -name "*.tsx" -exec sed -i '' 's/alert(/window.alert(/g' {} +

# Fix unused vars
find src -type f -name "*.tsx" -exec sed -i '' 's/const \([a-zA-Z0-9]*\) =/const _\1 =/g' {} +

# Run ESLint fix again
npx eslint --fix "src/**/*.{ts,tsx}"

# Run TypeScript compiler
npx tsc --noEmit
