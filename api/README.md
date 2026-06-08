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
| GET | `/v1/restaurants/{id}/attributes` | ✅ (aggregates w/ min sample) |
| POST | `/v1/restaurants/{id}/attributes` | ✅ |
| POST | write endpoints | ✅ Firebase JWT (dev mode below) |
| GET | `/v1/me` | ✅ Authenticated profile |

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

## Firebase Auth

Full guide: [docs/FIREBASE_AUTH.md](../docs/FIREBASE_AUTH.md)

Write endpoints require `Authorization: Bearer <token>`.

`GET /v1/auth/config` — public client config (project ID, emulator flags).

### Local dev (`AUTH_DEV_MODE=true`)

Use a dev token — no Firebase setup required:

```bash
# Any stable uid; creates/loads user in Postgres
curl -H "Authorization: Bearer dev:pilot-tester-1" http://localhost:8080/v1/me

curl -X POST http://localhost:8080/v1/restaurants/{id}/ttf \
  -H "Authorization: Bearer dev:pilot-tester-1" \
  -H "Content-Type: application/json" \
  -d '{"elapsed_minutes": 8, "item_type": "fries", "item_quality": 5, "portion_size": "kid", "daypart": "lunch"}'
```

### Production / real Apple Sign-In tokens

1. Firebase Console → Project Settings → Service accounts → **Generate new private key**
2. Save as `firebase-sa.json` (gitignored) at repo root
3. Set `AUTH_DEV_MODE=false` and `FIREBASE_SERVICE_ACCOUNT_PATH=firebase-sa.json`
4. iOS app sends Firebase ID token from Apple Sign-In

## Config (env)

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://ttf_app:ttf_local@postgres:5432/ttf` |
| `PILOT_CITY` | `dedham-ma` |
| `PILOT_DISPLAY_NAME` | `Dedham, Massachusetts` |
| `FIREBASE_PROJECT_ID` | `ttf-restaurant-dev` |
| `AUTH_DEV_MODE` | `true` locally; `false` in Cloud Run |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to service account JSON (prod) |

Migrations run automatically on API startup (`api/migrations/*.sql`).

## Layout

```
api/
├── Dockerfile
├── openapi.yaml      # API contract
├── migrations/       # SQL schema + seeds
└── ttf_api/          # FastAPI app
```
