# Non-secret dev values for GitHub Actions Terraform CI (committed).
# Local apply may still use gitignored terraform.tfvars.

project_id                  = "ttf-restaurant-dev"
region                      = "us-central1"
uploads_bucket_name         = "ttf-uploads-dev"
terraform_state_bucket_name = "ttf-tfstate-dev"
github_repository           = "samueljoeharris/restaurant_app"

# Phase B — Cloud SQL + Cloud Run (~$7-10/mo). Image updates via .github/workflows/api.yml.
enable_cloud_sql             = true
enable_cloud_run             = true
enable_web_cloud_run         = true
api_image                    = "us-docker.pkg.dev/cloudrun/container/hello"
web_image                    = "us-docker.pkg.dev/cloudrun/container/hello"
cloud_sql_tier               = "db-f1-micro"
firebase_mfa_state           = "ENABLED"
firebase_admin_sa_configured = true
# App Check: set site key after creating reCAPTCHA Enterprise key (public; safe in ci.tfvars).
# app_check_recaptcha_site_key = "6L..."

# littlescout.app — dev segment on ttf-restaurant-dev (GoDaddy DNS → load_balancer_ip output)
dns_base_domain        = "littlescout.app"
dns_environment        = "dev"
enable_custom_domains  = true
enable_admin_cloud_run = true
# IAP — Google login wall on admin.dev (OAuth client in ttf-iap-oauth secret; see docs/LITTLESCOUT_DOMAIN.md)
enable_admin_iap  = true
iap_admin_members = ["user:samueljoeharris@gmail.com"]
