output "mfa_state" {
  value = google_identity_platform_config.auth.mfa[0].state
}

output "google_sign_in_enabled" {
  value = var.enable_google_sign_in && var.google_oauth_client_id != ""
}
