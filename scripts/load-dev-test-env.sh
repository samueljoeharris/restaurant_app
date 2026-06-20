#!/usr/bin/env bash
# Source DEV_TEST_EMAIL / DEV_TEST_PASSWORD from .secrets/dev-test.env (sync-secrets.sh).
# Never prints secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEV_TEST_ENV="$ROOT/.secrets/dev-test.env"

read_dev_test_kv() {
  local key="$1"
  [[ -f "$DEV_TEST_ENV" ]] || return 0
  local line val
  line="$(grep -E "^${key}=" "$DEV_TEST_ENV" 2>/dev/null | head -1 || true)"
  [[ -n "$line" ]] || return 0
  val="${line#*=}"
  val="${val%$'\r'}"
  val="${val#\"}"; val="${val%\"}"
  val="${val#\'}"; val="${val%\'}"
  printf '%s' "$val"
}

export DEV_TEST_EMAIL="${DEV_TEST_EMAIL:-$(read_dev_test_kv DEV_TEST_EMAIL)}"
export DEV_TEST_PASSWORD="${DEV_TEST_PASSWORD:-$(read_dev_test_kv DEV_TEST_PASSWORD)}"
