#!/bin/bash
set -e

# Set project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo "Please set a project ID using: gcloud config set project PROJECT_ID"
    exit 1
fi

# Enable required APIs
echo "Enabling required GCP APIs..."
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    sql-component.googleapis.com \
    sqladmin.googleapis.com \
    storage.googleapis.com \
    monitoring.googleapis.com \
    logging.googleapis.com \
    cloudtrace.googleapis.com

# Apply configurations directly with gcloud
echo "Setting up Cloud SQL..."
gcloud sql instances create tiktoktoe-db \
    --database-version=POSTGRES_14 \
    --region=us-central1 \
    --tier=db-f1-micro \
    --availability-type=regional \
    --backup-start-time=02:00 \
    --require-ssl \
    --storage-size=10GB \
    --storage-auto-increase

echo "Creating database..."
gcloud sql databases create tiktoktoe --instance=tiktoktoe-db

echo "Creating Cloud Storage buckets..."
gsutil mb -l us-central1 gs://tiktoktoe-media
gsutil mb -l us-central1 gs://tiktoktoe-backups

echo "Configuring bucket properties..."
gsutil uniformbucketlevelaccess set on gs://tiktoktoe-media
gsutil cors set config/gcp/cors.json gs://tiktoktoe-media

echo "Creating service account..."
gcloud iam service-accounts create tiktoktoe-sa \
    --display-name="TikTokToe Service Account"

echo "Granting permissions..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:tiktoktoe-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/cloudsql.client"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:tiktoktoe-sa@$PROJECT_ID.iam.gserviceaccount.com" \
    --role="roles/storage.objectViewer"

echo "Setting up Cloud Run..."
gcloud run deploy tiktoktoe \
    --image=gcr.io/$PROJECT_ID/tiktoktoe:latest \
    --platform=managed \
    --region=us-central1 \
    --service-account=tiktoktoe-sa@$PROJECT_ID.iam.gserviceaccount.com \
    --set-env-vars="NODE_ENV=production,STORAGE_BUCKET=tiktoktoe-media" \
    --allow-unauthenticated

echo "Setting up monitoring..."
gcloud monitoring channels create \
    --display-name="TikTokToe Alerts" \
    --type=email \
    --channel-labels=email_address=alerts@tiktoktoe.com

echo "GCP setup completed successfully!"
