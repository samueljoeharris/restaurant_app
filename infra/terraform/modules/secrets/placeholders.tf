# Optional initial secret versions for containers that have no other Terraform writer.
# lifecycle.ignore_changes keeps user-updated values after first seed.
#
# Manual-only secrets (ttf-maps-api-key, ttf-gemini-api-key, ttf-github-pat-mcp):
# Terraform creates the SM container only — never writes versions. Safe to
# `gcloud secrets versions add` once; deploys will not overwrite.

resource "google_secret_manager_secret_version" "placeholder" {
  for_each = var.create_placeholders ? {
    for id, cfg in local.enabled : id => cfg
    if cfg.placeholder_data != null && cfg.version_managed_by == null
  } : {}

  secret      = google_secret_manager_secret.secrets[each.key].id
  secret_data = each.value.placeholder_data

  lifecycle {
    ignore_changes = [secret_data]
  }
}
