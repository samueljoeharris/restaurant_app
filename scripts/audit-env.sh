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

echo "=== Environment audit ($(date -u +%Y-%m-%dT%H:%MZ)) ==="
echo ""
echo "Secret sync (.secrets/ from GCP Secret Manager):"
echo "  .secrets/ dir:       $( [[ -d .secrets ]] && echo present || echo missing — run ./scripts/sync-secrets.sh )"
echo "  api.env:             $(file_size "$API_SECRETS")"
echo "  web.env.local:       $(file_size "$WEB_SECRETS")"
echo "  mcp.env:             $(file_size "$MCP_SECRETS")"
echo "  firebase-sa.json:    $(file_size "$FIREBASE_SA")"
echo ""
echo "API secrets (.secrets/api.env):"
echo "  MAPS_API_KEY:                 $(status "$(read_kv "$API_SECRETS" MAPS_API_KEY)")"
echo "  GEMINI_API_KEY:               $(status "$(read_kv "$API_SECRETS" GEMINI_API_KEY)")"
echo "  APPLE_TEAM_ID:                $(status "$(read_kv "$API_SECRETS" APPLE_TEAM_ID)")"
echo ""
echo "Web (.secrets/web.env.local → web/.env.local):"
echo "  VITE_API_URL:                 $(read_kv "$WEB_SECRETS" VITE_API_URL)"
echo "  VITE_GOOGLE_MAPS_API_KEY:     $(status "$(read_kv "$WEB_SECRETS" VITE_GOOGLE_MAPS_API_KEY)")"
echo "  VITE_FIREBASE_API_KEY:        $(status "$(read_kv "$WEB_SECRETS" VITE_FIREBASE_API_KEY)")"
echo ""
echo "MCP (.secrets/mcp.env):"
echo "  GITHUB_PERSONAL_ACCESS_TOKEN: $(status "$(read_kv "$MCP_SECRETS" GITHUB_PERSONAL_ACCESS_TOKEN)")"
echo ""
echo "Config (.env.defaults — committed, non-secret):"
echo "  AUTH_DEV_MODE:                $(read_kv .env.defaults AUTH_DEV_MODE || echo unset)"
echo "  FIREBASE_AUTH_EMULATOR_HOST:  $(status "$(read_kv .env.defaults FIREBASE_AUTH_EMULATOR_HOST)")"
echo ""
sa_size=0
if [[ -f "$FIREBASE_SA" ]]; then
  sa_size="$(wc -c <"$FIREBASE_SA" | tr -d ' ')"
fi
if [[ "$sa_size" -le 4 ]]; then
  echo "firebase-sa.json: empty/minimal (OK for emulator)"
else
  echo "firebase-sa.json: non-empty ($sa_size bytes) — prod JWT verify"
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
