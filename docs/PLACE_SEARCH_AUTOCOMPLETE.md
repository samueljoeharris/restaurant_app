# Place search autocomplete + radius seeding

How Little Scout's search box becomes a Google-style typeahead that, on selecting a
place, runs an async radius search around that area and fills the list page —
on **web** and **iOS**.

**Status:** Design + implementation spec (June 2026). This doc is the frozen
contract; the API, web, and iOS layers are implemented against it in parallel.

**Related:** [MAP_SEARCH_AND_SEEDING.md](MAP_SEARCH_AND_SEEDING.md) (coverage seeding
pipeline this reuses), [BEST_PRACTICES.md](BEST_PRACTICES.md) (geolocation/cost/caching),
[IOS_DESIGN.md](IOS_DESIGN.md).

---

## 1. Goal & UX flow

Today the search box filters an already-loaded catalog client-side. We want:

1. User types in the search box → **debounced autocomplete** suggests:
   - **Places/areas** (Google Places Autocomplete — cities, neighborhoods, ZIPs, addresses)
   - **Restaurants we already have** (name matches from our Postgres catalog)
2. User picks a suggestion:
   - **Restaurant hit** → navigate straight to that restaurant's detail screen.
   - **Place hit** → resolve it to `lat/lng`, then **async**:
     - immediately query our catalog for restaurants **within a radius** of that point and render them on the list page, sorted by distance;
     - fire `POST /v1/coverage/ensure` to seed any missing venues around that point via Google Places (reusing the existing background pipeline);
     - poll the seed job and **re-run the radius query** when it finishes, so newly-seeded venues appear.
3. The list page shows a context banner ("Places near *Dedham, MA* · within 8 km · Clear") and a subtle "finding more nearby…" state while the seed runs.

```
type "dedh…"
   │  debounced 250ms
   ▼
GET /v1/places/autocomplete?q=&session_token=&lat=&lng=
   │  → [ {restaurant…}, {place…}, … ]
   ▼
pick a place
   ▼
GET /v1/places/resolve?place_id=&session_token=   → { lat, lng, label }
   ▼ (parallel)
 ┌───────────────────────────────┬─────────────────────────────────────┐
 │ GET /v1/restaurants/search    │ POST /v1/coverage/ensure {lat,lng}   │
 │  ?lat=&lng=&radius_m=         │  → queued? poll /v1/coverage/jobs/id │
 │  → RestaurantMapEntry[]       │  → on finish, re-run radius search   │
 └───────────────────────────────┴─────────────────────────────────────┘
   ▼
list page renders results near {label}
```

---

## 2. Frozen API contract

Three **new** endpoints. Everything else (`/v1/coverage/ensure`,
`/v1/coverage/jobs/{id}`) already exists and is reused unchanged.

### 2.1 `GET /v1/places/autocomplete` — typeahead (NEW)

Proxies **Google Places Autocomplete (New)** and merges our own restaurant name hits.

- **Auth:** `Depends(get_current_user)` + `verify_app_check(request)` — same gate as
  `/v1/coverage/ensure`. Rationale: Google Autocomplete is metered spend, so it sits
  behind sign-in + App Check exactly like coverage seeding. (Anonymous users keep
  the existing client-side name filter; the rich place typeahead is a signed-in feature.)
- **Query params:**
  | name | type | notes |
  |------|------|-------|
  | `q` | string, required, `min_length=1` | the partial input |
  | `session_token` | string, required | client-generated UUID, one per typing session; forwarded to Google for session billing |
  | `lat`, `lng` | float, optional | location bias (user location or current map center) |
- **Response 200:**
  ```json
  {
    "suggestions": [
      { "type": "restaurant", "restaurant_id": "uuid", "primary_text": "Joe's Pizza", "secondary_text": "12 Main St, Dedham" },
      { "type": "place", "place_id": "ChIJ…", "primary_text": "Dedham", "secondary_text": "MA, USA" }
    ]
  }
  ```
  - Up to **5 restaurant** hits first (direct catalog `name ILIKE %q%`, pilot_city, active), then up to **5 place** predictions.
  - On Google error or missing `MAPS_API_KEY`, still return the restaurant hits with an empty place list (degrade gracefully); only raise `503` if both the key is missing **and** there are no restaurant hits is *not* required — simplest: return restaurant hits + `"suggestions"` without places, log the Google error.

