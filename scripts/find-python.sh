#!/usr/bin/env bash
# Resolve Python 3.14 for native API venv (falls back to 3.11+ if 3.14 unavailable).
# Usage: PYTHON_BIN="$(scripts/find-python.sh)"  or  source + find_python export
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"

find_python() {
  local candidate ver major minor
  for candidate in python3.14 python3.13 python3.12 python3.11 python3; do
    if command -v "$candidate" >/dev/null 2>&1; then
      ver="$("$candidate" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
      major="${ver%%.*}"
      minor="${ver#*.}"
      if [[ "$major" -gt 3 ]] || { [[ "$major" -eq 3 ]] && [[ "$minor" -ge 11 ]]; }; then
        if [[ "$major" -eq 3 && "$minor" -lt 14 ]]; then
          echo "WARN: Python $ver found; repo standard is 3.14 (install python@3.14 or use deadsnakes on Linux)" >&2
        fi
        command -v "$candidate"
        return 0
      fi
    fi
  done
  echo "ERROR: Python 3.11+ required (3.14 recommended). Install via Homebrew/deadsnakes or use --docker-api." >&2
  return 1
}

ensure_venv_python() {
  local python_bin="$1"
  local root="$2"
  local desired
  desired="$("$python_bin" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
  if [[ -d "$root/.venv/bin" ]]; then
    local current=""
    current="$("$root/.venv/bin/python" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    if [[ -n "$current" && "$current" != "$desired" ]]; then
      echo "Recreating .venv (was Python $current, want $desired)..." >&2
      rm -rf "$root/.venv"
    fi
  fi
  if [[ ! -d "$root/.venv" ]]; then
    echo "Creating .venv with Python ${desired}..." >&2
    "$python_bin" -m venv "$root/.venv"
  fi
}

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  find_python
fi
