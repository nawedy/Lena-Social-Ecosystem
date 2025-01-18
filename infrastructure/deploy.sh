#!/bin/bash
set -e

# Configuration
PROJECT_ID="tiktok-toe-87f4f"
REGION="us-central1"
APP_NAME="tiktok-toe"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Starting deployment for $APP_NAME...${NC}"

# Ensure gcloud is configured correctly
echo -e "${YELLOW}Configuring gcloud...${NC}"
gcloud config set project $PROJECT_ID
gcloud config set compute/region $REGION

# Enable required APIs
echo -e "${YELLOW}Enabling required GCP APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    cloudrun.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    monitoring.googleapis.com \
    logging.googleapis.com \
    storage.googleapis.com \
    pubsub.googleapis.com

# Create Cloud Storage bucket for Terraform state if it doesn't exist
echo -e "${YELLOW}Setting up Terraform state bucket...${NC}"
if ! gsutil ls gs://${APP_NAME}-terraform-state > /dev/null 2>&1; then
    gsutil mb -l $REGION gs://${APP_NAME}-terraform-state
    gsutil versioning set on gs://${APP_NAME}-terraform-state
fi

# Initialize Terraform
echo -e "${YELLOW}Initializing Terraform...${NC}"
terraform init \
    -backend-config="bucket=${APP_NAME}-terraform-state" \
    -backend-config="prefix=terraform/state"

# Create terraform.tfvars if it doesn't exist
if [ ! -f terraform.tfvars ]; then
    echo -e "${YELLOW}Creating terraform.tfvars...${NC}"
    cat > terraform.tfvars <<EOF
project_id = "$PROJECT_ID"
region     = "$REGION"
app_image  = "gcr.io/${PROJECT_ID}/${APP_NAME}:latest"
alert_email = "your-email@example.com"
EOF
fi

# Plan Terraform changes
echo -e "${YELLOW}Planning Terraform changes...${NC}"
terraform plan -out=tfplan

# Apply Terraform changes
echo -e "${YELLOW}Applying Terraform changes...${NC}"
terraform apply tfplan

# Get database connection info
echo -e "${YELLOW}Retrieving database connection information...${NC}"
DB_INSTANCE=$(terraform output -raw db_instance_name)
DB_NAME=$(terraform output -raw db_name)

# Set up Cloud SQL Proxy for database migrations
echo -e "${YELLOW}Setting up Cloud SQL Proxy...${NC}"
wget https://dl.google.com/cloudsql/cloud_sql_proxy_x64.linux
chmod +x cloud_sql_proxy_x64.linux
./cloud_sql_proxy_x64.linux -instances=${DB_INSTANCE}=tcp:5432 &
PROXY_PID=$!

# Wait for proxy to be ready
sleep 5

# Run database migrations
echo -e "${YELLOW}Running database migrations...${NC}"
DATABASE_URL="postgres://postgres:${DB_PASSWORD}@localhost:5432/${DB_NAME}" npm run migrate

# Clean up Cloud SQL Proxy
kill $PROXY_PID

# Set up monitoring
echo -e "${YELLOW}Setting up monitoring...${NC}"
# Create custom dashboard
gcloud monitoring dashboards create --dashboard-json-from-file=monitoring-dashboard.json

# Set up logging exports
echo -e "${YELLOW}Setting up log exports...${NC}"
gcloud logging sinks create app-logs \
    storage.googleapis.com/app-logs \
    --log-filter="resource.type=cloud_run_revision"

# Final configuration checks
echo -e "${YELLOW}Performing final configuration checks...${NC}"
gcloud run services describe $APP_NAME --region $REGION
gcloud sql instances describe $DB_INSTANCE
gsutil ls -L gs://${APP_NAME}-media-${PROJECT_ID}

echo -e "${GREEN}Deployment completed successfully!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Update your application with the new environment variables"
echo "2. Configure your CI/CD pipeline"
echo "3. Set up monitoring alerts in the Google Cloud Console"
echo "4. Review the security settings"
echo "5. Perform a test deployment"
