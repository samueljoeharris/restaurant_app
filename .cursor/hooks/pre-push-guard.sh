#!/usr/bin/env bash
# Cursor hook: run Docker CI checks before agent-initiated git push.
set -euo pipefail

input="$(cat)"
command="$(printf '%s' "$input" | python3 -c "import sys, json; print(json.load(sys.stdin).get('command', ''))")"

allow() {
  printf '%s\n' '{"permission":"allow"}'
  exit 0
}

deny() {
  local user_msg="$1"
  local agent_msg="$2"
  python3 -c "import json, sys; print(json.dumps({'permission':'deny','user_message':sys.argv[1],'agent_message':sys.argv[2]}))" \
    "$user_msg" "$agent_msg"
  exit 2
}

# Only gate git push (git hook handles pushes from the terminal when installed).
if ! printf '%s' "$command" | grep -qE '(^|[;&|]\s*)git push'; then
  allow
fi

if printf '%s' "$command" | grep -qE '(--no-verify|-n\b)'; then
  deny \
    "CI bypass blocked. Run ./scripts/ci-check.sh first, then push without --no-verify." \
    "Do not use git push --no-verify. Run ./scripts/ci-check.sh and push normally."
fi

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "${SKIP_CI:-}" == "1" ]]; then
  allow
fi

if ! "$ROOT/scripts/ci-check.sh" >&2; then
  deny \
    "Local CI checks failed. Fix errors above, or run ./scripts/ci-check.sh manually." \
    "ci-check.sh failed. Fix build errors before pushing."
fi

allow
