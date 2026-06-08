# Non-secret dev values for GitHub Actions Terraform CI (committed).
# Local apply may still use gitignored terraform.tfvars.

project_id                   = "ttf-restaurant-dev"
region                       = "us-central1"
uploads_bucket_name          = "ttf-uploads-dev"
terraform_state_bucket_name  = "ttf-tfstate-dev"
github_repository            = "samueljoeharris/restaurant_app"

# Phase B — Cloud SQL + Cloud Run (~$7-10/mo). Image updates via .github/workflows/api.yml.
enable_cloud_sql     = true
enable_cloud_run     = true
enable_web_cloud_run = true
api_image            = "us-docker.pkg.dev/cloudrun/container/hello"
web_image            = "us-docker.pkg.dev/cloudrun/container/hello"
cloud_sql_tier       = "db-f1-micro"
firebase_mfa_state   = "DISABLED"
# App Check: create a score-based reCAPTCHA Enterprise key, add allowed domains
# (localhost, ttf-web Cloud Run host), then set site key here or in terraform.tfvars.
# app_check_recaptcha_site_key = "6L..."