**Google call (Places Autocomplete New):**
```
POST https://places.googleapis.com/v1/places:autocomplete
Headers: X-Goog-Api-Key: <MAPS_API_KEY>, Content-Type: application/json
Body: {
  "input": q,
  "sessionToken": session_token,
  "includedRegionCodes": ["us"],
  "locationBias": { "circle": { "center": {"latitude": lat, "longitude": lng}, "radius": 50000.0 } }  // omit if no lat/lng
}
```
Response shape (New API — note singular `placePrediction`):
```json
{ "suggestions": [
  { "placePrediction": {
      "placeId": "ChIJ…",
      "structuredFormat": { "mainText": {"text": "Dedham"}, "secondaryText": {"text": "MA, USA"} },
      "text": {"text": "Dedham, MA, USA"} } } ] }
```
Map `mainText`→`primary_text`, `secondaryText`→`secondary_text` (fall back to `text.text`).

### 2.2 `GET /v1/places/resolve` — place_id → coordinates (NEW)

Proxies **Place Details (New)**, passing the same `session_token` to close the
autocomplete billing session.

- **Auth:** same as autocomplete (`get_current_user` + `verify_app_check`).
- **Query params:** `place_id` (required), `session_token` (required).
- **Response 200:**
  ```json
  { "place_id": "ChIJ…", "lat": 42.2436, "lng": -71.1677, "label": "Dedham, MA, USA" }
  ```
- **Google call:**
  ```
  GET https://places.googleapis.com/v1/places/{place_id}?sessionToken=<session_token>
  Headers: X-Goog-Api-Key, X-Goog-FieldMask: id,location,formattedAddress,displayName
  ```
  `location.latitude/longitude` → `lat/lng`; `formattedAddress` (fallback `displayName.text`) → `label`.
- **Errors:** `404` if the place has no location; `503` if `MAPS_API_KEY` missing
  (reuse the `_raise_seed_error` convention: `"MAPS_API_KEY"` in message → 503, else 400).

### 2.3 `GET /v1/restaurants/search` — radius query (NEW)

Server-side radius query over our catalog. **Public**, no auth (read-only, no Google
spend) — same posture as `/v1/restaurants/map`.

- **Query params:**
  | name | type | default | notes |
  |------|------|---------|-------|
  | `lat` | float | required | |
  | `lng` | float | required | |
  | `radius_m` | int | `8000` | clamp **500–25000** |
  | `q` | string | optional | extra `name ILIKE` filter within the radius |
  | `limit` | int | `100` | clamp 1–250 |
- **Response 200:** `list[RestaurantMapEntry]` — **identical shape to `/v1/restaurants/map`**
  so web/iOS reuse existing decoders and list cards. Ordered by Haversine distance ascending.
- **SQL:** take the `/v1/restaurants/map` query (the 3 LATERAL aggregates), add to the
  `WHERE`:
  ```sql
  AND 2 * 6371000 * asin(sqrt(
        power(sin(radians(r.lat - %(lat)s) / 2), 2)
        + cos(radians(%(lat)s)) * cos(radians(r.lat))
          * power(sin(radians(r.lng - %(lng)s) / 2), 2)
      )) <= %(radius_m)s
  ```
  (same Haversine as `coverage.count_active_within`), optional `AND r.name ILIKE %(q)s`,
  `ORDER BY <that same distance expr> ASC`, `LIMIT %(limit)s`. Keep `pilot_city` + `status='active'` filters.

### 2.4 Reused (already built — do not modify)

- `POST /v1/coverage/ensure` `{lat, lng, radius_m}` → `{status: "covered"|"queued", job_id?, …}` (auth + App Check, density check, per-user cap, 24h cooldown).
- `GET /v1/coverage/jobs/{job_id}` → `{status, inserted_count, updated_count}` (user-scoped poll).

---

## 3. Backend implementation (`api/`)

| File | Change |
|------|--------|
| `api/ttf_api/routers/places.py` | **NEW** router, `prefix="/v1/places"`, `tags=["places"]`. Two endpoints (2.1, 2.2). Reuse `require_maps_api_key()`, `httpx.Client`, and the `_raise_seed_error` 503/400 convention. Restaurant hits via a small `name ILIKE` query (pilot_city, active, `LIMIT 5`). |
| `api/ttf_api/routers/restaurants.py` | **EDIT** — add `GET /search` (2.3) next to `list_restaurants`/`list_restaurants_for_map`. Factor the `/map` SELECT body into a shared helper or copy it; reuse `_row_to_summary` + the TtfAggregate build block. |
| `api/ttf_api/schemas.py` | **NEW** models: `PlaceSuggestion` (a discriminated-ish union via `type: Literal["place","restaurant"]` with optional `place_id`/`restaurant_id`), `AutocompleteResponse{ suggestions: list[PlaceSuggestion] }`, `PlaceResolveResponse{ place_id, lat, lng, label }`. |
| `api/ttf_api/main.py` | **EDIT** — `app.include_router(places.router)`. |
| `api/ttf_api/places_client.py` *(optional)* | Thin helpers `autocomplete_places()` / `place_details()` using `httpx`, mirroring `places_seed.search_places()` style. Keeps the router thin and testable. |
| `api/openapi.yaml` | **EDIT** — document the 3 new endpoints (best-effort; spec is hand-maintained). |
| `api/ttf_api/config.py` | Optional: `places_autocomplete_bias_radius_m: int = 50000`. Not required. |

