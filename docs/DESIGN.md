# Little Scout — Product & Technical Design

**Public brand:** Little Scout · **Internal codename / GCP prefix:** `ttf` (legacy: Time to Fries)  
**Status:** Phase 2 complete — API, web pilot, admin surface, Terraform, and dev custom domains are in place; Phase 3 iOS next
**MVP scope:** Single-metro pilot; native iOS (Swift/SwiftUI); GCP backend; browser pilot for early validation
**Agents:** See [AGENTS.md](../AGENTS.md) for AI coding agent guidance

---

## Table of Contents

1. [Naming Conventions](#1-naming-conventions)
2. [Vision & Goals](#2-vision--goals)
3. [Core User Flows](#3-core-user-flows)
4. [Data Model](#4-data-model)
5. [TTF Metric — Detailed Spec](#5-ttf-metric--detailed-spec)
6. [Pre-Selected Parent Metrics](#6-pre-selected-parent-metrics-v1-schema)
7. [Maps, Search & External Links](#7-maps-search--external-links)
8. [Technical Architecture](#8-technical-architecture)
9. [Infrastructure as Code — Terraform](#9-infrastructure-as-code--terraform)
10. [Repository Strategy](#10-repository-strategy)
11. [Developer Setup — First-Time iOS](#11-developer-setup--first-time-ios)
12. [API Design (Phase 2)](#12-api-design-phase-2)
13. [MVP Feature Matrix](#13-mvp-feature-matrix)
14. [Phased Rollout](#14-phased-rollout)
15. [Open Questions & Roadmap](#15-open-questions--roadmap)

---

## 1. Naming Conventions

Use slug prefix **`ttf`** across cloud resources (legacy from internal codename; do not rename GCP projects). Public-facing copy uses **Little Scout**. GitHub repo name stays **`restaurant_app`** (do not rename).

### Rules

| Context | Rule | Example |
|---------|------|---------|
| GCP project IDs, Cloud Run, buckets | lowercase, hyphens, 4–30 chars | `ttf-restaurant-dev` |
| Terraform resources / variables | lowercase, underscores | `ttf_cloud_sql_dev` |
| Docker Compose service names | short, lowercase | `api`, `postgres`, `terraform` |
| iOS bundle ID | reverse-DNS, dots | `com.samueljoeharris.ttf` |
| Secrets / env vars | `TTF_` prefix or standard names | `TTF_GCP_PROJECT_DEV` |
| Git branches | `feature/ttf-<short-desc>` | `feature/ttf-maps-search` |

GCP project IDs are **globally unique**. If `ttf-restaurant-dev` is taken, append initials or a number: `ttf-restaurant-dev-sjh`.

### Full Naming Matrix

| Resource | Dev | Prod | Notes |
|----------|-----|------|-------|
| **GitHub monorepo** | `samueljoeharris/restaurant_app` | same | Keep existing repo name |
| **Git default branch** | `main` | `main` | |
| **GitHub Actions environments** | `dev` | `prod` | Approval gate on `prod` |
| **GitHub fine-grained PAT** | `ttf-cursor-mcp` | — | Scoped to `restaurant_app` repo |
| **GCP project ID** | `ttf-restaurant-dev` | `ttf-restaurant-prod` | Separate projects per env |
| **GCP project display name** | `TTF Restaurant (Dev)` | `TTF Restaurant (Prod)` | Human-readable |
| **Firebase** | Linked to `ttf-restaurant-dev` | `ttf-restaurant-prod` | Same ID as GCP project |
| **Terraform state GCS bucket** | `ttf-tfstate-dev` | `ttf-tfstate-prod` | Bootstrap manually once per env |
| **Cloud Run service** | `ttf-api` | `ttf-api` | Per-project; env implied by project |
| **Cloud SQL instance** | `ttf-db` | `ttf-db` | Per-project |
| **Postgres database / user** | `ttf` / `ttf_app` | same | |
| **Artifact Registry repo** | `ttf-containers` | `ttf-containers` | Region: `us-central1` |
| **Docker image** | `ttf-api` | `ttf-api` | `{region}-docker.pkg.dev/{project}/ttf-containers/ttf-api` |
| **GCS photo bucket** | `ttf-uploads-dev` | `ttf-uploads-prod` | Append project number if collision |
| **Secret Manager** | `ttf-db-url`, `ttf-maps-api-key` | same pattern | Per-project |
| **Service account (API runtime)** | `ttf-api-runtime@ttf-restaurant-dev.iam` | `ttf-api-runtime@ttf-restaurant-prod.iam` | |
| **Service account (CI deploy)** | `ttf-github-deploy@ttf-restaurant-dev.iam` | `ttf-github-deploy@ttf-restaurant-prod.iam` | |
| **Maps API key name** | `ttf-maps-dev` | `ttf-maps-prod` | |
| **Budget alert** | `ttf-dev-budget` | `ttf-prod-budget` | Thresholds: $25, $50, $100 |
| **Local Postgres URL** | `postgresql://ttf_app:ttf_local@localhost:5432/ttf` | — | Env: `LOCAL_POSTGRES_URL` |
| **iOS Xcode project** | `TTF` | — | Path: `ios/TTF/` |
| **iOS bundle ID** | `com.samueljoeharris.ttf` | same | |
| **App Store Connect name** | `Little Scout` | — | |
| **TestFlight group** | `ttf-pilot-testers` | — | Internal: `ttf-team` |
| **OpenAPI spec** | `Little Scout API` | — | File: `api/openapi.yaml` |

### Future Multi-Repo Split (if needed)

| Repo | GitHub name |
|------|-------------|
| Monorepo (now) | `restaurant_app` |
| iOS split | `ttf-ios` |
| API split | `ttf-api` |
| Infra split | `ttf-infra` |

---

## 2. Vision & Goals

### Problem

Existing restaurant apps (Yelp, Google Maps, OpenTable) lack **structured, parent-specific signals**. Parents and caregivers need to know more than hours and vibe: high chair availability, noise level, stroller access, kids menu quality, and—critically—**how fast kid-friendly food reaches the table**.

### Solution

Little Scout is a social restaurant rating app focused on **parents dining with children**. It captures:

- **Pre-selected metrics** — curated schema every restaurant shares (high chairs, noise, etc.)
- **Crowd-sourced observations** — structured submissions from real visits
- **Restaurant-specific notes** — unique per-venue tags and freeform data
- **Kid food speed (TTF metric)** — the flagship signal measuring speed, type, and quality of kid starters

### Goals

- Fast contribution loop (submit TTF in under 60 seconds during a meal)
- Trustworthy aggregates with sample size and recency
- Map-first discovery
- Link-out to Google for supplemental context (no scraping)

### Non-Goals (v1)

- Native Android client
- Production web marketplace beyond the browser pilot/admin surfaces already in this repo
- Reservations or payments
- Full menu scraping
- Restaurant partnerships or monetization

### Audience

Parents and caregivers dining out with children.

---

## 3. Core User Flows

```mermaid
flowchart TD
    subgraph discovery [Discovery]
        Map[Map view] --> Search[Search by name or area]
        Search --> Detail[Restaurant detail]
    end
    subgraph contribute [Contribute]
        Detail --> RateTTF[Submit TTF observation]
        Detail --> RateAttrs[Rate shared attributes]
        Detail --> AddCustom[Add restaurant-specific note]
    end
    subgraph trust [Trust]
        RateTTF --> Aggregate[Aggregate and display stats]
        RateAttrs --> Aggregate
    end
```

| Flow | Steps |
|------|-------|
| **Discover** | Map + search → filter by attributes → restaurant detail |
| **Contribute** | Submit TTF observation, rate shared attributes, add unique notes |
| **Trust** | View aggregates, sample size, last updated, contributor count |

---

## 4. Data Model

### Two-Layer Metric System

| Layer | Description | Examples |
|-------|-------------|----------|
| **Shared attributes** | Pre-defined schema on every restaurant | `high_chair_availability`, `kids_menu_exists`, `noise_level`, `stroller_friendly`, `changing_table` |
| **Restaurant-specific data** | Optional per-venue fields or tags | "Outdoor play area", "Crayons provided", "Character-themed cups" |
| **Flagship: TTF** | Structured time + quality observation | `elapsed_minutes`, `item_type`, `item_quality`, `daypart` |

### Key Entities

#### Restaurant

```
Restaurant {
  id: UUID
  name: string
  address: string
  lat: float
  lng: float
  google_place_id: string      // for link-out only
  google_maps_url: string
  cuisine_tags: string[]
  pilot_city: string             // metro filter for MVP
  created_at, updated_at
}
```

#### MetricDefinition

Curated schema for shared attributes.

```
MetricDefinition {
  key: string                    // e.g. "high_chair_availability"
  label: string                  // "High chair availability"
  type: enum | boolean | numeric | duration
  category: access | atmosphere | kids_menu | service | safety | dietary
  input_widget: toggle | slider | enum_select
  min_sample_size: int           // before showing aggregate publicly
}
```

#### RestaurantAttributeRating

```
RestaurantAttributeRating {
  id: UUID
  restaurant_id: UUID
  metric_key: string
  firebase_uid: string           // from Firebase Auth JWT
  value: JSON                    // type-dependent
  observed_at: timestamp
  visit_context: optional string
}
```

#### TTFObservation

See [Section 5](#5-ttf-metric--detailed-spec).

#### RestaurantNote

```
RestaurantNote {
  id: UUID
  restaurant_id: UUID
  firebase_uid: string
  text: string
  tags: string[]                 // optional structured tags
  created_at: timestamp
}
```

#### User (Firebase Auth + `user_profiles` row)

```
UserProfile {
  firebase_uid: string           // JWT `uid`
  display_name: string         // JWT `name`
  email: string                // JWT `email`
  contribution_count: int        // computed from contributions
  kids_ages: int[]               // family profile
  // Family profile v2 (#85) — private to the account, never in public
  // aggregates or activity events. Vocabulary keys live in code
  // (api/ttf_api/family_profile.py), not DB enums:
  allergies: string[]            // ALLERGENS keys
  allergy_notes: string          // free-form "other"
  dietary_restrictions: string[] // DIETARY_RESTRICTIONS keys
  cuisine_likes: string[]        // lowercase tags, matches cuisine_tags
  cuisine_dislikes: string[]
  atmosphere_preferences: string[] // maps onto metric_definitions keys
  preference_notes: string
}
```

**Preference-aware discovery (#88):** `ttf_api/family_match.py` matches a
profile against a restaurant's `dietary` category attributes (community-rated,
`min_sample_size`-gated boolean aggregates like `gluten_free_options`,
`allergy_menu_available`) plus `cuisine_tags`/`cuisine_likes`/`cuisine_dislikes`.
Match reasons are decision support ("reported by parents"), never a safety
guarantee. The web "Fits my family" Explore filter (`POST /v1/me/family-matches`,
bounded to on-screen restaurant ids) and a `profile_match` activity-event type
(targeted at one user via `activity_events.target_firebase_uid`, emitted when
a restaurant is newly added/reactivated in the catalog) both consume it.
Every vocabulary key maps to a metric-backed match reason (#101) — including
halal/kosher restrictions and numeric/enum atmosphere signals (`noise_level`,
`table_spacing`, `kid_food_speed_general`, with product-defined cutoffs
documented in `ttf_api/family_match.py`) — except `pescatarian`, intentionally
unmapped (no clear boolean venue signal).

### Aggregation Rules

| Metric type | Aggregation |
|-------------|-------------|
| TTF elapsed time | Median + p25/p75 over last N observations; breakdown by daypart |
| TTF quality | Mean over same window |
| Boolean attrs | Majority vote with recency weighting |
| Numeric attrs (noise) | Rolling average |
| Minimum sample | Hide aggregate until `min_sample_size` met; show "Be the first to rate" |

---

## 5. TTF Metric — Detailed Spec

The **TTF metric** (kid food speed) measures how quickly a kid-friendly starter reaches the table, plus what was served and how good it was.

### TTFObservation Schema

```
TTFObservation {
  id: UUID
  restaurant_id: UUID
  firebase_uid: string
  ordered_at: timestamp          // when order placed
  served_at: timestamp           // when food arrived
  elapsed_minutes: int           // computed: served_at - ordered_at
  item_type: enum                // fries | apple_slices | bread | kids_meal | other
  item_quality: int              // 1-5
  portion_size: enum             // kid | regular | shareable
  daypart: enum                  // breakfast | lunch | dinner | late
  party_size_kids: int
  wait_context: string           // optional freeform
  photo_url: string              // optional, Cloud Storage
  created_at: timestamp
}
```

### Display on Restaurant Card / Detail

| Field | Display |
|-------|---------|
| TTF Score | Median minutes — e.g. **"7 min"** |
| TTF Quality | Avg quality of kid starter — e.g. **"4.2 / 5"** |
| Confidence | Sample size + last updated — e.g. **"12 visits · updated 3 days ago"** |
| Daypart breakdown | Optional: "Lunch median: 6 min" |

### TTF Tiers (Map Pin Colors)

| Tier | Median TTF | Pin color | Token name |
|------|------------|-----------|------------|
| Fast | ≤ 8 min | Green | `ttfFast` |
| OK | 9–15 min | Yellow | `ttfOk` |
| Slow | > 15 min | Red | `ttfSlow` |
| Unknown | < 3 samples | Gray | `ttfUnknown` |

Visual palette and codegen: [DESIGN_TOKENS.md](DESIGN_TOKENS.md) · design kit: [design-system/readme.md](design-system/readme.md).

---

## 6. Pre-Selected Parent Metrics (v1 Schema)

Seed `MetricDefinition` records for MVP:

### Access

| Key | Type | Input |
|-----|------|-------|
| `stroller_friendly` | boolean | toggle |
| `high_chair_availability` | enum | always / usually / sometimes / never |
| `changing_table` | enum | mens / womens / both / none |

### Atmosphere

| Key | Type | Input |
|-----|------|-------|
| `noise_level` | numeric 1–5 | slider |
| `lighting_comfort` | numeric 1–5 | slider |
| `table_spacing` | enum | roomy / average / cramped |

### Kids Menu

| Key | Type | Input |
|-----|------|-------|
| `kids_menu_exists` | boolean | toggle |
| `healthy_kids_options` | boolean | toggle |
| `free_kids_meal_with_adult` | boolean | toggle |

### Service

| Key | Type | Input |
|-----|------|-------|
| `kid_food_speed_general` | numeric 1–5 | slider (separate from TTF granularity) |

### Safety / Comfort

| Key | Type | Input |
|-----|------|-------|
| `booster_seats` | boolean | toggle |
| `allergy_accommodation` | enum | excellent / good / limited / unknown |

---

## 7. Maps, Search & External Links

Operational guidance for caching, auth, deletion, and trust controls: [BEST_PRACTICES.md](BEST_PRACTICES.md).

### Maps (iOS)

- **Apple MapKit** for discovery, pins, and directions
- Pins colored by TTF tier (see Section 5)
- User location via Core Location
- Area radius filters results

### Search

- Name and cuisine text search
- Attribute filters: "high chairs", "TTF under 10 min", "changing table"
- Geo radius search

### Google Link-Out

- Store `google_place_id` per restaurant
- Deep link to Google Maps Place URL and Google Search
- **No scraping** — supplemental context only; all parent-specific data lives in TTF

---

## 8. Technical Architecture

```mermaid
flowchart LR
    subgraph client [iOS App]
        SwiftUI[SwiftUI UI]
        MapKit[MapKit]
    end
    subgraph gcp [GCP]
        API[Cloud Run ttf-api]
        SQL[Cloud SQL ttf-db]
        Auth[Firebase Auth]
        Storage[Cloud Storage]
        Maps[Maps Platform]
    end
    SwiftUI --> API
    MapKit --> SwiftUI
    API --> SQL
    API --> Auth
    API --> Storage
    API --> Maps
```

### GCP Stack (v1)

| Concern | Service | Rationale |
|---------|---------|-----------|
| API | Cloud Run (REST) | Serverless, scales to zero |
| Database | Cloud SQL PostgreSQL | Relational fit for metrics + aggregations |
| Auth | Firebase Auth (Apple Sign-In) | Native iOS integration |
| Media | Cloud Storage (`ttf-uploads-*`) | TTF photos |
| Geocoding | Google Maps Platform | Place ID, geocoding for restaurant seeding |
| Secrets | Secret Manager | API keys, DB credentials |
| Infrastructure | Terraform | Reproducible, version-controlled |
| CI/CD | GitHub Actions | Path-filtered workflows |

### iOS Stack

| Layer | Choice |
|-------|--------|
| UI | SwiftUI |
| Concurrency | Swift Concurrency (async/await) |
| Maps | MapKit + Core Location |
| Architecture | MVVM (v1 simplicity) |
| Auth | Firebase Auth SDK + Sign in with Apple |

### Docker-First Local Development

One container image runs locally and on Cloud Run.

```mermaid
flowchart TB
    subgraph host [Mac / Windows / Cursor Cloud with Docker]
        Compose[docker compose up]
        subgraph containers [Local Containers]
            API[api container]
            PG[postgres container]
            TF[terraform container]
        end
        Cursor[Cursor edits source]
    end
    subgraph prod [GCP]
        CloudRun[Cloud Run]
        CloudSQL[Cloud SQL]
    end
    Cursor --> Compose
    API --> PG
    API -->|same Dockerfile| CloudRun
    CloudRun --> CloudSQL
```

| Component | Docker approach |
|-----------|-----------------|
| API server | `api/Dockerfile` with hot-reload volume mount |
| PostgreSQL | `postgres:16` in `docker-compose.yml` |
| Migrations / tests | `docker compose run api ...` |
| Terraform | `hashicorp/terraform` image in compose |
| Firebase Auth (local) | Firebase Emulator container (Phase 2) |
| Fake GCS | `fake-gcs-server` container (Phase 2) |

**Cannot Dockerize:** Xcode, Swift compiler, iOS Simulator, App Store signing (macOS only).

**Local workflow:**

```bash
docker compose up
docker compose run api test
docker compose run terraform plan
```

**Cross-machine testing:** iOS simulator on local Mac or CI runner → `http://host.docker.internal:8080` for local API, or the deployed custom API URL.

### iOS Build Workflow

| Task | Where |
|------|-------|
| Backend dev | Docker Compose on Mac, Windows, or Cursor Cloud |
| API / Terraform / docs | Cursor or local editor |
| iOS source editing | Cursor or Xcode |
| iOS build / simulator | Local Mac with Xcode or GitHub Actions macOS runner |
| Device testing | TestFlight |
| Signing setup | Local Mac / Apple Developer assets; CI thereafter |

---

## 9. Infrastructure as Code — Terraform

All GCP resources provisioned via **Terraform** except one-time bootstrap and hybrid console steps.

### Terraform Scope (v1)

| Resource | Module | Notes |
|----------|--------|-------|
| API enablement | `project-services` | Cloud Run, SQL Admin, Secret Manager, Artifact Registry |
| Cloud SQL | `cloud-sql` | Smallest tier dev; credentials → Secret Manager |
| Cloud Run | `cloud-run` | `ttf-api` service; Cloud SQL socket |
| Artifact Registry | `artifact-registry` | `ttf-containers` repo |
| Cloud Storage | `storage` | `ttf-uploads-*` bucket |
| Secret Manager | `secrets` | Containers only; values via CI |
| IAM | `iam` | `ttf-api-runtime`, `ttf-github-deploy` service accounts |
| Budget alert | root module | $25 / $50 thresholds |

### Hybrid (Console, Not Terraform)

- Firebase project linking ("Add Firebase to GCP project")
- Apple Sign-In provider configuration
- Google Maps API key creation (value stored in Secret Manager via Terraform container)

### Directory Layout (Phase 2)

```
infra/terraform/
├── backend.tf
├── versions.tf
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars.example   # project_id = "ttf-restaurant-dev"
│   └── prod/
└── modules/
    ├── cloud-run/
    ├── cloud-sql/
    ├── storage/
    ├── iam/
    └── project-services/
```

### Terraform via Docker

```bash
docker compose run terraform init
docker compose run terraform plan
docker compose run terraform apply
```

### CI/CD — `.github/workflows/reusable-terraform.yml`

- **Push to main:** called by the `deploy.yml` pipeline when `infra/**` changes — `terraform plan` + `terraform apply` for `dev`, then service deploys run
- **Manual dispatch:** plan/apply on demand (does not redeploy services)
- **Prod:** manual approval gate
- State locking via GCS backend (`ttf-tfstate-dev`)

### Bootstrap Sequence

1. Create GCP project `ttf-restaurant-dev` + billing (manual)
2. Create GCS bucket `ttf-tfstate-dev` (manual)
3. `terraform apply` for dev — creates everything else

---

## 10. Repository Strategy

**Decision: Monorepo** (`restaurant_app`) for MVP.

| Factor | Monorepo | Multi-repo |
|--------|----------|------------|
| Solo / small team | Ideal | Overhead |
| Cursor AI context | Full project indexed | Fragmented |
| Cross-cutting changes | One PR | Coordinated PRs across repos |
| Docker Compose | Root-level orchestration | Awkward |
| Beginner friction | Low | High |

### Monorepo Layout

```
restaurant_app/
├── .cursor/           # MCP config
├── docs/              # Design, onboarding, MCP setup
├── docker-compose.yml
├── api/               # Cloud Run service (Phase 2)
├── web/               # Web pilot and admin build (Phase 2.5)
├── firebase/          # Firebase emulator config/data
├── infra/terraform/   # IaC (Phase 2)
├── ios/TTF/           # Xcode project (Phase 3)
├── scripts/           # Local CI and helper scripts
└── .github/workflows/ # deploy.yml + reusable-* + tool-* (see workflows/README.md)
```

### Path-Aware Deploy Pipeline

`deploy.yml` runs on every push to `main` and routes work by changed paths
(Terraform first, then service deploys):

| Pipeline job | Runs when |
|--------------|-----------|
| Terraform (`reusable-terraform.yml`) | `infra/**` changed |
| API (`reusable-api.yml`) | `api/**` changed, or after Terraform apply |
| Web (`reusable-web.yml`) | `web/**` changed, or after Terraform apply |
| Admin Web (`reusable-admin-web.yml`) | `web/**` changed, or after Terraform apply |
| iOS (`tool-ios.yml`) | Manual `workflow_dispatch` today; path-filtered push when Phase 3 CI is added |

### When to Split

- Separate iOS contractor without infra access
- Decoupled release cadences
- Org policy requiring isolated infra repo

Extract via `git filter-repo` from `ios/`, `api/`, `infra/` folders.

---

## 11. Developer Setup — First-Time iOS

See [GETTING_STARTED.md](GETTING_STARTED.md) for the actionable checklist. Summary below.

### Account Checklist

| Account | Action | Cost |
|---------|--------|------|
| GitHub | `samueljoeharris/restaurant_app` — done | Free |
| Apple Developer Program | Enroll as individual; legal name exactly as on ID | $99/year |
| GCP | Free trial; project `ttf-restaurant-dev` | $300 credit / 90 days |
| Firebase | Add to GCP project | Free tier |
| Google Maps Platform | API key `ttf-maps-dev` | $200/mo free credit |

### Apple Developer Program

| Item | Detail |
|------|--------|
| Enrollment | https://developer.apple.com/programs/enroll/ |
| Requirements | Apple ID + 2FA; legal name; physical address; own credit card |
| Free tier | Xcode, simulators, 7-day device provisioning |
| Paid tier | TestFlight, App Store, Sign in with Apple production |
| Timeline | Apple says 24–48h; reports show 2–7+ weeks — **enroll early** |

### GCP Account

| Step | Action |
|------|--------|
| 1 | https://console.cloud.google.com → activate free trial |
| 2 | Create project `ttf-restaurant-dev` |
| 3 | Budget alerts at $25 and $50 |
| 4 | Enable APIs: Cloud Run, Cloud SQL, Secret Manager |
| 5 | Add Firebase to project |
| 6 | Bootstrap `ttf-tfstate-dev` GCS bucket |

**Billing safeguards:** Cloud Run scale-to-zero; smallest Cloud SQL tier; no manual "Upgrade to paid" until ready; secrets in Secret Manager only.

### Mac / iOS Development

| Option | Cost | Use for |
|--------|------|---------|
| Local Mac + Xcode | Existing hardware | Xcode, simulator, cert setup |
| GitHub Actions macOS | ~200 free build min/mo | TestFlight CI |
| Cloud Mac rental | Optional | Short-term fallback if local Mac is unavailable |

**Workflow:** Code locally or in Cursor → build/test in Xcode on a Mac → GitHub Actions for TestFlight.

### iOS Learning Path

1. Swift fundamentals — [100 Days of SwiftUI](https://www.hackingwithswift.com/100/swiftui) (days 1–14)
2. SwiftUI basics — navigation, `@State`, API calls
3. MapKit + Core Location
4. Firebase Auth + Apple Sign-In
5. TTF submission flow

### MCP Setup

See [MCP_SETUP.md](MCP_SETUP.md) for GitHub, gcloud, and postgres MCP configuration.

### Estimated Costs — First 6 Months

| Item | Estimate |
|------|----------|
| Apple Developer | $99/year |
| GCP (trial) | $0 first 90 days |
| GCP (after trial) | ~$30–50/mo |
| Mac hardware | Existing local Mac assumed |
| Maps Platform | Within $200/mo free credit |
| GitHub | Free |
| **Total** | **~$400–600** |

---

## 12. API Design (Phase 2)

REST API with OpenAPI spec at `api/openapi.yaml`. Endpoints sketched for implementation:

### Restaurants

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/restaurants` | List/search (geo, filters, pilot city) |
| GET | `/v1/restaurants/{id}` | Detail with aggregates |
| POST | `/v1/restaurants` | Add restaurant (authenticated) |

### TTF Observations

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/restaurants/{id}/ttf` | Submit TTF observation |
| GET | `/v1/restaurants/{id}/ttf` | Aggregated TTF stats |

### Attribute Ratings

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/restaurants/{id}/attributes` | Submit attribute rating |
| GET | `/v1/restaurants/{id}/attributes` | Aggregated attributes |

### Notes

| Method | Path | Description |
|--------|------|-------------|
| POST | `/v1/restaurants/{id}/notes` | Add restaurant-specific note |
| GET | `/v1/restaurants/{id}/notes` | List notes |

### Metrics Schema

| Method | Path | Description |
|--------|------|-------------|
| GET | `/v1/metrics` | List `MetricDefinition` seed schema |

### Auth

All write endpoints require Firebase Auth JWT (Apple Sign-In). Read endpoints public for v1.

---

## 13. MVP Feature Matrix

| Feature | v1 | Later |
|---------|----|----|
| Map + search | Yes | — |
| Restaurant detail + Google link | Yes | — |
| TTF submission + aggregate display | Yes | — |
| Shared parent attributes (curated set) | Yes | — |
| Restaurant-specific notes/tags | Yes | — |
| User accounts (Apple Sign-In) | Yes | — |
| Photo on TTF submission | Optional | — |
| Moderation / flagging | Basic | Advanced |
| Browser web pilot | Yes | Production web experience optional later |
| Native Android | — | Later |
| Push notifications | — | Later |
| Custom API domain | Dev (`api.dev.littlescout.app`) | Prod domain later |
| Restaurant partnerships | — | TBD |

---

## 14. Phased Rollout

```mermaid
flowchart TD
    P0[Phase 0: Docs + MCP + Accounts] --> P1[Phase 1: Terraform + API via Docker]
    P1 --> P2[Phase 2: API + Web Pilot + Admin + Dev Domains]
    P2 --> P3[Phase 3: iOS app connects to API]
    P3 --> P4[Phase 4: TestFlight beta in pilot city]
```

| Phase | Host | Blockers |
|-------|------|----------|
| 0 — Design docs + MCP | Any | None |
| 0 — Apple enrollment | Web | Apple Developer approval |
| 0 — GCP setup | Web / local CLI | Billing verification |
| 1 — Terraform + API | Docker | GCS state bucket bootstrapped |
| 2 — API + web pilot + admin + dev domains | Docker + GitHub Actions | Terraform apply, Firebase/Auth config |
| 3 — iOS MVP | Local Mac / macOS CI | Xcode project, signing certs |
| 4 — TestFlight | GitHub Actions + App Store Connect | Paid Apple Developer Program |

**Key insight:** Backend-first via Docker. Seed restaurant data before touching Xcode.

---

## 15. Open Questions & Roadmap

### Open Questions

- **Coverage:** Design supports any area; spend is guarded by density skip, per-user daily cap, and 24h cooldown
- **Moderation policy:** How to handle spam or bad-faith TTF submissions?
- **Verification:** Honor system vs check-in (GPS proximity)?
- **Monetization:** None planned for MVP
- **Brand:** Resolved — public name **Little Scout**; `ttf` retained for GCP/API internals

### Phase 2+ Roadmap

- Push notifications (new TTF data at favorite restaurants)
- Android / PWA client
- Restaurant owner claims / verified info
- Expansion beyond pilot city
- Advanced moderation and reputation system
- Production custom domains on `littlescout.app`

---

*Last updated: Phase 2 docs cleanup.*
