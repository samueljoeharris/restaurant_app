# Phase B — Cloud SQL + Cloud Run (enable when API is ready to deploy).
# Set enable_cloud_sql = true and enable_cloud_run = true in terraform.tfvars.

module "cloud_sql" {
  count  = var.enable_cloud_sql ? 1 : 0
  source = "../../modules/cloud-sql"

  project_id          = var.project_id
  region              = var.region
  tier                = var.cloud_sql_tier
  deletion_protection = var.deletion_protection

  depends_on = [module.project_services]
}

resource "google_secret_manager_secret_version" "db_url" {
  count = var.enable_cloud_sql ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-db-url"]
  secret_data = local.database_url

  depends_on = [module.cloud_sql, module.secrets]
}

locals {
  api_file_secret_mounts = var.firebase_admin_sa_configured ? [
    {
      volume_name = "firebase-admin-sa"
      secret_name = module.secrets.secret_resource_names["ttf-firebase-admin-sa"]
      mount_path  = "/secrets/firebase-admin"
      file_name   = "firebase-sa.json"
    },
  ] : []

  api_secret_env = merge({
    MAPS_API_KEY = {
      secret  = "ttf-maps-api-key"
      version = "latest"
    }
    }, var.enable_restaurant_refresh_job ? {
    INTERNAL_JOB_SECRET = {
      secret  = "ttf-internal-job-secret"
      version = "latest"
    }
  } : {})

  api_container_env = merge({
    PILOT_CITY                = "dedham-ma"
    PILOT_DISPLAY_NAME        = "Dedham, Massachusetts"
    FIREBASE_PROJECT_ID       = var.project_id
    AUTH_DEV_MODE             = "false"
    TTF_DEPLOYED              = "true"
    APP_CHECK_ENFORCE         = var.app_check_recaptcha_site_key != "" ? "true" : "false"
    RATE_LIMIT_MAX_WRITES     = "60"
    RATE_LIMIT_WINDOW_MINUTES = "60"
    CORS_ORIGINS = jsonencode(compact(concat(
      var.enable_web_cloud_run ? [module.cloud_run_web[0].service_uri] : [],
      var.enable_custom_domains ? [local.web_origin, local.admin_origin] : [],
    )))
    }, merge(
    var.firebase_admin_sa_configured ? {
      FIREBASE_SERVICE_ACCOUNT_PATH = "/secrets/firebase-admin/firebase-sa.json"
    } : {},
    local.iap_oauth_enabled ? {
      IAP_ADMIN_BACKEND_SERVICE = local.admin_api_iap_backend_service_name
      GCP_PROJECT_NUMBER        = data.google_project.current.number
    } : {},
    var.enable_restaurant_refresh_job ? {
      RESTAURANT_SEED_PUBSUB_TOPIC     = local.restaurant_seed_topic_id
      GCP_REGION                       = var.region
      RESTAURANT_REFRESH_SCHEDULER_JOB = "ttf-restaurant-refresh-weekly"
    } : {},
  ))
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
  secret_env                = local.api_secret_env
  file_secret_mounts        = local.api_file_secret_mounts
  container_env             = local.api_container_env

  depends_on = [
    module.iam,
    module.cloud_sql,
    google_secret_manager_secret_version.db_url,
    google_artifact_registry_repository_iam_member.api_runtime_reader,
  ]
}

resource "google_cloud_scheduler_job" "restaurant_refresh" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  name        = "ttf-restaurant-refresh-weekly"
  project     = var.project_id
  region      = var.region
  description = "Enqueue weekly restaurant catalog refresh (reads location_refresh_config)"
  schedule    = "0 9 * * 1"
  time_zone   = "America/New_York"
  paused      = false

  lifecycle {
    ignore_changes = [
      schedule,
      time_zone,
      paused,
    ]
  }

  http_target {
    http_method = "POST"
    uri         = "${local.api_origin != "" ? local.api_origin : module.cloud_run[0].service_uri}/v1/internal/scheduled-restaurant-refresh"

    headers = {
      X-Internal-Job-Token = random_password.internal_job_secret[0].result
    }
  }

  depends_on = [
    module.iam,
    module.cloud_run,
    google_secret_manager_secret_version.internal_job_secret,
  ]
}

resource "google_secret_manager_secret_version" "internal_job_secret" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-internal-job-secret"]
  secret_data = random_password.internal_job_secret[0].result

  depends_on = [module.secrets]
}

resource "random_password" "internal_job_secret" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  length  = 32
  special = false
}
