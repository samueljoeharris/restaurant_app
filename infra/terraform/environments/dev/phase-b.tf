# Phase B — Cloud SQL + Cloud Run (enable when API is ready to deploy).
# Set enable_cloud_sql = true and enable_cloud_run = true in terraform.tfvars.
#
# Cost: Cloud SQL db-f1-micro ~$7-10/mo. Cloud Run scales to zero when idle.

module "cloud_sql" {
  count  = var.enable_cloud_sql ? 1 : 0
  source = "../../modules/cloud-sql"

  project_id = var.project_id
  region     = var.region
  tier       = var.cloud_sql_tier

  depends_on = [module.project_services]
}

resource "google_secret_manager_secret_version" "db_url" {
  count = var.enable_cloud_sql ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-db-url"]
  secret_data = local.database_url

  depends_on = [module.cloud_sql, module.secrets]
}

module "cloud_run" {
  count  = var.enable_cloud_run ? 1 : 0
  source = "../../modules/cloud-run"

  project_id                = var.project_id
  region                    = var.region
  image                     = var.api_image
  service_account_email     = module.iam.api_runtime_email
  cloud_sql_connection_name = module.cloud_sql[0].connection_name
  database_url_secret_id    = "ttf-db-url"
  container_env = {
    PILOT_CITY          = "dedham-ma"
    PILOT_DISPLAY_NAME  = "Dedham, Massachusetts"
    FIREBASE_PROJECT_ID = var.project_id
    AUTH_DEV_MODE       = "false"
    CORS_ORIGINS = jsonencode(concat(
      ["http://localhost:5173", "http://localhost:3000"],
      var.enable_web_cloud_run ? [module.cloud_run_web[0].service_uri] : [],
    ))
  }

  depends_on = concat(
    [
      module.iam,
      module.cloud_sql,
      google_secret_manager_secret_version.db_url,
      google_artifact_registry_repository_iam_member.api_runtime_reader,
    ],
    var.enable_web_cloud_run ? [module.cloud_run_web[0]] : [],
  )
}
