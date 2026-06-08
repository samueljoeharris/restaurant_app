variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "uploads_bucket_name" {
  type        = string
  description = "Globally unique GCS bucket for TTF photo uploads"
}

variable "terraform_state_bucket_name" {
  type        = string
  description = "GCS bucket for Terraform remote state (from bootstrap output)"
  default     = "ttf-tfstate-dev"
}

variable "github_repository" {
  type        = string
  description = "GitHub repo allowed for Workload Identity Federation (owner/repo)"
  default     = "samueljoeharris/restaurant_app"
}

variable "enable_cloud_sql" {
  type        = bool
  description = "Phase B: provision Cloud SQL (~$7-10/mo). Keep false until API deploy."
  default     = false
}

variable "enable_cloud_run" {
  type        = bool
  description = "Phase B: deploy Cloud Run ttf-api. Requires enable_cloud_sql = true."
  default     = false

  validation {
    condition     = !var.enable_cloud_run || var.enable_cloud_sql
    error_message = "enable_cloud_run requires enable_cloud_sql = true."
  }
}

variable "api_image" {
  type        = string
  description = "Phase B: Cloud Run container image URI"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "enable_web_cloud_run" {
  type        = bool
  description = "Deploy static web POC (ttf-web) on Cloud Run. Requires enable_cloud_run."
  default     = true

  validation {
    condition     = !var.enable_web_cloud_run || var.enable_cloud_run
    error_message = "enable_web_cloud_run requires enable_cloud_run = true."
  }
}

variable "web_image" {
  type        = string
  description = "Cloud Run container image URI for ttf-web"
  default     = "us-docker.pkg.dev/cloudrun/container/hello"
}

variable "cloud_sql_tier" {
  type    = string
  default = "db-f1-micro"
}

variable "enable_billing_budget" {
  type    = bool
  default = false
}

variable "billing_account_id" {
  type        = string
  description = "Billing account ID (XXXXXX-XXXXXX-XXXXXX) for budget alerts"
  default     = ""
}

variable "budget_amount_usd" {
  type    = number
  default = 50
}

variable "labels" {
  type = map(string)
  default = {
    app         = "ttf"
    environment = "dev"
    managed_by  = "terraform"
  }
}

variable "enable_firebase_web" {
  type        = bool
  description = "Provision Firebase project binding + Web app for browser SDK (web/)"
  default     = true
}

variable "firebase_web_app_display_name" {
  type    = string
  default = "TTF Web"
}

variable "enable_google_sign_in" {
  type        = bool
  description = "Sign in with Google (requires OAuth client in tfvars or Console)"
  default     = true
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth 2.0 Web client ID for Google sign-in (optional in ci.tfvars)"
  default     = ""
}

variable "google_oauth_client_secret" {
  type        = string
  description = "OAuth client secret for Google sign-in"
  default     = ""
  sensitive   = true
}

variable "firebase_mfa_state" {
  type        = string
  description = "Firebase MFA: DISABLED | ENABLED (opt-in) | MANDATORY"
  default     = "DISABLED"
}

variable "app_check_recaptcha_site_key" {
  type        = string
  description = "reCAPTCHA Enterprise site key for Firebase App Check (web). Leave empty to skip App Check until configured."
  default     = ""
}

variable "firebase_admin_sa_configured" {
  type        = bool
  description = "Set true after api/scripts/upload_firebase_admin_sa.sh uploads ttf-firebase-admin-sa"
  default     = false
}
