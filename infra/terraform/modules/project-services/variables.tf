variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "services" {
  type        = list(string)
  description = "APIs to enable on the project"
}
