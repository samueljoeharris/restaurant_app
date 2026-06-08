variable "project_id" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "GitHub repo allowed to impersonate the Terraform SA (owner/repo)"
}

variable "terraform_service_account_id" {
  type        = string
  description = "google_service_account.name for the Terraform CI service account"
}

variable "pool_id" {
  type    = string
  default = "ttf-github"
}

variable "provider_id" {
  type    = string
  default = "github"
}
