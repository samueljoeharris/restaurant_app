# AGENTS.md — TTF Restaurant App

Guidance for AI coding agents working in this repository.

## Project

**Little Scout** — social restaurant rating app for parents and caregivers dining with children. Internal codename and GCP prefix: **TTF**.

- **Flagship metric:** TTF = time from order to kid-friendly starter on the table, plus item type and quality (1–5)
- **Status:** Phase 2 complete (API + web pilot + admin + Terraform + dev custom domains); Phase 3 iOS next; catalog key `dedham-ma` (opaque, no migration needed); search works anywhere
- **Repo:** Monorepo `samueljoeharris/restaurant_app` — do not split unless explicitly requested

Read [docs/DESIGN.md](docs/DESIGN.md) for full product and technical design.

## Stack

| Layer | Technology |
|-------|------------|
| iOS | SwiftUI, MapKit, MVVM — `ios/TTF/` |
| Web pilot / admin | Vite, React, Cloud Run — `web/` |
| API | Cloud Run, REST + OpenAPI — `api/` |
| Database | PostgreSQL (Cloud SQL prod, Docker local) |
| Auth | Firebase Auth + Apple Sign-In |
| Infra | Terraform — `infra/terraform/` |
| Local dev | Docker Compose (Mac or Windows host) |
| CI/CD | GitHub Actions — single **CI/CD** pipeline per push: checks gate → Terraform → path-aware deploys ([docs/CI.md](docs/CI.md)) |

## Repository layout

```
restaurant_app/
├── AGENTS.md          # this file
├── docs/              # DESIGN, GETTING_STARTED, MCP_SETUP
├── .cursor/mcp.json   # MCP config (env vars only, no secrets)
├── api/               # Phase 2
├── web/               # Phase 2.5 web pilot + admin build
├── firebase/          # Firebase emulator config/data
├── infra/terraform/   # Phase 2
├── ios/TTF/           # Phase 3
├── scripts/           # Local CI and helper scripts
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

### Docker-first backend

- Run API, Postgres, and Terraform **in Docker** — same workflow on Mac and Windows
- Same `api/Dockerfile` for local Compose and Cloud Run
- Local Postgres URL: `postgresql://ttf_app:ttf_local@localhost:5432/ttf` (`LOCAL_POSTGRES_URL`)
- Terraform compose mounts gcloud ADC from `~/.config/gcloud` (Mac/Linux); set `GCLOUD_CONFIG_PATH` on Windows

### iOS (local Mac)

- Xcode builds and simulators run on your Mac
- TestFlight via GitHub Actions macOS runners + Apple Developer Program

### Infrastructure

- Provision GCP via **Terraform** in `infra/terraform/` — not ad-hoc console clicks (except one-time bootstrap: billing, state bucket, Firebase link)
- Hybrid console steps: Firebase project linking, Apple Sign-In provider, Maps API key creation (values go in Secret Manager)

### Secrets

- **Never** commit `.env`, PATs, `*.pem`, `*.p8`, API keys, or `terraform.tfvars`
- MCP secrets: GCP Secret Manager → `./scripts/sync-secrets.sh` → `.secrets/`; `mcp.json` uses `--env-file .secrets/mcp.env`, never literal tokens
- App secrets → Secret Manager (GCP) or GitHub Secrets (CI)

## Agent workflow

1. Check [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) for current phase before scaffolding new code
2. Prefer minimal, focused diffs — match existing conventions in surrounding code
3. Cross-cutting changes (API schema + iOS model + migration) belong in one commit/ push to `main` in this monorepo
4. **Solo dev CI:** push directly to `main` — workflows do not run on pull requests ([docs/CI.md](docs/CI.md))
5. Use path-filtered CI awareness: `api/**`, `web/**`, `infra/**`, and future `ios/**` drive which pipeline jobs run
6. MCP servers available: GitHub (Docker), gcloud (npx), postgres (local) — see [docs/MCP_SETUP.md](docs/MCP_SETUP.md)

### Agent orchestration

Claude (Opus) acts as orchestrator for complex tasks. Delegate to sub-agents rather than doing everything in one context:

| Task type | Sub-agent model | When to spawn |
|-----------|----------------|---------------|
| Codebase research (find files, trace call chains, audit for a pattern) | `sonnet` | When a question spans >3 files or requires multiple greps |
| Quick single-file lookup | `haiku` | Symbol definition, line count, a specific value |
| Parallel independent work | `sonnet` (×N) | When two areas of the codebase need separate changes with no shared state |
| Design / plan review | `sonnet` | Reviewing a doc or architecture decision before committing |

**Sub-agent prompting rules:**
- Sub-agents have no conversation history — brief them completely: file paths, what was already tried, the goal
- Tell each sub-agent whether to **research only** (read, grep, report back) or **write code** (edit files, report what changed)
- After a sub-agent returns, the orchestrator synthesizes results and decides next steps — never blindly forward sub-agent output to the user without review
- Use `isolation: "worktree"` in the Agent tool for sub-agents that make file changes, so failures don't dirty the working tree

**Model override:** Pass `model: "sonnet"` or `model: "haiku"` in the Agent tool call. Example: research and code sub-agents both use `"sonnet"`; fast single-lookup agents use `"haiku"`.

## Pull requests

When opening a PR (e.g. Cloud Agent or feature branch):

- **Open ready for review** — do not create draft PRs unless the user explicitly asks for a draft
- Use a clear title and body; note deploy impact (`api/`, `web/`, `infra/`) when relevant
- CI does not run on PRs in this repo — merge or push to `main` to trigger workflows ([docs/CI.md](docs/CI.md))

## Data model essentials

Three metric layers:

