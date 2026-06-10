#!/usr/bin/env bash
# One-time setup: git will run scripts/ci-check.sh before every push.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/ci-check.sh .githooks/pre-push

git config core.hooksPath .githooks

echo "Installed pre-push hook → .githooks/pre-push"
echo "Runs: ./scripts/ci-check.sh --pre-push (Docker checks for changed paths)"
echo ""
echo "Cursor hook: .cursor/hooks.json (same checks for agent git push)"
echo "Bypass once: SKIP_CI=1 git push"
echo "Run manually: ./scripts/ci-check.sh --all"
