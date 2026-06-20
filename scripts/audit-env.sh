#!/usr/bin/env bash
# Print env readiness report — never prints secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

read_kv() {
  local file="$1" key="$2"
  [[ -f "$file" ]] || return 0
  local line val
  line="$(grep -E "^${key}=" "$file" 2>/dev/null | head -1 || true)"
  [[ -n "$line" ]] || return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

status() {
  local val="$1"
  if [[ -z "${val// }" ]]; then echo "MISSING"
  else echo "set"; fi
}

file_size() {
  local f="$1"
  if [[ -f "$f" ]]; then echo "present ($(wc -c <"$f" | tr -d ' ') bytes)"
  else echo "missing"; fi
}

API_SECRETS="${ROOT}/.secrets/api.env"
WEB_SECRETS="${ROOT}/.secrets/web.env.local"
MCP_SECRETS="${ROOT}/.secrets/mcp.env"
FIREBASE_SA="${ROOT}/.secrets/firebase-sa.json"
LEGACY_FIREBASE_SA="${ROOT}/firebase-sa.json"

echo "=== Environment audit ($(date -u +%Y-%m-%dT%H:%MZ)) ==="
echo ""
echo "Secret sync (.secrets/ from GCP Secret Manager):"
echo "  .secrets/ dir:       $( [[ -d .secrets ]] && echo present || echo missing — run ./scripts/sync-secrets.sh )"
echo "  api.env:             $(file_size "$API_SECRETS")"
echo "  web.env.local:       $(file_size "$WEB_SECRETS")"
echo "  mcp.env:             $(file_size "$MCP_SECRETS")"
echo "  .secrets/firebase-sa.json: $(file_size "$FIREBASE_SA")"
echo ""
echo "API secrets (.secrets/api.env):"
echo "  MAPS_API_KEY:                 $(status "$(read_kv "$API_SECRETS" MAPS_API_KEY)")"
echo "  GEMINI_API_KEY:               $(status "$(read_kv "$API_SECRETS" GEMINI_API_KEY)")"
echo "  APPLE_TEAM_ID:                $(status "$(read_kv "$API_SECRETS" APPLE_TEAM_ID)")"
echo ""
echo "Web (.secrets/web.env.local → web/.env.local):"
echo "  VITE_API_URL:                 $(read_kv "$WEB_SECRETS" VITE_API_URL)"
echo "  VITE_GOOGLE_MAPS_API_KEY:     $(status "$(read_kv "$WEB_SECRETS" VITE_GOOGLE_MAPS_API_KEY)")"
echo "  VITE_GOOGLE_MAPS_MAP_ID:      $(status "$(read_kv "$WEB_SECRETS" VITE_GOOGLE_MAPS_MAP_ID)")"
echo "  VITE_FIREBASE_API_KEY:        $(status "$(read_kv "$WEB_SECRETS" VITE_FIREBASE_API_KEY)")"
echo ""
echo "MCP (.secrets/mcp.env):"
echo "  GITHUB_PERSONAL_ACCESS_TOKEN: $(status "$(read_kv "$MCP_SECRETS" GITHUB_PERSONAL_ACCESS_TOKEN)")"
echo ""
echo "Config (.env.defaults — committed, non-secret):"
echo "  AUTH_DEV_MODE:                $(read_kv .env.defaults AUTH_DEV_MODE || echo unset)"
echo "  FIREBASE_SERVICE_ACCOUNT_PATH: $(read_kv .env.defaults FIREBASE_SERVICE_ACCOUNT_PATH || echo unset)"
echo "  FIREBASE_AUTH_EMULATOR_HOST:  $(status "$(read_kv .env.defaults FIREBASE_AUTH_EMULATOR_HOST)")"
echo ""
defaults_sa_path="$(read_kv .env.defaults FIREBASE_SERVICE_ACCOUNT_PATH)"
if [[ "$defaults_sa_path" != ".secrets/firebase-sa.json" ]]; then
  echo "WARN: .env.defaults FIREBASE_SERVICE_ACCOUNT_PATH should be .secrets/firebase-sa.json (got: ${defaults_sa_path:-unset})"
fi
env_sa_path="$(read_kv .env FIREBASE_SERVICE_ACCOUNT_PATH)"
if [[ -n "$env_sa_path" && "$env_sa_path" == "firebase-sa.json" ]]; then
  echo "WARN: .env overrides FIREBASE_SERVICE_ACCOUNT_PATH=firebase-sa.json (legacy repo-root path)"
fi
if [[ -f "$LEGACY_FIREBASE_SA" ]]; then
  echo "WARN: legacy repo-root firebase-sa.json still present — safe to delete after sync"
fi
sa_size=0
if [[ -f "$FIREBASE_SA" ]]; then
  sa_size="$(wc -c <"$FIREBASE_SA" | tr -d ' ')"
fi
if [[ "$sa_size" -le 4 ]]; then
  echo ".secrets/firebase-sa.json: empty/minimal (OK for emulator)"
else
  echo ".secrets/firebase-sa.json: non-empty ($sa_size bytes) — prod JWT verify"
fi
echo ""
echo "Native API runtime:"
if [[ -d .venv ]]; then echo "  .venv: present"
else echo "  .venv: missing (created on first ./scripts/run-api.sh)"; fi
if docker compose ps api --status running 2>/dev/null | grep -q api; then
  echo "  API mode: Docker container (legacy --docker-api or manual compose)"
elif curl -sf http://localhost:8080/health >/dev/null 2>&1; then
  echo "  API mode: native uvicorn on :8080 (up)"
else
  echo "  API mode: not running"
fi
echo ""
echo "Legacy (optional fallback during migration):"
echo "  .env:                         $(file_size "${ROOT}/.env")"
echo ""
echo "Docker:"
if docker info >/dev/null 2>&1; then echo "  daemon: running"
else echo "  daemon: not running"; fi
if curl -sf http://localhost:8080/health >/dev/null 2>&1; then echo "  API :8080: up"
else echo "  API :8080: down"; fi
if curl -sf http://localhost:5173/ >/dev/null 2>&1; then echo "  Vite :5173: up"
else echo "  Vite :5173: down"; fi
echo ""
echo "Deployed dev (no secrets needed):"
curl -sf -o /dev/null -w "  app.dev HTTP: %{http_code}\n" https://app.dev.littlescout.app/ 2>/dev/null || echo "  app.dev: unreachable"
curl -sf -o /dev/null -w "  api.dev health: %{http_code}\n" https://api.dev.littlescout.app/health 2>/dev/null || echo "  api.dev: unreachable"
echo ""
echo "Write secrets once in GCP Secret Manager, then: ./scripts/sync-secrets.sh"
echo "See docs/SECRETS_MATRIX.md"
