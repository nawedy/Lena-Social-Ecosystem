variable "project_id" {
  description = "The ID of the GCP project"
  type        = string
}

variable "region" {
  description = "The region to deploy resources to"
  type        = string
  default     = "us-central1"
}

variable "zone" {
  description = "The zone to deploy resources to"
  type        = string
  default     = "us-central1-a"
}

variable "app_image" {
  description = "The Docker image to deploy to Cloud Run"
  type        = string
}

variable "alert_email" {
  description = "Email address to send monitoring alerts to"
  type        = string
}

variable "db_tier" {
  description = "The machine type to use for the database"
  type        = string
  default     = "db-f1-micro"
}

variable "min_instances" {
  description = "Minimum number of instances to run"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances to run"
  type        = number
  default     = 10
}
