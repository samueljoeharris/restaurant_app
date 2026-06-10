#!/usr/bin/env bash
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH:-}"
exec npx -y @modelcontextprotocol/server-postgres postgresql://ttf_app:ttf_local@localhost:5432/ttf
