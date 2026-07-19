# AGENTS.md — TTF Restaurant App

Guidance for AI coding agents working in this repository. **Canonical source** — other agent entry points import or reference this file.

## How instructions layer

| Tool | Entry file | What it adds |
|------|------------|--------------|
| **Any agent** | `AGENTS.md` (this file) | Stack, constraints, workflow, local dev, key docs |
| **Devin** | `.devin/blueprint.yaml` + this file | Primary development environment; repo-level setup and skills |
| **Claude Code (backup)** | [CLAUDE.md](CLAUDE.md) | `@AGENTS.md` import + session bootstrap notes |

Keep one source of truth here. Update AGENTS.md first; thin wrappers (`CLAUDE.md`, Devin skills) should point here, not duplicate.

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
├── AGENTS.md          # this file — canonical agent guidance
├── CLAUDE.md          # Claude Code backup entry (@AGENTS.md import)
├── .claude/           # Claude Code hooks (session-start)
├── .devin/            # Devin environment blueprint and skills
├── docs/              # DESIGN, GETTING_STARTED, DEVIN_SETUP
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
3. Cross-cutting changes (API schema + iOS model + migration) belong in one commit/push to `main` in this monorepo
4. **Solo dev CI:** push directly to `main` — workflows do not run on pull requests ([docs/CI.md](docs/CI.md))
5. Use path-filtered CI awareness: `api/**`, `web/**`, `infra/**`, and future `ios/**` drive which pipeline jobs run
6. Devin handles MCP integrations via its built-in tools and any configured servers in `.devin/`. For Claude Code backup, see [docs/MCP_SETUP.md](docs/MCP_SETUP.md).

### Backlog discipline

Before starting new feature work:

1. Read [docs/ROADMAP.md](docs/ROADMAP.md) — canonical one-screen queue
2. Check open GitHub issues labeled `now`, `next`, or `later` in `samueljoeharris/restaurant_app`
3. **Max 3 items in `now`.** Do not add a fourth without bumping one out
4. Research docs (`AI_CONTRIBUTION_RESEARCH.md`, `MAP_SEARCH_AND_SEEDING.md`, etc.) are design notes — link from issues; they are not competing backlogs
5. New work needs an issue in `now`, or explicit user approval to bump something out of `now`

When completing work: close or update the issue; move labels if the queue shifts. Assigned issue delivery overrides `now` queue hesitation.

### When to commit and push

| Trigger | Action |
|---------|--------|
| User says commit, push, merge, or "do everything you can" on shippable work | Commit + push after `./scripts/ci-check.sh` |
| User assigns GitHub issue delivery | Commits in scope — see **GitHub issue delivery** below |
| User says "implement the plan" / "don't stop until done" | Commit when complete; merge/push if they said merge |
| Audit, review, or question-only | **Do not** commit unless asked |
| Default | **Do not** commit |

**Before push:** run `./scripts/ci-check.sh`. Never `git push --no-verify`. After push, confirm **CI/CD / CI** is green on GitHub Actions before claiming deploy is done ([docs/CI.md](docs/CI.md)). Path detection (`scripts/ci_path_filters.py`) drives which deploy jobs run; cross-stack API contract paths trigger both API and Web deploys.

### GitHub issue delivery

When the user assigns a GitHub issue ("work on #42", issue URL):

1. Read the issue title, body, and linked docs; infer minimal shippable scope
2. Do not ask questions until success or **3 failed attempts** — use defaults above
3. Loop: plan → implement → `./scripts/ci-check.sh` → push `main` → watch **CI/CD** → validate live (API curl / browser when deployable)
4. Update the issue each attempt; close on success or post failure report after attempt 3
5. One final chat message at each gate — no status pings mid-loop

In **Devin**, use the built-in GitHub and Devin MCP tools, or create repo-level skills under `.devin/skills/`. In **Claude Code (backup)**, use its native tooling.

### Coding discipline (ponytail)

Lazy means efficient, not careless. Before writing code, climb this ladder:

1. Does this need to be built? (YAGNI)
2. Does it already exist here? Reuse it
3. Stdlib / platform / installed dependency? Use that
4. Can it be one line? Make it one line
5. Only then: minimum code that works

Bug fix = root cause: grep every caller of the function you touch; fix the shared function once. No abstractions nobody asked for; no new dependencies if avoidable; deletion over addition. Mark intentional shortcuts with a `ponytail:` comment naming the ceiling and upgrade path. Non-trivial logic gets one runnable check (smallest thing that fails if the logic breaks).

Not lazy about: understanding the problem, trust-boundary validation, data-loss prevention, security, accessibility, anything explicitly requested.

### Agent orchestration (Devin primary + Claude Code backup)

Devin is the primary agent harness. Claude Code is a backup when explicitly invoked by the user. Devin provides built-in tools (GitHub, Slack, search, browser, shell, etc.) and child sessions; for complex tasks, delegate rather than doing everything in one context.

