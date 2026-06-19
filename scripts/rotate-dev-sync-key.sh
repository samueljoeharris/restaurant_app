#!/usr/bin/env bash
# Create a new ttf-dev-sync key and list old keys to revoke after Cursor update.
# Never prints key JSON to stdout — writes to a gitignored file only.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
SA="ttf-dev-sync@${PROJECT}.iam.gserviceaccount.com"
OUT="${1:-./ttf-dev-sync-key.json}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud required" >&2
  exit 1
fi

if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  echo "ERROR: $SA not found — apply dev-sync.tf first." >&2
  exit 1
fi

echo "=== Rotate dev-sync SA key ==="
echo ""
echo "Existing user-managed keys:"
gcloud iam service-accounts keys list \
  --iam-account="$SA" \
  --project="$PROJECT" \
  --managed-by=user \
  --format="table(name.basename(),validAfterTime.date(),validBeforeTime.date(),disabled)"

echo ""
gcloud iam service-accounts keys create "$OUT" \
  --iam-account="$SA" \
  --project="$PROJECT"

chmod 600 "$OUT"
bytes="$(wc -c <"$OUT" | tr -d ' ')"
echo ""
echo "Created new key file: $OUT ($bytes bytes)"
echo ""
echo "Next steps:"
echo "  1. Cursor → Cloud Agents → Secrets → GCP_DEV_SYNC_SA_JSON"
echo "     Paste entire JSON from $OUT (do not commit this file)"
echo "  2. Restart Cloud Agent or run: ./scripts/sync-secrets.sh"
echo "  3. Verify: ./scripts/audit-env.sh"
echo "  4. Revoke old keys:"
echo "       gcloud iam service-accounts keys list --iam-account=$SA --project=$PROJECT --managed-by=user"
echo "       gcloud iam service-accounts keys delete KEY_ID --iam-account=$SA --project=$PROJECT"
echo ""
echo "Terraform org policy caps key age at 90 days — rotate before expiry."
