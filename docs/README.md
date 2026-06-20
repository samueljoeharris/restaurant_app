# Documentation Index

Start here when you are orienting yourself in the Little Scout repo.

## Recommended reading order

| Read | Purpose |
|------|---------|
| [README.md](../README.md) | Project overview, current status, and top-level quick start |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Phase checklist and current build/deploy state |
| [ROADMAP.md](ROADMAP.md) | **Backlog queue** — `now` / `next` / `later` GitHub issues |
| [BACKLOG_STATUS.md](BACKLOG_STATUS.md) | Hygiene snapshot + `gh issue edit` bodies in [backlog/](backlog/) |
| [CI.md](CI.md) | Local Docker checks and GitHub Actions behavior |
| [WEB_AUTH.md](WEB_AUTH.md) | **Public app** — sign up, sign in, Google, MFA, local emulator |
| [FIREBASE_AUTH.md](FIREBASE_AUTH.md) | API JWT verification, dev tokens, App Check, Cloud Run env |
| [ADMIN_AUTH.md](ADMIN_AUTH.md) | **Operator console** — IAP, admin claims, Firebase SSO bridge |
| [AUTH.md](AUTH.md) | Auth index — which doc to read for public vs admin |
| [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) | Current `littlescout.app` DNS, TLS, IAP, and smoke-test runbook |
| [../api/README.md](../api/README.md) | API local development and endpoint summary |
| [../web/README.md](../web/README.md) | Web pilot local setup and Cloud Run deploy notes |
| [../infra/terraform/README.md](../infra/terraform/README.md) | Terraform bootstrap, dev stack, and WIF setup |
| [MCP_SETUP.md](MCP_SETUP.md) | Cursor MCP setup for GitHub, GCP, Postgres, and Firebase |
| [CLOUD_AGENT.md](CLOUD_AGENT.md) | **Cloud Agents** — paste `.env`, local stack, `/map` debugging |
| [SYNTHETIC_USERS.md](SYNTHETIC_USERS.md) | **Synthetic agent users** — Cursor Automations on app.dev |
| [SECRETS_MATRIX.md](SECRETS_MATRIX.md) | **Where secrets live** — local vs GCP vs deploy; rotation |
| [SECRETS_AUDIT.md](SECRETS_AUDIT.md) | Audit of the secrets design + Docker/runtime consistency (2026-06-20) |
| [DESIGN.md](DESIGN.md) | Product design, data model, architecture, and roadmap |
| [IOS_DESIGN.md](IOS_DESIGN.md) | Phase 3 iOS implementation plan — Cursor/Xcode workflow, architecture, milestones |
| [../ios/TTF/README.md](../ios/TTF/README.md) | iOS Xcode setup and local runbook |
| [../AGENTS.md](../AGENTS.md) | AI coding agent guidance for this repository |

## Current implementation notes

- Dev custom domains use `littlescout.app`:
  - `https://app.dev.littlescout.app` -> public web pilot (Firebase sign-in)
  - `https://api.dev.littlescout.app` -> API
  - `https://admin.dev.littlescout.app` -> IAP-protected admin (separate auth path — see [ADMIN_AUTH.md](ADMIN_AUTH.md))
- The current web pilot and admin app both live under `web/`; separate Cloud Run services are built by `reusable-web.yml` and `reusable-admin-web.yml`.
- `CUSTOM_DOMAIN_SETUP.md` is a historical planning document. Use [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) as the live runbook.
- GitHub Actions are intentionally push-to-`main` for this solo-dev repo; see [CI.md](CI.md) before changing branch protection or workflow triggers.

## Architecture & performance research

| Doc | Area | Summary |
|------|------|---------|
| [MAP_SEARCH_AND_SEEDING.md](MAP_SEARCH_AND_SEEDING.md) | API / web / iOS | How map load and client search work today; Places seeding pipeline; slowness root causes; location-based background seeding proposal |

## Future ideas & backlog

**Canonical queue:** [ROADMAP.md](ROADMAP.md) (GitHub Issues with `now` / `next` / `later` labels). Research docs below link from issues — not competing backlogs.

| Doc | Area | Summary |
|------|------|---------|
| [ROADMAP.md](ROADMAP.md) | All | One-screen north star; links to GitHub issues |
| [TTF_SUBMIT_TIMER_IDEAS.md](TTF_SUBMIT_TIMER_IDEAS.md) | Web pilot | Fun timer UX — [#45](https://github.com/samueljoeharris/restaurant_app/issues/45) |
| [AI_CONTRIBUTION_RESEARCH.md](AI_CONTRIBUTION_RESEARCH.md) | API / web / iOS | AI contribution research — [#41](https://github.com/samueljoeharris/restaurant_app/issues/41) |
