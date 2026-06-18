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

echo "=== Environment audit ($(date -u +%Y-%m-%dT%H:%MZ)) ==="
echo ""
echo "Files:"
for f in .env web/.env.local firebase-sa.json; do
  if [[ -f "$f" ]]; then echo "  $f: present ($(wc -c <"$f" | tr -d ' ') bytes)"
  else echo "  $f: missing"; fi
done
echo ""
echo "API (.env):"
echo "  MAPS_API_KEY:                 $(status "$(read_kv .env MAPS_API_KEY)")"
echo "  GEMINI_API_KEY:               $(status "$(read_kv .env GEMINI_API_KEY)")"
echo "  GITHUB_PERSONAL_ACCESS_TOKEN: $(status "$(read_kv .env GITHUB_PERSONAL_ACCESS_TOKEN)")"
echo "  FIREBASE_AUTH_EMULATOR_HOST:  $(status "$(read_kv .env FIREBASE_AUTH_EMULATOR_HOST)")"
echo "  AUTH_DEV_MODE:                $(read_kv .env AUTH_DEV_MODE || echo unset)"
echo "  CORS_ORIGINS:                 $(read_kv .env CORS_ORIGINS | head -c 60)$( [[ $(read_kv .env CORS_ORIGINS | wc -c) -gt 60 ]] && echo …)"
echo ""
echo "Web (web/.env.local):"
echo "  VITE_API_URL:                 $(read_kv web/.env.local VITE_API_URL)"
echo "  VITE_USE_AUTH_EMULATOR:       $(read_kv web/.env.local VITE_USE_AUTH_EMULATOR)"
echo "  VITE_GOOGLE_MAPS_API_KEY:     $(status "$(read_kv web/.env.local VITE_GOOGLE_MAPS_API_KEY)")"
echo "  VITE_FIREBASE_API_KEY:        $(status "$(read_kv web/.env.local VITE_FIREBASE_API_KEY)")"
echo ""
echo "Optional browser testing:"
echo "  DEV_TEST_EMAIL:               $(status "$(read_kv .env DEV_TEST_EMAIL)")"
echo ""
sa_size="$(wc -c <firebase-sa.json 2>/dev/null | tr -d ' ' || echo 0)"
if [[ "$sa_size" -le 4 ]]; then
  echo "firebase-sa.json: empty/minimal (OK for emulator)"
else
  echo "firebase-sa.json: non-empty ($sa_size bytes) — prod JWT verify"
fi
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
echo "See docs/SECRETS_MATRIX.md for where to set each value."
