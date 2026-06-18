#!/usr/bin/env bash
# Cloud agent startup: sync secrets from GCP SM, ensure web env + firebase SA exist.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

read_env_file() {
  local key="$1" file="${2:-.env.defaults}"
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

read_kv_safe() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true
}

env_or_file() {
  local key="$1"
  local from_env="${!key:-}"
  if [[ -n "$from_env" ]]; then
    printf '%s' "$from_env"
    return
  fi
  local val
  val="$(read_env_file "$key" ".env")"
  [[ -n "$val" ]] && printf '%s' "$val" && return
  read_env_file "$key" ".env.defaults"
}

emulator_host="$(env_or_file FIREBASE_AUTH_EMULATOR_HOST)"
use_emulator=false
[[ -n "$emulator_host" ]] && use_emulator=true

if $use_emulator; then
  mkdir -p .secrets
  echo '{}' > .secrets/firebase-sa.json
  cp .secrets/firebase-sa.json firebase-sa.json 2>/dev/null || true
  WEB="$ROOT/.secrets/web.env.local"
  {
    echo "VITE_API_URL=http://localhost:8080"
    echo "VITE_USE_AUTH_EMULATOR=true"
    echo "VITE_FIREBASE_API_KEY=fake-api-key-for-emulator"
    echo "VITE_FIREBASE_AUTH_DOMAIN=localhost"
    echo "VITE_FIREBASE_PROJECT_ID=ttf-restaurant-dev"
  } >"$WEB"
  cp "$WEB" "$ROOT/web/.env.local"
  echo "Cloud env bootstrap: Firebase emulator mode (skipping Secret Manager sync)"
else
  if [[ -n "${GCP_DEV_SYNC_SA_JSON:-}" ]] || [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" ]] \
    || (command -v gcloud >/dev/null 2>&1 \
      && gcloud auth application-default print-access-token \
        --project="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}" >/dev/null 2>&1); then
    bash "$ROOT/scripts/sync-secrets.sh" || {
      echo "WARN: sync-secrets.sh failed — set GCP_DEV_SYNC_SA_JSON Runtime Secret or gcloud ADC" >&2
    }
  else
    echo "WARN: No GCP credentials — set GCP_DEV_SYNC_SA_JSON in Cursor Runtime Secrets" >&2
    echo "      See docs/CLOUD_AGENT.md" >&2
    mkdir -p .secrets
    [[ -f firebase-sa.json ]] && cp firebase-sa.json .secrets/firebase-sa.json 2>/dev/null || echo '{}' > .secrets/firebase-sa.json
  fi
fi

if [[ -d web && ! -d web/node_modules ]]; then
  echo "Installing web npm dependencies…"
  (cd web && npm install --no-fund --no-audit)
fi

maps_api="$(read_kv_safe .secrets/api.env MAPS_API_KEY)"
maps_web="$(read_kv_safe .secrets/web.env.local VITE_GOOGLE_MAPS_API_KEY)"
github_pat="$(read_kv_safe .secrets/mcp.env GITHUB_PERSONAL_ACCESS_TOKEN)"
[[ -n "$github_pat" ]] && export GH_TOKEN="$github_pat"

sa_size=0
[[ -f .secrets/firebase-sa.json ]] && sa_size=$(wc -c <.secrets/firebase-sa.json | tr -d ' ')

echo "Cloud env bootstrap:"
echo "  auth mode:         $($use_emulator && echo emulator || echo secret-manager-sync)"
echo "  .secrets/api.env:  $([[ -f .secrets/api.env ]] && echo yes || echo missing)"
echo "  MAPS_API_KEY:      $([[ -n "$maps_api" ]] && echo set || echo MISSING)"
echo "  VITE_GOOGLE_MAPS:  $([[ -n "$maps_web" ]] && echo set || echo MISSING)"
echo "  firebase-sa.json:  $([[ "$sa_size" -gt 10 ]] && echo set || echo MISSING)"
echo "  GitHub PAT (MCP):  $([[ -n "$github_pat" ]] && echo set || echo missing)"
echo "  web/.env.local:    synced from .secrets/"
