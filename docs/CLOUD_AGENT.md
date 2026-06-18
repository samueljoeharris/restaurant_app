# Cursor Cloud Agent setup

How to give cloud agents a full local stack and credentials to evaluate `/map`, auth, and API behavior.

## Fastest path: paste `.env` in Cursor

1. Copy [`.env.cloud.example`](../.env.cloud.example) from the repo.
2. Fill in the `<paste-…>` placeholders (see below).
3. In **Cursor → Cloud Agents → Environment variables**, paste the entire file and save.
4. Start or restart a cloud agent — `.cursor/scripts/bootstrap-cloud-env.sh` runs on startup.

Bootstrap **never overwrites** non-empty values in your pasted `.env`. It syncs `web/.env.local` from the root `.env` and writes `firebase-sa.json` when needed.

## Required values (minimum for `/map` debugging)

| Variable | Source |
|----------|--------|
| `MAPS_API_KEY` | GCP Secret `ttf-maps-api-key` |
| `VITE_GOOGLE_MAPS_API_KEY` | GCP Secret `ttf-maps-web-api-key` |

```bash
gcloud secrets versions access latest --secret=ttf-maps-web-api-key --project=ttf-restaurant-dev
gcloud secrets versions access latest --secret=ttf-maps-api-key --project=ttf-restaurant-dev
```

## Recommended extras

| Variable | Purpose |
|----------|---------|
| `GITHUB_PERSONAL_ACCESS_TOKEN` | GitHub MCP, workflow dispatch |
| `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` | Sign in on `app.dev.littlescout.app` in browser tests |
| `GEMINI_API_KEY` | Review chat locally |

## Local full stack (agent commands)

After `.env` is pasted:

```bash
bash .cursor/scripts/cloud-eval-up.sh   # docker compose emulator + API
cd web && npm run dev                   # http://localhost:5173 (non-minified React errors)
```

Emulator sign-in defaults to `pilot@ttf.test` / `pilotpass123` unless `DEV_TEST_*` is set.

## Testing deployed dev

Agents can curl `https://api.dev.littlescout.app/health` without secrets. Signed-in browser tests on `https://app.dev.littlescout.app/map` need `DEV_TEST_EMAIL` and `DEV_TEST_PASSWORD` (a real Firebase user on `ttf-restaurant-dev`).

## Files touched by bootstrap

| File | Role |
|------|------|
| `.env` | Pasted from Cursor or created from `.env.cloud.example` |
| `web/.env.local` | Synced from `VITE_*` in `.env` |
| `firebase-sa.json` | `{}` for emulator, or `FIREBASE_SERVICE_ACCOUNT_JSON` |

See also [AGENTS.md](../AGENTS.md) (Cursor Cloud section) and [WEB_AUTH.md](WEB_AUTH.md#option-a--firebase-auth-emulator-recommended-in-cloud--no-secrets).
