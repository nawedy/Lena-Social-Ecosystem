#!/bin/bash

# Run Prettier to fix formatting issues
npx prettier --write "src/**/*.{ts,tsx}"

# Fix ESLint auto-fixable issues
npx eslint --fix "src/**/*.{ts,tsx}"

# Run TypeScript compiler to check types
npx tsc --noEmit

# Run final lint check
npm run lint
