#!/usr/bin/env bash
# Create GitHub issues from the modernization backlog drafts.
#
# Usage:
#   ./scripts/open-modernization-issues.sh          # dry run — prints what would be created
#   ./scripts/open-modernization-issues.sh --create # actually create issues (needs `gh auth login`)
#
# Each docs/backlog/modernization/M*.md file becomes one issue:
#   line 1  "# <title>"          → issue title
#   line    "Labels: a, b, c"    → issue labels (created on the fly if missing)
# The full file is the issue body.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIR="$ROOT/docs/backlog/modernization"
REPO="samueljoeharris/restaurant_app"
CREATE=false
[[ "${1:-}" == "--create" ]] && CREATE=true

if $CREATE && ! command -v gh >/dev/null; then
  echo "error: gh CLI required (https://cli.github.com) and authenticated" >&2
  exit 1
fi

shopt -s nullglob
files=("$DIR"/M*.md)
if ((${#files[@]} == 0)); then
  echo "error: no draft files in $DIR" >&2
  exit 1
fi

for f in "${files[@]}"; do
  title="$(sed -n '1s/^# *//p' "$f")"
  labels="$(sed -n 's/^Labels: *//p' "$f" | head -1 | tr -d ' ')"
  if [[ -z "$title" ]]; then
    echo "skip (no title): $f" >&2
    continue
  fi
  if $CREATE; then
    # ensure labels exist (no-op if they already do)
    IFS=',' read -ra ls <<<"$labels"
    for l in "${ls[@]}"; do
      [[ -n "$l" ]] && gh label create "$l" --repo "$REPO" 2>/dev/null || true
    done
    url="$(gh issue create --repo "$REPO" --title "$title" --body-file "$f" ${labels:+--label "$labels"})"
    echo "created: $url  ←  $(basename "$f")"
  else
    echo "would create: [$labels] $title  ←  $(basename "$f")"
  fi
done

$CREATE || echo $'\n(dry run — pass --create to open the issues)'
