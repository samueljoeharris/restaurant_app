#!/usr/bin/env bash
# Split Mac .env + web/.env.local for Cursor Cloud Agents (visible vs Runtime Secrets).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VISIBLE=".env.cursor-visible"
RUNTIME=".env.cursor-runtime-checklist"

[[ -f .env ]] || { echo "Missing .env" >&2; exit 1; }

# Non-sensitive keys → Cursor Environment variables (agent can see).
VISIBLE_KEYS=(
  DATABASE_URL POSTGRES_CONNECTION_STRING PILOT_CITY PILOT_DISPLAY_NAME
  FIREBASE_PROJECT_ID AUTH_DEV_MODE FIREBASE_SERVICE_ACCOUNT_PATH
  CORS_ORIGINS TTF_GCP_PROJECT_DEV
  VITE_API_URL VITE_FIREBASE_AUTH_DOMAIN VITE_FIREBASE_PROJECT_ID VITE_ENABLE_REVIEW_CHAT
)

# Sensitive keys → Cursor Runtime Secrets (agent sees [REDACTED]).
RUNTIME_KEYS=(
  GITHUB_PERSONAL_ACCESS_TOKEN MAPS_API_KEY GEMINI_API_KEY AUTH_DEV_ADMIN_UIDS
  VITE_FIREBASE_API_KEY VITE_FIREBASE_APP_ID VITE_GOOGLE_MAPS_API_KEY
  FIREBASE_SERVICE_ACCOUNT_JSON DEV_TEST_EMAIL DEV_TEST_PASSWORD
)

read_kv() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || true
}

{
  echo "# Paste into Cursor → Cloud Agents → Environment variables (VISIBLE)"
  echo "# Generated $(date -u +%Y-%m-%d) — real Firebase, no emulator"
  echo ""
  for key in "${VISIBLE_KEYS[@]}"; do
    val="$(read_kv "$key" .env)"
    [[ -z "$val" && -f web/.env.local ]] && val="$(read_kv "$key" web/.env.local)"
    [[ -n "$val" ]] && echo "${key}=${val}"
  done
} >"$VISIBLE"

{
  echo "# Add each name as Cursor → Runtime Secret (values from your Mac files)"
  echo "# Do NOT paste values into visible Environment variables"
  echo ""
  for key in "${RUNTIME_KEYS[@]}"; do
    in_env=false
    grep -qE "^${key}=" .env 2>/dev/null && in_env=true
    grep -qE "^${key}=" web/.env.local 2>/dev/null && in_env=true
    [[ "$key" == "FIREBASE_SERVICE_ACCOUNT_JSON" && -f firebase-sa.json ]] && \
      [[ $(wc -c <firebase-sa.json | tr -d ' ') -gt 10 ]] && in_env=true
    if $in_env; then echo "${key}=<set on Mac — copy to Runtime Secret>"
    else echo "# ${key}=<missing locally>"
    fi
  done
} >"$RUNTIME"

echo "Wrote $VISIBLE ($(wc -l <"$VISIBLE" | tr -d ' ') lines) → Cursor Environment variables"
echo "Wrote $RUNTIME → Runtime Secrets checklist"
echo "See docs/CLOUD_AGENT.md"
