# Getting Started — Little Scout

Actionable checklist for building the **Little Scout** restaurant app from zero. Internal codename and GCP prefix: **TTF**. For full product and technical detail, see [DESIGN.md](DESIGN.md).

**Current status:** Phase 2 complete; Phase 3 iOS on `main` (`ios/TTF/`) — M5 Apple Sign-In implemented; TestFlight (M6) next.

**Your setup:** Docker, GitHub, GCP/Firebase access, and Apple Developer enrollment. Xcode is only required for Phase 3 iOS work.

**Pilot city catalog key:** `dedham-ma` (opaque catalog key)

**Live dev surfaces:** web `https://app.dev.littlescout.app`, API `https://api.dev.littlescout.app`, admin `https://admin.dev.littlescout.app` (IAP-protected).

**Docs map:** start with [docs/README.md](README.md) when you need the full documentation index.

---

## Phase 0 — MCP + Git + Accounts

### Git

- [x] Monorepo: `restaurant_app`
- [x] Remote: `git@github.com:samueljoeharris/restaurant_app.git`
- [x] First commit (docs + MCP template)
- [x] `git push` — synced with `origin/main`

### MCP Setup

See [MCP_SETUP.md](MCP_SETUP.md) for full instructions.

- [x] Docker Desktop running
- [x] Install [Node.js 20+](https://nodejs.org) (or `brew install node@20`)
- [x] Install [gcloud CLI](https://cloud.google.com/sdk/docs/install) → `gcloud auth login`
- [x] Install [gh CLI](https://cli.github.com) (optional)
- [x] `cp .env.example .env` and add `GITHUB_PERSONAL_ACCESS_TOKEN` (see [MCP_SETUP.md](MCP_SETUP.md))
- [x] Restart Cursor → verify green MCP dots (github, gcloud)
- [x] Test: ask agent to list GitHub issues or run `gcloud projects list`

### Accounts (start in parallel — approvals take time)

- [x] Read [DESIGN.md](DESIGN.md)
- [x] **Apple Developer Program** ($99/year) — enrolled (personal)
- [x] **GCP free trial / project**
  - Project ID: **`ttf-restaurant-dev`**
  - Display name: **TTF Restaurant (Dev)**
  - Budget alerts at **$25** and **$50** (names: `ttf-dev-budget`)
  - Firebase linked to GCP project
  - Maps API key in Secret Manager (`ttf-maps-api-key`)

---

## Auth (public web)

- [ ] Enable **Google** sign-in in [Firebase Console](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/providers) (if not using Terraform OAuth vars)
- [ ] Test **Continue with Google** and email sign-up on `/login`
- [ ] Optional: **Account → Set up authenticator** for MFA

Guide: [WEB_AUTH.md](WEB_AUTH.md). Operator console (IAP): [ADMIN_AUTH.md](ADMIN_AUTH.md).

---

## Phase 2.5 — Web POC + Admin

Pilot the product in a browser while building the native iOS app.

- [ ] `terraform output firebase_web_env` → copy `VITE_FIREBASE_*` to `web/.env.local` (or Console Web app if TF not applied)
- [ ] `cd web && npm install && npm run dev` — http://localhost:5173
- [ ] Sign in (Email/Password) → browse restaurants → submit TTF
- [ ] Point `VITE_API_URL` at `https://api.dev.littlescout.app` or local API

See [`web/README.md`](../web/README.md).

---

## Phase 1 — Learn iOS (local Mac)

Xcode runs natively on your Mac — no cloud Mac rental needed.

- [ ] Install **Xcode** from Mac App Store → `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`
- [ ] Complete [100 Days of SwiftUI](https://www.hackingwithswift.com/100/swiftui) — days 1–14 minimum (optional refresher)
- [x] Create Xcode project at `ios/TTF/` (on `main` — see [ios/TTF/README.md](../ios/TTF/README.md) and [IOS_DESIGN.md](IOS_DESIGN.md))
  - Bundle ID: `com.samueljoeharris.ttf`
  - Display name: `TTF`
- [ ] One-time: App Store Connect API key (`.p8`) + provisioning profiles → GitHub Secrets

---

## Phase 2 — Backend + Infra (Docker + Terraform)

Full guide: [`infra/terraform/README.md`](../infra/terraform/README.md)

- [x] GCP project `ttf-restaurant-dev` + billing
- [x] `gcloud config set project ttf-restaurant-dev && gcloud auth application-default login`
- [x] **Bootstrap** state bucket `ttf-tfstate-dev`
- [x] **Deploy dev** Phase A (Artifact Registry, GCS, secrets, IAM, WIF)
- [x] Firebase + Maps key — see infra README
- [x] Scaffold `api/` (FastAPI + migrations + OpenAPI)
- [x] `docker compose up api` — verify `/health` and `/v1/metrics`
- [x] Seed restaurants: `docker compose run --rm api python scripts/seed_restaurants.py`
- [x] Phase B enabled in `ci.tfvars` — Terraform CI provisions Cloud SQL + Cloud Run
- [x] GitHub variable `GCP_DEPLOY_SERVICE_ACCOUNT` = `ttf-github-deploy@ttf-restaurant-dev.iam.gserviceaccount.com`
- [x] API CI (`reusable-api.yml` via `deploy.yml`) — build, push, deploy when `api/**` changes on `main`
- [x] Firebase Auth on API — see [FIREBASE_AUTH.md](FIREBASE_AUTH.md)
- [x] Enable Email/Password in Firebase (`ttf-restaurant-dev`)
- [ ] Test real JWT against **production** Firebase (see below)
- [x] Terraform CI (WIF): green on `main`
- [x] Set `GCP_DEPLOY_SERVICE_ACCOUNT` repo variable + run API workflow after Phase B apply
- [x] Seed **production** Cloud SQL: `./api/scripts/seed_production.sh` (115+ venues)
- [ ] (Optional) GitHub environment `dev` with approval gate for apply on `main`

### Phase A resources (default apply)

| Resource | Name |
|----------|------|
| Artifact Registry | `ttf-containers` |
| GCS bucket | `ttf-uploads-dev` |
| Secret | `ttf-maps-api-key` |
| API runtime SA | `ttf-api-runtime@...` |
| CI Terraform SA | `ttf-github-terraform@...` |
| CI deploy SA | `ttf-github-deploy@...` |

Phase B (`enable_cloud_sql`, `enable_cloud_run`) adds `ttf-db`, `ttf-api` — see `phase-b.tf`.

### Verify production Firebase Email/Password

After enabling in Console (or via API), create a test user and get an ID token:

1. [Firebase Console](https://console.firebase.google.com/project/ttf-restaurant-dev/authentication/users) → **Add user** (email + password)
2. Download `firebase-sa.json` (Project settings → Service accounts) for real JWT verify locally
3. Or use Firebase JS SDK / REST to sign in and call `GET /v1/me` with the token

Local emulator flow (no Console user needed):

```bash
docker compose up firebase-emulator api postgres
docker compose run --rm api python scripts/get_emulator_token.py --email pilot@ttf.test --password pilotpass123
```

---

## Phase 3 — iOS MVP (local Mac + GitHub CI)

See [IOS_DESIGN.md](IOS_DESIGN.md) and [ios/TTF/README.md](../ios/TTF/README.md).

- [x] MapKit restaurant list for pilot city (scaffold — polish ongoing)
- [x] Restaurant detail with TTF aggregates + Google link-out
- [x] TTF submission screen (timer + quality + item type) — needs auth to POST
- [x] Shared attribute rating UI — needs auth to POST
- [x] Apple Sign-In via Firebase Auth (`AuthService` + `SignInWithAppleButton`, `TTF.entitlements`)
- [x] Point API base URL at Cloud Run (`https://api.dev.littlescout.app`)
- [x] Add GitHub Actions iOS workflow skeleton (manual dispatch; TestFlight steps TBD)
- [ ] TestFlight group: `ttf-pilot-testers`

---

## Phase 4 — Pilot Launch

- [x] Seed restaurants for pilot metro area (115+ venues; exact count may change as Google Places results are refreshed)
- [ ] Invite beta testers via TestFlight
- [ ] Gather TTF observations from real visits
- [ ] Iterate on aggregates and UX
- [ ] Plan `ttf-restaurant-prod` GCP project for public launch
- [ ] Pre-launch hardening — [BEST_PRACTICES.md](BEST_PRACTICES.md) checklist (auth, account deletion, caching, moderation)

---

## Estimated Costs — First 6 Months

| Item | Estimate |
|------|----------|
| Apple Developer Program | $99/year |
| GCP free trial | $0 (90 days, $300 credit) |
| GCP after trial | ~$30–50/mo |
| Mac development environment | $0 (local Xcode assumed) |
| Google Maps | Likely within $200/mo free credit |
| GitHub | Free |
| **Total** | **~$400–600** |

---

## Quick Links

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](../AGENTS.md) | Guidance for AI coding agents |
| [docs/README.md](README.md) | Documentation index and reading order |
| [DESIGN.md](DESIGN.md) | Full product + technical design |
| [WEB_AUTH.md](WEB_AUTH.md) | Public app sign-up, sign-in, Google, MFA |
| [ADMIN_AUTH.md](ADMIN_AUTH.md) | Operator console — IAP and admin claims |
| [AUTH.md](AUTH.md) | Auth index |
| [FIREBASE_AUTH.md](FIREBASE_AUTH.md) | Firebase Auth + emulator (API) |
| [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) | `littlescout.app` DNS, TLS, and deployment runbook |
| [MCP_SETUP.md](MCP_SETUP.md) | Cursor MCP server configuration |
| [CI.md](CI.md) | Local checks and GitHub Actions |
| [api/README.md](../api/README.md) | API local runbook |
| [web/README.md](../web/README.md) | Web pilot local runbook |
| [infra/terraform/README.md](../infra/terraform/README.md) | Terraform + WIF CI |
| [README.md](../README.md) | Project overview |

---

## Naming Reference

All resources use prefix **`ttf`**. Full matrix in [DESIGN.md § Naming](DESIGN.md#1-naming-conventions).
