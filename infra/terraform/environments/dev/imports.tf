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
