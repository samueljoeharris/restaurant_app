variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "service_name" {
  type    = string
  default = "ttf-web"
}

variable "image" {
  type        = string
  description = "Initial container image URI (updates via web.yml after first deploy)"
}

variable "service_account_email" {
  type = string
}

variable "ingress" {
  type        = string
  description = "Cloud Run ingress setting (use INTERNAL_LOAD_BALANCER when fronted by HTTPS LB + IAP)"
  default     = "INGRESS_TRAFFIC_ALL"
}

variable "invoker_members" {
  type        = list(string)
  description = "IAM members allowed to invoke Cloud Run (public: allUsers). Empty when IAP SA is granted separately."
  default     = ["allUsers"]
}

variable "container_env" {
  type        = map(string)
  description = "Plain environment variables for the container"
  default     = {}
}

variable "secret_env" {
  type = map(object({
    secret  = string
    version = string
  }))
  description = "Secret Manager env vars (secret id + version)"
  default     = {}
}
