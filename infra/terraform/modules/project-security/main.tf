# Project-level security policies (org policy constraints on the GCP project).

variable "project_id" {
  type = string
}

variable "enable_sa_key_max_age_policy" {
  type        = bool
  description = "Enforce max age on service account JSON keys (iam.serviceAccountKeyExpiryHours)."
  default     = true
}

variable "sa_key_max_age_hours" {
  type        = number
  description = "Maximum validity for SA keys in hours (default 2160 = 90 days)."
  default     = 2160
}

resource "google_org_policy_policy" "sa_key_max_age" {
  count = var.enable_sa_key_max_age_policy ? 1 : 0

  name   = "projects/${var.project_id}/policies/iam.serviceAccountKeyExpiryHours"
  parent = "projects/${var.project_id}"

  spec {
    rules {
      enforce = true
      parameters = jsonencode({
        maxAge = "${var.sa_key_max_age_hours}h"
      })
    }
  }
}

output "sa_key_max_age_hours" {
  description = "Configured SA key max age (hours); rotate dev-sync key before expiry."
  value       = var.enable_sa_key_max_age_policy ? var.sa_key_max_age_hours : null
}
