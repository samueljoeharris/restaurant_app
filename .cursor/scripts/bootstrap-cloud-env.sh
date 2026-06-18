#!/usr/bin/env bash
# Cloud agent startup: materialize .env files from repo examples + Cursor-injected secrets.
# Safe to re-run; only overwrites generated keys when the matching env var is set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

set_env_kv() {
  local file="$1" key="$2" value="$3"
  [[ -n "$value" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$file"
  fi
}

if [[ ! -f .env ]]; then
  cp .env.example .env
fi

# Emulator-first local stack (no production Firebase SA required).
set_env_kv .env FIREBASE_AUTH_EMULATOR_HOST "firebase-emulator:9099"
set_env_kv .env AUTH_DEV_MODE "true"
set_env_kv .env MAPS_API_KEY "${MAPS_API_KEY:-}"
set_env_kv .env GEMINI_API_KEY "${GEMINI_API_KEY:-}"
set_env_kv .env GITHUB_PERSONAL_ACCESS_TOKEN "${GITHUB_PERSONAL_ACCESS_TOKEN:-}"

if [[ -n "${FIREBASE_SERVICE_ACCOUNT_JSON:-}" ]]; then
  printf '%s' "$FIREBASE_SERVICE_ACCOUNT_JSON" >firebase-sa.json
elif [[ ! -f firebase-sa.json ]]; then
  echo '{}' >firebase-sa.json
fi

if [[ ! -f web/.env.local ]]; then
  cp web/.env.example web/.env.local
fi

{
  echo "VITE_API_URL=http://localhost:8080"
  echo "VITE_USE_AUTH_EMULATOR=true"
  echo "VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY:-fake-api-key-for-emulator}"
  echo "VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN:-localhost}"
  echo "VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-ttf-restaurant-dev}"
  echo "VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID:-}"
  echo "VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY:-}"
  echo "VITE_ENABLE_REVIEW_CHAT=${VITE_ENABLE_REVIEW_CHAT:-true}"
} >web/.env.local

# Optional: real Firebase web SDK when testing against app.dev tokens locally.
if [[ -n "${VITE_FIREBASE_API_KEY:-}" && "${VITE_USE_AUTH_EMULATOR:-true}" == "false" ]]; then
  set_env_kv web/.env.local VITE_USE_AUTH_EMULATOR "false"
  set_env_kv web/.env.local VITE_API_URL "${VITE_API_URL:-https://api.dev.littlescout.app}"
fi

if [[ -d web && ! -d web/node_modules ]]; then
  echo "Installing web npm dependencies…"
  (cd web && npm install --no-fund --no-audit)
fi

echo "Cloud env ready (.env, web/.env.local, firebase-sa.json)"
