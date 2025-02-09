#!/bin/bash

# Exit on error
set -e

# Load environment variables
if [ -f .env.test ]; then
  export $(cat .env.test | grep -v '^#' | xargs)
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print section header
print_header() {
  echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Function to handle errors
handle_error() {
  echo -e "\n${RED}Error: $1${NC}"
  exit 1
}

# Check required commands
required_commands=("docker" "docker-compose" "node" "npm")
for cmd in "${required_commands[@]}"; do
  if ! command_exists "$cmd"; then
    handle_error "$cmd is required but not installed."
  fi
done

# Create test results directory
mkdir -p test-results

# Start test environment
print_header "Starting test environment"
docker-compose -f docker-compose.test.yml up -d || handle_error "Failed to start test environment"

# Wait for services to be ready
print_header "Waiting for services to be ready"
sleep 10

# Install dependencies
print_header "Installing dependencies"
npm ci || handle_error "Failed to install dependencies"

# Install Playwright browsers
print_header "Installing Playwright browsers"
npx playwright install --with-deps || handle_error "Failed to install Playwright browsers"

# Run linter
print_header "Running linter"
npm run lint || handle_error "Linter check failed"

# Run type check
print_header "Running type check"
npm run typecheck || handle_error "Type check failed"

# Run unit tests
print_header "Running unit tests"
npm run test:unit || handle_error "Unit tests failed"

# Run E2E tests
print_header "Running E2E tests"
npm run test:e2e || handle_error "E2E tests failed"

# Generate coverage report
print_header "Generating coverage report"
npm run test:unit:coverage || handle_error "Failed to generate coverage report"

# Merge coverage reports
print_header "Merging coverage reports"
npx nyc merge ./coverage ./coverage/coverage-final.json || handle_error "Failed to merge coverage reports"

# Generate HTML report
print_header "Generating HTML report"
npx nyc report --reporter=html --reporter=text --reporter=lcov || handle_error "Failed to generate HTML report"

# Run performance tests
print_header "Running performance tests"
npm run test:e2e -- --grep @performance || handle_error "Performance tests failed"

# Run accessibility tests
print_header "Running accessibility tests"
npm run test:e2e -- --grep @accessibility || handle_error "Accessibility tests failed"

# Run security tests
print_header "Running security tests"
npm run test:e2e -- --grep @security || handle_error "Security tests failed"

# Generate test report
print_header "Generating test report"
npm run test:e2e:report || handle_error "Failed to generate test report"

# Check test coverage thresholds
print_header "Checking coverage thresholds"
if [ -f ./coverage/lcov.info ]; then
  npx istanbul check-coverage \
    --statements 80 \
    --branches 70 \
    --functions 80 \
    --lines 80 \
    ./coverage/lcov.info || handle_error "Coverage is below thresholds"
else
  handle_error "Coverage report not found"
fi

# Stop test environment
print_header "Stopping test environment"
docker-compose -f docker-compose.test.yml down || handle_error "Failed to stop test environment"

# Print summary
print_header "Test Summary"
echo -e "${GREEN}All tests completed successfully!${NC}"
echo "Test reports are available in:"
echo "- Unit test coverage: ./coverage/index.html"
echo "- E2E test report: ./playwright-report/index.html"
echo "- Performance report: ./test-results/performance.html"
echo "- Accessibility report: ./test-results/accessibility.html"
echo "- Security report: ./test-results/security.html"

# Make script executable
chmod +x scripts/test.sh 