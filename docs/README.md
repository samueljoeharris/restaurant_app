# Documentation Index

Start here when you are orienting yourself in the Little Scout repo.

## Recommended reading order

| Read | Purpose |
|------|---------|
| [README.md](../README.md) | Project overview, current status, and top-level quick start |
| [GETTING_STARTED.md](GETTING_STARTED.md) | Phase checklist and current build/deploy state |
| [CI.md](CI.md) | Local Docker checks and GitHub Actions behavior |
| [FIREBASE_AUTH.md](FIREBASE_AUTH.md) | API auth modes, emulator setup, and Firebase JWT flow |
| [AUTH.md](AUTH.md) | Google sign-in, MFA, admin IAP, and operator auth notes |
| [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) | Current `littlescout.app` DNS, TLS, IAP, and smoke-test runbook |
| [../api/README.md](../api/README.md) | API local development and endpoint summary |
| [../web/README.md](../web/README.md) | Web pilot local setup and Cloud Run deploy notes |
| [../infra/terraform/README.md](../infra/terraform/README.md) | Terraform bootstrap, dev stack, and WIF setup |
| [MCP_SETUP.md](MCP_SETUP.md) | Cursor MCP setup for GitHub, GCP, Postgres, and Firebase |
| [DESIGN.md](DESIGN.md) | Product design, data model, architecture, and roadmap |
| [../AGENTS.md](../AGENTS.md) | AI coding agent guidance for this repository |

## Current implementation notes

- Dev custom domains use `littlescout.app`:
  - `https://app.dev.littlescout.app` -> public web pilot
  - `https://api.dev.littlescout.app` -> API
  - `https://admin.dev.littlescout.app` -> IAP-protected admin
- The current web pilot and admin app both live under `web/`; separate Cloud Run services are built by `web.yml` and `admin-web.yml`.
- `CUSTOM_DOMAIN_SETUP.md` is a historical planning document. Use [LITTLESCOUT_DOMAIN.md](LITTLESCOUT_DOMAIN.md) as the live runbook.
- GitHub Actions are intentionally push-to-`main` for this solo-dev repo; see [CI.md](CI.md) before changing branch protection or workflow triggers.
