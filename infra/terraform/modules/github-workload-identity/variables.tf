variable "project_id" {
  type = string
}

variable "github_repository" {
  type        = string
  description = "GitHub repo allowed to impersonate the Terraform SA (owner/repo)"
}

variable "wif_service_account_ids" {
  type        = list(string)
  description = "google_service_account.name values GitHub Actions may impersonate via WIF"
}

variable "pool_id" {
  type    = string
  default = "ttf-github"
}

variable "provider_id" {
  type    = string
  default = "github"
}
