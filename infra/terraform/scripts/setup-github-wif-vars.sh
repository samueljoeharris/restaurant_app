#!/usr/bin/env bash
# After terraform apply: set GitHub repository variables for WIF (no SA keys).
set -euo pipefail

REPO="${GITHUB_REPOSITORY:-samueljoeharris/restaurant_app}"
TF_DIR="${TF_DIR:-infra/terraform/environments/dev}"

cd "$(git rev-parse --show-toplevel)"

echo "==> Reading Terraform outputs from dev environment"
PROVIDER=$(docker compose run --rm terraform -chdir=environments/dev output -raw github_workload_identity_provider)
SA_EMAIL=$(docker compose run --rm terraform -chdir=environments/dev output -raw github_terraform_service_account)

echo "GCP_WORKLOAD_IDENTITY_PROVIDER=$PROVIDER"
echo "GCP_TERRAFORM_SERVICE_ACCOUNT=$SA_EMAIL"

set_github_var() {
  local name="$1"
  local value="$2"
  if command -v gh &>/dev/null && gh auth status &>/dev/null; then
    gh variable set "$name" --repo "$REPO" --body "$value"
  elif [[ -n "${GITHUB_PERSONAL_ACCESS_TOKEN:-}" ]]; then
    GITHUB_TOKEN="$GITHUB_PERSONAL_ACCESS_TOKEN" npx --yes gh variable set "$name" --repo "$REPO" --body "$value"
  else
    return 1
  fi
}

if set_github_var "GCP_WORKLOAD_IDENTITY_PROVIDER" "$PROVIDER" \
  && set_github_var "GCP_TERRAFORM_SERVICE_ACCOUNT" "$SA_EMAIL"; then
  echo "Done. GitHub repository variables set on $REPO"
else
  echo ""
  echo "Set these manually: GitHub → $REPO → Settings → Secrets and variables → Variables"
  echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = $PROVIDER"
  echo "  GCP_TERRAFORM_SERVICE_ACCOUNT  = $SA_EMAIL"
fi

echo ""
echo "No GCP_SA_KEY secret needed — auth uses GitHub OIDC + Workload Identity Federation."
