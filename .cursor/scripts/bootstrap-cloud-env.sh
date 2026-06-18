#!/usr/bin/env bash
# Cloud agent startup: ensure .env + web/.env.local + firebase-sa.json exist.
# Defaults to real Firebase unless FIREBASE_AUTH_EMULATOR_HOST is set.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

read_env_file() {
  local key="$1" file="${2:-.env}"
  [[ -f "$file" ]] || return 0
  local line
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 || true)"
  [[ -n "$line" ]] || return 0
  local value="${line#*=}"
  value="${value%$'\r'}"
  if [[ "$value" =~ ^\".*\"$ ]]; then value="${value:1:${#value}-2}"; fi
  if [[ "$value" =~ ^\'.*\'$ ]]; then value="${value:1:${#value}-2}"; fi
  printf '%s' "$value"
}

set_env_kv_if_empty() {
  local file="$1" key="$2" value="$3"
  [[ -n "$value" ]] || return 0
  local current
  current="$(read_env_file "$key" "$file")"
  [[ -z "$current" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

env_or_file() {
  local key="$1"
  local from_env="${!key:-}"
  if [[ -n "$from_env" ]]; then
    printf '%s' "$from_env"
    return
  fi
  read_env_file "$key"
}

if [[ ! -f .env ]]; then
  if [[ -f .env.cloud.visible.example ]]; then
    cp .env.cloud.visible.example .env
    echo "Created .env from .env.cloud.visible.example — add Runtime Secrets in Cursor"
  else
    cp .env.example .env
  fi
fi

emulator_host="$(env_or_file FIREBASE_AUTH_EMULATOR_HOST)"
use_emulator=false
[[ -n "$emulator_host" ]] && use_emulator=true

# Shared defaults (non-secret).
set_env_kv_if_empty .env AUTH_DEV_MODE "true"
set_env_kv_if_empty .env DATABASE_URL "postgresql://ttf_app:ttf_local@localhost:5432/ttf"
set_env_kv_if_empty .env POSTGRES_CONNECTION_STRING "postgresql://ttf_app:ttf_local@localhost:5432/ttf"
set_env_kv_if_empty .env PILOT_CITY "dedham-ma"
set_env_kv_if_empty .env FIREBASE_PROJECT_ID "ttf-restaurant-dev"
set_env_kv_if_empty .env FIREBASE_SERVICE_ACCOUNT_PATH "firebase-sa.json"
set_env_kv_if_empty .env CORS_ORIGINS '["http://localhost:5173","http://localhost:3000"]'

sa_json="$(env_or_file FIREBASE_SERVICE_ACCOUNT_JSON)"
if [[ -n "$sa_json" ]]; then
  printf '%s' "$sa_json" >firebase-sa.json
elif [[ ! -f firebase-sa.json ]]; then
  if $use_emulator; then
    echo '{}' >firebase-sa.json
  else
    echo '{}' >firebase-sa.json
    echo "WARN: firebase-sa.json empty — set FIREBASE_SERVICE_ACCOUNT_JSON Runtime Secret for real Firebase" >&2
  fi
fi

# Sync web/.env.local from env (Runtime Secrets + visible .env).
{
  echo "VITE_API_URL=$(env_or_file VITE_API_URL)"
  echo "VITE_USE_AUTH_EMULATOR=$(env_or_file VITE_USE_AUTH_EMULATOR)"
  echo "VITE_FIREBASE_API_KEY=$(env_or_file VITE_FIREBASE_API_KEY)"
  echo "VITE_FIREBASE_AUTH_DOMAIN=$(env_or_file VITE_FIREBASE_AUTH_DOMAIN)"
  echo "VITE_FIREBASE_PROJECT_ID=$(env_or_file VITE_FIREBASE_PROJECT_ID)"
  echo "VITE_FIREBASE_APP_ID=$(env_or_file VITE_FIREBASE_APP_ID)"
  echo "VITE_GOOGLE_MAPS_API_KEY=$(env_or_file VITE_GOOGLE_MAPS_API_KEY)"
  echo "VITE_ENABLE_REVIEW_CHAT=$(env_or_file VITE_ENABLE_REVIEW_CHAT)"
  echo "VITE_ADMIN_APP_URL=$(env_or_file VITE_ADMIN_APP_URL)"
} >web/.env.local

set_env_kv_if_empty web/.env.local VITE_API_URL "http://localhost:8080"
set_env_kv_if_empty web/.env.local VITE_FIREBASE_PROJECT_ID "ttf-restaurant-dev"
set_env_kv_if_empty web/.env.local VITE_ENABLE_REVIEW_CHAT "true"

if $use_emulator; then
  set_env_kv_if_empty .env FIREBASE_AUTH_EMULATOR_HOST "firebase-emulator:9099"
  set_env_kv_if_empty web/.env.local VITE_USE_AUTH_EMULATOR "true"
  set_env_kv_if_empty web/.env.local VITE_FIREBASE_API_KEY "fake-api-key-for-emulator"
  set_env_kv_if_empty web/.env.local VITE_FIREBASE_AUTH_DOMAIN "localhost"
else
  set_env_kv_if_empty web/.env.local VITE_FIREBASE_AUTH_DOMAIN "ttf-restaurant-dev.firebaseapp.com"
fi

if [[ -d web && ! -d web/node_modules ]]; then
  echo "Installing web npm dependencies…"
  (cd web && npm install --no-fund --no-audit)
fi

maps_api="$(env_or_file MAPS_API_KEY)"
maps_web="$(env_or_file VITE_GOOGLE_MAPS_API_KEY)"
github_pat="$(env_or_file GITHUB_PERSONAL_ACCESS_TOKEN)"
dev_email="$(env_or_file DEV_TEST_EMAIL)"
vite_fb="$(env_or_file VITE_FIREBASE_API_KEY)"
sa_size=0
[[ -f firebase-sa.json ]] && sa_size=$(wc -c <firebase-sa.json | tr -d ' ')

echo "Cloud env bootstrap:"
echo "  auth mode:         $($use_emulator && echo emulator || echo real-firebase)"
echo "  .env:              $([[ -f .env ]] && echo yes || echo missing)"
echo "  MAPS_API_KEY:      $([[ -n "$maps_api" ]] && echo set || echo MISSING)"
echo "  VITE_GOOGLE_MAPS:  $([[ -n "$maps_web" ]] && echo set || echo MISSING)"
echo "  VITE_FIREBASE_KEY: $([[ -n "$vite_fb" ]] && echo set || echo MISSING)"
echo "  firebase-sa.json:  $([[ "$sa_size" -gt 10 ]] && echo set || echo MISSING — need FIREBASE_SERVICE_ACCOUNT_JSON)"
echo "  GitHub PAT:        $([[ -n "$github_pat" ]] && echo set || echo missing)"
echo "  DEV_TEST_EMAIL:    $([[ -n "$dev_email" ]] && echo set || echo missing)"
echo "  web/.env.local:    synced"
