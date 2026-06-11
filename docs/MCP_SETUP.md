# MCP Setup — Phase 0

Configure Model Context Protocol (MCP) servers so Cursor can interact with GitHub, Google Cloud, and your local database directly from the agent.

## Overview

| MCP Server | Transport | Purpose |
|------------|-----------|---------|
| **github** | Docker stdio | PRs, issues, Actions, repo management |
| **gcloud** | npx stdio | GCP/Terraform commands via natural language |
| **postgres** | npx stdio | Optional — query local Docker Postgres during **API** dev only |
| **firebase** | npx stdio | Optional — Auth/project config now that `firebase.json` exists |
| **Cloud SQL** | HTTP remote | Add in Phase 2 after GCP project exists |

Project config: [`.cursor/mcp.json`](../.cursor/mcp.json)  
Template (includes Firebase stub): [`.cursor/mcp.json.example`](../.cursor/mcp.json.example)

## Phase 0a — Git

- [x] Monorepo: `restaurant_app`
- [x] Remote: `git@github.com:samueljoeharris/restaurant_app.git`
- [x] First commit + `git push`

## Phase 0b — Prerequisites

Install before enabling MCP servers:

| Tool | Why | Install |
|------|-----|---------|
| **Docker Desktop** | GitHub MCP runs in container | Mac or Windows — keep it running |
| **Node.js 20+** | npx MCP servers (gcloud, postgres) | `brew install node@20` or https://nodejs.org |
| **gcloud CLI** | gcloud MCP + Terraform deploy | https://cloud.google.com/sdk/docs/install |
| **gh CLI** | Optional terminal GitHub access | https://cli.github.com |

After installing gcloud:

```bash
gcloud auth login
gcloud auth application-default login
```

## Phase 0c — Secrets via `.env`

**Do not use system environment variables** unless you prefer a global setup. This project uses a **gitignored `.env` file** at the repo root.

```bash
cp .env.example .env
```

Edit `.env` and set your values:

| Variable | Value | When needed |
|----------|-------|-------------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | Your fine-grained PAT | Phase 0 — GitHub MCP |
| `POSTGRES_CONNECTION_STRING` | `postgresql://ttf_app:ttf_local@localhost:5432/ttf` | Phase 2 — postgres MCP |
| `TTF_GCP_PROJECT_DEV` | `ttf-restaurant-dev` | Optional reference for gcloud |

### How secrets reach each MCP

| MCP | Mechanism |
|-----|-----------|
| **github** | Docker `--env-file .env` — token passed directly into container |
| **postgres** | Cursor `envFile` — loads `.env` for npx server |
| **gcloud** | No token in `.env` — uses `gcloud auth login` credentials on your machine |

### MCP scripts (Mac vs Windows)

| Platform | gcloud / postgres MCP |
|----------|----------------------|
| **Mac / Linux** | `.cursor/scripts/gcloud-mcp.sh` (default in `mcp.json`) |
| **Windows** | Swap `mcp.json` gcloud command to `gcloud-mcp.cmd` (fnm PATH workaround) |
| **postgres (optional)** | Add block from `postgres-mcp.sh` when running `docker compose up postgres` for API work |

After installing gcloud on Mac:

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project ttf-restaurant-dev
```

### Alternative: Windows user env vars

If you prefer machine-wide secrets, set `GITHUB_PERSONAL_ACCESS_TOKEN` in Windows Environment Variables and change `mcp.json` to use `${env:GITHUB_PERSONAL_ACCESS_TOKEN}` instead of `--env-file`. The `.env` approach is recommended for this repo.

### Alternative: global `~/.cursor/mcp.json`

Store the PAT only in your **global** Cursor config (never commit). Official GitHub docs show putting the token directly in `~/.cursor/mcp.json`. Use that if you want GitHub MCP in all projects — this repo uses **project-scoped** `.cursor/mcp.json` + `.env` instead.

### Creating the GitHub PAT

1. Go to https://github.com/settings/tokens?type=beta
2. Create fine-grained token named **`ttf-cursor-mcp`**
3. Repository access: **Only** `samueljoeharris/restaurant_app`
4. Permissions: Contents (read), Issues (read/write), Pull requests (read/write), Actions (read), Metadata (read)
5. Copy token → paste into `.env` as `GITHUB_PERSONAL_ACCESS_TOKEN=...`
6. Restart Cursor (or Reload Window) so MCP reloads

## Phase 0d — Enable MCP in Cursor

1. Verify [`.cursor/mcp.json`](../.cursor/mcp.json) exists (committed; uses `${env:VAR}` only)
2. Ensure Docker Desktop is running (for GitHub MCP)
3. Restart Cursor (or Reload Window: `Ctrl+Shift+P` → "Reload Window")
4. Open **Settings → Tools & MCP** — look for green dots next to `github` and `gcloud`
5. Test:
   - Ask agent: "List open issues on restaurant_app"
   - Ask agent: "Run gcloud projects list"

### Troubleshooting

| Problem | Fix |
|---------|-----|
| GitHub MCP red / disconnected | Docker running? `.env` exists with PAT? Path: `${workspaceFolder}/.env` |
| gcloud MCP red on Mac | Node in PATH? Run `which npx`. Reload Cursor after `brew install node@20`. |
| gcloud MCP red on Windows | Cursor doesn't load fnm shell PATH — use `.cmd` wrappers in `mcp.json`. Reload Cursor. |
| gcloud MCP auth errors | Run `gcloud auth login` in terminal |
| postgres MCP red | Optional server — only enable when `docker compose up postgres` is running for API dev |
| Terraform compose auth fails | Mac: `gcloud auth application-default login`. Windows: set `GCLOUD_CONFIG_PATH` in `.env` |
| Firebase shows 0 tools | Add the Firebase block from `mcp.json.example`, run `npx firebase login`, then restart Cursor |

## Phase 0e — Firebase MCP (optional)

Because `firebase.json` is now scaffolded, add this block to `.cursor/mcp.json` if you want Firebase MCP tools:

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
- Tokens live in **`.env` only** (gitignored) — `mcp.json` references the file, never the secret value
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
