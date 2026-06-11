# Browser Maps JavaScript API key for ttf-web (Vite → VITE_GOOGLE_MAPS_API_KEY).
# Server Places/Geocoding key remains separate in ttf-maps-api-key.

locals {
  maps_web_referrers = compact(concat(
    [
      "http://localhost:5173/*",
      "http://127.0.0.1:5173/*",
    ],
    var.enable_web_cloud_run ? ["${module.cloud_run_web[0].service_uri}/*"] : [],
    var.enable_custom_domains && local.web_fqdn != "" ? ["https://${local.web_fqdn}/*"] : [],
  ))
}

resource "google_apikeys_key" "maps_web" {
  count = var.enable_web_cloud_run ? 1 : 0

  provider = google-beta
  project  = var.project_id
  # Immutable key id from GCP (imported in 6f9e786); do not change or Terraform replaces the key.
  name         = "5c2e45bb-2e45-4804-85c3-2154bebcbdcd"
  display_name = "TTF Maps Web (browser)"

  restrictions {
    browser_key_restrictions {
      allowed_referrers = local.maps_web_referrers
    }
    api_targets {
      service = "maps-backend.googleapis.com"
    }
  }

  depends_on = [module.project_services]
}

resource "google_secret_manager_secret_version" "maps_web_api_key" {
  count = var.enable_web_cloud_run ? 1 : 0

  secret      = module.secrets.secret_resource_names["ttf-maps-web-api-key"]
  secret_data = google_apikeys_key.maps_web[0].key_string

  depends_on = [module.secrets, google_apikeys_key.maps_web]
}

resource "google_secret_manager_secret_iam_member" "github_deploy_maps_web_api_key" {
  count = var.enable_web_cloud_run ? 1 : 0

  project   = var.project_id
  secret_id = module.secrets.secret_ids["ttf-maps-web-api-key"]
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.github_deploy_email}"
}
