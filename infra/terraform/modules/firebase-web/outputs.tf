output "app_id" {
  description = "Firebase Web app ID"
  value       = google_firebase_web_app.web.app_id
}

output "api_key" {
  description = "Web SDK apiKey — copy to web/.env.local as VITE_FIREBASE_API_KEY"
  value       = data.google_firebase_web_app_config.web.api_key
}

output "auth_domain" {
  description = "Web SDK authDomain"
  value       = data.google_firebase_web_app_config.web.auth_domain
}

output "project_id" {
  description = "Firebase / GCP project ID for the Web SDK"
  value       = data.google_firebase_web_app_config.web.project
}

output "web_env" {
  description = "Values for web/.env.local (Vite)"
  value = {
    VITE_FIREBASE_API_KEY       = data.google_firebase_web_app_config.web.api_key
    VITE_FIREBASE_AUTH_DOMAIN   = data.google_firebase_web_app_config.web.auth_domain
    VITE_FIREBASE_PROJECT_ID    = data.google_firebase_web_app_config.web.project
  }
}
