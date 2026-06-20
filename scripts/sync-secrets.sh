#!/usr/bin/env bash
# Pull dev secrets from GCP Secret Manager into .secrets/ (gitignored).
# Source of truth: Secret Manager — write secrets there once, sync everywhere else.
#
# Auth (first match wins):
#   1. GCP_DEV_SYNC_SA_JSON env (Cursor Runtime Secret) → temp ADC + gcloud SA activate
#   2. GOOGLE_APPLICATION_CREDENTIALS already set (SA key → activate for gcloud CLI)
#   3. gcloud Application Default Credentials (local Mac: gcloud auth application-default login)
#
# Usage: ./scripts/sync-secrets.sh
# See docs/SECRETS_MATRIX.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PROJECT="${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}"
SECRETS_DIR="$ROOT/.secrets"
TMP_ADC=""

cleanup() {
  [[ -n "$TMP_ADC" && -f "$TMP_ADC" ]] && rm -f "$TMP_ADC"
}
trap cleanup EXIT

mkdir -p "$SECRETS_DIR"
chmod 700 "$SECRETS_DIR"

activate_gcloud_sa_if_key() {
  local key_file="$1"
  [[ -f "$key_file" ]] || return 0
  grep -q '"type"[[:space:]]*:[[:space:]]*"service_account"' "$key_file" 2>/dev/null || return 0
  gcloud auth activate-service-account --key-file="$key_file" --quiet >/dev/null 2>&1 \
    || echo "WARN: gcloud auth activate-service-account failed — Secret Manager fetch may fail" >&2
}

setup_gcp_auth() {
  if [[ -n "${GCP_DEV_SYNC_SA_JSON:-}" ]]; then
    TMP_ADC="$(mktemp)"
    printf '%s' "$GCP_DEV_SYNC_SA_JSON" >"$TMP_ADC"
    chmod 600 "$TMP_ADC"
    export GOOGLE_APPLICATION_CREDENTIALS="$TMP_ADC"
    activate_gcloud_sa_if_key "$TMP_ADC"
    return 0
  fi
  if [[ -n "${GOOGLE_APPLICATION_CREDENTIALS:-}" && -f "$GOOGLE_APPLICATION_CREDENTIALS" ]]; then
    activate_gcloud_sa_if_key "$GOOGLE_APPLICATION_CREDENTIALS"
    return 0
  fi
  if command -v gcloud >/dev/null 2>&1; then
    if gcloud auth application-default print-access-token --project="$PROJECT" >/dev/null 2>&1; then
      return 0
    fi
  fi
  echo "ERROR: No GCP credentials for Secret Manager." >&2
  echo "  Cursor: set Runtime Secret GCP_DEV_SYNC_SA_JSON (dev-sync SA JSON)" >&2
  echo "  Local:  gcloud auth application-default login" >&2
  echo "  See docs/SECRETS_MATRIX.md" >&2
  exit 1
}

fetch_secret() {
  local secret_id="$1"
  local err_file value
  err_file="$(mktemp)"
  if value="$(gcloud secrets versions access latest \
    --secret="$secret_id" \
    --project="$PROJECT" 2>"$err_file")"; then
    rm -f "$err_file"
    printf '%s' "$value"
    return 0
  fi
  if grep -q PERMISSION_DENIED "$err_file" 2>/dev/null; then
    echo "  WARN: could not fetch $secret_id (permission denied)" >&2
  elif grep -qi NOT_FOUND "$err_file" 2>/dev/null; then
    echo "  WARN: could not fetch $secret_id (not found or no version)" >&2
  elif [[ -s "$err_file" ]]; then
    echo "  WARN: could not fetch $secret_id (see gcloud output above)" >&2
  else
    echo "  WARN: could not fetch $secret_id (empty)" >&2
  fi
  rm -f "$err_file"
}