1. **Shared attributes** — curated schema on every restaurant (`high_chair_availability`, `noise_level`, etc.)
2. **TTF observations** — structured time + quality submissions (`elapsed_minutes`, `item_type`, `item_quality`, `daypart`)
3. **Restaurant notes** — per-venue freeform or tagged data

Key entities: `Restaurant`, `MetricDefinition`, `RestaurantAttributeRating`, `TTFObservation`, `RestaurantNote`, `User`

TTF display: median minutes + avg quality + sample size. Map pins colored by TTF tier.

## What not to build in v1

- Native Android client
- Production web marketplace beyond the current browser pilot/admin surfaces
- Reservations, payments, menu scraping
- Over-engineered abstractions or premature optimization
- Tests that only assert obvious behavior (unless requested)

## Key docs

| Doc | When to read |
|-----|--------------|
| [docs/DESIGN.md](docs/DESIGN.md) | Architecture, data model, API sketch, Terraform scope |
| [docs/IOS_DESIGN.md](docs/IOS_DESIGN.md) | Phase 3 iOS implementation plan and milestones |
| [ios/TTF/README.md](ios/TTF/README.md) | iOS Xcode setup and local runbook |
| [docs/BEST_PRACTICES.md](docs/BEST_PRACTICES.md) | Auth, account deletion, caching, map search, moderation |
| [docs/MAP_SEARCH_AND_SEEDING.md](docs/MAP_SEARCH_AND_SEEDING.md) | Map load vs seeding, explore slowness, location-based coverage proposal |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Phased checklist, account setup |
| [docs/README.md](docs/README.md) | Documentation index and reading order |
| [docs/CI.md](docs/CI.md) | Local checks and GitHub Actions behavior |
| [docs/WEB_AUTH.md](docs/WEB_AUTH.md) | Public app sign-up, sign-in, Google, MFA |
| [docs/ADMIN_AUTH.md](docs/ADMIN_AUTH.md) | Operator console — IAP and admin claims |
| [docs/AUTH.md](docs/AUTH.md) | Auth index |
| [docs/LITTLESCOUT_DOMAIN.md](docs/LITTLESCOUT_DOMAIN.md) | `littlescout.app` DNS and deploy runbook |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Cursor MCP configuration |

## Commits

Only create git commits when the user explicitly asks.

## Cursor Cloud specific instructions

### Docker daemon

Cloud agents install Docker through `.cursor/environment.json` + `.cursor/Dockerfile`. On startup the VM runs:

1. `.cursor/scripts/bootstrap-cloud-env.sh` — runs `sync-secrets.sh` (GCP SM → `.secrets/`), writes `web/.env.local`
2. `.cursor/scripts/start-docker.sh` — ensures Docker is running

If Docker is unavailable, run `bash .cursor/scripts/start-docker.sh` before `docker compose` or `./scripts/ci-check.sh`.

### Cursor Cloud secrets (real Firebase)

Full runbook: [docs/CLOUD_AGENT.md](docs/CLOUD_AGENT.md). Use **two** Cursor surfaces — do not paste secrets into visible env vars ([Cursor docs](https://cursor.com/docs/cloud-agent/security-network)):

| Cursor type | What to add |
|-------------|-------------|
| **Environment variables** (visible) | Copy [`.env.cloud.visible.example`](.env.cloud.visible.example) |
| **Runtime Secrets** (redacted) | `GCP_DEV_SYNC_SA_JSON` only — sync pulls all other secrets from SM |

Mac: `./scripts/sync-secrets.sh` after `gcloud auth application-default login` (replaces `merge-env-for-cursor.sh`).

```bash
bash .cursor/scripts/cloud-eval-up.sh   # postgres + API (real Firebase JWT verify)
cd web && npm run dev
```

### Local full-stack — real Firebase (default)

Same auth as `app.dev` — use your real `web/.env.local` Firebase config and `firebase-sa.json`. Full steps: [docs/WEB_AUTH.md](docs/WEB_AUTH.md#option-a--real-firebase-locally-recommended).

```bash
# .env — no FIREBASE_AUTH_EMULATOR_HOST; real SA path
# web/.env.local — real VITE_FIREBASE_* (no VITE_USE_AUTH_EMULATOR)

docker compose up --build -d postgres api
cd web && npm run dev   # http://localhost:5173
```

Sign in with a real Firebase user on `ttf-restaurant-dev` (Google or email/password).

### Local full-stack — Firebase emulator (optional)

```bash
cp .env.example .env
cp web/.env.example web/.env.local
# In .env: FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
# In web/.env.local: VITE_API_URL=http://localhost:8080, VITE_USE_AUTH_EMULATOR=true,
#   VITE_FIREBASE_API_KEY=fake-api-key-for-emulator (any value)
echo '{}' > firebase-sa.json   # compose bind-mount; not used when emulator is enabled

docker compose --profile emulator up --build -d postgres api firebase-emulator
cd web && npm run dev   # http://localhost:5173
```

Test user (emulator): `pilot@ttf.test` / `pilotpass123`. Emulator UI: http://localhost:4000.

API-only smoke test (no web): `docker compose up -d postgres api` then `curl http://localhost:8080/health`. Dev tokens (`AUTH_DEV_MODE=true`): `Authorization: Bearer dev:<uid>`.

### Lint, test, CI

| Check | Command |
|-------|---------|
| Web ESLint | `cd web && npm run lint` (may report pre-existing react-hooks warnings) |
| CI parity | `./scripts/ci-check.sh --all` (requires Docker; builds web + API images, Terraform validate) |
| API unit tests | None in repo yet |

### Seed data

`docker compose run --rm api python scripts/seed_restaurants.py` needs `MAPS_API_KEY` in `.env`. Without it, create a test restaurant via `POST /v1/restaurants` with a dev token.
