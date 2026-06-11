# Operator intranet + admin console — separate from public pilot web (ttf-web).

module "cloud_run_admin" {
  count  = var.enable_admin_cloud_run ? 1 : 0
  source = "../../modules/cloud-run-static"

  project_id            = var.project_id
  region                = var.region
  service_name          = "ttf-admin-web"
  image                 = var.admin_web_image
  service_account_email = module.iam.api_runtime_email

  depends_on = [
    module.iam,
    google_artifact_registry_repository_iam_member.api_runtime_reader,
  ]
}
