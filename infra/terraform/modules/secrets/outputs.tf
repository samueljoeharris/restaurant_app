output "secret_ids" {
  value = { for k, v in google_secret_manager_secret.secrets : k => v.secret_id }
}

output "secret_resource_names" {
  value = { for k, v in google_secret_manager_secret.secrets : k => v.name }
}

output "catalog" {
  description = "Metadata for enabled secrets (WHAT/WHY/env alias)"
  value = {
    for id, cfg in local.enabled : id => {
      title     = cfg.title
      env_alias = cfg.env_alias
      purpose   = cfg.purpose
      consumers = cfg.consumers
      category  = cfg.category
      sync_dev  = cfg.sync_dev
      seed_hint = cfg.seed_hint
    }
  }
}

output "dev_sync_secret_ids" {
  description = "Secret IDs pulled by scripts/sync-secrets.sh (sync_dev=true in catalog)"
  value       = [for id, cfg in local.enabled : id if cfg.sync_dev]
}
