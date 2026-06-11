locals {
  # Phase A — foundation only (no monthly compute cost)
  phase_a_apis = [
    "secretmanager.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    # Firebase Web SDK + Auth (browser sign-in)
    "firebase.googleapis.com",
    "identitytoolkit.googleapis.com",
    "recaptchaenterprise.googleapis.com",
    # Maps Platform — server key (Places/Geocoding) value in ttf-maps-api-key; web key via maps-web.tf
    "geocoding-backend.googleapis.com",
    "places.googleapis.com",
    "maps-backend.googleapis.com",
    "apikeys.googleapis.com",
  ]

  # Phase B — enable when deploying API + Cloud SQL (see phase-b.tf)
  phase_b_apis = [
    "run.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "cloudscheduler.googleapis.com",
  ]

  # Custom domains — global HTTPS load balancer + managed certs
  custom_domain_apis = [
    "compute.googleapis.com",
    "iap.googleapis.com",
  ]

  required_apis = concat(
    local.phase_a_apis,
    var.enable_cloud_sql || var.enable_cloud_run ? local.phase_b_apis : [],
    var.enable_custom_domains ? local.custom_domain_apis : [],
  )

  secret_ids = concat(
    var.enable_cloud_sql ? ["ttf-db-url"] : [],
    ["ttf-maps-api-key"],
    var.enable_web_cloud_run ? ["ttf-maps-web-api-key"] : [],
    var.enable_firebase_web ? ["ttf-firebase-web-env", "ttf-recaptcha-site-key"] : [],
    var.enable_cloud_run ? ["ttf-firebase-admin-sa"] : [],
    var.enable_custom_domains ? ["ttf-api-public-url", "ttf-web-public-url"] : [],
    var.enable_custom_domains && var.enable_admin_cloud_run ? ["ttf-admin-public-url"] : [],
    var.enable_custom_domains && var.enable_admin_cloud_run && var.enable_admin_iap ? ["ttf-iap-oauth"] : [],
  )

  database_url = var.enable_cloud_sql ? format(
    "postgresql://%s:%s@/%s?host=/cloudsql/%s",
    module.cloud_sql[0].database_user,
    module.cloud_sql[0].database_password,
    module.cloud_sql[0].database_name,
    module.cloud_sql[0].connection_name,
  ) : null
}

module "project_services" {
  source = "../../modules/project-services"

  project_id = var.project_id
  services   = local.required_apis
}

module "artifact_registry" {
  source = "../../modules/artifact-registry"

  project_id = var.project_id
  region     = var.region

  depends_on = [module.project_services]
}

module "storage" {
  source = "../../modules/storage"

  project_id  = var.project_id
  region      = var.region
  bucket_name = var.uploads_bucket_name

  depends_on = [module.project_services]
}

module "secrets" {
  source = "../../modules/secrets"

  project_id = var.project_id
  secret_ids = local.secret_ids

  depends_on = [module.project_services]
}

module "iam" {
  source = "../../modules/iam"

  project_id          = var.project_id
  uploads_bucket_name = module.storage.bucket_name
  enable_cloud_sql    = var.enable_cloud_sql
  enable_cloud_run    = var.enable_cloud_run
  enable_admin_iap    = var.enable_admin_iap

  depends_on = [module.storage]
}

resource "google_artifact_registry_repository_iam_member" "github_deploy_writer" {
  project    = var.project_id
  location   = var.region
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${module.iam.github_deploy_email}"
}

resource "google_artifact_registry_repository_iam_member" "api_runtime_reader" {
  count = var.enable_cloud_run ? 1 : 0

  project    = var.project_id
  location   = var.region
  repository = module.artifact_registry.repository_id
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.iam.api_runtime_email}"
}

resource "google_storage_bucket_iam_member" "github_terraform_state" {
  bucket = var.terraform_state_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${module.iam.github_terraform_email}"
}

module "github_workload_identity" {
  source = "../../modules/github-workload-identity"

  project_id        = var.project_id
  github_repository = var.github_repository
  wif_service_account_ids = [
    module.iam.github_terraform_sa_name,
    module.iam.github_deploy_sa_name,
  ]

  depends_on = [module.iam, module.project_services]
}

resource "google_billing_budget" "dev" {
  count = var.enable_billing_budget && var.billing_account_id != "" ? 1 : 0

  billing_account = var.billing_account_id
  display_name    = "ttf-dev-budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.budget_amount_usd)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }

  threshold_rules {
    threshold_percent = 1.0
  }
}
