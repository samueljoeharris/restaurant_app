module "firebase_auth" {
  count  = var.enable_firebase_web ? 1 : 0
  source = "../../modules/firebase-auth"

  project_id = var.project_id
  authorized_domains = concat(
    [
      "localhost",
      "${var.project_id}.firebaseapp.com",
      "${var.project_id}.web.app",
    ],
    var.enable_web_cloud_run ? [
      replace(module.cloud_run_web[0].service_uri, "https://", ""),
    ] : [],
  )

  enable_google_sign_in = var.enable_google_sign_in
  google_oauth_client_id = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret
  mfa_state             = var.firebase_mfa_state

  depends_on = [module.firebase_web]
}
