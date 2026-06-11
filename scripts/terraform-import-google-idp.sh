#!/usr/bin/env bash
# Import Firebase Google sign-in IdP if it was enabled in Console before Terraform.
# Safe to run repeatedly — no-op when already in state or not yet in GCP.
#
# Usage (from repo root, after terraform init in environments/dev):
#   TF_VAR_google_oauth_client_id=.... \
#   TF_VAR_google_oauth_client_secret=.... \
#   ./scripts/terraform-import-google-idp.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${GCP_PROJECT:-ttf-restaurant-dev}"
WORKDIR="${ROOT}/infra/terraform/environments/dev"
ADDR='module.firebase_auth[0].google_identity_platform_default_supported_idp_config.google[0]'
IMPORT_ID="projects/${PROJECT}/defaultSupportedIdpConfigs/google.com"

if [[ -z "${TF_VAR_google_oauth_client_id:-}" ]]; then
  echo "Skip Google IdP import — TF_VAR_google_oauth_client_id not set (resource count = 0)" >&2
  exit 0
fi

cd "$WORKDIR"

if terraform state show "$ADDR" >/dev/null 2>&1; then
  echo "Google IdP already in Terraform state"
  exit 0
fi

echo "Importing existing Google IdP config (Firebase Console) into Terraform state..."
if terraform import -input=false "$ADDR" "$IMPORT_ID"; then
  echo "Imported $IMPORT_ID"
else
  echo "Import failed — IdP may not exist in GCP yet (Terraform will create on apply)" >&2
  exit 0
fi
