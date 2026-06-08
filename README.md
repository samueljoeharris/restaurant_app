# TTF — Time to Fries

A social restaurant rating app for **parents and caregivers** dining out with children.

**Flagship metric: TTF (Time to Fries)** — how fast kid-friendly food reaches the table, plus what was served and how good it was. Beyond generic ratings, TTF captures structured, crowd-sourced data parents actually need: high chairs, noise level, stroller access, kids menu quality, and more.

## Status

**Design phase** — pilot city TBD, native iOS MVP targeting a single metro area.

## Stack

| Layer | Technology |
|-------|------------|
| iOS | SwiftUI, MapKit, MVVM |
| API | Cloud Run (Docker), REST + OpenAPI |
| Database | Cloud SQL PostgreSQL |
| Auth | Firebase Auth (Apple Sign-In) |
| Infra | Terraform on GCP |
| Local dev | Docker Compose on Windows |
| CI/CD | GitHub Actions (path-filtered) |

## Documentation

| Doc | Description |
|-----|-------------|
| [docs/DESIGN.md](docs/DESIGN.md) | Product vision, data model, TTF spec, architecture, naming conventions |
| [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md) | Phased onboarding checklist |
| [docs/MCP_SETUP.md](docs/MCP_SETUP.md) | Cursor MCP setup (GitHub, GCP, Postgres) |

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
