# Adopt secrets created outside Terraform (e.g. Console) so apply does not 409.
# Safe to keep: Terraform skips import when the resource is already in state.

import {
  to = module.secrets.google_secret_manager_secret.secrets["ttf-gemini-api-key"]
  id = "projects/${var.project_id}/secrets/ttf-gemini-api-key"
}
