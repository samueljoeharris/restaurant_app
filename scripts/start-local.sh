#!/usr/bin/env bash
# Local dev: Postgres + API (production Firebase JWT) + optional seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

if [[ ! -f firebase-sa.json ]]; then
  echo "Downloading firebase-sa.json from Secret Manager…"
  gcloud secrets versions access latest \
    --secret=ttf-firebase-admin-sa \
    --project=ttf-restaurant-dev > firebase-sa.json
fi

echo "Starting postgres + api…"
docker compose up postgres api --build -d

echo "Waiting for API…"
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

REST_COUNT="$(curl -sf http://localhost:8080/v1/restaurants 2>/dev/null | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)"
if [[ "$REST_COUNT" == "0" ]]; then
  echo "Seeding Dedham restaurants (first run)…"
  MAPS_API_KEY="$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project=ttf-restaurant-dev)"
  docker compose run --rm -e "MAPS_API_KEY=$MAPS_API_KEY" api python scripts/seed_restaurants.py
fi

echo ""
echo "API ready: http://localhost:8080/health"
echo "Web:       cd web && npm run dev  →  http://localhost:5173"
echo "Admin:     cd web && npm run dev:admin  →  http://localhost:5173/admin"
echo "           (sign out/in after set_admin_claim.py so the admin claim loads)"
echo ""
echo "Grant admin (once):"
echo "  docker compose run --rm api python scripts/set_admin_claim.py --email YOU@example.com"
