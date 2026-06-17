# Firebase App Check (reCAPTCHA Enterprise) for web → API write protection.

resource "google_secret_manager_secret_version" "recaptcha_site_key" {
  count = var.enable_firebase_web && var.app_check_recaptcha_site_key != "" ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-recaptcha-site-key"]
  secret_data = var.app_check_recaptcha_site_key

  depends_on = [module.secrets]
}

resource "google_secret_manager_secret_iam_member" "github_deploy_recaptcha_site_key" {
  count = var.enable_firebase_web && var.app_check_recaptcha_site_key != "" ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-recaptcha-site-key"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}

resource "google_firebase_app_check_recaptcha_enterprise_config" "web" {
  count = var.enable_firebase_web && var.app_check_recaptcha_site_key != "" ? 1 : 0

  provider = google-beta
  project  = var.project_id
  app_id   = module.firebase_web[0].app_id
  site_key = var.app_check_recaptcha_site_key

  depends_on = [module.firebase_web, module.project_services]
}
