variable "project_id" {
  type        = string
  description = "GCP project ID (must already exist)"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "state_bucket_name" {
  type        = string
  description = "Globally unique GCS bucket for Terraform remote state"
  default     = "ttf-tfstate-dev"
}

variable "terraform_admin_email" {
  type        = string
  description = "Your Google account email for state bucket access"
}
