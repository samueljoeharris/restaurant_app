#!/usr/bin/env bash
# One-time setup: git will run scripts/ci-check.sh before every push.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/ci-check.sh .githooks/pre-push

git config core.hooksPath .githooks

echo "Installed pre-push hook → .githooks/pre-push"
echo "Runs: ./scripts/ci-check.sh --pre-push (web/api/terraform checks for changed paths)"
echo ""
echo "Bypass once: git push --no-verify"
echo "Run manually: ./scripts/ci-check.sh --all"
