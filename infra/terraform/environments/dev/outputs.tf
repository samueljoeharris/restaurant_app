output "phase" {
  value = var.enable_cloud_sql || var.enable_cloud_run ? "B" : "A"
}

output "project_id" {
  value = var.project_id
}

output "uploads_bucket" {
  value = module.storage.bucket_name
}

output "artifact_registry_url" {
  value = module.artifact_registry.repository_url
}

output "api_runtime_service_account" {
  value = module.iam.api_runtime_email
}

output "github_deploy_service_account" {
  description = "Set as GitHub repository variable GCP_DEPLOY_SERVICE_ACCOUNT"
  value       = module.iam.github_deploy_email
}

output "github_terraform_service_account" {
  value = module.iam.github_terraform_email
}

output "github_workload_identity_provider" {
  description = "Set as GitHub repository variable GCP_WORKLOAD_IDENTITY_PROVIDER"
  value       = module.github_workload_identity.workload_identity_provider
}

output "api_image_target" {
  description = "Push API image here when ready (Phase B)"
  value       = "${module.artifact_registry.repository_url}/ttf-api"
}

output "cloud_run_url" {
  description = "Phase B only"
  value       = var.enable_cloud_run ? module.cloud_run[0].service_uri : null
}

output "cloud_sql_connection_name" {
  description = "Phase B only"
  value       = var.enable_cloud_sql ? module.cloud_sql[0].connection_name : null
}

output "cloud_sql_public_ip" {
  description = "Phase B only"
  value       = var.enable_cloud_sql ? module.cloud_sql[0].public_ip : null
}

output "firebase_web_env" {
  description = "Copy into web/.env.local (VITE_FIREBASE_*)"
  value       = var.enable_firebase_web ? module.firebase_web[0].web_env : null
}

output "firebase_web_app_id" {
  description = "Firebase Web app ID"
  value       = var.enable_firebase_web ? module.firebase_web[0].app_id : null
}
