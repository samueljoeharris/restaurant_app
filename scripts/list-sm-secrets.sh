#!/usr/bin/env bash
# List Secret Manager secrets with TTF labels and annotations (WHAT/WHY/env alias).
# Does not print secret values.
#
# Usage: ./scripts/list-sm-secrets.sh [PROJECT]
set -euo pipefail

PROJECT="${1:-${TTF_GCP_PROJECT_DEV:-ttf-restaurant-dev}}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "ERROR: gcloud required" >&2
  exit 1
fi

echo "=== Secret Manager catalog ($PROJECT) ==="
echo ""

gcloud secrets list \
  --project="$PROJECT" \
  --filter='labels.managed_by=terraform' \
  --format='table(
    name.basename():label=SECRET_ID,
    labels.category:label=CATEGORY,
    labels.environment:label=ENV,
    labels.sync_dev:label=SYNC_DEV,
    annotations.title:label=TITLE,
    annotations.env-alias:label=ENV_ALIAS
  )'

echo ""
echo "Full metadata for one secret:"
echo "  gcloud secrets describe SECRET_ID --project=$PROJECT"
echo ""
echo "Canonical definitions: infra/terraform/modules/secrets/catalog.tf"
echo "Human matrix: docs/SECRETS_MATRIX.md"
