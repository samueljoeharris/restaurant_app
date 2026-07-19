resource "google_cloud_run_v2_service" "api" {
  name     = var.service_name
  project  = var.project_id
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = var.service_account_email

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }

    volumes {
      name = "cloudsql"
      cloud_sql_instance {
        instances = [var.cloud_sql_connection_name]
      }
    }

    dynamic "volumes" {
      for_each = var.file_secret_mounts
      content {
        name = volumes.value.volume_name
        secret {
          secret = volumes.value.secret_name
          items {
            version = "latest"
            path    = volumes.value.file_name
            # Readable by the non-root container user (api/Dockerfile runs as app).
            mode = volumes.value.mode
          }
        }
      }
    }

    containers {
      image = var.image

      ports {
        container_port = 8080
      }

      volume_mounts {
        name       = "cloudsql"
        mount_path = "/cloudsql"
      }

      dynamic "volume_mounts" {
        for_each = var.file_secret_mounts
        content {
          name       = volume_mounts.value.volume_name
          mount_path = volume_mounts.value.mount_path
        }
      }

      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = var.database_url_secret_id
            version = "latest"
          }
        }
      }

      dynamic "env" {
        for_each = var.container_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value.secret
              version = env.value.version
            }
          }
        }
      }
    }
  }

  lifecycle {
    ignore_changes = [
      template[0].containers[0].image,
    ]
  }
}

resource "google_cloud_run_v2_service_iam_member" "invokers" {
  for_each = toset(var.invoker_members)

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = each.value
}
