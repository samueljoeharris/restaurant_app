# TTF API (Python / FastAPI)

REST API for **Little Scout** — parent-focused restaurant ratings.

## Run locally

From repo root (Postgres must be healthy):

```bash
./scripts/start-local.sh          # default: postgres (Docker) + native uvicorn
# Legacy Docker API: ./scripts/start-local.sh --docker-api
```

**Python 3.14** everywhere (`api/Dockerfile`, GHA, native `.venv`). Mac: `brew install python@3.14`. Cloud VM: `.cursor/Dockerfile` (deadsnakes).

## Endpoints

| Method | Path | Status |
|--------|------|--------|
| GET | `/health` | ✅ |
| GET | `/v1/restaurants` | ✅ (empty until seeded) |
| POST | `/v1/restaurants/seed-jobs` | ✅ start background Places seed by ZIP/city/coords |
| GET | `/v1/restaurants/seed-jobs/{id}` | ✅ poll seed job status |
| GET | `/v1/restaurants/{id}` | ✅ |
| POST | `/v1/coverage/ensure` | ✅ signed-in user requests background seeding for their location (guarded) |
| GET | `/v1/metrics` | ✅ (12 seed metrics) |
| GET | `/v1/restaurants/{id}/ttf` | ✅ |
| GET | `/v1/restaurants/{id}/attributes` | ✅ (aggregates w/ min sample) |
| POST | `/v1/restaurants/{id}/attributes` | ✅ |
| POST | write endpoints | ✅ Firebase JWT (dev mode below) |
| GET | `/v1/me` | ✅ Authenticated profile |
| POST | `/v1/me/delete-account` | ✅ Delete account + contributions (recent sign-in) |

Interactive docs: http://localhost:8080/docs

## Quick test

```bash
curl http://localhost:8080/health
curl http://localhost:8080/v1/metrics
curl http://localhost:8080/v1/restaurants
```

## Seed restaurants (Places API)

Requires `MAPS_API_KEY` in `.secrets/api.env` (via `./scripts/sync-secrets.sh`).

```bash
./scripts/run-api-script.sh seed_restaurants.py
curl http://localhost:8080/v1/restaurants
```

Or pass from Secret Manager (one-off):

```bash
export MAPS_API_KEY=$(gcloud secrets versions access latest --secret=ttf-maps-api-key --project=ttf-restaurant-dev)
./scripts/run-api-script.sh seed_restaurants.py
```

Re-running the script upserts by `google_place_id` and soft-hides closed/out-of-area venues
so user contributions are preserved.

### Background seed by ZIP / location

Authenticated clients can request a background seed job:

```bash
curl -X POST http://localhost:8080/v1/restaurants/seed-jobs \
  -H "Authorization: Bearer dev:pilot-tester-1" \
  -H "Content-Type: application/json" \
  -d '{"location": "02026", "radius_m": 8000}'
```

The API returns `202 Accepted` with a `job.id`. Poll:

```bash
curl -H "Authorization: Bearer dev:pilot-tester-1" \
  http://localhost:8080/v1/restaurants/seed-jobs/{job_id}
```

Recent jobs for the same rounded area/radius are reused for
`RESTAURANT_SEED_COOLDOWN_HOURS` to avoid repeated Places API calls.

### Periodic refresh

The production Terraform defines a weekly Cloud Scheduler trigger for a Cloud Run Job
that runs:

```bash
python -m ttf_api.jobs.refresh_restaurants
```

The job refreshes the configured pilot area, upserts new/modified Places data, marks
closed Places as `closed`, and marks active rows outside the pilot radius as
`outside_area` rather than deleting rows.

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
2. `./scripts/sync-secrets.sh` writes `.secrets/firebase-sa.json`, or upload via `./api/scripts/upload_firebase_admin_sa.sh .secrets/firebase-sa.json`
3. Set `AUTH_DEV_MODE=false` (`.env.defaults` sets `FIREBASE_SERVICE_ACCOUNT_PATH=.secrets/firebase-sa.json`)
4. iOS app sends Firebase ID token from Apple Sign-In

## Config (env)

| Variable | Default |
|----------|---------|
| `DATABASE_URL` | `postgresql://ttf_app:ttf_local@localhost:5432/ttf` (native) or `@postgres:5432` (Docker API) |
| `PILOT_CITY` | `dedham-ma` (opaque catalog key) |
| `PILOT_DISPLAY_NAME` | `Little Scout` |
| `FIREBASE_PROJECT_ID` | `ttf-restaurant-dev` |
| `AUTH_DEV_MODE` | `true` locally; `false` in Cloud Run |
| `APP_CHECK_ENFORCE` | `false` locally; `true` when reCAPTCHA configured |
| `RATE_LIMIT_MAX_WRITES` | Max writes per user per window (default `60`) |
| `RATE_LIMIT_WINDOW_MINUTES` | Rate limit window (default `60`) |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | `.secrets/firebase-sa.json` locally; `/secrets/firebase-admin/firebase-sa.json` on Cloud Run |
| `MAPS_API_KEY` | Server key for Geocoding + Places API |
| `RESTAURANT_SEED_DEFAULT_LAT` / `RESTAURANT_SEED_DEFAULT_LNG` | Fallback refresh center |
| `RESTAURANT_SEED_DEFAULT_RADIUS_M` | Fallback refresh radius (default `8000`) |
| `RESTAURANT_SEED_COOLDOWN_HOURS` | Reuse recent area seed jobs (default `24`) |
| `RESTAURANT_SEED_REFRESH_QUERIES` | JSON array of Places text queries for scheduled refresh |

Migrations run automatically on API startup (`api/migrations/*.sql`).

## Layout

```
api/
├── Dockerfile
├── openapi.yaml      # API contract
├── migrations/       # SQL schema + seeds
└── ttf_api/          # FastAPI app
```
