# Non-secret prod values for GitHub Actions Terraform CI (committed).
# Local apply may still use gitignored terraform.tfvars.
#
# This file is a scaffold — applying it requires a real ttf-restaurant-prod
# GCP project, billing account, and bootstrap state bucket. See
# docs/PROD_CUTOVER_RUNBOOK.md before running terraform apply against prod.

project_id                  = "ttf-restaurant-prod"
region                      = "us-central1"
uploads_bucket_name         = "ttf-uploads-prod"
terraform_state_bucket_name = "ttf-tfstate-prod"
github_repository           = "samueljoeharris/restaurant_app"

# Phase B — Cloud SQL + Cloud Run. Image updates via reusable-api.yml (deploy pipeline).
enable_cloud_sql              = true
enable_cloud_run              = true
enable_restaurant_refresh_job = true
enable_web_cloud_run          = true
api_image                     = "us-docker.pkg.dev/cloudrun/container/hello"
web_image                     = "us-docker.pkg.dev/cloudrun/container/hello"
cloud_sql_tier                = "db-custom-1-3840"
deletion_protection           = true
firebase_mfa_state            = "MANDATORY"
firebase_admin_sa_configured  = true
# Google sign-in: managed in Firebase Console (not Terraform). See docs/AUTH.md.
enable_google_sign_in = false
# App Check: set site key after creating reCAPTCHA Enterprise key (public; safe in ci.tfvars).
# app_check_recaptcha_site_key = "6L..."

# littlescout.app — prod segment on ttf-restaurant-prod (GoDaddy DNS → load_balancer_ip output)
dns_base_domain        = "littlescout.app"
dns_environment        = "prod"
enable_custom_domains  = true
enable_admin_cloud_run = true
# IAP — Google login wall on admin (OAuth client in ttf-iap-oauth secret; see docs/LITTLESCOUT_DOMAIN.md)
enable_admin_iap  = true
iap_admin_members = ["user:samueljoeharris@gmail.com"]

# Budget alert — see docs/DESIGN.md naming matrix ($25/$50/$100 thresholds)
enable_billing_budget      = true
billing_account_id         = "" # set via GitHub Environment secret BILLING_ACCOUNT_ID before apply
budget_amount_usd          = 100
budget_notification_emails = ["samueljoeharris@gmail.com"]
