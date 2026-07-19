#!/usr/bin/env bash
# Local end-to-end test in Docker: API integration tests + runtime smoke + web unit tests.
# Run before push to catch startup, migration, and cross-stack issues that compile/build checks miss.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

require_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "::error:: docker not found" >&2
    exit 1
  }
  docker info >/dev/null 2>&1 || {
    echo "::error:: Docker daemon is not running" >&2
    exit 1
  }
}

usage() {
  cat <<'EOF'
Usage: ./scripts/ci-e2e-local.sh [--skip-build]

  --skip-build   Reuse already-built images instead of rebuilding
EOF
}

SKIP_BUILD=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
done

require_docker

COMPOSE="docker compose -f docker-compose.test.yml"

cleanup() {
  echo "→ cleanup"
  $COMPOSE down -v || true
}
trap cleanup EXIT INT TERM

echo "=== TTF Docker e2e tests ==="

if ! $SKIP_BUILD; then
  echo "→ building images"
  $COMPOSE build
fi

echo "→ API integration tests (postgres + pytest)"
$COMPOSE run --rm api-test

echo "→ API smoke tests (migrations + uvicorn + HTTP)"
$COMPOSE up --abort-on-container-exit api-smoke smoke-test

echo "→ Web unit tests (vitest)"
$COMPOSE run --rm web-test

echo "=== Docker e2e tests passed ==="
