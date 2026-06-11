#!/usr/bin/env bash
# Import Firebase Google sign-in IdP if it was enabled in Console before Terraform.
# Safe to run repeatedly — no-op when already in state or OAuth vars not set.
#
# Usage (from repo root, after terraform init in environments/dev):
#   TF_VAR_google_oauth_client_id=.... \
#   TF_VAR_google_oauth_client_secret=.... \
#   ./scripts/terraform-import-google-idp.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${GCP_PROJECT:-ttf-restaurant-dev}"
WORKDIR="${ROOT}/infra/terraform/environments/dev"
VAR_FILE="${TF_VAR_FILE:-ci.tfvars}"
ADDR='module.firebase_auth[0].google_identity_platform_default_supported_idp_config.google[0]'
IMPORT_ID="projects/${PROJECT}/defaultSupportedIdpConfigs/google.com"

TF_ARGS=(-input=false -var-file="$VAR_FILE")

if [[ -z "${TF_VAR_google_oauth_client_id:-}" ]]; then
  echo "Skip Google IdP import — TF_VAR_google_oauth_client_id not set (resource count = 0)" >&2
  exit 0
fi

cd "$WORKDIR"

if terraform state show "${TF_ARGS[@]}" "$ADDR" >/dev/null 2>&1; then
  echo "Google IdP already in Terraform state"
  exit 0
fi

echo "Importing existing Google IdP config (Firebase Console) into Terraform state..."
if terraform import "${TF_ARGS[@]}" "$ADDR" "$IMPORT_ID"; then
  echo "Imported $IMPORT_ID"
  exit 0
fi

echo "::error::Google IdP import failed. If Google sign-in is not enabled in Firebase yet, disable GOOGLE_OAUTH_* secrets and re-run." >&2
exit 1
