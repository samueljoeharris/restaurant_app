terraform {
  required_providers {
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
  }
}

# Adopts an existing Firebase-enabled GCP project or enables Firebase on the project.
resource "google_firebase_project" "project" {
  provider = google-beta
  project  = var.project_id
}

resource "google_firebase_web_app" "web" {
  provider     = google-beta
  project      = var.project_id
  display_name = var.web_app_display_name

  depends_on = [google_firebase_project.project]
}

data "google_firebase_web_app_config" "web" {
  provider   = google-beta
  web_app_id = google_firebase_web_app.web.app_id
}
