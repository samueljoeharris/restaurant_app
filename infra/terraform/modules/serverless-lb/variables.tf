variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "name_prefix" {
  type        = string
  description = "Prefix for LB resource names (e.g. ttf-dev)"
}

variable "ssl_domains" {
  type        = list(string)
  description = "Hostnames on the Google-managed certificate"
}

variable "backends" {
  type = map(object({
    cloud_run_service = string
    enable_iap        = optional(bool, false)
  }))
  description = "Named backends (keys become path matcher names)"
}

variable "host_routes" {
  type = list(object({
    hostname    = string
    backend_key = string
  }))
  description = "Hostname → backend_key routing"
}

variable "default_backend_key" {
  type        = string
  description = "Backend used when no host rule matches"
}

variable "iap_oauth_client_id" {
  type        = string
  description = "IAP OAuth client ID (required when any backend has enable_iap)"
  default     = ""
}

variable "iap_oauth_client_secret" {
  type        = string
  description = "IAP OAuth client secret"
  default     = ""
  sensitive   = true
}
