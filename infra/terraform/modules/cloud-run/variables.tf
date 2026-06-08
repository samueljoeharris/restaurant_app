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
  description = "Initial container image URI (updates via api.yml after first deploy)"
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

variable "container_env" {
  type        = map(string)
  description = "Plain env vars for the API container"
  default     = {}
}

variable "invoker_members" {
  type        = list(string)
  description = "IAM members allowed to invoke Cloud Run (public: allUsers)"
  default     = ["allUsers"]
}
