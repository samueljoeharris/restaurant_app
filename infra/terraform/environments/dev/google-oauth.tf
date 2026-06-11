# Google sign-in OAuth for Firebase / Identity Platform.
#
# Separate from IAP OAuth (admin.dev load balancer) — use a Web application client.
# Create in GCP Console → APIs & Services → Credentials, or Firebase → Auth → Google.
#
# Provide credentials via GitHub Environment secrets (CI) or gitignored terraform.tfvars
# (local). Terraform persists to Secret Manager and configures Identity Platform.

locals {
  google_oauth_enabled = var.enable_firebase_web && var.enable_google_sign_in

  google_oauth_bootstrap = (
    local.google_oauth_enabled
    && var.google_oauth_client_id != ""
    && var.google_oauth_client_secret != ""
  )

  google_oauth_read_secret = local.google_oauth_enabled && !local.google_oauth_bootstrap
}

resource "google_secret_manager_secret_version" "google_oauth" {
  count = local.google_oauth_bootstrap ? 1 : 0

  secret = module.secrets.secret_resource_names["ttf-google-oauth"]
  secret_data = jsonencode({
    client_id     = var.google_oauth_client_id
    client_secret = var.google_oauth_client_secret
  })

  lifecycle {
    create_before_destroy = true
  }
}

data "google_secret_manager_secret_version" "google_oauth" {
  count = local.google_oauth_read_secret ? 1 : 0

  secret  = module.secrets.secret_resource_names["ttf-google-oauth"]
  version = "latest"
}

locals {
  google_oauth_config = local.google_oauth_read_secret ? jsondecode(
    data.google_secret_manager_secret_version.google_oauth[0].secret_data
  ) : {}

  google_oauth_client_id_effective = local.google_oauth_bootstrap ? var.google_oauth_client_id : try(
    local.google_oauth_config.client_id,
    "",
  )
  google_oauth_client_secret_effective = local.google_oauth_bootstrap ? var.google_oauth_client_secret : try(
    local.google_oauth_config.client_secret,
    "",
  )
}
