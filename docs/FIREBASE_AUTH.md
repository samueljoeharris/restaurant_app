# Firebase Auth — TTF

Auth flow for API write endpoints and future web/iOS clients.

```
Client (web / iOS)  →  Firebase Auth  →  ID token (JWT)
                              ↓
                    API verifies JWT (firebase-admin)
                              ↓
              firebase_uid on contributions (no local users table)
```

Identity lives entirely in **Firebase Auth**. Postgres stores `firebase_uid` on TTF observations, attribute ratings, and notes. `GET /v1/me` returns profile fields from the JWT plus a computed `contribution_count`.

## Modes (pick one for local dev)

| Mode | When | API config |
|------|------|------------|
| **Dev tokens** | Quick curl tests | `AUTH_DEV_MODE=true`, `Bearer dev:<uid>` |
| **Auth Emulator** | Real JWT flow on Windows | `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099` |
| **Production** | Cloud Run / real users | `AUTH_DEV_MODE=false` + `firebase-sa.json` |

---

## 1. Firebase Console (one-time)

Project: **`ttf-restaurant-dev`**

**Status:** Email/Password enabled; authorized domains include `localhost`, `ttf-restaurant-dev.firebaseapp.com`, `ttf-restaurant-dev.web.app`.

Console links:
- [Authentication providers](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers)
- [Users](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/users)
- [Authorized domains](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/settings)

Manual setup (if starting fresh):

1. [Firebase Console](https://console.firebase.google.com) → **Authentication** → **Get started**
2. Enable sign-in providers:
   - **Email/Password** — easiest for web pilot testing
   - **Google** — optional
   - **Apple** — enable when iOS app exists (requires Apple Developer)
3. **Settings** → Authorized domains — ensure `localhost` is listed (for web pilot)

### Web app (browser SDK)

Terraform module `infra/terraform/modules/firebase-web` creates `google_firebase_web_app` and exposes SDK config:

```bash
docker compose run --rm terraform -chdir=environments/dev output -json firebase_web_env
```

Copy into `web/.env.local` as `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`.

### Service account (production API)

1. Project **Settings** → **Service accounts**
2. **Generate new private key** → save as `firebase-sa.json` at repo root (gitignored)
3. API env:
   ```bash
   AUTH_DEV_MODE=false
   FIREBASE_SERVICE_ACCOUNT_PATH=firebase-sa.json
   ```

---

## 2. Local — Auth Emulator (recommended)

Start emulator + API:

```bash
docker compose up firebase-emulator api postgres
```

API uses `FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099` (set in `docker-compose.yml`).

Emulator UI: http://localhost:4000

### Get a test ID token

```bash
docker compose run --rm api python scripts/get_emulator_token.py \
  --email pilot@ttf.test --password pilotpass123
```

Use the printed token:

```bash
curl -H "Authorization: Bearer <ID_TOKEN>" http://localhost:8080/v1/me
```

### Create user via REST (alternative)

```bash
curl -X POST "http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-key" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@ttf.test","password":"secret123","returnSecureToken":true}'
```

---

## 3. Dev tokens (fastest)

When `AUTH_DEV_MODE=true`:

```bash
curl -H "Authorization: Bearer dev:pilot-tester-1" http://localhost:8080/v1/me
```

No Firebase required. **Disable in production** (`AUTH_DEV_MODE=false`).

---

## 4. Production (Cloud Run)

| Env var | Value |
|---------|--------|
| `AUTH_DEV_MODE` | `false` |
| `FIREBASE_PROJECT_ID` | `ttf-restaurant-dev` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/secrets/firebase-admin/firebase-sa.json` (when secret mounted) |
| `APP_CHECK_ENFORCE` | `true` when reCAPTCHA site key is configured |
| `RATE_LIMIT_MAX_WRITES` | `60` per `RATE_LIMIT_WINDOW_MINUTES` (`60`) |

### Tier 1 hardening setup

**1. Firebase Admin SA in Secret Manager**

```bash
# Download key: Firebase Console → Project settings → Service accounts → Generate new private key
./api/scripts/upload_firebase_admin_sa.sh firebase-sa.json
```

Then in `infra/terraform/environments/dev/terraform.tfvars` (gitignored):

```
firebase_admin_sa_configured = true
```

Terraform apply mounts the secret on `ttf-api` and sets `FIREBASE_SERVICE_ACCOUNT_PATH`.

**2. App Check (reCAPTCHA Enterprise)**

1. [reCAPTCHA Enterprise](https://console.cloud.google.com/security/recaptcha) → Create key → **Website** → Score-based
2. Allowed domains: `localhost`, your `ttf-web` Cloud Run host (no `https://`)
3. [Firebase App Check](https://console.firebase.google.com/project/ttf-restaurant-dev/appcheck) → register web app with that site key
4. Set in `terraform.tfvars`:

```
app_check_recaptcha_site_key = "6L..."
```

Terraform stores the key in `ttf-recaptcha-site-key`, wires Firebase App Check, enables API enforcement, and bakes the key into web CI builds.

**3. Identity Platform (Terraform)**

`infra/terraform/modules/firebase-auth`: request logging, MFA default `DISABLED`. (Sign-up quota can be set in Firebase Console if needed — API requires a rolling `start_time`.)

Write endpoints require Firebase ID token + (when enabled) `X-Firebase-AppCheck` + rate limit.

---

## 5. Google sign-in + MFA (web)

See **[AUTH.md](AUTH.md)** for enabling Google, enrolling TOTP MFA, and the `/account` security page.

Terraform: `infra/terraform/modules/firebase-auth` (Identity Platform config + optional Google OAuth vars).

---

## 6. Client integration

### Web (Firebase JS SDK)

```javascript
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();
const cred = await signInWithEmailAndPassword(auth, email, password);
const idToken = await cred.user.getIdToken();
// fetch(API_URL, { headers: { Authorization: `Bearer ${idToken}` } })
```

Connect emulator: `connectAuthEmulator(auth, "http://localhost:9099")` when developing locally.

### iOS

Firebase Auth SDK + Sign in with Apple → `user.getIDToken()` → same `Authorization` header.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Invalid or expired Firebase token` | Token expired (~1h); get a fresh one |
| `Firebase service account not found` | Download `firebase-sa.json` or use emulator |
| Emulator connection refused | `docker compose up firebase-emulator` |
| `aud` / project mismatch | `FIREBASE_PROJECT_ID` must match token project |
