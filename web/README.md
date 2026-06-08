# TTF Web POC

Browser pilot for Dedham — Firebase Auth + Cloud Run API.

## Setup

1. Get Firebase Web SDK config from Terraform (after `enable_firebase_web` apply):

```bash
docker compose run --rm terraform -chdir=environments/dev output -json firebase_web_env
```

Copy `VITE_FIREBASE_*` into `.env.local`. Or register manually in [Firebase Console](https://console.firebase.google.com/project/ttf-restaurant-dev/settings/general) if Terraform is not applied yet.
2. Ensure **Email/Password** auth is enabled and `localhost` is an authorized domain.
3. Install and run:

```bash
cd web
cp .env.example .env.local
# fill VITE_FIREBASE_API_KEY
npm install
npm run dev
```

Open http://localhost:5173 (or the next free port if 5173 is busy).

**Troubleshooting:** If the UI shows “Load failed” / console `Failed to fetch`, restart `npm run dev` after editing `.env.local`. In dev, API calls are proxied through Vite (`/v1` → `VITE_API_URL`) so any localhost port works without CORS. If you still hit CORS directly (e.g. old tab), use port **5173** or restart the dev server to pick up the proxy.

## Deploy to Cloud Run (dev)

Terraform provisions `ttf-web` (see `infra/terraform/environments/dev/web.tf`). CI builds the Vite app with Firebase + API URLs baked in and deploys via `.github/workflows/web.yml`.

1. Merge to `main` so **Terraform** applies `enable_web_cloud_run` (updates API CORS + Firebase authorized domains).
2. Run the **Web** workflow (or push `web/` changes).
3. Open the URL from:

```bash
docker compose run --rm terraform -chdir=environments/dev output -raw cloud_run_web_url
```

## Local API instead of Cloud Run

```bash
# repo root
docker compose up postgres api firebase-emulator
```

Set in `.env.local`:

```
VITE_API_URL=http://localhost:8080
```

Use the Auth emulator: add to `firebase.ts` connectAuthEmulator when `VITE_USE_AUTH_EMULATOR=true` — optional for later.
