# Static web POC on Cloud Run (nginx + Vite build from web.yml).

module "cloud_run_web" {
  count  = var.enable_web_cloud_run ? 1 : 0
  source = "../../modules/cloud-run-static"

  project_id            = var.project_id
  region                = var.region
  image                 = var.web_image
  service_account_email = module.iam.api_runtime_email

  depends_on = [
    module.iam,
    google_artifact_registry_repository_iam_member.api_runtime_reader,
  ]
}
