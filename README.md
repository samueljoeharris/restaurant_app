# Little Scout

A social restaurant rating app for **parents and caregivers** dining out with children.

**Flagship metric: kid food speed (TTF internally)** — how fast kid-friendly food reaches the table, plus what was served and how good it was. Beyond generic ratings, Little Scout captures structured, crowd-sourced data parents actually need: high chairs, noise level, stroller access, kids menu quality, and more.

## Status

**Phase 2 complete** — API, web pilot, admin surface, Terraform, and dev custom domains are in place. **Phase 3 iOS is next.**

## Stack

| Layer | Technology |
|-------|------------|
| iOS | SwiftUI, MapKit, MVVM |
| Web pilot / admin | Vite, React, Cloud Run |
| API | Cloud Run (Docker), REST + OpenAPI |
| Database | Cloud SQL PostgreSQL |
| Auth | Firebase Auth, Google sign-in, Apple Sign-In planned for iOS |
| Infra | Terraform on GCP |
| Local dev | Docker Compose (Mac or Windows) |
| CI/CD | GitHub Actions (path-filtered) |

## Documentation

| Doc | Description |
|-----|-------------|
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents |
| [docs/README.md](docs/README.md) | Documentation index and recommended reading order |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Component map, runtime topology, auth/data flows, and CI/CD |
| [docs/DESIGN.md](docs/DESIGN.md) | Product vision, data model, TTF spec, architecture, naming conventions |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Phased onboarding checklist |
| [docs/WEB_AUTH.md](docs/WEB_AUTH.md) | Public app sign-up, sign-in, Google, MFA, and local dev |
| [docs/ADMIN_AUTH.md](docs/ADMIN_AUTH.md) | Operator console — IAP, admin claims, Firebase SSO |
| [docs/AUTH.md](docs/AUTH.md) | Auth index — public vs admin |
| [docs/FIREBASE_AUTH.md](docs/FIREBASE_AUTH.md) | API JWT verification, emulator, App Check |
| [docs/LITTLESCOUT_DOMAIN.md](docs/LITTLESCOUT_DOMAIN.md) | `littlescout.app` DNS, TLS, and deployment runbook |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Cursor MCP setup (GitHub, GCP, Postgres) |
| [docs/CI.md](docs/CI.md) | Local Docker checks and GitHub Actions (dev) |
| [docs/BEST_PRACTICES.md](docs/BEST_PRACTICES.md) | Auth, deletion, caching, map search, and trust guidelines |
| [api/README.md](api/README.md) | API local runbook and endpoint summary |
| [web/README.md](web/README.md) | Web pilot local setup and deploy notes |
| [infra/terraform/README.md](infra/terraform/README.md) | Terraform bootstrap and deploy |

## Repository

Monorepo: `samueljoeharris/restaurant_app`

```
restaurant_app/
├── docs/           # Design and onboarding
├── .cursor/        # MCP configuration
├── api/            # Cloud Run API (Phase 2)
├── web/            # Vite web pilot and admin build
├── firebase/       # Firebase emulator data/config
├── infra/          # Terraform (Phase 2)
├── ios/            # Xcode / SwiftUI (Phase 3)
├── scripts/        # Local CI and helper scripts
└── .github/        # CI workflows (Phase 2+)
```

## Quick Start

1. Read [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)
2. Configure MCP servers per [docs/MCP_SETUP.md](docs/MCP_SETUP.md) if using Cursor tools
3. For local full-stack web development, use the Firebase emulator flow in [docs/WEB_AUTH.md](docs/WEB_AUTH.md) or [AGENTS.md](AGENTS.md#local-full-stack-no-cloud-firebase-secrets)
4. For deployed dev testing, use:
   - Web pilot: `https://app.dev.littlescout.app`
   - API health: `https://api.dev.littlescout.app/health`
   - Admin: `https://admin.dev.littlescout.app` (IAP-protected)
5. For iOS work, enroll in [Apple Developer Program](https://developer.apple.com/programs/enroll/) and continue with Phase 3 in [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)

## Future work / backlog

Not scheduled — design notes and product ideas for later phases. See also [docs/DESIGN.md § Roadmap](docs/DESIGN.md#15-open-questions--roadmap).

| Doc | Area | Summary |
|-----|------|---------|
| [docs/AI_CONTRIBUTION_RESEARCH.md](docs/AI_CONTRIBUTION_RESEARCH.md) | API / web / iOS | Chat or voice visit logging via Firebase/GCP AI; structured draft extraction with human review before submit |
| [docs/TTF_SUBMIT_TIMER_IDEAS.md](docs/TTF_SUBMIT_TIMER_IDEAS.md) | Web pilot | Fun timer UX on the TTF submit page — progress ring, parent humor copy, median comparison |

## License

TBD
