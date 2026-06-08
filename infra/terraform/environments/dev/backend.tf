terraform {
  backend "gcs" {
    bucket = "ttf-tfstate-dev"
    prefix = "dev"
  }
}
