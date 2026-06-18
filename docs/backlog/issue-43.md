## Goal
Implement layered caching per [BEST_PRACTICES.md §3](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#3-caching-strategy).

---

## Progress (2026-06-18)

### Done ✅
- [x] `Cache-Control` + strong ETag + `304 Not Modified` on cacheable GETs (`ETagMiddleware` — `/v1/restaurants/map`, `/v1/restaurants`, `/v1/metrics`)
- [x] Web client ETag revalidation via `listRestaurantsForMapCached()` + shared `restaurantMapCache` (5 min stale, bbox/nearby region keys)
- [x] iOS design doc notes server ETag contract ([docs/ios.md](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/ios.md))

### Remaining 🔲
- [ ] Normalized geohash/tile cache keys for bbox search (server-side)
- [ ] Event invalidation on new TTF observation / attribute rating / note
- [ ] Google `place_id` field refresh policy (≤ 30 days for Google-sourced fields)
- [ ] iOS client: enable `URLCache` + protocol cache policy (currently ignores ETags)

---

## References
- [BEST_PRACTICES.md §7 checklist](https://github.com/samueljoeharris/restaurant_app/blob/main/docs/BEST_PRACTICES.md#7-implementation-checklist)
- Related: [#42](https://github.com/samueljoeharris/restaurant_app/issues/42) map cache merge, [#50](https://github.com/samueljoeharris/restaurant_app/issues/50) detail freshness
