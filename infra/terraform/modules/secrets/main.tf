resource "google_secret_manager_secret" "secrets" {
  for_each = local.enabled

  project   = var.project_id
  secret_id = each.key

  labels = {
    managed_by      = "terraform"
    environment     = var.environment
    category        = each.value.category
    confidentiality = each.value.confidentiality
    sync_dev        = each.value.sync_dev ? "true" : "false"
  }

  annotations = {
    title      = each.value.title
    purpose    = each.value.purpose
    consumers  = each.value.consumers
    env-alias  = each.value.env_alias
    seed-hint  = each.value.seed_hint
    docs       = "docs/SECRETS_MATRIX.md"
    managed-by = "terraform-module-secrets"
  }

  replication {
    auto {}
  }
}

check "secret_catalog_coverage" {
  assert {
    condition     = length(local.unknown_secret_ids) == 0
    error_message = "Unknown secret_ids (add to modules/secrets/catalog.tf): ${join(", ", local.unknown_secret_ids)}"
  }
}
