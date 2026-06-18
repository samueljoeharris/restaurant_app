# Dev secret sync — read-only SA for local Mac + Cursor VM (sync-secrets.sh).
# SA key is NOT managed by Terraform; create once via scripts/create-dev-sync-key.sh

resource "google_service_account" "dev_sync" {
  project      = var.project_id
  account_id   = "ttf-dev-sync"
  display_name = "TTF dev secret sync (local + Cursor VM)"
}

locals {
  dev_sync_secret_ids = concat(
    ["ttf-maps-api-key", "ttf-gemini-api-key", "ttf-github-pat-mcp"],
    var.enable_web_cloud_run ? ["ttf-maps-web-api-key"] : [],
    var.enable_firebase_web ? ["ttf-firebase-web-env", "ttf-recaptcha-site-key"] : [],
    var.enable_cloud_run ? ["ttf-firebase-admin-sa"] : [],
    ["ttf-dev-test-credentials", "ttf-apple-sign-in-key"],
  )
}

resource "google_secret_manager_secret_iam_member" "dev_sync_accessor" {
  for_each = toset(local.dev_sync_secret_ids)

  project   = var.project_id
  secret_id = module.secrets.secret_ids[each.value]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.dev_sync.email}"
}

output "dev_sync_service_account_email" {
  description = "Grant a key via scripts/create-dev-sync-key.sh → Cursor GCP_DEV_SYNC_SA_JSON"
  value       = google_service_account.dev_sync.email
}
