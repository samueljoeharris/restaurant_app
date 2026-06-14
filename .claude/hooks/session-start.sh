#!/usr/bin/env bash
# Claude Code on the web — SessionStart hook for the Little Scout / TTF monorepo.
#
# Installs web + API dependencies and scaffolds the no-secret local env files so
# linting, type-checking, builds, and the Firebase emulator flow work out of the
# box. iOS (Xcode) and the Docker/Terraform CI path are intentionally left out:
# iOS can't build on Linux, and image builds are too heavy for session startup.
set -euo pipefail

# Web only — developers manage their own setup on local machines.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

ROOT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$ROOT"

# --- Web (Vite/React/TS): unlocks `npm run lint`, tsc typecheck, vite build ---
if [ -d web ]; then
  ( cd web && npm install --no-audit --no-fund )
fi

# --- API (FastAPI): resolve imports for edits and any future pytest ---
if [ -f api/requirements.txt ]; then
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install -r api/requirements.txt
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    {
      echo "export VIRTUAL_ENV=$ROOT/.venv"
      echo "export PATH=$ROOT/.venv/bin:\$PATH"
      echo "export PYTHONPATH=$ROOT/api"   # mirrors api/Dockerfile (PYTHONPATH=/app)
    } >> "$CLAUDE_ENV_FILE"
  fi
fi

# --- No-secret local env scaffolding (Firebase Auth emulator flow, AGENTS.md) ---
[ -f .env ]            || cp .env.example .env
[ -f web/.env.local ]  || cp web/.env.example web/.env.local
[ -f firebase-sa.json ] || echo '{}' > firebase-sa.json

echo "session-start: web + API dependencies installed, local env scaffolded"
