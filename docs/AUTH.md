# Auth — sign-in, Google, MFA

TTF uses **Firebase Auth** only (no local users table). The web app and API share JWT identity.

## Sign-in methods (web)

| Method | Status |
|--------|--------|
| Email / password | Sign up + sign in on `/login` |
| Google | **Continue with Google** on `/login` |
| Apple | Later (needs Apple Developer) |
| SMS MFA | Later (TOTP preferred for web POC) |

## Enable Google (one-time)

**Option A — Firebase Console (fastest)**

1. [Authentication → Sign-in method](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers)
2. Enable **Google**
3. Support email = your address → Save

**Option B — Terraform** (optional)

Set in gitignored `terraform.tfvars`:

```hcl
google_oauth_client_id     = "....apps.googleusercontent.com"
google_oauth_client_secret = "..."
```

From GCP **APIs & Services → Credentials** (Web client) after Google provider is enabled.

## MFA (authenticator app)

Terraform (`modules/firebase-auth`) sets MFA to **ENABLED** (opt-in, not mandatory). **Requires a successful Terraform apply** — if you see `auth/operation-not-allowed` for TOTP, Identity Platform MFA is not enabled in GCP yet (apply failed or pending).

**Enroll:** Sign in → **Account** (nav) → **Set up authenticator** → scan QR → enter 6-digit code.

**Sign-in:** After password or Google, enter authenticator code when prompted.

Supported apps: Google Authenticator, 1Password, Authy, etc. (TOTP).

## Local dev

```bash
cd web && npm run dev
```

Uses production Firebase (`web/.env.local`) by default. Emulator optional — see [FIREBASE_AUTH.md](FIREBASE_AUTH.md).

## API

All write endpoints require `Authorization: Bearer <firebase_id_token>`. Token refresh is handled by the Firebase JS SDK; `AuthContext` refreshes on auth state changes.
