#!/usr/bin/env bash
# Run an api/scripts/*.py helper natively with the same env as run-api.sh.
# Usage: ./scripts/run-api-script.sh seed_restaurants.py [args...]
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
  echo "ERROR: Python 3.11+ required for native API scripts." >&2
  return 1
}

PYTHON_BIN="$(find_python)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <script.py> [args...]" >&2
  echo "Example: $0 seed_restaurants.py" >&2
  exit 1
fi

SCRIPT="$1"
shift

if [[ ! -d .venv ]]; then
  echo "Creating .venv and installing api/requirements.txt…"
  "$PYTHON_BIN" -m venv .venv
fi
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r api/requirements.txt

# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

cd "$ROOT/api"
exec "$ROOT/.venv/bin/python" "scripts/$SCRIPT" "$@"
