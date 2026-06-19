#!/usr/bin/env bash
# Create a JSON key for ttf-dev-sync SA — paste into Cursor as GCP_DEV_SYNC_SA_JSON.
# Requires: terraform applied (dev-sync.tf) + gcloud auth with iam.serviceAccountKeys.create
set -euo pipefail

PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
SA="ttf-dev-sync@${PROJECT}.iam.gserviceaccount.com"
OUT="${1:-./ttf-dev-sync-key.json}"

if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  echo "ERROR: $SA not found — apply infra/terraform/environments/dev (dev-sync.tf) first." >&2
  exit 1
fi

gcloud iam service-accounts keys create "$OUT" \
  --iam-account="$SA" \
  --project="$PROJECT"

echo ""
echo "Created key: $OUT"
echo ""
echo "Next steps:"
echo "  1. Cursor → Cloud Agents → Secrets → Runtime Secret"
echo "     Name:  GCP_DEV_SYNC_SA_JSON"
echo "     Value: entire JSON file contents (one line is fine)"
echo ""
echo "  2. Local Mac can use ADC instead: gcloud auth application-default login"
echo ""
echo "  3. Rotate: delete old keys in Console → IAM → $SA → Keys"
echo "     Or: ./scripts/rotate-dev-sync-key.sh (creates new key + revoke instructions)"
echo "  4. Audit key ages: ./scripts/audit-dev-sync-keys.sh (warns <15 days left)"
echo "  5. Never commit $OUT — add to .gitignore if kept locally"