**Model-tier policy — the coordinator is the most expensive model in the room.** When the main session runs on an Opus- or Fable-tier model, delegate aggressively to `haiku` and `sonnet` sub-agents: the coordinator plans, delegates, and synthesizes; cheaper models do the reading, searching, and mechanical legwork. Frontier models under-delegate by default — Anthropic's own guidance is to instruct them explicitly, so treat this section as that instruction. When the main session already runs on Sonnet or Haiku, delegation is for context isolation, not cost — `inherit` is fine.

| Task type | Sub-agent model | When to spawn |
|-----------|----------------|---------------|
| Quick lookup (symbol definition, line count, a specific value) | `haiku` | Single-file or single-grep questions the coordinator doesn't need to see raw |
| Codebase research (find files, trace call chains, audit for a pattern) | `haiku`; `sonnet` if results need interpretation | When a question spans >3 files or requires multiple greps |
| High-volume output isolation (test runs, log processing, docs fetching) | `haiku` | Whenever raw output would flood the coordinator's context — only the summary returns |
| Implementation in a scoped area | `sonnet` | Writing or refactoring code the coordinator has already scoped |
| Parallel independent work | `sonnet` (×N) | When two areas of the codebase need separate changes with no shared state |
| Design / plan review | `sonnet` | Reviewing a doc or architecture decision before committing |
| Judgment-heavy synthesis, cross-cutting decisions | coordinator itself | Delegate the legwork, never the thinking |

