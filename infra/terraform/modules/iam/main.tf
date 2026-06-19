resource "google_service_account" "api_runtime" {
  project      = var.project_id
  account_id   = var.api_runtime_sa_id
  display_name = "TTF API runtime (Cloud Run)"
}

resource "google_service_account" "github_deploy" {
  project      = var.project_id
  account_id   = var.github_deploy_sa_id
  display_name = "TTF GitHub Actions deploy"
}

resource "google_service_account" "github_terraform" {
  project      = var.project_id
  account_id   = var.github_terraform_sa_id
  display_name = "TTF GitHub Actions Terraform (dev)"
}

# Terraform CI — manage Phase A/B resources in ttf-restaurant-dev
locals {
  github_terraform_roles = [
    "roles/serviceusage.serviceUsageAdmin",
    "roles/storage.admin",
    "roles/secretmanager.admin",
    "roles/artifactregistry.admin",
    "roles/iam.serviceAccountAdmin",
    "roles/iam.workloadIdentityPoolAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/cloudsql.admin",
    "roles/run.admin",
    "roles/cloudscheduler.admin",
    "roles/compute.networkAdmin",
    "roles/compute.loadBalancerAdmin",
    "roles/serviceusage.apiKeysAdmin",
    "roles/iap.admin",
    "roles/logging.viewer",
    "roles/pubsub.admin",
    # Org policies (e.g. SA key max age in project-security module)
    "roles/orgpolicy.policyAdmin",
    # Deploy Cloud Run services that run as ttf-api-runtime (actAs)
    "roles/iam.serviceAccountUser",
    # Firebase Web app + project management
    "roles/firebase.admin",
  ]
}

resource "google_project_iam_member" "github_terraform" {
  for_each = toset(local.github_terraform_roles)

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.github_terraform.email}"
}

resource "google_project_iam_member" "api_runtime_sql_client" {
  count = var.enable_cloud_sql ? 1 : 0

  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_project_iam_member" "api_runtime_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_project_iam_member" "api_runtime_scheduler_admin" {
  count = var.enable_restaurant_refresh_scheduler ? 1 : 0

  project = var.project_id
  role    = "roles/cloudscheduler.admin"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_project_iam_member" "api_runtime_compute_viewer" {
  count = var.enable_admin_iap ? 1 : 0

  project = var.project_id
  role    = "roles/compute.viewer"
  member  = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_storage_bucket_iam_member" "api_runtime_uploads_admin" {
  bucket = var.uploads_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.api_runtime.email}"
}

resource "google_project_iam_member" "github_deploy_run_admin" {
  project = var.project_id
  role    = "roles/run.admin"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_project_iam_member" "github_deploy_ar_writer" {
  project = var.project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_project_iam_member" "github_deploy_sa_user" {
  project = var.project_id
  role    = "roles/iam.serviceAccountUser"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}

resource "google_project_iam_member" "github_deploy_logging_viewer" {
  project = var.project_id
  role    = "roles/logging.viewer"
  member  = "serviceAccount:${google_service_account.github_deploy.email}"
}
