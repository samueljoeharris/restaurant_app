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
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `/secrets/firebase-sa.json` (mount from Secret Manager) |

Cloud Run runtime SA can also use Workload Identity; service account JSON is simplest for v1.

---

## 5. Client integration (later)

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
