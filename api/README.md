# TTF API (Python / FastAPI)

REST API for the Time to Fries restaurant app. **Pilot city:** Dedham, Massachusetts (`dedham-ma`).

## Run locally

From repo root (Postgres must be healthy):

```bash
docker compose up --build api
```

## Endpoints

| Method | Path | Status |
|--------|------|--------|
| GET | `/health` | ✅ |
| GET | `/v1/restaurants` | ✅ (empty until seeded) |
| GET | `/v1/restaurants/{id}` | ✅ |
| GET | `/v1/metrics` | ✅ (12 seed metrics) |
| GET | `/v1/restaurants/{id}/ttf` | ✅ |
| POST | write endpoints | 501 until Firebase Auth |

Interactive docs: http://localhost:8080/docs

## Quick test

```bash
curl http://localhost:8080/health
curl http://localhost:8080/v1/metrics
curl http://localhost:8080/v1/restaurants
```

## Seed Dedham restaurants (Places API)

Requires `MAPS_API_KEY` in repo-root `.env` (same key as `ttf-maps-dev`).

```bash
docker compose run --rm api python scripts/seed_dedham.py
curl http://localhost:8080/v1/restaurants
```

Or pass from Secret Manager (one-off):

```bash
export MAPS_API_KEY=$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project=ttf-restaurant-dev)
docker compose run --rm -e MAPS_API_KEY api python scripts/seed_dedham.py
```

Re-running the script upserts by `google_place_id` (safe to run again).

## Config (env)

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://ttf_app:ttf_local@postgres:5432/ttf` |
| `PILOT_CITY` | `dedham-ma` |
| `PILOT_DISPLAY_NAME` | `Dedham, Massachusetts` |

Migrations run automatically on API startup (`api/migrations/*.sql`).

## Layout

```
api/
├── Dockerfile
├── openapi.yaml      # API contract
├── migrations/       # SQL schema + seeds
└── ttf_api/          # FastAPI app
```
