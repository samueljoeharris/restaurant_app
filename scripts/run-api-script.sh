#!/usr/bin/env bash
# Run an api/scripts/*.py helper natively with the same env as run-api.sh.
# Usage: ./scripts/run-api-script.sh seed_restaurants.py [args...]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/scripts/find-python.sh"
PYTHON_BIN="$(find_python)"

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <script.py> [args...]" >&2
  echo "Example: $0 seed_restaurants.py" >&2
  exit 1
fi

SCRIPT="$1"
shift

ensure_venv_python "$PYTHON_BIN" "$ROOT"
.venv/bin/pip install --quiet --upgrade pip
.venv/bin/pip install --quiet -r api/requirements.txt

# shellcheck disable=SC1091
source "$ROOT/scripts/load-dev-env.sh"

cd "$ROOT/api"
exec "$ROOT/.venv/bin/python" "scripts/$SCRIPT" "$@"
