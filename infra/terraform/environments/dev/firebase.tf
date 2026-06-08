module "firebase_web" {
  count  = var.enable_firebase_web ? 1 : 0
  source = "../../modules/firebase-web"

  project_id           = var.project_id
  web_app_display_name = var.firebase_web_app_display_name

  depends_on = [module.project_services]
}
