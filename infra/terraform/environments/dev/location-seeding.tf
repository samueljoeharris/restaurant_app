# Async restaurant seeding — Pub/Sub queue + push worker on Cloud Run API.

locals {
  restaurant_seed_topic_name = "ttf-restaurant-seed-jobs"
  restaurant_seed_topic_id   = "projects/${var.project_id}/topics/${local.restaurant_seed_topic_name}"
}

resource "google_pubsub_topic" "restaurant_seed_jobs" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  name    = local.restaurant_seed_topic_name
  project = var.project_id

  depends_on = [module.project_services]
}

resource "google_pubsub_topic_iam_member" "api_runtime_publisher" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  project = var.project_id
  topic   = google_pubsub_topic.restaurant_seed_jobs[0].name
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${module.iam.api_runtime_email}"
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_push_invoker" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = module.cloud_run[0].service_name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"
}

resource "google_pubsub_subscription" "restaurant_seed_worker" {
  count = var.enable_restaurant_refresh_job ? 1 : 0

  name    = "ttf-restaurant-seed-worker"
  project = var.project_id
  topic   = google_pubsub_topic.restaurant_seed_jobs[0].name

  ack_deadline_seconds = 600

  push_config {
    push_endpoint = "${module.cloud_run[0].service_uri}/v1/internal/pubsub/seed-jobs"

    oidc_token {
      service_account_email = module.iam.api_runtime_email
    }

    attributes = {
      x-goog-version = "v1"
    }
  }

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  depends_on = [
    google_pubsub_topic.restaurant_seed_jobs,
    google_cloud_run_v2_service_iam_member.pubsub_push_invoker,
  ]
}
