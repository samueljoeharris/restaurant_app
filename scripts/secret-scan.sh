#!/usr/bin/env bash
# Scan the repo for committed secrets (gitleaks). Never prints secret values.
# Used by ci-check.sh pre-push hook and GitHub Actions CI job.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE="${GITLEAKS_IMAGE:-ghcr.io/gitleaks/gitleaks:latest}"
CONFIG="$ROOT/.gitleaks.toml"
MODE="${1:-detect}"

if [[ ! -f "$CONFIG" ]]; then
  echo "ERROR: missing $CONFIG" >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker required for secret-scan.sh" >&2
  exit 1
fi

docker info >/dev/null 2>&1 || {
  echo "ERROR: Docker daemon is not running" >&2
  exit 1
}

echo "-> secret-scan: gitleaks $MODE"

case "$MODE" in
  detect)
    # Full repo scan (tracked files + history in working tree checkout).
    docker run --rm \
      -v "$ROOT:/repo:ro" \
      -w /repo \
      "$IMAGE" \
      detect \
      --source /repo \
      --config /repo/.gitleaks.toml \
      --redact \
      --verbose
    ;;
  protect)
    # Staged files only — optional pre-commit use.
    docker run --rm \
      -v "$ROOT:/repo" \
      -w /repo \
      "$IMAGE" \
      protect \
      --staged \
      --config /repo/.gitleaks.toml \
      --redact \
      --verbose
    ;;
  *)
    echo "Usage: $0 [detect|protect]" >&2
    exit 1
    ;;
esac

echo "✓ secret-scan passed"
