#!/usr/bin/env bash
# First-run verify for a new Cursor Cloud Agent VM (real Firebase dev).
# Requires: visible env from .env.cloud.visible.example + Runtime Secret GCP_DEV_SYNC_SA_JSON
#
# Usage (paste into a new agent chat or run in terminal):
#   bash .cursor/scripts/cloud-agent-bootstrap.sh
#
# Never prints secret values — only set/missing and byte lengths.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
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

key_status() {
  local val="$1"
  if [[ -z "${val// }" ]]; then echo "MISSING"
  else echo "set (${#val} bytes)"; fi
}

fail=0
require_key() {
  local file="$1" key="$2" label="${3:-$2}"
  local val
  val="$(read_kv "$file" "$key")"
  local st
  st="$(key_status "$val")"
  echo "  $label: $st"
  if [[ "$st" == MISSING ]]; then fail=1; fi
}

echo "=== Cloud Agent bootstrap verify ==="
echo ""

# ── Phase 1: prerequisites ─────────────────────────────────────────────────
if [[ -n "${GCP_DEV_SYNC_SA_JSON:-}" ]]; then
  echo "GCP_DEV_SYNC_SA_JSON: yes"
else
  echo "GCP_DEV_SYNC_SA_JSON: no — set Runtime Secret in Cursor (docs/CLOUD_AGENT.md)" >&2
  exit 1
fi

if [[ -n "${FIREBASE_AUTH_EMULATOR_HOST:-}" ]] || grep -qE '^FIREBASE_AUTH_EMULATOR_HOST=.+' .env 2>/dev/null; then
  echo "auth mode: emulator (skipping Secret Manager)"
else
  echo "auth mode: secret-manager-sync"
fi

bash "$ROOT/.cursor/scripts/start-docker.sh"
echo ""

# ── Phase 2: sync + audit ────────────────────────────────────────────────────
bash "$ROOT/scripts/sync-secrets.sh"
echo ""
bash "$ROOT/scripts/audit-env.sh"
echo ""

# ── Phase 3: core secret gate (no values printed) ─────────────────────────────
echo "Core secret gate:"
require_key "$ROOT/.secrets/api.env" MAPS_API_KEY
require_key "$ROOT/.secrets/web.env.local" VITE_FIREBASE_API_KEY
require_key "$ROOT/.secrets/web.env.local" VITE_GOOGLE_MAPS_API_KEY

sa_size=0
[[ -f "$ROOT/.secrets/firebase-sa.json" ]] && sa_size=$(wc -c <"$ROOT/.secrets/firebase-sa.json" | tr -d ' ')
if [[ "$sa_size" -le 10 ]]; then
  echo "  .secrets/firebase-sa.json: MISSING or minimal ($sa_size bytes)"
  fail=1
else
  echo "  .secrets/firebase-sa.json: set ($sa_size bytes)"
fi

github_pat="$(read_kv "$ROOT/.secrets/mcp.env" GITHUB_PERSONAL_ACCESS_TOKEN)"
echo "  GITHUB_PERSONAL_ACCESS_TOKEN (MCP): $(key_status "$github_pat")"

dev_test_email="$(read_kv "$ROOT/.secrets/dev-test.env" DEV_TEST_EMAIL)"
dev_test_pass="$(read_kv "$ROOT/.secrets/dev-test.env" DEV_TEST_PASSWORD)"
echo "  DEV_TEST_EMAIL (UI tests): $(key_status "$dev_test_email")"
echo "  DEV_TEST_PASSWORD (UI tests): $(key_status "$dev_test_pass")"
if [[ "$(key_status "$dev_test_email")" == MISSING || "$(key_status "$dev_test_pass")" == MISSING ]]; then
  echo "  WARN: browser/UI validation needs ttf-dev-test-credentials in SM — see AGENTS.md"
fi
echo ""

if [[ "$fail" -ne 0 ]]; then
  echo "BLOCKED: core secrets missing after sync. Check WARN lines above and docs/SECRETS_MATRIX.md" >&2
  exit 1
fi

# ── Phase 4: API smoke (no web unless health passes) ─────────────────────────
echo "Starting API stack…"
bash "$ROOT/.cursor/scripts/cloud-eval-up.sh"
echo ""

if curl -sf http://localhost:8080/health >/dev/null 2>&1; then
  echo "READY: API healthy. Start web with: cd web && npm run dev"
else
  echo "BLOCKED: API health check failed after cloud-eval-up.sh" >&2
  exit 1
fi
