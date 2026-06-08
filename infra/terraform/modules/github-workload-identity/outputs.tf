output "workload_identity_provider" {
  description = "Full provider resource name for google-github-actions/auth"
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "pool_name" {
  value = google_iam_workload_identity_pool.github.name
}
