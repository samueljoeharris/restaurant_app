#!/usr/bin/env bash
# One-time: store IAP OAuth client credentials in Secret Manager for Terraform.
#
# Prerequisite: create the OAuth client in GCP Console → Security → IAP
# on backend ttf-dev-admin-backend (External consent screen for personal Gmail projects).
#
# Usage:
#   IAP_OAUTH_CLIENT_ID=....apps.googleusercontent.com \
#   IAP_OAUTH_CLIENT_SECRET=.... \
#   ./scripts/bootstrap-iap-oauth-secret.sh
#
# Then run Terraform apply (or set the same values as GitHub Environment secrets
# IAP_OAUTH_CLIENT_ID / IAP_OAUTH_CLIENT_SECRET for CI).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="${GCP_PROJECT:-ttf-restaurant-dev}"
SECRET_ID="ttf-iap-oauth"

CLIENT_ID="${IAP_OAUTH_CLIENT_ID:-}"
CLIENT_SECRET="${IAP_OAUTH_CLIENT_SECRET:-}"

if [[ -z "$CLIENT_ID" || -z "$CLIENT_SECRET" ]]; then
  echo "Set IAP_OAUTH_CLIENT_ID and IAP_OAUTH_CLIENT_SECRET" >&2
  exit 1
fi

export CLIENT_ID CLIENT_SECRET

PAYLOAD="$(python3 - <<'PY'
import json, os
print(json.dumps({
    "client_id": os.environ["CLIENT_ID"],
    "client_secret": os.environ["CLIENT_SECRET"],
}))
PY
)"

if ! gcloud secrets describe "$SECRET_ID" --project="$PROJECT" >/dev/null 2>&1; then
  echo "Secret $SECRET_ID not found — run Terraform apply first (creates secret shell)." >&2
  exit 1
fi

echo "$PAYLOAD" | gcloud secrets versions add "$SECRET_ID" \
  --project="$PROJECT" \
  --data-file=-

echo "Added secret version to projects/$PROJECT/secrets/$SECRET_ID"
echo "Next: terraform apply -var-file=ci.tfvars (or push to main with GitHub secrets set)"
