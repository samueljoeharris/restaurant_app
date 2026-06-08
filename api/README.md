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
