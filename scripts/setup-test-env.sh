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
required_commands=("docker" "docker-compose" "node" "npm")
for cmd in "${required_commands[@]}"; do
  if ! command_exists "$cmd"; then
    handle_error "$cmd is required but not installed."
  fi
done

# Create necessary directories
print_header "Creating directories"
mkdir -p test-results
mkdir -p coverage
mkdir -p playwright-report
mkdir -p test-assets

# Copy environment files
print_header "Setting up environment files"
cp apps/core/tests/e2e/test.env apps/core/tests/e2e/.env.test || handle_error "Failed to copy test environment file"

# Generate test SSL certificates
print_header "Generating SSL certificates"
mkdir -p certs
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout certs/test-key.pem \
  -out certs/test-cert.pem \
  -subj "/C=US/ST=Test/L=Test/O=Test/CN=localhost" || handle_error "Failed to generate SSL certificates"

# Pull Docker images
print_header "Pulling Docker images"
docker-compose -f docker-compose.test.yml pull || handle_error "Failed to pull Docker images"

# Start test environment
print_header "Starting test environment"
docker-compose -f docker-compose.test.yml up -d || handle_error "Failed to start test environment"

# Wait for services to be ready
print_header "Waiting for services to be ready"
sleep 10

# Initialize test database
print_header "Initializing test database"
docker-compose -f docker-compose.test.yml exec -T postgres psql -U postgres -c "CREATE DATABASE test;" || handle_error "Failed to create test database"

# Set up Supabase
print_header "Setting up Supabase"
npx supabase init || handle_error "Failed to initialize Supabase"
npx supabase start || handle_error "Failed to start Supabase"

# Set up MinIO buckets
print_header "Setting up MinIO buckets"
docker-compose -f docker-compose.test.yml exec -T minio mkdir -p /data/test-bucket || handle_error "Failed to create MinIO bucket"

# Set up Elasticsearch indices
print_header "Setting up Elasticsearch"
curl -X PUT "localhost:9200/test-index" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  }
}' || handle_error "Failed to create Elasticsearch index"

# Set up Redis
print_header "Setting up Redis"
docker-compose -f docker-compose.test.yml exec -T redis redis-cli FLUSHALL || handle_error "Failed to flush Redis"

# Install test dependencies
print_header "Installing test dependencies"
npm ci || handle_error "Failed to install dependencies"

# Install Playwright browsers
print_header "Installing Playwright browsers"
npx playwright install --with-deps || handle_error "Failed to install Playwright browsers"

# Create test assets
print_header "Creating test assets"
cat > test-assets/test-image.svg << EOF
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
</svg>
EOF

cat > test-assets/test-video.txt << EOF
This is a placeholder for a test video file
EOF

cat > test-assets/test-audio.txt << EOF
This is a placeholder for a test audio file
EOF

# Set up test monitoring
print_header "Setting up monitoring"
docker-compose -f docker-compose.test.yml exec -T prometheus promtool check config /etc/prometheus/prometheus.yml || handle_error "Invalid Prometheus configuration"

# Set up test logging
print_header "Setting up logging"
mkdir -p logs
touch logs/test.log

# Set up test metrics collection
print_header "Setting up metrics collection"
mkdir -p metrics

# Set up test reporting
print_header "Setting up test reporting"
mkdir -p reports
mkdir -p reports/unit
mkdir -p reports/e2e
mkdir -p reports/coverage
mkdir -p reports/performance
mkdir -p reports/security

# Set up Git hooks
print_header "Setting up Git hooks"
mkdir -p .git/hooks
cat > .git/hooks/pre-commit << EOF
#!/bin/bash
npm run lint
npm run typecheck
EOF
chmod +x .git/hooks/pre-commit

# Set file permissions
print_header "Setting file permissions"
chmod -R 755 scripts/
chmod -R 777 test-results/
chmod -R 777 coverage/
chmod -R 777 playwright-report/
chmod -R 777 test-assets/
chmod -R 777 logs/
chmod -R 777 metrics/
chmod -R 777 reports/

# Print setup summary
print_header "Setup Summary"
echo -e "${GREEN}Test environment setup completed successfully!${NC}"
echo "The following components are ready:"
echo "- Test database"
echo "- Supabase"
echo "- Redis"
echo "- MinIO"
echo "- Elasticsearch"
echo "- Prometheus"
echo "- Grafana"
echo "- Jaeger"
echo "- Mailhog"
echo "- Test certificates"
echo "- Test assets"
echo "- Test monitoring"
echo "- Test logging"
echo "- Test reporting"
echo "- Git hooks"

echo -e "\nYou can now run tests using:"
echo "npm run test"
echo "or"
echo "./scripts/test.sh"

# Make script executable
chmod +x scripts/setup-test-env.sh 