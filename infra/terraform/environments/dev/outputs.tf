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

output "cloud_run_web_url" {
  description = "Web POC on Cloud Run"
  value       = var.enable_web_cloud_run ? module.cloud_run_web[0].service_uri : null
}

output "web_image_target" {
  description = "Push web image here (web.yml)"
  value       = "${module.artifact_registry.repository_url}/ttf-web"
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

output "dns_hostnames" {
  description = "Custom domain hostnames (dev segment)"
  value = var.enable_custom_domains ? {
    web   = local.web_fqdn
    api   = local.api_fqdn
    admin = var.enable_admin_cloud_run ? local.admin_fqdn : null
  } : null
}

output "load_balancer_ip" {
  description = "GoDaddy A record target for app.dev / api.dev / admin.dev"
  value       = var.enable_custom_domains && var.enable_cloud_run ? module.serverless_lb[0].lb_ip_address : null
}

output "godaddy_dns_records" {
  description = "Create these A records in GoDaddy DNS (see docs/LITTLESCOUT_DOMAIN.md)"
  value = var.enable_custom_domains && var.enable_cloud_run ? [
    for host in local.custom_domain_hostnames : {
      type  = "A"
      name  = replace(host, ".${local.dns_base}", "")
      value = module.serverless_lb[0].lb_ip_address
      ttl   = 600
    }
  ] : null
}

output "cloud_run_admin_url" {
  description = "Admin intranet (run.app until DNS + LB ready)"
  value       = var.enable_admin_cloud_run ? module.cloud_run_admin[0].service_uri : null
}

output "admin_iap_enabled" {
  description = "Whether IAP protects the admin load balancer backend"
  value       = var.enable_custom_domains && var.enable_admin_cloud_run && var.enable_admin_iap
}

output "iap_oauth_configured" {
  description = "Whether IAP OAuth client credentials are loaded (ttf-iap-oauth secret or TF_VAR bootstrap)"
  value       = local.iap_oauth_enabled && local.iap_oauth_client_id_effective != ""
  sensitive   = false
}

output "public_urls" {
  description = "Canonical HTTPS origins after DNS cutover"
  value = var.enable_custom_domains ? {
    web   = local.web_origin
    api   = local.api_origin
    admin = var.enable_admin_cloud_run ? local.admin_origin : null
  } : null
}
