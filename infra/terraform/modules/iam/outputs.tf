output "api_runtime_email" {
  value = google_service_account.api_runtime.email
}

output "github_deploy_email" {
  value = google_service_account.github_deploy.email
}

output "github_terraform_email" {
  value = google_service_account.github_terraform.email
}

output "github_terraform_sa_name" {
  description = "Full SA resource name for IAM bindings"
  value       = google_service_account.github_terraform.name
}
