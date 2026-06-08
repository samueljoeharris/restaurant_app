output "api_runtime_email" {
  value = google_service_account.api_runtime.email
}

output "github_deploy_email" {
  value = google_service_account.github_deploy.email
}
