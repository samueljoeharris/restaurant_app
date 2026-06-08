variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type    = string
  default = "ttf-api"
}

variable "image" {
  type        = string
  description = "Container image URI (placeholder until API image is pushed)"
}

variable "service_account_email" {
  type = string
}

variable "cloud_sql_connection_name" {
  type        = string
  description = "Cloud SQL instance connection name"
}

variable "database_url_secret_id" {
  type        = string
  description = "Secret Manager secret ID for DATABASE_URL"
}

variable "invoker_members" {
  type        = list(string)
  description = "IAM members allowed to invoke Cloud Run (public: allUsers)"
  default     = ["allUsers"]
}
