# API and Route Contract

Canonical app paths and API endpoints for Little Scout clients. Keep this short and update it when a route or endpoint becomes the preferred client path.

## Web Routes

Public web and mobile web use the same React routes. Mobile behavior is responsive chrome, not a separate URL tree.

| Area | Canonical path | Notes |
|------|----------------|-------|
| Explore map | `/map` | `/restaurants` is a legacy alias for the same page. New navigation should use `/map`. |
| Saved spots | `/saved` | Authenticated. |
| Account | `/account` | Authenticated. |
| Contributions | `/account/contributions` | Authenticated contribution management. |
| Restaurant detail | `/restaurants/:id` | Catalog restaurants. Build with `restaurantDetailPath()`. |
| Place detail | `/restaurants/place/:placeId` | Google Place entries before catalog materialization. Build with `restaurantDetailPath()`. |
| Log speed | `/restaurants/:id/submit`, `/restaurants/place/:placeId/submit` | Build with `restaurantSubmitPath()`. |
| Rate attributes | `/restaurants/:id/rate`, `/restaurants/place/:placeId/rate` | Build with `restaurantRatePath()`. |
| Review chat | `/restaurants/:id/review`, `/restaurants/place/:placeId/review` | Build with `restaurantReviewPath()`. |

Use `web/src/lib/mapEntryKey.ts` for restaurant and place-aware URL generation. Avoid hand-built `/restaurants/${id}` links outside that helper.

## Public API

All app endpoints are versioned under `/v1` except `/health`.

| Client need | Canonical endpoint | Web | iOS | Notes |
|-------------|--------------------|-----|-----|-------|
| Health check | `GET /health` | N/A | N/A | Ops probe. |
| Map viewport | `GET /v1/restaurants/map` | Uses bbox + ETag | Full fetch | iOS should adopt bbox when map parity work resumes. |
| Text search | `GET /v1/restaurants/search` | Anonymous search | Current search | Database-backed results. |
| Signed-in nearby search | `GET /v1/places/nearby` | Yes | Missing | Canonical for Google + catalog nearby search. |
| Place autocomplete | `GET /v1/places/autocomplete` | Yes | Yes | Requires auth/App Check where configured. |
| Place resolve | `GET /v1/places/resolve` | Yes | Yes | |
| Place entry | `GET /v1/places/{place_id}/entry` | Yes | Missing | Preferred pre-materialized detail payload. |
| Place materialize | `POST /v1/places/{place_id}/materialize` | Yes | Missing | Creates/returns catalog restaurant. |
| Restaurant detail | `GET /v1/restaurants/{id}` | Yes | Yes | Includes TTF aggregate. |
| Attribute ratings | `GET/POST /v1/restaurants/{id}/attributes` | Yes | Yes | |
| Notes | `GET/POST /v1/restaurants/{id}/notes` | Yes | Yes | |
| TTF observation | `POST /v1/restaurants/{id}/ttf` | Yes | Yes | Per-type write path. |
| Batch contribution | `POST /v1/restaurants/{id}/contributions` | Yes | Missing | Canonical for review-chat style multi-field submissions. |
| Place batch contribution | `POST /v1/places/{place_id}/contributions` | Yes | Missing | Materializes as needed. |
| Profile | `GET/PATCH /v1/me/profile` | Yes | Missing | Preferred account profile shape. |
| Basic user | `GET /v1/me` | Unused on web | Yes | Legacy/basic user shape. |
| Activity inbox | `GET /v1/me/activity` | Yes | Yes | |
| Mark activity read | `POST /v1/me/activity/mark-read` | Yes | Missing | |

## Admin API

Admin-only operations should use `/v1/admin/*`. Prefer `POST /v1/admin/seed-jobs` for catalog refreshes; the older restaurant seed-job route is not a client-facing path.

## OpenAPI

`api/openapi.yaml` is hand-maintained and can drift from FastAPI routers. Treat `api/ttf_api/routers/*.py` as the runtime source of truth until OpenAPI is generated or CI-enforced from the app.
