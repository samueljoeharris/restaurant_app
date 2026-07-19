resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "google_sql_database_instance" "main" {
  name             = var.instance_name
  project          = var.project_id
  region           = var.region
  database_version = "POSTGRES_15"

  deletion_protection = var.deletion_protection

  settings {
    tier = var.tier

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "04:00"
    }

    ip_configuration {
      ipv4_enabled = true
      # ponytail: public IP is required until a VPC + Serverless VPC Access
      # connector is added for Cloud Run private connectivity. Tracked in
      # #142 — disable public IP once private networking is in place.
    }
  }
}

resource "google_sql_database" "main" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "app" {
  name     = var.database_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}
