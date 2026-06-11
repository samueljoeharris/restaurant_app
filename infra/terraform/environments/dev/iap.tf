# IAP OAuth credentials for admin.dev load balancer backend.
#
# Google shut down the IAP OAuth Admin API (google_iap_brand / google_iap_client no
# longer work for external projects). Flow:
#   1. Create OAuth client once in Console (Security → IAP → ttf-dev-admin-backend).
#   2. Provide credentials via GitHub Environment secrets (CI) or terraform.tfvars (local).
#   3. Terraform persists to Secret Manager and wires the admin backend service.

locals {
  iap_oauth_enabled = (
    var.enable_custom_domains
    && var.enable_admin_cloud_run
    && var.enable_admin_iap
  )

  iap_oauth_bootstrap = (
    local.iap_oauth_enabled
    && var.iap_oauth_client_id != ""
    && var.iap_oauth_client_secret != ""
  )

  # When TF vars are set this run, use them directly (also writes SM version).
  # Otherwise read the persisted secret (subsequent applies without re-passing secrets).
  iap_oauth_read_secret = local.iap_oauth_enabled && !local.iap_oauth_bootstrap
}

resource "google_secret_manager_secret_version" "iap_oauth" {
  count = local.iap_oauth_bootstrap ? 1 : 0

  secret = module.secrets.secret_resource_names["ttf-iap-oauth"]
  secret_data = jsonencode({
    client_id     = var.iap_oauth_client_id
    client_secret = var.iap_oauth_client_secret
  })

  lifecycle {
    create_before_destroy = true
  }
}

data "google_secret_manager_secret_version" "iap_oauth" {
  count = local.iap_oauth_read_secret ? 1 : 0

  secret  = module.secrets.secret_resource_names["ttf-iap-oauth"]
  version = "latest"
}

locals {
  iap_oauth_config = local.iap_oauth_read_secret ? jsondecode(
    data.google_secret_manager_secret_version.iap_oauth[0].secret_data
  ) : {}

  iap_oauth_client_id_effective = local.iap_oauth_bootstrap ? var.iap_oauth_client_id : try(
    local.iap_oauth_config.client_id,
    "",
  )
  iap_oauth_client_secret_effective = local.iap_oauth_bootstrap ? var.iap_oauth_client_secret : try(
    local.iap_oauth_config.client_secret,
    "",
  )
}
