# One-time import: ttf-github-pat-mcp was seeded manually in Console before Terraform.
# Remove this file after the next successful apply (secret is then in state).
import {
  to = module.secrets.google_secret_manager_secret.secrets["ttf-github-pat-mcp"]
  id = "projects/${var.project_id}/secrets/ttf-github-pat-mcp"
}
