#!/usr/bin/env bash
# Deprecated — use ./scripts/sync-secrets.sh
echo "NOTE: pull-dev-secrets.sh is deprecated. Use ./scripts/sync-secrets.sh" >&2
exec "$(dirname "$0")/sync-secrets.sh" "$@"