**Conventions to match:** FastAPI dependency injection, `with get_conn() as conn`,
snake_case response fields, `httpx.Client` context manager, 20–30s timeouts, raise
`HTTPException` mapping `PlacesSeedError` via the existing 503/400 rule.

**Tests:** none exist in the repo; do not add unless trivial. A `httpx` mock for the
autocomplete mapper would be the highest-value optional test.

---

## 4. Web implementation (`web/`)

Vite + React, React Router v7, plain `useState`+`fetch`, global BEM CSS in `index.css`.

| File | Change |
|------|--------|
| `web/src/api/client.ts` | **EDIT** — add `placesAutocomplete(q, opts, token)`, `resolvePlace(placeId, sessionToken, token)`, `searchRestaurants({lat,lng,radius_m,q?,limit?})`. Mirror existing `ensureCoverage`/`getCoverageJob` signatures (auth token passed explicitly). |
| `web/src/types.ts` | **EDIT** — add `PlaceSuggestion`, `PlaceResolveResponse`. Reuse existing `RestaurantMapEntry` for radius results. |
| `web/src/hooks/usePlacesAutocomplete.ts` | **NEW** — debounced (250ms) typeahead. Owns a `sessionToken` (`crypto.randomUUID()`), regenerated after each `resolve`. Cancellation-token pattern like `useNearbyCoverage`. Returns `{ suggestions, loading, error }`. No-ops when signed out (return empty + a `requiresSignIn` flag). |
| `web/src/components/PlaceSearchBox.tsx` | **NEW** — accessible combobox (`role="combobox"`, `aria-expanded`, `aria-activedescendant`, listbox of options). Keyboard nav (↑/↓/Enter/Esc). Renders restaurant vs place rows distinctly (icon + secondary text). Props: `onSelectPlace(resolved)`, `onSelectRestaurant(id)`. Style with new BEM classes (`.place-search`, `.place-search__menu`, `.place-search__option`) added to `index.css`, following `.search`/`.explore-filter` patterns. |
| `web/src/hooks/useAreaCoverage.ts` | **NEW (or generalize `useNearbyCoverage`)** — takes explicit `{lat,lng,radius_m}` (not geolocation), calls `ensureCoverage`, polls `getCoverageJob` (4s / 90s cap), invokes `onComplete()` to refetch. Extract the shared polling core so `useNearbyCoverage` keeps working. |
| `web/src/pages/RestaurantListPage.tsx` | **EDIT** — mount `PlaceSearchBox` above the existing filters. New URL params `lat`,`lng`,`radius`,`place`. When `lat`+`lng` present: fetch via `api.searchRestaurants()` instead of `listRestaurantsForMap()`, show a "Places near {place} · within Nkm · Clear" banner, and drive `useAreaCoverage` (refetch on seed completion). When absent: current behavior unchanged. `onSelectRestaurant` → `navigate('/restaurants/'+id)`. |
| `web/src/pages/ExploreMapPage.tsx` | Place search via `PlaceSearchBox`; selecting a place routes with `?lat=&lng=&radius=&place=`. |
| `web/src/index.css` | **EDIT** — combobox styles. |

**Notes:** No new deps — we proxy Google through our API, so **no client-side Google
Places JS / `use-places-autocomplete`**. `VITE_GOOGLE_MAPS_API_KEY` stays map-render-only.
Debounce + session token are mandatory for billing sanity.

---

## 5. iOS implementation (`ios/TTF/`)

SwiftUI + MapKit + MVVM, `@Observable`, async/await, manual `.pbxproj` registration.

> ⚠️ **Per the user's decision we proxy Google through our API — do NOT use
> `MKLocalSearchCompleter`.** iOS calls `/v1/places/autocomplete` for parity with web.

