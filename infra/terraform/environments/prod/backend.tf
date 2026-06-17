terraform {
  backend "gcs" {
    bucket = "ttf-tfstate-prod"
    prefix = "prod"
  }
}
