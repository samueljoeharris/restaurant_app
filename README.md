# Little Scout

A social restaurant rating app for **parents and caregivers** dining out with children.

**Flagship metric: kid food speed (TTF internally)** — how fast kid-friendly food reaches the table, plus what was served and how good it was. Beyond generic ratings, Little Scout captures structured, crowd-sourced data parents actually need: high chairs, noise level, stroller access, kids menu quality, and more.

## Status

**Phase 2 complete** — API + web POC deployed; Phase 3 iOS next. Pilot city: Dedham, MA.

## Stack

| Layer | Technology |
|-------|------------|
| iOS | SwiftUI, MapKit, MVVM |
| API | Cloud Run (Docker), REST + OpenAPI |
| Database | Cloud SQL PostgreSQL |
| Auth | Firebase Auth (Apple Sign-In) |
| Infra | Terraform on GCP |
| Local dev | Docker Compose (Mac or Windows) |
| CI/CD | GitHub Actions (path-filtered) |

## Documentation

| Doc | Description |
|-----|-------------|
| [AGENTS.md](AGENTS.md) | Guidance for AI coding agents |
| [docs/DESIGN.md](docs/DESIGN.md) | Product vision, data model, TTF spec, architecture, naming conventions |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Phased onboarding checklist |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Cursor MCP setup (GitHub, GCP, Postgres) |
| [docs/CI.md](docs/CI.md) | Local Docker checks and GitHub Actions (dev) |
| [infra/terraform/README.md](infra/terraform/README.md) | Terraform bootstrap and deploy |

## Repository

Monorepo: `samueljoeharris/restaurant_app`

```
restaurant_app/
├── docs/           # Design and onboarding
├── .cursor/        # MCP configuration
├── api/            # Cloud Run API (Phase 2)
├── infra/          # Terraform (Phase 2)
├── ios/            # Xcode / SwiftUI (Phase 3)
└── .github/        # CI workflows (Phase 2+)
```

## Quick Start (Phase 0)

1. Read [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)
2. Configure MCP servers per [docs/MCP_SETUP.md](docs/MCP_SETUP.md)
3. Enroll in [Apple Developer Program](https://developer.apple.com/programs/enroll/) ($99/year)
4. Create GCP project `ttf-restaurant-dev` with free trial

## License

TBD