write_env_kv() {
  local file="$1" key="$2" value="$3"
  [[ -n "$value" ]] || return 0
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" >>"$file"
  fi
}

init_env_file() {
  local file="$1"
  : >"$file"
  chmod 600 "$file"
}

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud CLI required. Install Google Cloud SDK." >&2
  exit 1
fi

setup_gcp_auth

echo "Syncing secrets from $PROJECT → .secrets/"

# ── API secrets ─────────────────────────────────────────────────────────────
API_ENV="$SECRETS_DIR/api.env"
init_env_file "$API_ENV"

MAPS_API="$(fetch_secret ttf-maps-api-key)"
GEMINI="$(fetch_secret ttf-gemini-api-key)"
[[ -n "$MAPS_API" ]] && write_env_kv "$API_ENV" MAPS_API_KEY "$MAPS_API" && echo "  MAPS_API_KEY"
[[ -n "$GEMINI" ]] && write_env_kv "$API_ENV" GEMINI_API_KEY "$GEMINI" && echo "  GEMINI_API_KEY"

APPLE_JSON="$(fetch_secret ttf-apple-sign-in-key)"
if [[ -n "$APPLE_JSON" ]]; then
  python3 - <<'PY' "$APPLE_JSON" "$API_ENV"
import json, sys

cfg = json.loads(sys.argv[1])
path = sys.argv[2]
mapping = {
    "APPLE_TEAM_ID": cfg.get("team_id", ""),
    "APPLE_KEY_ID": cfg.get("key_id", ""),
    "APPLE_PRIVATE_KEY": cfg.get("private_key", ""),
    "APPLE_CLIENT_ID": cfg.get("client_id", "com.samueljoeharris.ttf"),
}

def write_kv(key, val):
    if not val:
        return
    val = val.replace("\n", "\\n")
    with open(path, "a") as f:
        f.write(f"{key}={val}\n")

for k, v in mapping.items():
    write_kv(k, v)
PY
  echo "  APPLE_* (from ttf-apple-sign-in-key)"
fi

# ── Firebase admin SA ───────────────────────────────────────────────────────
FIREBASE_SA="$(fetch_secret ttf-firebase-admin-sa)"
if [[ -n "$FIREBASE_SA" ]]; then
  printf '%s' "$FIREBASE_SA" >"$SECRETS_DIR/firebase-sa.json"
  chmod 600 "$SECRETS_DIR/firebase-sa.json"
  echo "  .secrets/firebase-sa.json"
else
  echo "  WARN: ttf-firebase-admin-sa missing — API JWT verify needs emulator or SA" >&2
fi

# ── Web / Vite ──────────────────────────────────────────────────────────────
WEB_ENV="$SECRETS_DIR/web.env.local"
init_env_file "$WEB_ENV"

# Non-secret web defaults (overridable by visible Cursor env)
write_env_kv "$WEB_ENV" VITE_API_URL "${VITE_API_URL:-http://localhost:8080}"
write_env_kv "$WEB_ENV" VITE_FIREBASE_PROJECT_ID "${VITE_FIREBASE_PROJECT_ID:-ttf-restaurant-dev}"
write_env_kv "$WEB_ENV" VITE_ENABLE_REVIEW_CHAT "${VITE_ENABLE_REVIEW_CHAT:-true}"

FIREBASE_WEB="$(fetch_secret ttf-firebase-web-env)"
if [[ -n "$FIREBASE_WEB" ]]; then
  python3 - <<'PY' "$FIREBASE_WEB" "$WEB_ENV"
import json, sys
cfg = json.loads(sys.argv[1])
path = sys.argv[2]
keys = (
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_APP_ID",
)
with open(path, "a") as f:
    for k in keys:
        v = cfg.get(k, "")
        if v:
            f.write(f"{k}={v}\n")
PY
  echo "  VITE_FIREBASE_* (from ttf-firebase-web-env)"
fi

