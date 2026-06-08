output "state_bucket_name" {
  value = google_storage_bucket.terraform_state.name
}

output "backend_config_snippet" {
  description = "Paste into environments/dev/backend.tf after bootstrap"
  value       = <<-EOT
    terraform {
      backend "gcs" {
        bucket = "${google_storage_bucket.terraform_state.name}"
        prefix = "dev"
      }
    }
  EOT
}
