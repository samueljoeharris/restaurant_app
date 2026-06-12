#!/usr/bin/env bash
# Local Terraform plan against dev GCP (read-only — does NOT apply).
# Mirrors GitHub Actions: terraform.yml plan job with ci.tfvars.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

usage() {
  cat <<'EOF'
Usage: ./scripts/terraform-plan-local.sh [extra terraform plan args...]

Runs fmt check, init, validate, and plan for infra/terraform/environments/dev
using committed ci.tfvars. Requires Docker + gcloud application-default login.

Examples:
  ./scripts/terraform-plan-local.sh
  ./scripts/terraform-plan-local.sh -out=tfplan

Never run terraform apply locally unless you intend to change dev GCP.
EOF
}

require_docker() {
  command -v docker >/dev/null 2>&1 || {
    echo "::error:: docker not found — install Docker Desktop and retry" >&2
    exit 1
  }
  docker info >/dev/null 2>&1 || {
    echo "::error:: Docker daemon is not running" >&2
    exit 1
  }
}

require_gcloud_adc() {
  if ! gcloud auth application-default print-access-token >/dev/null 2>&1; then
    echo "::error:: gcloud application-default credentials missing" >&2
    echo "Run: gcloud config set project ttf-restaurant-dev && gcloud auth application-default login" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      break
      ;;
  esac
done

require_docker
require_gcloud_adc

echo "=== TTF terraform plan (local, dev, plan-only) ==="
echo "→ fmt -check"
docker compose run --rm --no-TTY terraform fmt -check -recursive .

echo "→ init"
docker compose run --rm --no-TTY terraform -chdir=environments/dev init -input=false

echo "→ validate"
docker compose run --rm --no-TTY terraform -chdir=environments/dev validate

echo "→ plan (-var-file=ci.tfvars)"
docker compose run --rm --no-TTY terraform -chdir=environments/dev plan -input=false -no-color -var-file=ci.tfvars "$@"

echo "=== terraform plan finished (no changes applied) ==="
