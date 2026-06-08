# One-time recovery: Phase B apply failed after creating these in GCP but before
# state was saved. Import blocks are no-ops once resources are in state.

import {
  to = module.cloud_sql[0].google_sql_database_instance.main
  id = "projects/ttf-restaurant-dev/instances/ttf-db"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["ttf-db-url"]
  id = "projects/ttf-restaurant-dev/secrets/ttf-db-url"
}

import {
  to = module.secrets.google_secret_manager_secret.secrets["ttf-firebase-web-env"]
  id = "projects/ttf-restaurant-dev/secrets/ttf-firebase-web-env"
}

import {
  to = module.firebase_web[0].google_firebase_project.project
  id = "projects/ttf-restaurant-dev"
}

import {
  to = module.firebase_auth[0].google_identity_platform_config.auth
  id = "projects/ttf-restaurant-dev"
}