**Scale sub-agent count to task complexity** (per [Anthropic's multi-agent research system](https://www.anthropic.com/engineering/multi-agent-research-system)): **0** when one read or grep answers it — delegation overhead exceeds the work, do it directly; **1** for a scoped question; **2–4 in parallel** for comparisons or multi-area changes; more only for genuinely decomposable research. Never spawn a fleet for a one-line question.

**Sub-agent briefing rules** (sub-agents start with zero conversation history):
- Brief completely: objective, file paths, what was already tried, expected output format, and boundaries (what *not* to touch)
- Tell each sub-agent whether to **research only** (read, grep, report back) or **write code** (edit files, report what changed)
- Parallelize only independent workstreams; dependent steps stay sequential in the coordinator
- After a sub-agent returns, the coordinator synthesizes results and decides next steps — never blindly forward sub-agent output to the user without review
- Use `isolation: "worktree"` for sub-agents that make file changes, so failures don't dirty the working tree

**Devin:** use the built-in `devin_mcp` child-session and tooling for parallel work; set per-session parameters as needed. For repository skills, place them in `.devin/skills/`.

**Claude Code (backup):** prefer the built-in `Explore` agent for read-only search (pass a thoroughness level: quick / medium / very thorough). Per-invocation model override: pass `model: "haiku"` / `"sonnet"` in the Agent tool call.

### Devin environment

Devin uses the repo-level `.devin/blueprint.yaml` to install web/API deps, configure the local environment, and scaffold no-secret env files on session start. See `.devin/blueprint.yaml`.

### Claude Code backup bootstrap

Remote Claude Code sessions run [.claude/hooks/session-start.sh](.claude/hooks/session-start.sh): installs web/API deps and scaffolds emulator env files. iOS and Docker CI paths are skipped on Linux. See [CLAUDE.md](CLAUDE.md).

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
| [docs/design-system/readme.md](docs/design-system/readme.md) | Bluebird visual design kit — voice, UI kits, reference components |
| [docs/DESIGN_TOKENS.md](docs/DESIGN_TOKENS.md) | Theme tokens — edit `design/tokens.json`, run `npm run tokens:generate` |
| [docs/MAP_STYLE.md](docs/MAP_STYLE.md) | Google Map Style basemap + MapKit POI-off |
| [docs/TEST_FLOWS.md](docs/TEST_FLOWS.md) | Live UI theme QA catalog |
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
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Claude Code MCP configuration (backup) |
| [CLAUDE.md](CLAUDE.md) | Claude Code backup entry (imports this file) |
| [.devin/blueprint.yaml](.devin/blueprint.yaml) | Devin environment blueprint |

## Devin Cloud environment

### Docker daemon

Devin snapshots install Docker through the org-wide blueprint and repo `.devin/blueprint.yaml`. On startup the VM ensures Docker is running.

If Docker is unavailable, install Docker and write `/etc/docker/daemon.json` with `"storage-driver": "fuse-overlayfs"` and `"features": {"containerd-snapshotter": false}` before `docker compose` or `./scripts/ci-check.sh`.

### Devin Cloud secrets (real Firebase)

Full runbook: [docs/CLOUD_AGENT.md](docs/CLOUD_AGENT.md). In Devin, use repository or org secrets via the secret manager — do not paste secrets into chat.

| Surface | What to add |
|---------|-------------|
| **Environment variables** (visible) | Copy [`.env.cloud.visible.example`](.env.cloud.visible.example) |
| **Secrets** (redacted) | `GCP_DEV_SYNC_SA_JSON` only — `sync-secrets.sh` pulls all other secrets from SM |

Mac: `./scripts/sync-secrets.sh` after `gcloud auth application-default login`.

```bash
./scripts/start-local.sh                # postgres + native API (real Firebase JWT verify)
cd web && npm run dev
```

### Browser / UI test plan (cloud agents)

When validating web UI flows (issue delivery, [TEST_FLOWS.md](docs/TEST_FLOWS.md)), sign in with the **shared dev test account** — not a personal Google account.

| Item | Detail |
|------|--------|
| **Email (public)** | `contrib-1781961579@ttf.test` |
| **Password** | Secret Manager `ttf-dev-test-credentials` → `.secrets/dev-test.env` |
| **One-time setup** | Human with SM admin runs `./scripts/seed-dev-test-credentials.sh` (creates GSM version + Firebase user) |
| **Agent bootstrap** | Automatic — `sync-secrets.sh` writes `DEV_TEST_EMAIL` / `DEV_TEST_PASSWORD` |
| **Load in shell** | `source scripts/load-dev-test-env.sh` (never echo `$DEV_TEST_PASSWORD` in chat) |

**Test steps (local or app.dev):**

1. `./scripts/audit-env.sh` — confirm `DEV_TEST_EMAIL` and `DEV_TEST_PASSWORD` are set.
2. Start stack: `./scripts/start-local.sh` then `cd web && npm run dev` (local) or use `https://app.dev.littlescout.app`.
3. Open `/login` → email/password → expect redirect to `/map`.
4. Run P0 flows from [TEST_FLOWS.md](docs/TEST_FLOWS.md) (WEB-AUTH-01, WEB-MAP-01, etc.).

**Emulator fallback:** if `FIREBASE_AUTH_EMULATOR_HOST` is set, the same `DEV_TEST_*` vars seed the emulator user (`seed-emulator-user.sh`); default fallback is `pilot@ttf.test` / `pilotpass123`.

**Do not:** paste test passwords into chat, commit them, or create ad-hoc test users per agent run.

### Local full-stack — real Firebase (default)

Same auth as `app.dev` — use your real `web/.env.local` Firebase config and `.secrets/firebase-sa.json` (via `./scripts/sync-secrets.sh`). Full steps: [docs/WEB_AUTH.md](docs/WEB_AUTH.md#option-a--real-firebase-locally-recommended).

```bash
./scripts/start-local.sh   # postgres (Docker) + native uvicorn on :8080
cd web && npm run dev      # http://localhost:5173
```

Legacy Docker API path: `./scripts/start-local.sh --docker-api`

Sign in with a real Firebase user on `ttf-restaurant-dev` (Google or email/password).

### Local full-stack — Firebase emulator (optional)

```bash
cp .env.example .env
cp web/.env.example web/.env.local
# In .env: FIREBASE_AUTH_EMULATOR_HOST=firebase-emulator:9099
#   (load-dev-env.sh rewrites to localhost:9099 for native API)
# In web/.env.local: VITE_API_URL=http://localhost:8080, VITE_USE_AUTH_EMULATOR=true,
#   VITE_FIREBASE_API_KEY=fake-api-key-for-emulator (any value)
mkdir -p .secrets && echo '{}' > .secrets/firebase-sa.json

docker compose --profile emulator up --build -d postgres firebase-emulator
./scripts/run-api.sh --reload &
cd web && npm run dev   # http://localhost:5173
```

Test user (emulator): `pilot@ttf.test` / `pilotpass123`. Emulator UI: http://localhost:4000.

API-only smoke test (no web): `./scripts/start-local.sh` then `curl http://localhost:8080/health`. Dev tokens (`AUTH_DEV_MODE=true`): `Authorization: Bearer dev:<uid>`.

### Lint, test, CI

| Check | Command |
|-------|---------|
| Web ESLint | `cd web && npm run lint` (may report pre-existing react-hooks warnings) |
| CI parity | `./scripts/ci-check.sh --all` (requires Docker; builds web + API images, Terraform validate) |
| API tests | `api/tests/` exists. unittest (no extra deps): `docker compose run --rm api python -m unittest discover -s tests -p 'test_*.py'` — but `test_map_query.py`/`test_http_cache.py` import `pytest`, absent from the prod image. Full run: `docker compose run --rm --no-deps api sh -c "pip install -q pytest && python -m pytest tests/"`. CI only runs `tests.test_security_config`. |

### Seed data

`./scripts/run-api-script.sh seed_restaurants.py` needs `MAPS_API_KEY` in `.secrets/api.env` (via sync). Without it, create a test restaurant via `POST /v1/restaurants` with a dev token.
