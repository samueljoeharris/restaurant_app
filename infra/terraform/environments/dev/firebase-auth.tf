module "firebase_auth" {
  count  = var.enable_firebase_web ? 1 : 0
  source = "../../modules/firebase-auth"

  project_id = var.project_id
  authorized_domains = [
    "localhost",
    "${var.project_id}.firebaseapp.com",
    "${var.project_id}.web.app",
  ]

  enable_google_sign_in = var.enable_google_sign_in
  google_oauth_client_id = var.google_oauth_client_id
  google_oauth_client_secret = var.google_oauth_client_secret
  mfa_state             = var.firebase_mfa_state

  depends_on = [module.firebase_web]
}
