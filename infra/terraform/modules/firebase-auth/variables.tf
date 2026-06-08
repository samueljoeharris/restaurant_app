variable "project_id" {
  type = string
}

variable "authorized_domains" {
  type        = list(string)
  description = "Hosts allowed to use Firebase Auth (OAuth redirects)"
}

variable "enable_google_sign_in" {
  type        = bool
  description = "Enable Sign in with Google (uses project OAuth client from Firebase/GCP)"
  default     = true
}

variable "google_oauth_client_id" {
  type        = string
  description = "OAuth client ID for google.com IdP (from GCP Credentials or Firebase Console)"
  default     = ""
}

variable "google_oauth_client_secret" {
  type        = string
  description = "OAuth client secret for google.com IdP"
  default     = ""
  sensitive   = true
}

variable "mfa_state" {
  type        = string
  description = "DISABLED, ENABLED (optional MFA), or MANDATORY"
  default     = "DISABLED"

  validation {
    condition     = contains(["DISABLED", "ENABLED", "MANDATORY"], var.mfa_state)
    error_message = "mfa_state must be DISABLED, ENABLED, or MANDATORY."
  }
}

