#!/usr/bin/env bash
# Local CI parity checks — run before push: ./scripts/ci-check.sh
# Installed automatically via: ./scripts/setup-githooks.sh
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
MODE="smart"

usage() {
  cat <<'EOF'
Usage: ./scripts/ci-check.sh [--all | --pre-push]

  --all       Run web, API, and Terraform checks (ignores changed files)
  --pre-push  Infer changed files from refs passed on stdin (git pre-push hook)

Default (smart): run checks only for paths changed vs upstream/main (or last commit).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all)
      RUN_WEB=true
      RUN_API=true
      RUN_INFRA=true
      MODE="all"
      shift
      ;;
    --pre-push)
      MODE="pre-push"
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

if [[ "$MODE" != "all" ]]; then
  changed="$(collect_changed_files)"
  if echo "$changed" | grep -qE '^web/'; then RUN_WEB=true; fi
  if echo "$changed" | grep -qE '^api/'; then RUN_API=true; fi
  if echo "$changed" | grep -qE '^infra/terraform/'; then RUN_INFRA=true; fi
  if echo "$changed" | grep -qE '^\.github/workflows/(ci|web|api|terraform)\.yml'; then
    RUN_WEB=true
    RUN_API=true
    RUN_INFRA=true
  fi
fi

if ! $RUN_WEB && ! $RUN_API && ! $RUN_INFRA; then
  echo "ci-check: no relevant changes — skipping (use --all to force)"
  exit 0
fi

fail() {
  echo "::error:: $1" >&2
  exit 1
}

warn_cross_stack() {
  local changed="$1"
  if echo "$changed" | grep -qE '^web/src/api/' && ! echo "$changed" | grep -qE '^api/'; then
    echo "⚠️  web API client changed but api/ did not — deploy API workflow after push if endpoints changed."
  fi
  if echo "$changed" | grep -qE '^api/ttf_api/routers/' && ! echo "$changed" | grep -qE '^web/'; then
    echo "ℹ️  API routes changed — web may need redeploy if response shapes changed."
  fi
}

if [[ "$MODE" != "all" ]]; then
  warn_cross_stack "$(collect_changed_files)"
fi

echo "=== TTF ci-check ($MODE) ==="

if $RUN_WEB; then
  echo "→ web: npm ci + build"
  command -v npm >/dev/null 2>&1 || fail "npm not found"
  (
    cd web
    npm ci
    VITE_API_URL="${VITE_API_URL:-https://example.com}" \
    VITE_FIREBASE_API_KEY="${VITE_FIREBASE_API_KEY:-ci-dummy}" \
    VITE_FIREBASE_AUTH_DOMAIN="${VITE_FIREBASE_AUTH_DOMAIN:-ci.example.com}" \
    VITE_FIREBASE_PROJECT_ID="${VITE_FIREBASE_PROJECT_ID:-ci-project}" \
    VITE_GOOGLE_MAPS_API_KEY="${VITE_GOOGLE_MAPS_API_KEY:-}" \
    npm run build
  )
  echo "✓ web build"
fi

if $RUN_API; then
  echo "→ api: python compile + docker build"
  command -v python >/dev/null 2>&1 || command -v python3 >/dev/null 2>&1 || fail "python not found"
  PY=python
  command -v python3 >/dev/null 2>&1 && PY=python3
  $PY -m compileall -q api/ttf_api
  command -v docker >/dev/null 2>&1 || fail "docker not found (required for API image build)"
  docker build -q ./api >/dev/null
  echo "✓ api build"
fi

if $RUN_INFRA; then
  echo "→ infra: terraform fmt + validate"
  command -v terraform >/dev/null 2>&1 || fail "terraform not found (install 1.9+ or skip with no infra/ changes)"
  terraform fmt -check -recursive infra/terraform
  (
    cd infra/terraform/environments/dev
    terraform init -backend=false -input=false >/dev/null
    terraform validate
  )
  echo "✓ terraform validate"
fi

echo "=== ci-check passed ==="
