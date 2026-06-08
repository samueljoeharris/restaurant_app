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
# Default 5433 avoids conflict with local docker compose postgres on 5432
PROXY_PORT="${CLOUD_SQL_PROXY_PORT:-5433}"
PROXY_PID=""
PROXY_CONTAINER="ttf-cloud-sql-proxy"
COMPOSE_NETWORK="${COMPOSE_NETWORK:-restaurant_app_default}"

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
    echo "==> Starting Cloud SQL proxy on Docker network ${COMPOSE_NETWORK}"
    GCLOUD_CONFIG="${APPDATA:-$HOME/.config}/gcloud"
    ADC_FILE="${GCLOUD_CONFIG}/application_default_credentials.json"
    if [[ ! -f "$ADC_FILE" ]]; then
      echo "ADC not found at ${ADC_FILE}. Run: gcloud auth application-default login"
      exit 1
    fi
    docker rm -f "$PROXY_CONTAINER" &>/dev/null || true
    # MSYS_NO_PATHCONV: Git Bash on Windows must not rewrite /adc.json to a host path
    MSYS_NO_PATHCONV=1 docker run -d --name "$PROXY_CONTAINER" \
      --network "$COMPOSE_NETWORK" \
      -v "${ADC_FILE}:/adc.json:ro" \
      gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.14.1 \
      --credentials-file=/adc.json \
      --address 0.0.0.0 \
      --port 5432 \
      "$INSTANCE"
    DB_HOST="$PROXY_CONTAINER"
    PROXY_PORT=5432
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
DB_HOST="${DB_HOST:-${DOCKER_DB_HOST:-host.docker.internal}}"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${PROXY_PORT}/${DB_NAME}"

export MAPS_API_KEY
MAPS_API_KEY="$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project="$PROJECT_ID")"

echo "==> Running seed_dedham.py against Cloud SQL"
API_IMAGE="${API_IMAGE:-restaurant_app-api:latest}"
docker run --rm --network "$COMPOSE_NETWORK" \
  -e "DATABASE_URL=${DATABASE_URL}" \
  -e "MAPS_API_KEY=${MAPS_API_KEY}" \
  "$API_IMAGE" \
  python scripts/seed_dedham.py

echo "==> Done. Verify: curl https://ttf-api-6ac5e3cakq-uc.a.run.app/v1/restaurants | head"
