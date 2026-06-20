# Web app auth — public pilot

How parents sign up, sign in, and call the API on **`app.dev.littlescout.app`** (and locally).

This is **one auth system**: Firebase Auth in the browser, Firebase JWT verification on Cloud Run. There is no local `users` table — Postgres stores `firebase_uid` on contributions only.

For the operator console (`admin.dev`), see **[ADMIN_AUTH.md](ADMIN_AUTH.md)** — that is a separate Google IAP wall plus Firebase admin claims.

---

## Mental model

```
Browser (React)  →  Firebase Auth  →  ID token (JWT)
                           ↓
                 Cloud Run API verifies JWT
                           ↓
              firebase_uid on TTF / ratings / notes
```

- **Sign up** and **sign in** are both Firebase Auth operations on the same `/login` page.
- **Google** always uses “Continue with Google” — Firebase creates the account on first use.
- The API never distinguishes “new user” vs “returning user”; it only checks a valid JWT on writes.

---

## Sign up vs sign in (public app)

Both live on **`/login`** in the public web build (`web/src/pages/LoginPage.tsx`).

| Action | UI | Firebase call |
|--------|-----|---------------|
| **Sign in** (email) | “Sign in” button (default) | `signInWithEmailAndPassword` |
| **Sign up** (email) | Toggle “Need an account? Sign up” → “Create account” | `createUserWithEmailAndPassword` |
| **Google** | “Continue with Google” | `signInWithRedirect` (prod) / popup (local) |

After a successful session, the app redirects to `/` (home). MFA, if enrolled, prompts on the same page before redirect.

**Admin build:** production `admin.dev` does **not** use this login form — operators hit the IAP wall first. Email/password on `/login` exists only for **local admin dev** without IAP. See [ADMIN_AUTH.md](ADMIN_AUTH.md).

---

## Sign-in methods

| Method | Status | Notes |
|--------|--------|-------|
| Email / password | ✅ | Sign up + sign in toggle on `/login` |
| Google | ✅ | Console setup below |
| Apple | Planned (iOS) | Required on iOS when other third-party sign-in is offered |
| SMS MFA | Later | TOTP preferred for web |

---

## API calls from the web app

1. User signs in via Firebase JS SDK (`web/src/auth/AuthContext.tsx`).
2. `web/src/api/client.ts` attaches `Authorization: Bearer <id_token>` on authenticated requests.
3. When App Check is enabled, the client also sends `X-Firebase-AppCheck`.
4. Cloud Run (`api/ttf_api/auth.py`) verifies the JWT; local dev can use `Bearer dev:<uid>` when `AUTH_DEV_MODE=true`.

Token refresh is handled by the Firebase SDK (~1 hour lifetime).

Public read endpoints do not require auth. All **writes** require a valid Firebase token (plus App Check and rate limits when configured).

---

## Local development

### Option A — Real Firebase locally (recommended)

Same auth as `app.dev` and Cursor Cloud agents. Use when testing Google sign-in, MFA, or production-like JWT verification.

1. Copy Firebase Web SDK config into `web/.env.local` (`VITE_FIREBASE_*`). Do **not** set `VITE_USE_AUTH_EMULATOR`.
2. Run `./scripts/sync-secrets.sh` (writes `.secrets/firebase-sa.json` and `web/.env.local` from Secret Manager).
3. In `.env`: leave `FIREBASE_AUTH_EMULATOR_HOST` unset. `.env.defaults` sets `FIREBASE_SERVICE_ACCOUNT_PATH=.secrets/firebase-sa.json` (set `AUTH_DEV_MODE=false` if you want only real tokens).
4. Run `./scripts/start-local.sh` and `cd web && npm run dev`.

For Cursor Cloud, see [CLOUD_AGENT.md](CLOUD_AGENT.md) — one Runtime Secret `GCP_DEV_SYNC_SA_JSON`; sync pulls everything else.

### Option B — Firebase Auth emulator (optional, no secrets)

No real Firebase credentials needed. Useful for CI-like sandboxes or when you cannot use Runtime Secrets.

```bash
cp .env.example .env
cp web/.env.example web/.env.local
```

In `.env`:

```
FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
AUTH_DEV_MODE=true
```

In `web/.env.local`:

```
VITE_API_URL=http://localhost:8080
VITE_USE_AUTH_EMULATOR=true
VITE_FIREBASE_API_KEY=fake-api-key-for-emulator
VITE_FIREBASE_AUTH_DOMAIN=localhost
VITE_FIREBASE_PROJECT_ID=ttf-restaurant-dev
```

```bash
mkdir -p .secrets && echo '{}' > .secrets/firebase-sa.json
docker compose --profile emulator up --build -d postgres firebase-emulator
./scripts/run-api.sh --reload &
cd web && npm install && npm run dev   # http://localhost:5173
```

Test user (emulator): **`pilot@ttf.test`** / **`pilotpass123`**. Emulator UI: http://localhost:4000.

### Option C — API-only smoke test (no web)

```bash
./scripts/start-local.sh
curl -H "Authorization: Bearer dev:pilot-tester-1" http://localhost:8080/v1/me
```

