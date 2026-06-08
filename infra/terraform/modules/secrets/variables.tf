variable "project_id" {
  type = string
}

variable "secret_ids" {
  type        = list(string)
  description = "Secret Manager secret IDs to create (containers only)"
}
