variable "project_id" {
  type = string
}

variable "api_runtime_sa_id" {
  type    = string
  default = "ttf-api-runtime"
}

variable "github_deploy_sa_id" {
  type    = string
  default = "ttf-github-deploy"
}

variable "github_terraform_sa_id" {
  type    = string
  default = "ttf-github-terraform"
}

variable "uploads_bucket_name" {
  type = string
}

variable "enable_cloud_sql" {
  type        = bool
  description = "Grant Cloud SQL client role to API runtime SA (Phase B)"
  default     = false
}

variable "enable_cloud_run" {
  type        = bool
  description = "Grant Firebase Auth admin to API runtime SA (Phase B)"
  default     = false
}

variable "enable_admin_iap" {
  type        = bool
  description = "Grant compute.viewer so API can resolve IAP JWT audience"
  default     = false
}
