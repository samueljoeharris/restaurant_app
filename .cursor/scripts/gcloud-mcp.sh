#!/usr/bin/env bash
set -euo pipefail
# Cursor does not load shell profile PATH — Homebrew node must be explicit.
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
exec npx -y @google-cloud/gcloud-mcp
