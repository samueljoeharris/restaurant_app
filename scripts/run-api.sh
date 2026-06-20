#!/usr/bin/env bash
# Run the API natively with uvicorn (Postgres may still be in Docker).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

find_python() {
  local candidate ver major minor
  for candidate in python3.12 python3.11 python3.13 python3.14 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      ver="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      major="${ver%%.*}"
      minor="${ver#*.}"
      if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 11 ]]; }; then
        command -v "$candidate"
        return 0
      fi
    fi
  done
  echo "ERROR: Python 3.11+ required for native API (API uses datetime.UTC). Install via Homebrew or use --docker-api." >&2
  return 1
}

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

if [[ ! -d .venv ]]; then
  echo "Creating .venv and installing api/requirements.txt…"
  "$PYTHON_BIN" -m venv .venv
fi
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
