#!/usr/bin/env bash
# Local dev: Postgres + native API (production Firebase JWT) + optional seed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

USE_DOCKER_API=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker-api) USE_DOCKER_API=true; shift ;;
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/start-local.sh [--docker-api]

  Default: Postgres in Docker + native uvicorn on :8080
  --docker-api  Legacy path: postgres + api containers via docker compose
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

echo "Syncing secrets from GCP Secret Manager…"
if ! bash "$ROOT/scripts/sync-secrets.sh"; then
  echo "WARN: sync-secrets.sh failed — using .env fallback if present" >&2
  [[ -f .secrets/firebase-sa.json ]] || {
    echo "No .secrets/firebase-sa.json — run gcloud auth application-default login && ./scripts/sync-secrets.sh" >&2
    exit 1
  }
fi

mkdir -p .secrets
if [[ ! -f .secrets/firebase-sa.json ]]; then
  echo "No .secrets/firebase-sa.json — run ./scripts/sync-secrets.sh" >&2
  exit 1
fi

API_PID=""
cleanup() {
  if [[ -n "$API_PID" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
    wait "$API_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

if $USE_DOCKER_API; then
  echo "Starting postgres + api (Docker)…"
  docker compose up postgres api --build -d
else
  echo "Starting postgres (Docker)…"
  docker compose up postgres -d
  echo "Starting native API…"
  bash "$ROOT/scripts/run-api.sh" --reload --foreground &
  API_PID=$!
fi

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
  elif $USE_DOCKER_API; then
    docker compose run --rm -e "MAPS_API_KEY=$MAPS_API_KEY" api python scripts/seed_restaurants.py
  else
    bash "$ROOT/scripts/run-api-script.sh" seed_restaurants.py
  fi
fi

if $USE_DOCKER_API; then
  trap - EXIT INT TERM
else
  trap - EXIT INT TERM
  echo ""
  echo "Native API running (PID $API_PID). Ctrl+C or exit shell stops it."
fi

echo ""
echo "API ready: http://localhost:8080/health"
echo "Web:       cd web && npm run dev  →  http://localhost:5173"
echo "Admin:     cd web && npm run dev:admin  →  http://localhost:5173/admin"
echo ""
echo "Grant admin (once):"
if $USE_DOCKER_API; then
  echo "  docker compose run --rm api python scripts/set_admin_claim.py --email YOU@example.com"
else
  echo "  ./scripts/run-api-script.sh set_admin_claim.py --email YOU@example.com"
fi

if ! $USE_DOCKER_API; then
  wait "$API_PID"
fi
