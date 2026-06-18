## Goal
Track remaining map search / seeding work from [MAP_SEARCH_AND_SEEDING.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/MAP_SEARCH_AND_SEEDING.md).

**Status (2026-06-18):** Core **web pilot** flow is largely done. Keep this issue for **iOS parity**, **scale/perf**, and **post-seed refresh** polish — not for re-implementing the basics.

---

## Shipped ✅ (web + API)

- [x] Combined explore page (`/map`, `/restaurants`) with sidebar + map
- [x] Viewport bbox catalog load (debounced 300 ms on map idle)
- [x] Shared in-memory `restaurantMapCache` + stable snapshot for React
- [x] HTTP ETag / `Cache-Control` on `GET /v1/restaurants/map`
- [x] Pin clustering at low zoom (>12 pins, zoom ≤ 13)
- [x] Places autocomplete (catalog ILIKE + Google predictions, auth-gated)
- [x] **Fast path on search select:** resolve → `GET /places/{id}/entry` → focus pin + detail sheet
- [x] Async nearby via `GET /v1/places/nearby` + pin pop-in for newly discovered venues
- [x] Background `POST /v1/coverage/ensure` (1 km) on search selection
- [x] Search-focus pin (brand orange) + venue zoom (17) vs area zoom (12)
- [x] Google-only pins: discover styling, Little Scout sheet, **View on Google Maps**
- [x] `clickableIcons={false}` — our pins, not native Google POI clicks
- [x] Fetch `getPlaceEntry` on map pin click when place not cached
- [x] `google_maps_url` on `RestaurantMapEntry`

**Commits:** `1a95866`, `c173a9f`, `5cdda30`, `2bbe5bf`, `d5e644e`, `17cca42`

---

## Remaining 🔲

### Web / API polish
- [ ] Silent refresh after coverage seed job completes (invalidate cache + reload radius/nearby)
- [ ] Poll `GET /v1/coverage/jobs/{id}` UX indicator in radius banner (optional)
- [ ] Recency / freshness on map sheet (see [#50](https://github.com/samueljoeharris/restaurant_app/issues/50))

### Scale (when catalog grows)
- [ ] PostGIS GiST index on restaurant location
- [ ] Normalized geohash/tile keys for bbox queries ([#43](https://github.com/samueljoeharris/restaurant_app/issues/43))

### iOS (Phase 3)
- [ ] MapKit explore + same API contract (nearby, focus, place entry)
- [ ] Core Location “search this area” parity

---

## References
- [MAP_SEARCH_AND_SEEDING.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/MAP_SEARCH_AND_SEEDING.md)
- [BEST_PRACTICES.md §4](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#4-map-search--geospatial-performance)
- Closed: [#34](https://github.com/samueljoeharris/restaurant_app/issues/34) (sidebar branch merged)
