#!/usr/bin/env bash
# Local dev: Postgres + API (production Firebase JWT) + optional seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

echo "Syncing secrets from GCP Secret Manager…"
if ! bash "$ROOT/scripts/sync-secrets.sh"; then
  echo "WARN: sync-secrets.sh failed — using .env fallback if present" >&2
  [[ -f .secrets/firebase-sa.json ]] || [[ -f firebase-sa.json ]] || {
    echo "No firebase-sa.json — run gcloud auth application-default login && ./scripts/sync-secrets.sh" >&2
    exit 1
  }
fi

mkdir -p .secrets
if [[ ! -f .secrets/firebase-sa.json && -f firebase-sa.json ]]; then
  cp firebase-sa.json .secrets/firebase-sa.json
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
  MAPS_API_KEY="$(grep -E '^MAPS_API_KEY=' .secrets/api.env 2>/dev/null | head -1 | cut -d= -f2- || true)"
  if [[ -z "$MAPS_API_KEY" ]]; then
    echo "WARN: MAPS_API_KEY missing — skip seed" >&2
  else
    docker compose run --rm -e "MAPS_API_KEY=$MAPS_API_KEY" api python scripts/seed_restaurants.py
  fi
fi

echo ""
echo "API ready: http://localhost:8080/health"
echo "Web:       cd web && npm run dev  →  http://localhost:5173"
echo "Admin:     cd web && npm run dev:admin  →  http://localhost:5173/admin"
echo ""
echo "Grant admin (once):"
echo "  docker compose run --rm api python scripts/set_admin_claim.py --email YOU@example.com"
