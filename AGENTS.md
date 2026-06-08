# AGENTS.md — TTF Restaurant App

Guidance for AI coding agents working in this repository.

## Project

**TTF (Time to Fries)** — social restaurant rating app for parents and caregivers dining with children.

- **Flagship metric:** TTF = time from order to kid-friendly starter on the table, plus item type and quality (1–5)
- **Status:** Design phase; pilot city TBD; single-metro MVP
- **Repo:** Monorepo `samueljoeharris/restaurant_app` — do not split unless explicitly requested

Read [docs/DESIGN.md](docs/DESIGN.md) for full product and technical design.

## Stack

| Layer | Technology |
|-------|------------|
| iOS | SwiftUI, MapKit, MVVM — `ios/TTF/` |
| API | Cloud Run, REST + OpenAPI — `api/` |
| Database | PostgreSQL (Cloud SQL prod, Docker local) |
| Auth | Firebase Auth + Apple Sign-In |
| Infra | Terraform — `infra/terraform/` |
| Local dev | Docker Compose (Windows host) |
| CI/CD | GitHub Actions with path filters |

## Repository layout

```
restaurant_app/
├── AGENTS.md          # this file
├── docs/              # DESIGN, GETTING_STARTED, MCP_SETUP
├── .cursor/mcp.json   # MCP config (env vars only, no secrets)
├── api/               # Phase 2
├── infra/terraform/   # Phase 2
├── ios/TTF/           # Phase 3
└── .github/workflows/ # Phase 2+
```

## Naming conventions

Prefix cloud resources with **`ttf`**. Full matrix in [docs/DESIGN.md § Naming](docs/DESIGN.md#1-naming-conventions).

| Resource | Dev name |
|----------|----------|
| GCP project | `ttf-restaurant-dev` |
| Cloud Run | `ttf-api` |
| Cloud SQL | `ttf-db` |
| Postgres DB / user | `ttf` / `ttf_app` |
| GCS bucket | `ttf-uploads-dev` |
| iOS bundle ID | `com.samueljoeharris.ttf` |
| Git branches | `feature/ttf-<short-desc>` |

GCP project IDs are globally unique — append `-sjh` or a number if taken.

## Development constraints

### Docker-first backend (Windows)

- Run API, Postgres, and Terraform **in Docker** — avoid native Windows installs of Postgres, Python runtimes, or Terraform
- Same `api/Dockerfile` for local Compose and Cloud Run
- Local Postgres URL: `postgresql://ttf_app:ttf_local@localhost:5432/ttf` (`LOCAL_POSTGRES_URL`)

### iOS (no local Mac)

- Xcode builds **cannot** run on Windows — only on cloud Mac or GitHub Actions macOS runners
- Edit Swift source on Windows; build/test via CI or rented Mac
- TestFlight requires paid Apple Developer Program ($99/year)

### Infrastructure

- Provision GCP via **Terraform** in `infra/terraform/` — not ad-hoc console clicks (except one-time bootstrap: billing, state bucket, Firebase link)
- Hybrid console steps: Firebase project linking, Apple Sign-In provider, Maps API key creation (values go in Secret Manager)

### Secrets

- **Never** commit `.env`, PATs, `*.pem`, `*.p8`, API keys, or `terraform.tfvars`
- MCP secrets live in **`.env`** (gitignored); `mcp.json` uses `--env-file` / `envFile`, never literal tokens
- App secrets → Secret Manager (GCP) or GitHub Secrets (CI)

## Agent workflow

1. Check [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for current phase before scaffolding new code
2. Prefer minimal, focused diffs — match existing conventions in surrounding code
3. Cross-cutting changes (API schema + iOS model + migration) belong in one PR in this monorepo
4. Use path-filtered CI awareness: `api/**`, `infra/**`, `ios/**` trigger separate workflows
5. MCP servers available: GitHub (Docker), gcloud (npx), postgres (local) — see [docs/MCP_SETUP.md](docs/MCP_SETUP.md)

## Data model essentials

Three metric layers:

1. **Shared attributes** — curated schema on every restaurant (`high_chair_availability`, `noise_level`, etc.)
2. **TTF observations** — structured time + quality submissions (`elapsed_minutes`, `item_type`, `item_quality`, `daypart`)
3. **Restaurant notes** — per-venue freeform or tagged data

Key entities: `Restaurant`, `MetricDefinition`, `RestaurantAttributeRating`, `TTFObservation`, `RestaurantNote`, `User`

TTF display: median minutes + avg quality + sample size. Map pins colored by TTF tier.

## What not to build in v1

- Android or web client
- Reservations, payments, menu scraping
- Over-engineered abstractions or premature optimization
- Tests that only assert obvious behavior (unless requested)

## Key docs

| Doc | When to read |
|-----|--------------|
| [docs/DESIGN.md](docs/DESIGN.md) | Architecture, data model, API sketch, Terraform scope |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Phased checklist, account setup |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Cursor MCP configuration |

## Commits

Only create git commits when the user explicitly asks.
