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

Open http://localhost:5173

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
