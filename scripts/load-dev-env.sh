#!/usr/bin/env bash
# Source local dev env for native API runs (not used inside Docker Compose api service).
# Usage: source scripts/load-dev-env.sh   (or via run-api.sh / run-api-script.sh)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

eval "$(ROOT="$ROOT" python3 - <<'PY'
import os
from pathlib import Path

root = Path(os.environ["ROOT"])


def emit_exports(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text().splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        escaped = val.replace("\\", "\\\\").replace('"', '\\"')
        print(f'export {key}="{escaped}"')


for name in (".env.defaults", ".secrets/api.env", ".env"):
    emit_exports(root / name)
PY
)"

export PYTHONPATH="$ROOT/api"
export TTF_API_RUNTIME="${TTF_API_RUNTIME:-native}"

if [[ "$TTF_API_RUNTIME" == "native" ]]; then
  if [[ -n "${FIREBASE_AUTH_EMULATOR_HOST:-}" ]]; then
    FIREBASE_AUTH_EMULATOR_HOST="${FIREBASE_AUTH_EMULATOR_HOST/firebase-emulator/localhost}"
    export FIREBASE_AUTH_EMULATOR_HOST
  fi
  if [[ -n "${DATABASE_URL:-}" ]]; then
    DATABASE_URL="${DATABASE_URL/@postgres:/@localhost:}"
    export DATABASE_URL
  fi
fi
