variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_name" {
  type    = string
  default = "ttf-db"
}

variable "database_name" {
  type    = string
  default = "ttf"
}

variable "database_user" {
  type    = string
  default = "ttf_app"
}

variable "tier" {
  type        = string
  description = "Cloud SQL machine tier"
  default     = "db-f1-micro"
}

variable "deletion_protection" {
  type    = bool
  default = false
}
