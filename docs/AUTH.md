# Auth — sign-in, Google, MFA

Little Scout uses **Firebase Auth** only (no local users table). The web app and API share JWT identity.

## Sign-in methods (web)

| Method | Status |
|--------|--------|
| Email / password | Sign up + sign in on `/login` |
| Google | **Continue with Google** on `/login` |
| Apple | Later (needs Apple Developer) |
| SMS MFA | Later (TOTP preferred for web POC) |

## Enable Google (Firebase Console)

Google sign-in for **`app.dev`** is managed in [Firebase Authentication](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers) — not Terraform (`enable_google_sign_in = false` in `ci.tfvars`).

1. Enable **Google** provider, set support email, Save.
2. Firebase auto-creates the **Web client (auto created by Google Service)** in GCP Credentials.
3. Ensure that Web client includes origins/redirects for `app.dev.littlescout.app` (see [AUTH.md](AUTH.md) origins list if sign-in fails).

> **Not the same client as admin IAP.** `admin.dev` uses a separate IAP OAuth client (`IAP-ttf-dev-admin-backend`) wired by Terraform for the operator login wall only.

## Admin IAP (Terraform)

Operator access to **`admin.dev`** uses **Identity-Aware Proxy** on the load balancer (Google account login, separate from Firebase app sign-in). GitHub Environment `dev` secrets:

| Secret | Purpose |
|--------|---------|
| `IAP_OAUTH_CLIENT_ID` | admin.dev IAP |
| `IAP_OAUTH_CLIENT_SECRET` | admin.dev IAP |

Terraform also provisions the IAP service agent and grants `roles/run.invoker` on `ttf-admin-web` (required for IAP → Cloud Run).

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
