#!/usr/bin/env bash
# Create a Firebase Auth emulator user for local sign-in (idempotent).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

read_env_file() {
  local key="$1"
  grep -E "^${key}=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//'
}

EMAIL="${DEV_TEST_EMAIL:-$(read_env_file DEV_TEST_EMAIL)}"
PASSWORD="${DEV_TEST_PASSWORD:-$(read_env_file DEV_TEST_PASSWORD)}"
EMAIL="${EMAIL:-pilot@ttf.test}"
PASSWORD="${PASSWORD:-pilotpass123}"

if ! curl -sf http://localhost:9099/ >/dev/null 2>&1; then
  echo "Firebase emulator not reachable on :9099 — skip user seed"
  exit 0
fi

RESP="$(curl -sf -X POST \
  "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\",\"returnSecureToken\":true}" 2>&1)" || true

if echo "$RESP" | grep -q '"idToken"'; then
  echo "Emulator user ready: ${EMAIL}"
elif echo "$RESP" | grep -qi 'EMAIL_EXISTS'; then
  echo "Emulator user already exists: ${EMAIL}"
else
  echo "Emulator user seed: ${RESP:-failed}" >&2
fi
