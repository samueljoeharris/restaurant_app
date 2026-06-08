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

variable "invoker_members" {
  type        = list(string)
  description = "IAM members allowed to invoke Cloud Run (public: allUsers)"
  default     = ["allUsers"]
}
