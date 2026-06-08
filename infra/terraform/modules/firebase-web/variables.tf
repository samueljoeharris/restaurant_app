variable "project_id" {
  type = string
}

variable "web_app_display_name" {
  type        = string
  description = "Display name for the Firebase Web app (browser SDK)"
  default     = "TTF Web"
}
