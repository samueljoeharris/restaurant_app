#!/usr/bin/env bash
# Deprecated — use ./scripts/sync-secrets.sh + GCP_DEV_SYNC_SA_JSON in Cursor.
echo "DEPRECATED: merge-env-for-cursor.sh" >&2
echo "  1. Copy .env.cloud.visible.example → Cursor Environment variables" >&2
echo "  2. Set ONE Runtime Secret: GCP_DEV_SYNC_SA_JSON (./scripts/create-dev-sync-key.sh)" >&2
echo "  3. Run ./scripts/sync-secrets.sh" >&2
echo "See docs/SECRETS_MATRIX.md" >&2
exit 1
