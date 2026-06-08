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
PROXY_CONTAINER="ttf-cloud-sql-proxy"

cleanup() {
  if [[ -n "$PROXY_PID" ]] && kill -0 "$PROXY_PID" 2>/dev/null; then
    kill "$PROXY_PID"
    wait "$PROXY_PID" 2>/dev/null || true
  fi
  docker rm -f "$PROXY_CONTAINER" &>/dev/null || true
}
trap cleanup EXIT

start_proxy() {
  if command -v cloud-sql-proxy &>/dev/null; then
    echo "==> Starting cloud-sql-proxy on 127.0.0.1:${PROXY_PORT}"
    cloud-sql-proxy "$INSTANCE" --port "$PROXY_PORT" &
    PROXY_PID=$!
  else
    echo "==> Starting Cloud SQL proxy container on 127.0.0.1:${PROXY_PORT}"
    GCLOUD_CONFIG="${APPDATA:-$HOME/.config}/gcloud"
    docker rm -f "$PROXY_CONTAINER" &>/dev/null || true
    docker run -d --name "$PROXY_CONTAINER" \
      -p "127.0.0.1:${PROXY_PORT}:5432" \
      -v "${GCLOUD_CONFIG}:/root/.config/gcloud:ro" \
      gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.1 \
      --address 0.0.0.0 --port 5432 \
      "$INSTANCE"
  fi
  sleep 4
}

start_proxy

echo "==> Building local DATABASE_URL from Secret Manager (ttf-db-url)"
export PROJECT_ID PROXY_PORT

RAW_DB_URL="$(gcloud secrets versions access latest --secret=ttf-db-url --project="$PROJECT_ID")"
DB_USER="$(printf '%s' "$RAW_DB_URL" | sed -n 's#postgresql://\([^:]*\):.*#\1#p')"
DB_PASS="$(printf '%s' "$RAW_DB_URL" | sed -n 's#postgresql://[^:]*:\([^@]*\)@/.*#\1#p')"
DB_NAME="$(printf '%s' "$RAW_DB_URL" | sed -n 's#postgresql://[^/]*/\([^?]*\).*#\1#p')"
if [[ -z "$DB_USER" || -z "$DB_PASS" || -z "$DB_NAME" ]]; then
  echo "Could not parse ttf-db-url secret"
  exit 1
fi
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:${PROXY_PORT}/${DB_NAME}"

export MAPS_API_KEY
MAPS_API_KEY="$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project="$PROJECT_ID")"

echo "==> Running seed_dedham.py against Cloud SQL"
docker compose run --rm \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e "MAPS_API_KEY=${MAPS_API_KEY}" \
  api python scripts/seed_dedham.py

echo "==> Done. Verify: curl https://ttf-api-6ac5e3cakq-uc.a.run.app/v1/restaurants | head"
