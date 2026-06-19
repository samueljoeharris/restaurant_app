#!/usr/bin/env bash
# List ttf-dev-sync SA key ages (no secret material). Warn when rotation is due.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
SA="ttf-dev-sync@${PROJECT}.iam.gserviceaccount.com"
WARN_DAYS_LEFT="${DEV_SYNC_KEY_WARN_DAYS_LEFT:-15}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud required" >&2
  exit 1
fi

if ! gcloud iam service-accounts describe "$SA" --project="$PROJECT" >/dev/null 2>&1; then
  echo "ERROR: $SA not found — apply dev-sync.tf first." >&2
  exit 1
fi

echo "=== dev-sync SA keys ($SA) ==="
echo "Warn when <= $WARN_DAYS_LEFT days remain (Terraform caps key age at 90 days)"
echo ""

now_epoch="$(date -u +%s)"
warn=0

while IFS=$'\t' read -r name valid_after valid_before disabled; do
  key_id="${name##*/}"
  created="${valid_after%%T*}"
  if [[ -z "$valid_before" || "$valid_before" == "null" ]]; then
    echo "  key $key_id: created $created, no expiry — consider rotating (org policy may not apply to this key)"
    warn=1
    continue
  fi
  expiry="${valid_before%%T*}"
  expiry_epoch="$(date -u -d "${valid_before}" +%s)"
  days_left=$(( (expiry_epoch - now_epoch) / 86400 ))
  if (( days_left < 0 )); then
    echo "  key $key_id: created $created, expires $expiry — EXPIRED"
    warn=1
  elif (( days_left <= WARN_DAYS_LEFT )); then
    echo "  key $key_id: created $created, expires $expiry — rotate soon ($days_left days left)"
    warn=1
  else
    echo "  key $key_id: created $created, expires $expiry — ok ($days_left days left)"
  fi
done < <(gcloud iam service-accounts keys list \
  --iam-account="$SA" \
  --project="$PROJECT" \
  --managed-by=user \
  --format="value(name,validAfterTime,validBeforeTime,disabled)")

echo ""
if (( warn )); then
  echo "ACTION: ./scripts/rotate-dev-sync-key.sh"
  exit 1
fi
echo "Keys within rotation window."
