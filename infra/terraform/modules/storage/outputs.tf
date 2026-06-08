output "bucket_name" {
  value = google_storage_bucket.uploads.name
}

output "bucket_url" {
  value = "gs://${google_storage_bucket.uploads.name}"
}
