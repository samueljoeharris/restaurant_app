#!/usr/bin/env bash
# Run the API natively with uvicorn (Postgres may still be in Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/find-python.sh"
PYTHON_BIN="$(find_python)"

RELOAD=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --reload) RELOAD=true; shift ;;
    --foreground) shift ;; # accepted for start-local.sh compatibility; always blocks
    -h|--help)
      cat <<'EOF'
Usage: ./scripts/run-api.sh [--reload] [--foreground]

  --reload       Enable uvicorn auto-reload (Mac local dev)
  --foreground   Block until uvicorn exits (default)
EOF
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

ensure_venv_python "$PYTHON_BIN" "$ROOT"
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r api/requirements.txt

# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

UVICORN_ARGS=(ttf_api.main:app --host 0.0.0.0 --port 8080)
if $RELOAD; then
  UVICORN_ARGS+=(--reload)
fi

cd "$ROOT/api"
exec "$ROOT/.venv/bin/uvicorn" "${UVICORN_ARGS[@]}"
