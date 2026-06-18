#!/usr/bin/env bash
# Start local full stack for cloud-agent evaluation (real Firebase by default).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

bash .cursor/scripts/bootstrap-cloud-env.sh
bash .cursor/scripts/start-docker.sh

use_emulator=false
if grep -qE '^FIREBASE_AUTH_EMULATOR_HOST=.+' .env 2>/dev/null; then
  use_emulator=true
fi

if $use_emulator; then
  echo "Starting postgres, api, firebase-emulator…"
  docker compose --profile emulator up --build -d postgres api firebase-emulator
  bash .cursor/scripts/seed-emulator-user.sh || true
else
  echo "Starting postgres, api (real Firebase — sign in with ttf-restaurant-dev user)…"
  docker compose up --build -d postgres api
fi

echo "Waiting for API…"
for _ in $(seq 1 30); do
  if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -sf http://localhost:8080/health | head -c 200
echo ""

echo ""
echo "Local stack:"
echo "  API:       http://localhost:8080/health"
if $use_emulator; then
  echo "  Emulator:  http://localhost:4000"
else
  echo "  Auth:      real Firebase (ttf-restaurant-dev)"
fi
echo "  Web dev:   cd web && npm run dev  → http://localhost:5173"
echo "  app.dev:   DEV_TEST_EMAIL / DEV_TEST_PASSWORD Runtime Secrets"
