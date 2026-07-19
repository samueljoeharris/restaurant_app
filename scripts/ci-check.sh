#!/usr/bin/env bash
# Local CI parity checks (Docker-first) — run before push: ./scripts/ci-check.sh
# Installed automatically via: ./scripts/setup-githooks.sh
#
# Path filters: scripts/ci_path_filters.py (must match .github/workflows/deploy.yml)
set -euo pipefail

if [[ "${SKIP_CI:-}" == "1" ]]; then
  echo "ci-check: SKIP_CI=1 — skipping"
  exit 0
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RUN_WEB=false
RUN_API=false
RUN_INFRA=false
RUN_IOS=false
RUN_TOKENS=false
RUN_SECRETS=false
MODE="smart"

# Dummy Vite env for web Docker builds (same as GitHub CI).
VITE_CI_ARGS=(
  --build-arg "VITE_API_URL=${VITE_API_URL:-https://ci.example.com}"
  --build-arg "VITE_FIREBASE_API_KEY=${VITE_FIREBASE_API_KEY:-ci-dummy}"
  --build-arg "VITE_FIREBASE_AUTH_DOMAIN=${VITE_FIREBASE_AUTH_DOMAIN:-ci.example.com}"
  --build-arg "VITE_FIREBASE_PROJECT_ID=${VITE_FIREBASE_PROJECT_ID:-ci-project}"
  --build-arg "VITE_FIREBASE_APP_ID=${VITE_FIREBASE_APP_ID:-1:000000000000:web:ci-dummy}"
  --build-arg "VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY:-}"
  --build-arg "VITE_ENABLE_REVIEW_CHAT=${VITE_ENABLE_REVIEW_CHAT:-true}"
)

usage() {
  cat <<'EOF'
Usage: ./scripts/ci-check.sh [--all | --pre-push]

  --all       Run web, API, and Terraform checks (ignores changed files)
  --pre-push  Infer changed files from refs passed on stdin (git pre-push hook)

Default (smart): run checks only for paths changed vs upstream/main (or last commit).

Requires Docker (and Docker Compose for Terraform checks).
EOF
}

require_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "::error:: docker not found — install Docker Desktop locally or check the Devin environment blueprint" >&2
    exit 1
  }
  docker info >/dev/null 2>&1 || {
    echo "::error:: Docker daemon is not running" >&2
    exit 1
  }
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      RUN_WEB=true
      RUN_API=true
      RUN_INFRA=true
      RUN_IOS=true
      RUN_TOKENS=true
      RUN_SECRETS=true
      MODE="all"
      shift
      ;;
    --pre-push)
      MODE="pre-push"
      RUN_SECRETS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

collect_changed_files() {
  local range files=""
  if [[ "$MODE" == "pre-push" ]]; then
    while read -r local_ref local_sha remote_ref remote_sha; do
      [[ -n "${remote_ref:-}" ]] || continue
      if [[ "$remote_ref" != refs/heads/* ]]; then
        continue
      fi
      if [[ "$remote_sha" =~ ^0+$ ]]; then
        range="$local_sha"
      else
        range="$remote_sha..$local_sha"
      fi
      files+="$(git diff --name-only "$range" 2>/dev/null || true)"$'\n'
    done
  else
    if git rev-parse --verify origin/main >/dev/null 2>&1; then
      range="$(git merge-base HEAD origin/main)..HEAD"
      files="$(git diff --name-only "$range" 2>/dev/null || true)"
    else
      files="$(git diff --name-only HEAD~1..HEAD 2>/dev/null || git ls-files)"
    fi
  fi
  printf '%s' "$files"
}

apply_path_filters() {
  local changed="$1"
  local flags
  flags="$(printf '%s\n' "$changed" | python3 "$ROOT/scripts/ci_path_filters.py" --shell-env)"
  eval "$flags"
}

if [[ "$MODE" != "all" ]]; then
  apply_path_filters "$(collect_changed_files)"
  if echo "$(collect_changed_files)" | grep -qE '^(\.gitleaks\.toml|scripts/secret-scan\.sh)'; then
    RUN_SECRETS=true
  fi
fi

if ! $RUN_WEB && ! $RUN_API && ! $RUN_INFRA && ! $RUN_IOS && ! $RUN_TOKENS && ! $RUN_SECRETS; then
  echo "ci-check: no relevant changes — skipping (use --all to force)"
  exit 0
fi

fail() {
  echo "::error:: $1" >&2
  exit 1
}

require_docker

echo "=== TTF ci-check ($MODE, Docker) ==="

if $RUN_SECRETS; then
  bash "$ROOT/scripts/secret-scan.sh" detect
fi

if $RUN_TOKENS; then
  bash "$ROOT/scripts/verify-design-tokens.sh"
fi

if $RUN_WEB; then
  echo "→ web: docker build (web/Dockerfile)"
  docker build "${VITE_CI_ARGS[@]}" -t ttf-web-ci ./web
  echo "✓ web build"
fi

if $RUN_API; then
  echo "→ api: docker build + compileall + app import (api/Dockerfile)"
  docker build -t ttf-api-ci ./api
  docker run --rm ttf-api-ci python -m compileall -q ttf_api
  # Import the app: catches startup-time failures (route config, bad imports)
  # that compileall misses — same failure mode as a Cloud Run boot crash.
  docker run --rm ttf-api-ci python -c "from ttf_api.main import app"
  docker run --rm ttf-api-ci python -m unittest tests.test_security_config tests.test_write_guards tests.test_place_id -q
  echo "→ api: pip-audit dependency check"
  docker run --user root --rm ttf-api-ci /bin/sh -c "pip install --quiet pip-audit && pip-audit -r /app/requirements.txt"
  echo "✓ api build"
fi

if $RUN_INFRA; then
  echo "→ infra: terraform fmt + validate"
  # Compose mounts gcloud ADC (required for init even with -backend=false when backend.tf exists).
  docker compose run --rm --no-TTY terraform fmt -check -recursive .
  docker compose run --rm --no-TTY terraform -chdir=environments/dev init -backend=false -input=false >/dev/null
  docker compose run --rm --no-TTY terraform -chdir=environments/dev validate
  echo "✓ terraform validate"
fi

if $RUN_IOS && ! $RUN_WEB; then
  echo "ℹ️  ios/** changed — token outputs verified; full Xcode build: Actions → iOS → Run workflow"
fi

echo "=== ci-check passed ==="
