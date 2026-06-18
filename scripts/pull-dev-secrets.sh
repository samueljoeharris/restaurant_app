#!/usr/bin/env bash
# Pull dev secrets from GCP Secret Manager into local .env / web/.env.local (optional).
# Requires: gcloud auth + secretmanager.secretAccessor on ttf-restaurant-dev.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud not installed — paste keys manually; see docs/SECRETS_MATRIX.md" >&2
  exit 1
fi

[[ -f .env ]] || cp .env.example .env
bash .cursor/scripts/bootstrap-cloud-env.sh

set_kv() {
  local file="$1" key="$2" value="$3"
  [[ -n "$value" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

fetch_secret() {
  gcloud secrets versions access latest --secret="$1" --project="$PROJECT" 2>/dev/null || true
}

MAPS_API="$(fetch_secret ttf-maps-api-key)"
MAPS_WEB="$(fetch_secret ttf-maps-web-api-key)"
FIREBASE_JSON="$(fetch_secret ttf-firebase-web-env)"

[[ -n "$MAPS_API" ]] && set_kv .env MAPS_API_KEY "$MAPS_API" && echo "MAPS_API_KEY: set from GCP"
[[ -n "$MAPS_WEB" ]] && set_kv .env VITE_GOOGLE_MAPS_API_KEY "$MAPS_WEB" && echo "VITE_GOOGLE_MAPS_API_KEY: set from GCP"

if [[ -n "$FIREBASE_JSON" ]]; then
  while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    set_kv .env "$key" "$val"
  done < <(python3 - <<'PY' "$FIREBASE_JSON"
import json, sys
cfg = json.loads(sys.argv[1])
for k in ("VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"):
    v = cfg.get(k, "")
    if v:
        print(f"{k}={v}")
PY
)
  echo "VITE_FIREBASE_*: set from ttf-firebase-web-env"
fi

bash .cursor/scripts/bootstrap-cloud-env.sh
./scripts/audit-env.sh
