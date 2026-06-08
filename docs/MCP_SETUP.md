# MCP Setup — Phase 0

Configure Model Context Protocol (MCP) servers so Cursor can interact with GitHub, Google Cloud, and your local database directly from the agent.

## Overview

| MCP Server | Transport | Purpose |
|------------|-----------|---------|
| **github** | Docker stdio | PRs, issues, Actions, repo management |
| **gcloud** | npx stdio | GCP/Terraform commands via natural language |
| **postgres** | npx stdio | Query local Docker Postgres during API dev |
| **firebase** | npx stdio | Auth/project config — add in Phase 2 when `firebase.json` exists |
| **Cloud SQL** | HTTP remote | Add in Phase 2 after GCP project exists |

Project config: [`.cursor/mcp.json`](../.cursor/mcp.json)  
Template (includes Firebase stub): [`.cursor/mcp.json.example`](../.cursor/mcp.json.example)

## Phase 0a — Git

- [x] Monorepo: `restaurant_app`
- [x] Remote: `git@github.com:samueljoeharris/restaurant_app.git`
- [ ] First commit + `git push` (this doc is part of that commit)

## Phase 0b — Prerequisites

Install before enabling MCP servers:

| Tool | Why | Install |
|------|-----|---------|
| **Docker Desktop** | GitHub MCP runs in container | Already installed — keep WSL2 backend enabled |
| **Node.js 20+** | npx MCP servers (gcloud, postgres) | https://nodejs.org |
| **gcloud CLI** | gcloud MCP + Terraform deploy | https://cloud.google.com/sdk/docs/install |
| **gh CLI** | Optional terminal GitHub access | https://cli.github.com |

After installing gcloud:

```bash
gcloud auth login
gcloud auth application-default login
```

## Phase 0c — Environment Variables (Windows)

Set these as **user environment variables** (Settings → System → Environment Variables). Never commit values to git.

| Variable | Value | When needed |
|----------|-------|-------------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Your fine-grained PAT | Phase 0 — GitHub MCP |
| `LOCAL_POSTGRES_URL` | `postgresql://ttf_app:ttf_local@localhost:5432/ttf` | Phase 2 — after `docker compose up` |
| `TTF_GCP_PROJECT_DEV` | `ttf-restaurant-dev` | Phase 0e — after GCP project created |

### Creating the GitHub PAT

1. Go to https://github.com/settings/tokens?type=beta
2. Create fine-grained token named **`ttf-cursor-mcp`**
3. Repository access: **Only** `samueljoeharris/restaurant_app`
4. Permissions: Contents (read), Issues (read/write), Pull requests (read/write), Actions (read), Metadata (read)
5. Copy token → set as `GITHUB_PERSONAL_ACCESS_TOKEN` in Windows env vars
6. Restart Cursor so it picks up the new variable

## Phase 0d — Enable MCP in Cursor

1. Verify [`.cursor/mcp.json`](../.cursor/mcp.json) exists (committed; uses `${env:VAR}` only)
2. Ensure Docker Desktop is running (for GitHub MCP)
3. Restart Cursor (or Reload Window: `Ctrl+Shift+P` → "Reload Window")
4. Open **Settings → Tools & MCP** — look for green dots next to `github`, `gcloud`, `postgres`
5. Test:
   - Ask agent: "List open issues on restaurant_app"
   - Ask agent: "Run gcloud projects list"

### Troubleshooting

| Problem | Fix |
|---------|-----|
| GitHub MCP red / disconnected | Docker running? PAT set? Restart Cursor after setting env var |
| gcloud MCP fails | Run `gcloud auth login` in terminal; ensure Node 20+ installed |
| postgres MCP "no tools" | Expected until Phase 2 — `LOCAL_POSTGRES_URL` only works when Postgres container is up |
| Firebase shows 0 tools | Add Firebase block from `mcp.json.example` only after `firebase.json` exists in repo |

## Phase 0e — Firebase MCP (Phase 2)

When `firebase.json` is scaffolded, add to `.cursor/mcp.json`:

```json
"firebase": {
  "command": "npx",
  "args": ["-y", "firebase-tools@latest", "mcp", "--dir", "${workspaceFolder}"]
}
```

Then run `npx firebase login` and restart Cursor.

## Phase 0f — Cloud SQL MCP (Phase 2)

After GCP project `ttf-restaurant-dev` exists, add remote HTTP server per [Cloud SQL MCP docs](https://cloud.google.com/sql/docs/mysql/use-cloudsql-mcp). Requires `gcloud auth` and IAM permissions.

## Security Rules

- **Never** commit PATs, API keys, or `.env` files
- Use `${env:VAR}` in committed `mcp.json` — tokens live in OS environment only
- GitHub PAT: scope to `restaurant_app` repo only
- gcloud MCP inherits your `gcloud auth` permissions — use a dev account
- `.gitignore` excludes `.env`, `*.pem`, `*.p8`, Terraform state files

## Why Docker for GitHub MCP

You already use Docker for backend development. The official GitHub MCP image (`ghcr.io/github/github-mcp-server`) replaces the deprecated npm package and aligns with the Docker-first workflow documented in [DESIGN.md](DESIGN.md).

## References

- [GitHub MCP — Cursor install guide](https://github.com/github/github-mcp-server/blob/main/docs/installation-guides/install-cursor.md)
- [gcloud MCP](https://www.npmjs.com/package/@google-cloud/gcloud-mcp)
- [Firebase MCP](https://firebase.google.com/docs/ai-assistance/mcp-server)
- [Cursor MCP docs](https://cursor.com/docs/mcp)
