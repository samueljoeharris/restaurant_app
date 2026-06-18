#!/usr/bin/env bash
# Start local full stack for cloud-agent evaluation (emulator + API + optional Vite).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

bash .cursor/scripts/bootstrap-cloud-env.sh
bash .cursor/scripts/start-docker.sh

echo "Starting postgres, api, firebase-emulator…"
docker compose --profile emulator up --build -d postgres api firebase-emulator

echo "Waiting for API…"
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf http://localhost:8080/health | head -c 200
echo ""

# Seed emulator test user when credentials provided (or defaults).
bash .cursor/scripts/seed-emulator-user.sh || true

echo ""
echo "Local stack:"
echo "  API:       http://localhost:8080/health"
echo "  Emulator:  http://localhost:4000"
echo "  Web dev:   cd web && npm run dev  → http://localhost:5173"
echo "  app.dev:   use DEV_TEST_EMAIL / DEV_TEST_PASSWORD from .env"
