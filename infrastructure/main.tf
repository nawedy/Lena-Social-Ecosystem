terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
  backend "gcs" {
    bucket = "tiktok-toe-terraform-state"
    prefix = "terraform/state"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

# Cloud SQL Instance
resource "google_sql_database_instance" "main" {
  name             = "tiktok-toe-db"
  database_version = "POSTGRES_14"
  region           = var.region

  settings {
    tier = var.db_tier

    backup_configuration {
      enabled = true
      start_time = "02:00"  # UTC time
    }

    ip_configuration {
      ipv4_enabled = true
      require_ssl  = true
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM UTC
      update_track = "stable"
    }
  }

  deletion_protection = true  # Prevent accidental deletion
}

# Cloud SQL Database
resource "google_sql_database" "database" {
  name     = "tiktok_toe_db"
  instance = google_sql_database_instance.main.name
}

# Cloud Storage Buckets
resource "google_storage_bucket" "media" {
  name          = "tiktok-toe-media-${var.project_id}"
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 30  # Days
    }
    action {
      type = "SetStorageClass"
      storage_class = "NEARLINE"
    }
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD", "PUT", "POST", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }
}

# Cloud Logging Metrics
resource "google_logging_metric" "error_rate" {
  name    = "error_rate"
  filter  = "resource.type=\"cloud_run_revision\" severity>=ERROR"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}

resource "google_logging_metric" "request_latency" {
  name            = "request_latency"
  filter          = "resource.type=\"cloud_run_revision\" httpRequest.latency"
  value_extractor = "EXTRACT(httpRequest.latency)"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
  }
  bucket_options {
    explicit_buckets {
      bounds = [50, 100, 200, 400, 800, 1600, 3200]
    }
  }
}

# Cloud Monitoring Dashboard
resource "google_monitoring_dashboard" "dashboard" {
  dashboard_json = jsonencode({
    displayName = "TikTokToe Application Dashboard"
    gridLayout = {
      columns = 2
      widgets = [
        {
          title = "Error Rate"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/error_rate\" resource.type=\"cloud_run_revision\""
                }
              }
            }]
          }
        },
        {
          title = "Request Latency"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"logging.googleapis.com/user/request_latency\" resource.type=\"cloud_run_revision\""
                }
              }
            }]
          }
        },
        {
          title = "Database Connections"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\" resource.type=\"cloudsql_database\""
                }
              }
            }]
          }
        },
        {
          title = "Storage Usage"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"storage.googleapis.com/storage/total_bytes\" resource.type=\"gcs_bucket\""
                }
              }
            }]
          }
        }
      ]
    }
  })
}

# Cloud Monitoring Alert Policies
resource "google_monitoring_alert_policy" "high_error_rate" {
  display_name = "High Error Rate Alert"
  combiner     = "OR"
  conditions {
    display_name = "Error rate > 5%"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/error_rate\" resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 0.05
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.name]
}

resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "High Latency Alert"
  combiner     = "OR"
  conditions {
    display_name = "Request latency > 1s"
    condition_threshold {
      filter          = "metric.type=\"logging.googleapis.com/user/request_latency\" resource.type=\"cloud_run_revision\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 1000
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_99"
      }
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.name]
}

resource "google_monitoring_alert_policy" "database_connections" {
  display_name = "High Database Connections"
  combiner     = "OR"
  conditions {
    display_name = "Database connections > 80% capacity"
    condition_threshold {
      filter          = "metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\" resource.type=\"cloudsql_database\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 80
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.name]
}

resource "google_monitoring_alert_policy" "storage_usage" {
  display_name = "High Storage Usage"
  combiner     = "OR"
  conditions {
    display_name = "Storage usage > 80% capacity"
    condition_threshold {
      filter          = "metric.type=\"storage.googleapis.com/storage/total_bytes\" resource.type=\"gcs_bucket\""
      duration        = "300s"
      comparison     = "COMPARISON_GT"
      threshold_value = 85899345920  # 80GB in bytes
      trigger {
        count = 1
      }
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.name]
}

# Uptime Check
resource "google_monitoring_uptime_check_config" "app_health" {
  display_name = "TikTokToe App Health Check"
  timeout      = "10s"
  period      = "60s"

  http_check {
    path           = "/health"
    port           = "443"
    use_ssl        = true
    validate_ssl   = true
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      host = google_cloud_run_service.app.status[0].url
    }
  }

  content_matchers {
    content = "ok"
    matcher = "CONTAINS_STRING"
  }
}

# Notification Channel
resource "google_monitoring_notification_channel" "email" {
  display_name = "Email Notification Channel"
  type         = "email"
  labels = {
    email_address = var.alert_email
  }
}

# Cloud Pub/Sub Topic for Application Logs
resource "google_pubsub_topic" "app_logs" {
  name = "app-logs"
}

# Subscription for Processing Application Logs
resource "google_pubsub_subscription" "log_subscription" {
  name  = "log-subscription"
  topic = google_pubsub_topic.app_logs.name

  ack_deadline_seconds = 20

  expiration_policy {
    ttl = "604800s"  # 7 days
  }

  retry_policy {
    minimum_backoff = "10s"
  }
}

# IAM roles for service accounts
resource "google_service_account" "app_service_account" {
  account_id   = "tiktok-toe-app"
  display_name = "TikTokToe Application Service Account"
}

resource "google_project_iam_member" "storage_admin" {
  project = var.project_id
  role    = "roles/storage.admin"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app_service_account.email}"
}

# Cloud Run service
resource "google_cloud_run_service" "app" {
  name     = "tiktok-toe-app"
  location = var.region

  template {
    spec {
      containers {
        image = var.app_image

        env {
          name  = "DB_HOST"
          value = google_sql_database_instance.main.connection_name
        }

        env {
          name  = "DB_NAME"
          value = google_sql_database.database.name
        }

        env {
          name  = "STORAGE_BUCKET"
          value = google_storage_bucket.media.name
        }

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }
      }

      service_account_name = google_service_account.app_service_account.email
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = var.min_instances
        "autoscaling.knative.dev/maxScale" = var.max_instances
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}
