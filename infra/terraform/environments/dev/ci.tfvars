# Non-secret dev values for GitHub Actions Terraform CI (committed).
# Local apply may still use gitignored terraform.tfvars.

project_id                   = "ttf-restaurant-dev"
region                       = "us-central1"
uploads_bucket_name          = "ttf-uploads-dev"
terraform_state_bucket_name  = "ttf-tfstate-dev"
enable_cloud_sql             = false
enable_cloud_run             = false
github_repository            = "samueljoeharris/restaurant_app"
