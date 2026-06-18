# Secrets & environment matrix

Where each credential lives, what it powers, and what to do if it leaks.  
**Never commit filled `.env`, `web/.env.local`, or `firebase-sa.json`.**

## Mental model (three layers)

```
┌─────────────────────────────────────────────────────────────────┐
│  LOCAL / CURSOR CLOUD (your machine or cloud agent VM)          │
│  .env              → API docker compose, MCP, scripts           │
│  web/.env.local    → Vite dev server only (npm run dev)         │
│  firebase-sa.json  → API JWT verify when not using emulator   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  GCP Secret Manager (ttf-restaurant-dev)                        │
│  Used by GitHub Actions to BUILD Cloud Run images               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  DEPLOYED (app.dev / api.dev) — baked into images at build time │
│  No .env at runtime on Cloud Run for web; API uses SM env refs  │
└─────────────────────────────────────────────────────────────────┘
```

## Secret inventory

| Secret | Local file(s) | GCP Secret Manager | GitHub Actions | Rotate if… |
|--------|---------------|--------------------|----------------|------------|
| Server Maps / Places key | `.env` → `MAPS_API_KEY` | `ttf-maps-api-key` | via deploy SA | Leaked in chat, commit, or public issue |
| Browser Maps JS key | `web/.env.local` → `VITE_GOOGLE_MAPS_API_KEY` | `ttf-maps-web-api-key` | web build arg | Same |
| Firebase web SDK JSON | `web/.env.local` → `VITE_FIREBASE_*` | `ttf-firebase-web-env` | web build arg | Firebase console regen |
| Firebase admin SA | `firebase-sa.json` | `ttf-firebase-admin-sa` (prod API) | — | **Always rotate** if JSON leaked |
| Gemini API key | `.env` → `GEMINI_API_KEY` | `ttf-gemini-api-key` | API deploy | Google AI Studio revoke |
| GitHub PAT (MCP) | `.env` → `GITHUB_PERSONAL_ACCESS_TOKEN` | — | — | GitHub → revoke token |
| IAP OAuth client | — | `ttf-iap-oauth` | `IAP_OAUTH_*` env secrets | Google Cloud Console |
| Dev test login | `.env` → `DEV_TEST_EMAIL/PASSWORD` | — | — | Firebase console reset password |
| Postgres (local) | `.env` → `DATABASE_URL` | — | — | N/A (`ttf_local` is dev-only) |

## Which file do I edit?

| I want to… | Edit |
|------------|------|
| Local API + docker compose | Repo root **`.env`** |
| Local web (`npm run dev`) | **`web/.env.local`** (or `VITE_*` in pasted Cursor `.env` — bootstrap syncs) |
| Cloud agent VM | **Cursor → Cloud Agents → paste `.env`** (root + `VITE_*` lines together) |
| Fix `app.dev` map tiles | GCP `ttf-maps-web-api-key` + re-run **Web** workflow |
| Fix `app.dev` places search | GCP `ttf-maps-api-key` on API Cloud Run (Terraform/secret) |

## Rotation runbook (after a leak)

1. **Revoke at source** (Google Cloud Console → APIs & Services → Credentials, Firebase, GitHub PAT settings, etc.).
2. **Write new version** to GCP Secret Manager (`gcloud secrets versions add …`).
3. **Update local** `.env` / `web/.env.local` / Cursor pasted `.env`.
4. **Redeploy** — push to `main` or workflow_dispatch **Web** / **API** as needed.
5. **Terraform** `maps-web.tf` creates browser key in SM — prefer updating SM version over ad-hoc console keys.

## Audit (no secret values printed)

```bash
./scripts/audit-env.sh
```

## Repo hygiene (verified)

- `.env`, `web/.env.local`, `firebase-sa.json` are **gitignored**
- No API key patterns in tracked source files
- `ci.tfvars` contains only non-secret project config
- Email in `iap_admin_members` is intentional (not a secret)

See also [CLOUD_AGENT.md](CLOUD_AGENT.md), [MCP_SETUP.md](MCP_SETUP.md), [WEB_AUTH.md](WEB_AUTH.md).
