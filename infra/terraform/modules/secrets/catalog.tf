# Canonical Secret Manager inventory — WHAT each secret is, WHY it exists, env "alias".
# Environments pass secret_ids to enable a subset; unknown IDs fail at plan time.

locals {
  catalog = {
    ttf-maps-api-key = {
      title              = "Google Maps server API key"
      env_alias          = "MAPS_API_KEY"
      purpose            = "Server-side Places, Geocoding, and map seeding on the API"
      consumers          = "Cloud Run API, local Docker API, seed_restaurants.py, dev-sync"
      category           = "api"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = null
      seed_hint          = "echo -n KEY | gcloud secrets versions add ttf-maps-api-key --data-file=-"
    }
    ttf-maps-web-api-key = {
      title              = "Google Maps JavaScript API key (browser)"
      env_alias          = "VITE_GOOGLE_MAPS_API_KEY"
      purpose            = "Maps JavaScript API for web pilot map UI"
      consumers          = "Cloud Run web build (GitHub Actions), local Vite, dev-sync"
      category           = "web"
      sync_dev           = true
      version_managed_by = "maps-web.tf"
      placeholder_data   = null
      seed_hint          = "Auto-populated by Terraform from API Keys when maps-web.tf applies"
    }
    ttf-firebase-web-env = {
      title              = "Firebase web SDK config (JSON)"
      env_alias          = "web/.env.local VITE_FIREBASE_*"
      purpose            = "Public Firebase web app config for sign-in and App Check"
      consumers          = "Cloud Run web/admin builds, local Vite, dev-sync"
      category           = "web"
      sync_dev           = true
      version_managed_by = "firebase.tf"
      placeholder_data   = null
      seed_hint          = "Auto-populated by Terraform from Firebase web app"
    }
    ttf-firebase-admin-sa = {
      title              = "Firebase Admin service account JSON"
      env_alias          = "firebase-sa.json"
      purpose            = "Verify Firebase ID tokens on the API (JWT)"
      consumers          = "Cloud Run API file mount, local Docker API, dev-sync"
      category           = "api"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = null
      seed_hint          = "api/scripts/upload_firebase_admin_sa.sh"
    }
    ttf-gemini-api-key = {
      title              = "Google Gemini API key"
      env_alias          = "GEMINI_API_KEY"
      purpose            = "Review chat and structured extraction on the API"
      consumers          = "Cloud Run API, local Docker API, dev-sync"
      category           = "api"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = null
      seed_hint          = "echo -n KEY | gcloud secrets versions add ttf-gemini-api-key --data-file=-"
    }
    ttf-github-pat-mcp = {
      title              = "GitHub PAT for Cursor MCP"
      env_alias          = "GITHUB_PERSONAL_ACCESS_TOKEN"
      purpose            = "GitHub MCP server in Cursor (issues, PRs) — dev only"
      consumers          = "dev-sync → .secrets/mcp.env, Cursor MCP"
      category           = "dev-tool"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = null
      seed_hint          = "Create fine-grained PAT (repo scope); gcloud secrets versions add ttf-github-pat-mcp"
    }
    ttf-dev-test-credentials = {
      title              = "Optional dev browser test login (JSON)"
      env_alias          = "DEV_TEST_EMAIL / DEV_TEST_PASSWORD"
      purpose            = "Automated sign-in for cloud-agent or local browser smoke tests"
      consumers          = "dev-sync → .secrets/dev-test.env (optional)"
      category           = "dev-tool"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = "{\"email\":\"\",\"password\":\"\",\"note\":\"Replace via gcloud secrets versions add\"}"
      seed_hint          = "echo '{\"email\":\"you@example.com\",\"password\":\"...\"}' | gcloud secrets versions add ttf-dev-test-credentials --data-file=-"
    }
    ttf-apple-sign-in-key = {
      title              = "Apple Sign-In key for token revoke (JSON)"
      env_alias          = "APPLE_* / APPLE_SIGN_IN_KEY_JSON"
      purpose            = "Revoke Apple refresh tokens when users delete accounts (App Store 5.1.1v)"
      consumers          = "Cloud Run API when apple_sign_in_key_configured=true, dev-sync"
      category           = "api"
      sync_dev           = true
      version_managed_by = null
      placeholder_data   = "{\"team_id\":\"\",\"key_id\":\"\",\"private_key\":\"\",\"client_id\":\"com.samueljoeharris.ttf\",\"note\":\"Replace via gcloud secrets versions add\"}"
      seed_hint          = "JSON with team_id, key_id, private_key, client_id; then apple_sign_in_key_configured=true"
    }
    ttf-recaptcha-site-key = {
      title              = "reCAPTCHA Enterprise site key (public)"
      env_alias          = "VITE_APP_CHECK_RECAPTCHA_SITE_KEY"
      purpose            = "Firebase App Check on web (optional locally)"
      consumers          = "Cloud Run web build, local Vite, dev-sync"
      category           = "web"
      sync_dev           = true
      version_managed_by = "app-check.tf"
      placeholder_data   = null
      seed_hint          = "Set app_check_recaptcha_site_key in tfvars or app-check.tf writes SM version"
    }
    ttf-iap-oauth = {
      title              = "Admin IAP OAuth client (JSON)"
      env_alias          = "TF_VAR_iap_oauth_*"
      purpose            = "Google OAuth wall on admin.dev / admin prod load balancer"
      consumers          = "Terraform CI (IAP), not dev-sync"
      category           = "terraform"
      sync_dev           = false
      version_managed_by = "iap.tf"
      placeholder_data   = null
      seed_hint          = "Console IAP OAuth client; scripts/bootstrap-iap-oauth-secret.sh"
    }
    ttf-db-url = {
      title              = "Cloud SQL connection URL"
      env_alias          = "DATABASE_URL"
      purpose            = "Postgres DSN for Cloud Run API (Unix socket)"
      consumers          = "Cloud Run API runtime only"
      category           = "infra"
      sync_dev           = false
      version_managed_by = "phase-b.tf"
      placeholder_data   = null
      seed_hint          = "Auto-written by Terraform when Cloud SQL is enabled"
    }
    ttf-internal-job-secret = {
      title              = "Internal scheduled job bearer token"
      env_alias          = "INTERNAL_JOB_SECRET / X-Internal-Job-Token"
      purpose            = "Auth for Cloud Scheduler → weekly restaurant refresh endpoint"
      consumers          = "Cloud Run API, Cloud Scheduler"
      category           = "infra"
      sync_dev           = false
      version_managed_by = "phase-b.tf"
      placeholder_data   = null
      seed_hint          = "Auto-generated by Terraform (random_password)"
    }
    ttf-api-public-url = {
      title              = "Public API base URL for CI/deploy"
      env_alias          = "api.dev / api origin"
      purpose            = "Canonical HTTPS URL written after custom domain LB is live"
      consumers          = "GitHub Actions deploy workflows, networking"
      category           = "infra"
      sync_dev           = false
      version_managed_by = "networking.tf"
      placeholder_data   = null
      seed_hint          = "Auto-written by Terraform from load balancer output"
    }
    ttf-web-public-url = {
      title              = "Public web app URL for CI/deploy"
      env_alias          = "app.dev / app origin"
      purpose            = "Canonical HTTPS URL for pilot web Cloud Run + LB"
      consumers          = "GitHub Actions web deploy, CORS config"
      category           = "infra"
      sync_dev           = false
      version_managed_by = "networking.tf"
      placeholder_data   = null
      seed_hint          = "Auto-written by Terraform from load balancer output"
    }
    ttf-admin-public-url = {
      title              = "Public admin console URL for CI/deploy"
      env_alias          = "admin.dev / admin origin"
      purpose            = "Canonical HTTPS URL for operator admin web + IAP"
      consumers          = "GitHub Actions admin deploy, IAP config"
      category           = "infra"
      sync_dev           = false
      version_managed_by = "networking.tf"
      placeholder_data   = null
      seed_hint          = "Auto-written by Terraform from load balancer output"
    }
  }

  # Resolve enabled set — fail plan if an unknown secret_id is requested.
  enabled = {
    for id in var.secret_ids : id => local.catalog[id]
  }

  unknown_secret_ids = setsubtract(toset(var.secret_ids), keys(local.catalog))
}
