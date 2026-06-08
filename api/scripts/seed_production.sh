#!/usr/bin/env bash
# Seed Dedham restaurants into production Cloud SQL (one-time / rare).
#
# Prerequisites:
#   - gcloud auth application-default login
#   - cloud-sql-proxy on PATH (https://cloud.google.com/sql/docs/postgres/sql-proxy)
#
# Usage (from repo root):
#   ./api/scripts/seed_production.sh

set -euo pipefail

PROJECT_ID="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
INSTANCE="${PROJECT_ID}:us-central1:ttf-db"
PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-5432}"
PROXY_PID=""

cleanup() {
  if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID"
    wait "$PROXY_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if ! command -v cloud-sql-proxy &>/dev/null; then
  echo "cloud-sql-proxy not found. Install: https://cloud.google.com/sql/docs/postgres/sql-proxy"
  exit 1
fi

echo "==> Starting Cloud SQL Auth Proxy on 127.0.0.1:${PROXY_PORT}"
cloud-sql-proxy "$INSTANCE" --port "$PROXY_PORT" &
PROXY_PID=$!
sleep 3

echo "==> Building local DATABASE_URL from Secret Manager (ttf-db-url)"
export PROJECT_ID PROXY_PORT
export DATABASE_URL
DATABASE_URL="$(
  python - <<'PY'
import os
import re
import subprocess
import sys

project = os.environ["PROJECT_ID"]
raw = subprocess.check_output(
    ["gcloud", "secrets", "versions", "access", "latest",
     "--secret=ttf-db-url", f"--project={project}"],
    text=True,
).strip()
m = re.match(r"postgresql://([^:]+):([^@]+)@/([^?]+)", raw)
if not m:
    sys.exit("Could not parse ttf-db-url secret")
user, password, db = m.groups()
port = os.environ.get("PROXY_PORT", "5432")
print(f"postgresql://{user}:{password}@127.0.0.1:{port}/{db}")
PY
)"

export MAPS_API_KEY
MAPS_API_KEY="$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project="$PROJECT_ID")"

echo "==> Running seed_dedham.py against Cloud SQL"
docker compose run --rm \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e "MAPS_API_KEY=${MAPS_API_KEY}" \
  api python scripts/seed_dedham.py

echo "==> Done. Verify: curl https://ttf-api-6ac5e3cakq-uc.a.run.app/v1/restaurants | head"