See [FIREBASE_AUTH.md](FIREBASE_AUTH.md) for API-side modes (dev tokens, emulator, production).

---

## Enable Google sign-in (Firebase Console)

Google for **`app.dev`** is configured in [Firebase Authentication](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers) — not Terraform (`enable_google_sign_in = false` in committed CI tfvars).

1. Enable **Google** provider, set support email, Save.
2. Firebase auto-creates the **Web client (auto created by Google Service)** in GCP Credentials.
3. Complete the checklist below.

> **Not the admin IAP client.** Use **Web client (auto created by Google Service)** for public Google sign-in. The IAP OAuth client (`IAP-ttf-dev-admin-backend`) is only for `admin.dev`.

> If sign-in fails with **`The provided client secret is invalid`**, the secret stored in Firebase → Google provider is stale. Create a **new client secret** on the Web client in GCP Credentials, then open [Firebase → Google sign-in](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers) and re-enter Client ID + the new secret → Save.

### 1. Firebase authorized domains

[Authentication → Settings → Authorized domains](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/settings)

- `app.dev.littlescout.app`
- `localhost` (local Vite)

(`admin.dev.littlescout.app` is listed for the admin Firebase session; public-app testing only needs the two above.)

### 2. OAuth Web client — origins and redirect URIs

[GCP → Credentials](https://console.cloud.google.com/apis/credentials?project=ttf-restaurant-dev) → **Web client (auto created by Google Service)**

**Authorized JavaScript origins:**

- `https://app.dev.littlescout.app`
- `http://localhost:5173`

**Authorized redirect URIs** (both required):

- `https://ttf-restaurant-dev.firebaseapp.com/__/auth/handler` (legacy)
- `https://app.dev.littlescout.app/__/auth/handler` (**required** — app uses `app.dev` as `authDomain` with an nginx proxy to Firebase; without this URI, Google redirect sign-in returns to `/login` with no error on Chrome 115+)

The public web nginx config proxies `/__/auth` (and `/__/firebase`) to `ttf-restaurant-dev.firebaseapp.com` so auth storage stays same-origin. Use `location ^~` so the static `*.js` cache rule does not intercept `handler.js` / `iframe.js` (those 404s break Google redirect sign-in). See [Firebase redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices).

### 3. OAuth consent screen branding

[GCP → OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent?project=ttf-restaurant-dev)

- **App name:** `Little Scout`
- **Application home page:** `https://app.dev.littlescout.app`

Also set **Firebase → Project settings → General → Public-facing name** to `Little Scout`.

### 4. Verify

1. Open `https://app.dev.littlescout.app/login`.
2. **Continue with Google** → account picker shows **Little Scout**.
3. After choosing an account, brief stop on `/login`, then redirect to `/`.

| Error | Fix |
|-------|-----|
| `auth/unauthorized-domain` | Add hostname to Firebase authorized domains |
| `redirect_uri_mismatch` | Check Web client redirect URIs above |
| Back on `/login`, no error (Chrome) | Add `https://app.dev.littlescout.app/__/auth/handler` to OAuth redirect URIs; redeploy web |
| `signInWithIdp` **400** / `auth/invalid-credential` with `client secret is invalid` | Regenerate **Web client** secret in [GCP Credentials](https://console.cloud.google.com/apis/credentials?project=ttf-restaurant-dev) and re-save **Firebase → Authentication → Google** with matching Client ID + secret (not the admin IAP OAuth client) |
| `signInWithIdp` **400** (other) | Add `https://app.dev.littlescout.app/__/auth/handler` to OAuth Web client redirect URIs |
| `Cross-Origin-Opener-Policy` console warnings | Benign with redirect flow; for popup mode nginx sends `same-origin-allow-popups` |

---

## MFA (authenticator app)

Identity Platform MFA is **ENABLED** (opt-in) via Terraform `modules/firebase-auth`. Requires a successful Terraform apply.

- **Enroll:** Sign in → **Account** → **Set up authenticator** → scan QR → enter 6-digit code.
- **Sign-in:** After password or Google, enter TOTP code when prompted.
- **Unenroll:** **Account** → **Remove authenticator** (re-auth required).

If you see `auth/operation-not-allowed` for TOTP, MFA is not enabled in GCP yet (Terraform apply pending).

---

## Deployed dev URLs

| Surface | URL |
|---------|-----|
| Public web | https://app.dev.littlescout.app |
| API | https://api.dev.littlescout.app |
| Health | https://api.dev.littlescout.app/health |

---

## Related docs

| Doc | Purpose |
|-----|---------|
| [FIREBASE_AUTH.md](FIREBASE_AUTH.md) | API JWT verification, dev tokens, App Check, Cloud Run env |
| [ADMIN_AUTH.md](ADMIN_AUTH.md) | Operator console — IAP + admin claims (separate from this doc) |
| [web/README.md](../web/README.md) | Web repo setup |
| [api/README.md](../api/README.md) | API endpoints and auth headers |
| [BEST_PRACTICES.md](BEST_PRACTICES.md) | Session hardening, deletion, trust |