MAPS_WEB="$(fetch_secret ttf-maps-web-api-key)"
[[ -n "$MAPS_WEB" ]] && write_env_kv "$WEB_ENV" VITE_GOOGLE_MAPS_API_KEY "$MAPS_WEB" && echo "  VITE_GOOGLE_MAPS_API_KEY"

RECAPTCHA="$(fetch_secret ttf-recaptcha-site-key)"
[[ -n "$RECAPTCHA" ]] && write_env_kv "$WEB_ENV" VITE_APP_CHECK_RECAPTCHA_SITE_KEY "$RECAPTCHA" && echo "  VITE_APP_CHECK_RECAPTCHA_SITE_KEY (optional)"

if [[ -f "$ROOT/.env.cloud.visible.example" ]] && grep -q VITE_USE_AUTH_EMULATOR "$ROOT/.env" 2>/dev/null; then
  :
fi
if grep -qE '^FIREBASE_AUTH_EMULATOR_HOST=.+' "$ROOT/.env" 2>/dev/null; then
  write_env_kv "$WEB_ENV" VITE_USE_AUTH_EMULATOR "true"
  write_env_kv "$WEB_ENV" VITE_FIREBASE_API_KEY "fake-api-key-for-emulator"
  write_env_kv "$WEB_ENV" VITE_FIREBASE_AUTH_DOMAIN "localhost"
fi

cp "$WEB_ENV" "$ROOT/web/.env.local"
chmod 600 "$ROOT/web/.env.local"
echo "  web/.env.local"

# ── MCP (GitHub PAT) ────────────────────────────────────────────────────────
MCP_ENV="$SECRETS_DIR/mcp.env"
init_env_file "$MCP_ENV"
GITHUB_PAT="$(fetch_secret ttf-github-pat-mcp)"
if [[ -n "$GITHUB_PAT" ]]; then
  write_env_kv "$MCP_ENV" GITHUB_PERSONAL_ACCESS_TOKEN "$GITHUB_PAT"
  export GH_TOKEN="$GITHUB_PAT"
  echo "  GITHUB_PERSONAL_ACCESS_TOKEN (MCP)"
else
  echo "  WARN: ttf-github-pat-mcp missing — GitHub MCP disabled" >&2
fi

# ── Optional dev test login ───────────────────────────────────────────────────
DEV_TEST="$(fetch_secret ttf-dev-test-credentials)"
if [[ -n "$DEV_TEST" ]]; then
  DEV_TEST_ENV="$SECRETS_DIR/dev-test.env"
  init_env_file "$DEV_TEST_ENV"
  python3 - <<'PY' "$DEV_TEST" "$DEV_TEST_ENV"
import json, sys
cfg = json.loads(sys.argv[1])
path = sys.argv[2]
email = cfg.get("email", "")
password = cfg.get("password", "")
with open(path, "w") as f:
    if email:
        f.write(f"DEV_TEST_EMAIL={email}\n")
    if password:
        f.write(f"DEV_TEST_PASSWORD={password}\n")
PY
  echo "  DEV_TEST_* (optional)"
fi

# ── Synthetic agent user registry ───────────────────────────────────────────
AGENT_REGISTRY="$(fetch_secret ttf-agent-users-registry)"
if [[ -n "$AGENT_REGISTRY" ]]; then
  AGENT_REGISTRY_PATH="$SECRETS_DIR/agent-users-registry.json"
  printf '%s' "$AGENT_REGISTRY" >"$AGENT_REGISTRY_PATH"
  chmod 600 "$AGENT_REGISTRY_PATH"
  echo "  agent-users-registry.json"
fi

echo ""
echo "Sync complete. Run ./scripts/audit-env.sh to verify."

# Ensure docker compose mount path exists
[[ -f "$SECRETS_DIR/firebase-sa.json" ]] || echo '{}' >"$SECRETS_DIR/firebase-sa.json"
chmod 600 "$SECRETS_DIR/firebase-sa.json"