| File | Change |
|------|--------|
| `ios/TTF/TTF/Models/PlaceSuggestion.swift` | **NEW** — `PlaceSuggestion` (Codable; `type`, optional `placeId`/`restaurantId`, `primaryText`, `secondaryText` via `CodingKeys`), `AutocompleteResponse`, `PlaceResolveResponse`. Reuse `RestaurantMapEntry` for results. |
| `ios/TTF/TTF/Services/APIClient.swift` | **EDIT** — add `placesAutocomplete(query:sessionToken:near:) async throws -> [PlaceSuggestion]`, `resolvePlace(placeId:sessionToken:) async throws -> PlaceResolveResponse` (both authed — send bearer token), `searchRestaurants(lat:lng:radiusM:q:) async throws -> [RestaurantMapEntry]`, plus `ensureCoverage(lat:lng:radiusM:) ` and `coverageJob(id:)` (coverage was never wired on iOS — add it now). |
| `ios/TTF/TTF/ViewModels/PlaceSearchViewModel.swift` | **NEW** `@Observable` — debounced query via cancellable `Task` + `Task.sleep(250ms)`; owns `sessionToken = UUID().uuidString` (regenerate after resolve); `suggestions`, `isSearching`, `radiusResults`, `areaLabel`, `seedState`. `select(_ suggestion)` → resolve → `searchRestaurants` + `ensureCoverage` (poll job, refetch). |
| `ios/TTF/TTF/Views/List/RestaurantListView.swift` | **EDIT** — replace the local `.searchable` name filter with the place search. When a place is picked, show its radius `radiusResults` + a banner ("Near {label} · within N km · Clear"); when a restaurant is picked, push `RestaurantDetailView`. Keep pull-to-refresh. |
| `ios/TTF/TTF/Views/Search/PlaceSearchSuggestionsView.swift` *(optional)* | **NEW** — the suggestions list UI (restaurant vs place rows), if cleaner than inlining. |
| `ios/TTF/TTF.xcodeproj/project.pbxproj` | **EDIT (critical)** — register every new `.swift` file: add a `PBXFileReference`, a `PBXBuildFile`, a child entry in the right `PBXGroup` (Models/, ViewModels/, Views/Search/), and an entry in the `PBXSourcesBuildPhase`. Mirror an existing file's four entries exactly (copy the `Restaurant.swift` / `RestaurantListViewModel.swift` blocks, new UUIDs). The project uses classic groups, not folder-synced groups, so files are invisible to the build until registered. |

**Constraints:** This environment has **no Xcode/macOS**, so iOS cannot be compiled or
run here — correctness of the hand-edited `.pbxproj` and Swift matters. Match the
`@Observable` + async/await style; do not introduce Combine. `AppConfig.apiBaseURL`
and the `RestaurantStore` decoder already handle the `RestaurantMapEntry` JSON.

---

## 6. Cost, auth & rate-limiting

- **Session tokens** are required: one UUID per typing session, sent on every
  autocomplete keystroke and the final resolve, so Google bills the session as a unit.
- **Debounce 250ms** on both clients before each autocomplete call.
- **Auth gate:** autocomplete + resolve require sign-in + App Check (Google spend),
  mirroring `/v1/coverage/ensure`. The radius query is public.
- **Seeding guards** are unchanged and already strong: density short-circuit
  (`coverage_min_restaurants`), per-user daily area cap (`coverage_max_areas_per_day`),
  24h `area_key` cooldown.
- **Places caching terms:** we persist only `place_id` long-term (our own restaurant
  rows live in Postgres); transient autocomplete/resolve responses are not stored.

---

## 7. Verification

- **API:** `./scripts/start-local.sh`; with a dev token
  (`Authorization: Bearer dev:<uid>`, `AUTH_DEV_MODE=true`):
  - `GET /v1/restaurants/search?lat=42.24&lng=-71.17&radius_m=8000` → distance-sorted list (works without `MAPS_API_KEY`).
  - `GET /v1/places/autocomplete?q=dedh&session_token=<uuid>` → restaurant hits even when `MAPS_API_KEY` unset; place hits when set.
- **Web:** `cd web && npm run lint` and `npm run dev`; type in the box, pick a place,
  confirm the list switches to radius results + banner + "finding more" while seeding.
- **iOS:** cannot build here (no macOS). Verify `.pbxproj` edits are well-formed and
  Swift compiles by inspection; real build happens on a Mac / CI macOS runner.
- CI does not run on PRs; this lands on the feature branch for review.

---

## 8. v1 scope / non-goals

- No PostGIS (keep inline Haversine, consistent with the codebase).
- No client-side Google JS SDK (all Google calls proxied through our API).
- No new tabs on iOS; the feature lives in the existing **List** tab + Home search.
- No bbox/viewport-driven auto-search; selection-driven only.
- Radius is fixed-default (8 km) v1; a radius control is a fast follow.
</content>
</invoke>
