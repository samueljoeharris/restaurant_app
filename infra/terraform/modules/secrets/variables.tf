variable "project_id" {
  type = string
}

variable "environment" {
  type        = string
  description = "dev or prod — applied as label environment on every secret"
  default     = "dev"

  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be dev or prod."
  }
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret IDs to create (must exist in catalog.tf)"
}

variable "create_placeholders" {
  type        = bool
  description = "Create placeholder secret versions for catalog entries with placeholder_data (dev optional secrets)"
  default     = false
}
