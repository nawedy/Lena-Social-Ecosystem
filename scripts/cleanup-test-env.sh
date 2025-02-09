#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to print section header
print_header() {
  echo -e "\n${YELLOW}=== $1 ===${NC}\n"
}

# Function to handle errors
handle_error() {
  echo -e "\n${RED}Error: $1${NC}"
  exit 1
}

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check required commands
required_commands=("docker" "docker-compose")
for cmd in "${required_commands[@]}"; do
  if ! command_exists "$cmd"; then
    handle_error "$cmd is required but not installed."
  fi
done

# Stop test environment
print_header "Stopping test environment"
docker-compose -f docker-compose.test.yml down -v || handle_error "Failed to stop test environment"

# Remove test database
print_header "Removing test database"
docker volume rm $(docker volume ls -q | grep postgres_test_data) 2>/dev/null || true

# Remove Redis data
print_header "Removing Redis data"
docker volume rm $(docker volume ls -q | grep redis_test_data) 2>/dev/null || true

# Remove Supabase data
print_header "Removing Supabase data"
docker volume rm $(docker volume ls -q | grep supabase_test_data) 2>/dev/null || true
npx supabase stop || true

# Remove MinIO data
print_header "Removing MinIO data"
docker volume rm $(docker volume ls -q | grep minio_test_data) 2>/dev/null || true

# Remove Elasticsearch data
print_header "Removing Elasticsearch data"
docker volume rm $(docker volume ls -q | grep elasticsearch_test_data) 2>/dev/null || true

# Remove Prometheus data
print_header "Removing Prometheus data"
docker volume rm $(docker volume ls -q | grep prometheus_test_data) 2>/dev/null || true

# Remove Grafana data
print_header "Removing Grafana data"
docker volume rm $(docker volume ls -q | grep grafana_test_data) 2>/dev/null || true

# Remove test directories
print_header "Removing test directories"
rm -rf test-results/
rm -rf coverage/
rm -rf playwright-report/
rm -rf test-assets/
rm -rf logs/
rm -rf metrics/
rm -rf reports/
rm -rf certs/

# Remove test environment files
print_header "Removing environment files"
rm -f apps/core/tests/e2e/.env.test

# Remove test certificates
print_header "Removing SSL certificates"
rm -f certs/test-key.pem
rm -f certs/test-cert.pem

# Clean npm cache
print_header "Cleaning npm cache"
npm cache clean --force || true

# Remove node_modules
print_header "Removing node_modules"
rm -rf node_modules/

# Remove temporary files
print_header "Removing temporary files"
find . -type f -name "*.log" -delete
find . -type f -name "*.tmp" -delete
find . -type f -name ".DS_Store" -delete
find . -type d -name "__pycache__" -exec rm -r {} +

# Remove Docker test network
print_header "Removing Docker test network"
docker network rm $(docker network ls -q -f name=tiktok-toe_test) 2>/dev/null || true

# Clean Docker system
print_header "Cleaning Docker system"
docker system prune -f || true

# Remove Git hooks
print_header "Removing Git hooks"
rm -f .git/hooks/pre-commit

# Print cleanup summary
print_header "Cleanup Summary"
echo -e "${GREEN}Test environment cleanup completed successfully!${NC}"
echo "The following components have been removed:"
echo "- Test containers and volumes"
echo "- Test database"
echo "- Redis data"
echo "- Supabase data"
echo "- MinIO data"
echo "- Elasticsearch data"
echo "- Prometheus data"
echo "- Grafana data"
echo "- Test directories"
echo "- Test environment files"
echo "- Test certificates"
echo "- Node modules"
echo "- Temporary files"
echo "- Docker test network"
echo "- Git hooks"

echo -e "\nTo set up the test environment again, run:"
echo "./scripts/setup-test-env.sh"

# Make script executable
chmod +x scripts/cleanup-test-env.sh 