module "firebase_web" {
  count  = var.enable_firebase_web ? 1 : 0
  source = "../../modules/firebase-web"

  project_id           = var.project_id
  web_app_display_name = var.firebase_web_app_display_name

  depends_on = [module.project_services]
}

resource "google_secret_manager_secret_version" "firebase_web_env" {
  count = var.enable_firebase_web ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-firebase-web-env"]
  secret_data = jsonencode(module.firebase_web[0].web_env)

  depends_on = [module.firebase_web, module.secrets]
}

resource "google_secret_manager_secret_iam_member" "github_deploy_firebase_web_env" {
  count = var.enable_firebase_web ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-firebase-web-env"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}
