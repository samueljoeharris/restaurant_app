# Getting Started — TTF Restaurant App

Actionable checklist for building the TTF (Time to Fries) restaurant app from zero. For full product and technical detail, see [DESIGN.md](DESIGN.md).

**Your setup:** Windows, Docker, GitHub, no Mac, no Apple Developer account yet, first-time iOS.

**Pilot city:** Dedham, Massachusetts (`dedham-ma`)

---

## Phase 0 — MCP + Git + Accounts

### Git

- [x] Monorepo: `restaurant_app`
- [x] Remote: `git@github.com:samueljoeharris/restaurant_app.git`
- [x] First commit (docs + MCP template)
- [ ] `git push -u origin main`

### MCP Setup

See [MCP_SETUP.md](MCP_SETUP.md) for full instructions.

- [ ] Docker Desktop running (WSL2 backend)
- [ ] Install [Node.js 20+](https://nodejs.org)
- [ ] Install [gcloud CLI](https://cloud.google.com/sdk/docs/install) → `gcloud auth login`
- [ ] Install [gh CLI](https://cli.github.com) (optional)
- [ ] `cp .env.example .env` and add `GITHUB_PERSONAL_ACCESS_TOKEN` (see [MCP_SETUP.md](MCP_SETUP.md))
- [ ] Restart Cursor → verify green MCP dots (github, gcloud)
- [ ] Test: ask agent to list GitHub issues or run `gcloud projects list`

### Accounts (start in parallel — approvals take time)

- [ ] Read [DESIGN.md](DESIGN.md)
- [ ] **Apple Developer Program** ($99/year)
  - https://developer.apple.com/programs/enroll/
  - Enroll as **individual** with legal name exactly as on ID
  - Allow 2–7+ weeks for approval
- [ ] **GCP free trial**
  - https://console.cloud.google.com → activate trial
  - Create project ID: **`ttf-restaurant-dev`**
  - Display name: **TTF Restaurant (Dev)**
  - Add `TTF_GCP_PROJECT_DEV=ttf-restaurant-dev` to `.env` (optional)
  - Budget alerts at **$25** and **$50** (names: `ttf-dev-budget`)
  - Firebase → "Add Firebase to Google Cloud project"
  - Create Maps API key named **`ttf-maps-dev`** (APIs enabled by Terraform)

---

## Phase 1 — Learn iOS (cloud Mac, ~1–2 weeks)

No Mac required for Phases 0–2 backend work. Rent a cloud Mac when ready for Xcode.

- [ ] Rent cloud Mac ([MacinCloud](https://www.macincloud.com/), [MacStadium](https://www.macstadium.com/), etc.)
- [ ] Install Xcode from Mac App Store
- [ ] Complete [100 Days of SwiftUI](https://www.hackingwithswift.com/100/swiftui) — days 1–14 minimum
- [ ] Create Xcode project at `ios/TTF/`
  - Bundle ID: `com.samueljoeharris.ttf`
  - Display name: `TTF`
- [ ] One-time: App Store Connect API key (`.p8`) + provisioning profiles → GitHub Secrets

---

## Phase 2 — Backend + Infra (Windows + Docker + Terraform)

Full guide: [`infra/terraform/README.md`](../infra/terraform/README.md)

- [ ] GCP project `ttf-restaurant-dev` + billing (no org/folders OK)
- [ ] `gcloud config set project ttf-restaurant-dev && gcloud auth application-default login`
- [ ] **Bootstrap** state bucket:
  ```bash
  cd infra/terraform/bootstrap && cp terraform.tfvars.example terraform.tfvars
  docker compose run --rm terraform -chdir=bootstrap init
  docker compose run --rm terraform -chdir=bootstrap apply
  cp ../environments/dev/backend.tf.example ../environments/dev/backend.tf
  ```
- [ ] **Deploy dev**:
  ```bash
  cd infra/terraform/environments/dev && cp terraform.tfvars.example terraform.tfvars
  docker compose run --rm terraform -chdir=environments/dev init
  docker compose run --rm terraform -chdir=environments/dev apply
  ```
- [ ] Firebase + Maps key (console) — see infra README
- [x] Scaffold `api/` (FastAPI + migrations + OpenAPI)
- [x] `docker compose up postgres` — local DB
- [ ] `docker compose up api` — verify `/health` and `/v1/metrics`
- [ ] Seed Dedham restaurants (Places API script — later)
- [ ] Push image to Artifact Registry `ttf-api` (Phase B)
- [ ] _(Later)_ GitHub secret `GCP_SA_KEY` + enable `.github/workflows/terraform.yml` CI (local `terraform apply` for now)

### Phase A resources (default apply)

| Resource | Name |
|----------|------|
| Artifact Registry | `ttf-containers` |
| GCS bucket | `ttf-uploads-dev` |
| Secret | `ttf-maps-api-key` |
| API runtime SA | `ttf-api-runtime@...` |
| CI deploy SA | `ttf-github-deploy@...` |

Phase B (`enable_cloud_sql`, `enable_cloud_run`) adds `ttf-db`, `ttf-api` — see `phase-b.tf`.

---

## Phase 3 — iOS MVP (cloud Mac + GitHub CI)

- [ ] MapKit restaurant list for pilot city
- [ ] Restaurant detail with TTF aggregates + Google link-out
- [ ] TTF submission screen (timer + quality + item type)
- [ ] Shared attribute rating UI
- [ ] Apple Sign-In via Firebase Auth
- [ ] Point API base URL at Cloud Run or `host.docker.internal:8080`
- [ ] GitHub Actions `ios.yml` → TestFlight
- [ ] TestFlight group: `ttf-pilot-testers`

---

## Phase 4 — Pilot Launch

- [ ] Seed restaurants for pilot metro area
- [ ] Invite beta testers via TestFlight
- [ ] Gather TTF observations from real visits
- [ ] Iterate on aggregates and UX
- [ ] Plan `ttf-restaurant-prod` GCP project for public launch

---

## Estimated Costs — First 6 Months

| Item | Estimate |
|------|----------|
| Apple Developer Program | $99/year |
| GCP free trial | $0 (90 days, $300 credit) |
| GCP after trial | ~$30–50/mo |
| Cloud Mac bursts (~5 days/mo) | ~$100–150 |
| Google Maps | Likely within $200/mo free credit |
| GitHub | Free |
| **Total** | **~$400–600** |

---

## Quick Links

| Doc | Purpose |
|-----|---------|
| [AGENTS.md](../AGENTS.md) | Guidance for AI coding agents |
| [DESIGN.md](DESIGN.md) | Full product + technical design |
| [MCP_SETUP.md](MCP_SETUP.md) | Cursor MCP server configuration |
| [README.md](../README.md) | Project overview |

---

## Naming Reference

All resources use prefix **`ttf`**. Full matrix in [DESIGN.md § Naming](DESIGN.md#1-naming-conventions).
