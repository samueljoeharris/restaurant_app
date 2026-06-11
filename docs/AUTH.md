# Auth — sign-in, Google, MFA

Little Scout uses **Firebase Auth** only (no local users table). The web app and API share JWT identity.

## Sign-in methods (web)

| Method | Status |
|--------|--------|
| Email / password | Sign up + sign in on `/login` |
| Google | **Continue with Google** on `/login` |
| Apple | Later (needs Apple Developer) |
| SMS MFA | Later (TOTP preferred for web POC) |

## Enable Google (Terraform — recommended)

Google sign-in is managed by Terraform (`modules/firebase-auth` + `google-oauth.tf`). Non-secret flags live in committed `ci.tfvars`; **credentials never go in git**.

### 1. Create OAuth Web client (one-time)

GCP [APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials?project=ttf-restaurant-dev) → **Create credentials → OAuth client ID → Web application**.

Authorized JavaScript origins (add as you deploy):

- `http://localhost:5173`
- `https://app.dev.littlescout.app`
- `https://ttf-restaurant-dev.firebaseapp.com`

Authorized redirect URIs:

- `https://ttf-restaurant-dev.firebaseapp.com/__/auth/handler`
- `https://app.dev.littlescout.app/__/auth/handler`

Copy **Client ID** and **Client secret**.

> **Not the same client as IAP.** Admin IAP uses a separate OAuth client from [Security → IAP](https://console.cloud.google.com/security/iap). Keep two credential pairs.

### 2. Provide secrets (pick one)

**CI (recommended):** Repo **Settings → Environments → dev → Secrets**

| Secret | Purpose |
|--------|---------|
| `GOOGLE_OAUTH_CLIENT_ID` | Firebase Google sign-in |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Firebase Google sign-in |
| `IAP_OAUTH_CLIENT_ID` | admin.dev IAP wall |
| `IAP_OAUTH_CLIENT_SECRET` | admin.dev IAP wall |

Merge infra changes → **Actions → Terraform** runs plan/apply. Terraform stores values in Secret Manager (`ttf-google-oauth`, `ttf-iap-oauth`) and configures Identity Platform / the load balancer.

**Local apply:** gitignored `infra/terraform/environments/dev/terraform.tfvars`:

```hcl
google_oauth_client_id     = "....apps.googleusercontent.com"
google_oauth_client_secret = "GOCSPX-...."
```

Then `terraform apply -var-file=ci.tfvars -var-file=terraform.tfvars`.

### 3. Verify

Sign in at `https://app.dev.littlescout.app/login` → **Continue with Google**.

**Console-only fallback:** Enable Google in [Firebase Authentication](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers) if you are not passing Terraform OAuth vars yet. Prefer Terraform so config stays in code.

## MFA (authenticator app)

Terraform (`modules/firebase-auth`) sets MFA to **ENABLED** (opt-in, not mandatory). **Requires a successful Terraform apply** — if you see `auth/operation-not-allowed` for TOTP, Identity Platform MFA is not enabled in GCP yet (apply failed or pending).

**Enroll:** Sign in → **Account** (nav) → **Set up authenticator** → scan QR → enter 6-digit code.

**Unenroll:** Sign in → **Account** (nav) or **Admin → Security** → **Remove authenticator** → confirm your password or Google sign-in when prompted.

**Sign-in:** After password or Google, enter authenticator code when prompted.

Supported apps: Google Authenticator, 1Password, Authy, etc. (TOTP).

## Local dev

```bash
cd web && npm run dev
```

Uses production Firebase (`web/.env.local`) by default. Emulator optional — see [FIREBASE_AUTH.md](FIREBASE_AUTH.md).

## API

All write endpoints require `Authorization: Bearer <firebase_id_token>`. Token refresh is handled by the Firebase JS SDK; `AuthContext` refreshes on auth state changes.

## Admin access

Admin UI is deployed separately at **`https://admin.dev.littlescout.app`** (`ttf-admin-web`). Routes: `/admin` overview, restaurants, contributors, observation log. The API enforces `role: admin` from Firebase **custom claims** on `/v1/admin/*`. See [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md).

**Grant yourself admin (one-time):**

```bash
# Download firebase-sa.json from Firebase Console → Service accounts
python api/scripts/set_admin_claim.py --email you@example.com
```

Sign out and back in (or call `refreshClaims()` in the app) so the JWT picks up the claim.

**Local API without Firebase SA:** set `AUTH_DEV_ADMIN_UIDS=<your-uid>` in `.env` and use `Bearer dev:<uid>` — or run against Cloud SQL with production Firebase tokens after granting the claim.
