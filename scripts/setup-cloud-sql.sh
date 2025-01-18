#!/bin/bash
set -e

# Load environment variables
source .env

# Set variables
PROJECT_ID=$GOOGLE_CLOUD_PROJECT
INSTANCE_NAME=$CLOUD_SQL_INSTANCE
REGION=$CLOUD_SQL_REGION
DB_NAME=$CLOUD_SQL_DATABASE
DB_USER=$CLOUD_SQL_USER
DB_TIER=$CLOUD_SQL_TIER

# Enable necessary APIs
gcloud services enable \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com \
  clouderrorreporting.googleapis.com \
  cloudtrace.googleapis.com

# Create Cloud SQL instance
echo "Creating Cloud SQL instance..."
gcloud sql instances create $INSTANCE_NAME \
  --database-version=POSTGRES_14 \
  --tier=$DB_TIER \
  --region=$REGION \
  --storage-type=SSD \
  --storage-size=10GB \
  --availability-type=zonal \
  --backup-start-time=23:00 \
  --maintenance-window-day=SUN \
  --maintenance-window-hour=00:00 \
  --database-flags=max_connections=100,shared_buffers=128MB

# Create database
echo "Creating database..."
gcloud sql databases create $DB_NAME --instance=$INSTANCE_NAME

# Create user
echo "Creating database user..."
DB_PASSWORD=$(openssl rand -base64 32)
gcloud sql users create $DB_USER \
  --instance=$INSTANCE_NAME \
  --password=$DB_PASSWORD

# Store password in Secret Manager
echo "Storing database password in Secret Manager..."
printf "%s" "$DB_PASSWORD" | gcloud secrets create cloud-sql-password \
  --data-file=- \
  --replication-policy="automatic"

# Grant necessary IAM roles
echo "Granting IAM roles..."
SERVICE_ACCOUNT="$PROJECT_ID@appspot.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/monitoring.metricWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/logging.logWriter"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/errorreporting.writer"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/cloudtrace.agent"

# Create necessary indexes for performance
echo "Running initial database migrations..."
npm run migrate

echo "Setup completed successfully!"
echo "Your Cloud SQL instance is ready to use."
echo "The database password has been stored in Secret Manager."
echo "Make sure to update your .env file with the correct connection details."
