#!/usr/bin/env bash
# One-time: store shared dev browser-test login in Secret Manager + ensure Firebase user.
#
# Requires gcloud credentials with secretmanager.versions.add on ttf-dev-test-credentials
# (project owner or Secret Manager Admin — not the dev-sync SA).
#
# Usage:
#   ./scripts/seed-dev-test-credentials.sh
#   ./scripts/seed-dev-test-credentials.sh --email contrib-1781961579@ttf.test --password 'your-pass'
#
# After seeding, cloud agents pick up credentials via sync-secrets.sh → .secrets/dev-test.env
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
SECRET_ID="ttf-dev-test-credentials"
DEFAULT_EMAIL="contrib-1781961579@ttf.test"

EMAIL="$DEFAULT_EMAIL"
PASSWORD=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --email) EMAIL="$2"; shift 2 ;;
    --password) PASSWORD="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 [--email EMAIL] [--password PASSWORD]"
      echo "  Default email: $DEFAULT_EMAIL"
      echo "  Password: generated with openssl if omitted"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [[ -z "$PASSWORD" ]]; then
  PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | head -c 20)"
  echo "Generated password (also stored in Secret Manager — do not commit):"
  echo "  $PASSWORD"
  echo ""
fi

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud required" >&2
  exit 1
fi

JSON="$(python3 - <<PY
import json
print(json.dumps({"email": "$EMAIL", "password": "$PASSWORD"}))
PY
)"

echo "Adding Secret Manager version for $SECRET_ID (project=$PROJECT)…"
printf '%s' "$JSON" | gcloud secrets versions add "$SECRET_ID" \
  --project="$PROJECT" \
  --data-file=-

echo "Syncing to .secrets/dev-test.env…"
bash "$ROOT/scripts/sync-secrets.sh"

echo "Ensuring Firebase Auth user exists…"
bash "$ROOT/scripts/run-api-script.sh" ensure_dev_test_user.py \
  --email "$EMAIL" \
  --password "$PASSWORD"

echo ""
echo "Done. Cloud agents: bootstrap syncs DEV_TEST_* automatically."
echo "  source scripts/load-dev-test-env.sh   # or read .secrets/dev-test.env"
echo "  Sign in at http://localhost:5173/login or https://app.dev.littlescout.app/login"
echo ""
echo "See AGENTS.md § Browser / UI test plan and docs/TEST_FLOWS.md"
