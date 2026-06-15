# Little Scout iOS — Swift/iOS Best-Practices Review

**Type:** Engineering review / recommendations
**Date:** June 2026
**Scope:** the native iOS client in `ios/TTF/` — map rendering, list search, autocomplete, networking, and (the headline item) **map-driven async backend search** as the user scrolls the map.
**Method:** audited the current iOS source against the web reference client (`web/`), the backend contract (`api/ttf_api/`), the project's own [`BEST_PRACTICES.md`](BEST_PRACTICES.md) / [`MAP_SEARCH_AND_SEEDING.md`](MAP_SEARCH_AND_SEEDING.md) / [`IOS_DESIGN.md`](IOS_DESIGN.md), plus current (2024–2026) Swift/SwiftUI/MapKit guidance (sources at the end).

> This is a **review**, not a change set. Each finding cites the file it's about, says what's fine for the pilot today, and what will break as the catalog grows. Code snippets are illustrative and match the repo's existing idioms (`@Observable`, `async/await`, SwiftUI `Map`).

> **Update — June 2026:** the P0 map→coverage feature and several P1 items below have since been implemented (iOS + backend). See **Implementation status** next.

## Implementation status (June 2026)

**Done — iOS**
- **P0** — `onMapCameraChange(.onEnded)` camera tracking; `ensureCoverage` / `getCoverageJob` on `APIClient`; `CoverageModel` (job polling + latest-wins cancellation); sparse-viewport **"Search this area"** button (sign-in gated) with a radius preview circle. (`Views/Map/RestaurantMapView.swift`, `Services/CoverageModel.swift`)
- **P1** — markers filtered to the visible region; `URLSession` switched to `.useProtocolCachePolicy` + a real `URLCache`; URLs built with `URLComponents`/`URLQueryItem`; dead `MapViewModel` / `RestaurantListViewModel` deleted; list search widened to name + address + cuisine; `summaries` cached on load; `@MainActor` hoisted to `RestaurantStore`.

**Done — backend (benefits web too)**
- `ETag` + `Cache-Control: …stale-while-revalidate` + `304 Not Modified` on the cacheable GET reads (`/v1/restaurants/map`, `/v1/restaurants`, `/v1/metrics`) via `ETagMiddleware` — so the new iOS `URLCache` (and browsers) revalidate cheaply.
- Optional `min_lat/max_lat/min_lng/max_lng` bbox params on `/v1/restaurants/map` (all-or-nothing, backward compatible). `openapi.yaml` updated; unit tests under `api/tests/`.

**Still open (future)**
- **P2** — `MKLocalSearchCompleter` autocomplete (§4); pin clustering once counts climb (§2).
- iOS unit-test target (coverage client `URLProtocol` stubs per §7) — not yet added; backend has `api/tests/`.
- Wire the iOS/web map *reads* to actually send the new bbox params + add geohash/SWR server caching as the catalog grows (§1 end, §9).

---

## TL;DR scorecard

| Area | Today | Verdict | Priority |
|------|-------|---------|----------|
| **Map → async search as you scroll** | Map loads the whole catalog once; **nothing observes camera movement**; no `coverage/ensure` call on iOS | ❌ Missing — web already does this | **P0** |
| **Map rendering** | `ForEach(store.mapEntries) { Marker(...) }` renders *every* venue, always; no clustering, no viewport filtering | ⚠️ Fine at ~115 pins, degrades at ~1–2k | P1 |
| **Large list search** | Client-side `contains` on **name only**; server `?q=` search exists but is unused | ⚠️ OK for pilot, won't scale | P1 |
| **Autocomplete** | None | ❌ Absent | P2 |
| **Networking / caching** | HTTP cache **disabled** (`.reloadIgnoringLocalCacheData`); URLs built by string concatenation | ⚠️ Wastes the server's ETag/SWR work | P1 |
| **Concurrency / state** | No task cancellation for searches; two **dead-code** view models | ⚠️ Cleanup + latest-wins needed before async search | P1 |
| **Location consent** | No Core Location yet (planned) | ✅ Plan matches web's privacy rule | P2 |

---

## 1. The headline: scroll the map → async backend search

This is the behavior you called out, and it's the single biggest gap. **The web client already does it; iOS does not.**

### What the map does today

`ios/TTF/TTF/Views/Map/RestaurantMapView.swift`:

```swift
@State private var cameraPosition = MapCameraPosition.region(...)

Map(position: $cameraPosition, selection: $selectedRestaurantID) {
    ForEach(store.mapEntries) { entry in
        Marker(entry.name, coordinate: entry.coordinate)
            .tint(TtfTierLogic.tier(for: entry.ttf).color)
            .tag(entry.id)
    }
}
```

- `cameraPosition` is bound, but **nothing reacts to it changing.** There is no `onMapCameraChange`. (Confirmed: `onMapCameraChange`, `visibleRegion`, `coverage/ensure`, `MKLocalSearch` produce **zero** matches across `ios/`.)
- The data is loaded **once** by `RestaurantStore.load(api:)` (called from `RootTabView.task`) via `GET /v1/restaurants/map`, which returns the entire pilot city. Panning/zooming never fetches anything.
- So if a user scrolls to a town with no seeded coverage, they see an empty map and have no way to fix it — exactly the "coverage gap feels like broken search" problem described in [`MAP_SEARCH_AND_SEEDING.md`](MAP_SEARCH_AND_SEEDING.md) §4B.

### What web already does (the reference to copy)

`web/src/components/RestaurantMap.tsx` + `web/src/hooks/useNearbyCoverage.ts`:

1. On the map's **`idle`** event (camera settled) it recomputes whether the viewport is *sparse* (`countWithinBounds(...) <= SPARSE_VIEWPORT_MAX`, i.e. ≤ 3 venues).
2. When sparse, it shows a **"Search this area"** button and draws a translucent radius circle glued to the viewport center.
3. Tapping it calls `api.ensureCoverage({ lat, lng, radius_m })` → `POST /v1/coverage/ensure` with the viewport center and a **zoom-derived radius** (`viewportRadiusM`, clamped 1–25 km).
4. If the response is `queued`, it polls `GET /v1/coverage/jobs/{job_id}` every 4 s (90 s cap) and refreshes the map when the background seed finishes.

The backend for this is **already live and public** (`api/ttf_api/routers/coverage.py`): auth-gated, density-checked (no Places spend when already covered), per-user daily cap, 24 h area cooldown. **iOS needs no backend work — only a client.**

### Recommended iOS design

Mirror web, but use the SwiftUI-native camera hook. The key API is `onMapCameraChange(frequency:)`:

- **`.onEnded`** fires only when the gesture settles → this *is* your debounce. Use it for the expensive path (sparsity check / coverage seed).
- **`.continuous`** fires during the drag → use it only for cheap UI like keeping a preview circle under the viewport center.

```swift
@State private var visibleRegion: MKCoordinateRegion?

Map(position: $cameraPosition, selection: $selectedRestaurantID) {
    ForEach(visibleEntries) { entry in   // see §2: filter to viewport
        Marker(entry.name, coordinate: entry.coordinate)
            .tint(TtfTierLogic.tier(for: entry.ttf).color)
            .tag(entry.id)
    }
}
.onMapCameraChange(frequency: .onEnded) { context in
    visibleRegion = context.region          // settled camera → safe to act
}
```

Then a small coverage service that mirrors `useNearbyCoverage`:

```swift
@Observable @MainActor
final class CoverageModel {
    enum State { case idle, seeding, covered(String), error(String) }
    private(set) var state: State = .idle
    private var task: Task<Void, Never>?

    func searchThisArea(region: MKCoordinateRegion, api: APIClient) {
        task?.cancel()                       // latest-wins: cancel any in-flight seed
        task = Task {
            do {
                let radius = Self.radiusMeters(for: region)   // clamp 1_000...25_000
                let res = try await api.ensureCoverage(
                    lat: region.center.latitude,
                    lng: region.center.longitude,
                    radiusM: radius
                )
                if res.status == "queued", let jobID = res.jobID {
                    state = .seeding
                    try await pollJob(jobID, api: api)         // 4s interval, ~90s cap
                    await store.refresh(api: api)
                } else {
                    state = .covered("You're covered nearby.")
                }
            } catch is CancellationError {
                // superseded by a newer search — ignore
            } catch let APIError.httpStatus(429, _) {
                state = .error("Daily coverage limit reached. Try again tomorrow.")
            } catch {
                state = .error(error.localizedDescription)
            }
        }
    }
}
```

…and the two `APIClient` methods that **do not exist yet** (the web client has the equivalents in `web/src/api/client.ts`):

```swift
func ensureCoverage(lat: Double, lng: Double, radiusM: Int) async throws -> CoverageEnsureResponse {
    try await request(path: "/v1/coverage/ensure", method: "POST",
                      body: CoverageEnsureRequest(lat: lat, lng: lng, radiusM: radiusM),
                      authenticated: true)
}

func getCoverageJob(id: UUID) async throws -> CoverageJobStatus {
    try await request(path: "/v1/coverage/jobs/\(id.uuidString.lowercased())", authenticated: true)
}
```

The response shapes are defined server-side in `CoverageEnsureResponse` / `CoverageJobStatus` (`api/ttf_api/schemas.py`) — `status` is `"covered" | "queued"`, with `job_id`, `restaurant_count`, `inserted_count`.

### Two distinct "scroll → search" behaviors (don't conflate them)

| Behavior | Trigger | Cost | iOS status |
|----------|---------|------|------------|
| **Filter to viewport** — only render/keep pins inside the visible region | every settled camera move | free (client-only) | missing → §2 |
| **Seed this area** — ask the backend to discover venues here | sparse viewport + explicit tap (Places $$) | metered (cooldown + daily cap) | missing → this section |

Keep the seed path **explicit and gated** (button when sparse, requires sign-in), exactly like web — auto-seeding on every pan would burn Google Places quota. This matches [`BEST_PRACTICES.md`](BEST_PRACTICES.md): *"Query on map idle or explicit 'Search this area' — not every pan/zoom frame."*

### When the catalog outgrows "load everything"

Today `/v1/restaurants/map` returns the whole pilot city with no geo filter (~115 rows — fine). As coverage expands, the **read** side should also become viewport-scoped: add `min_lat/max_lat/min_lng/max_lng` bbox params (listed as a gap in both [`BEST_PRACTICES.md`](BEST_PRACTICES.md) §"gaps" and [`MAP_SEARCH_AND_SEEDING.md`](MAP_SEARCH_AND_SEEDING.md) §8), debounce the fetch on `.onEnded`, and let the server cache by geohash with `stale-while-revalidate`. That turns "scroll the map" into a cheap, cached, latest-wins fetch instead of one giant payload.

---

## 2. Map rendering

**Finding:** the map renders *every* venue as a `Marker` on every interaction, with no clustering and no viewport filtering.

- For the pilot (~115 venues) this is completely fine.
- It will **not** scale. The well-documented SwiftUI-`Map` failure mode: the framework rebuilds the annotation set on the main thread on every camera interaction, so a few thousand markers make the map stutter even when most are off-screen (Apple's own forums flag ~2 000 annotations as "unusable" on an iPhone 14 Pro). SwiftUI's `Map` still has **no built-in clustering** (unlike the old `MKMapView`/`MKClusterAnnotation`).

**Recommendations (in order):**

1. **Filter to the visible region** (cheap, do this first — also unblocks §1):

   ```swift
   private var visibleEntries: [RestaurantMapEntry] {
       guard let region = visibleRegion else { return store.mapEntries }
       let rect = region.mapRect
       return store.mapEntries.filter { rect.contains(MKMapPoint($0.coordinate)) }
   }
   ```

   Don't render pins the user can't see.

2. **Cluster at low zoom.** SwiftUI `Map` won't do it for you, so either:
   - drop to a `UIViewRepresentable` wrapper around `MKMapView` with `MKMarkerAnnotationView.clusteringIdentifier` (most native), or
   - adopt a quadtree-based library such as **ClusterMap**, which clusters off the main thread (the on-main-thread rebuild is the actual bottleneck).

3. **Cap markers** at very low zoom (e.g. show the densest/most-data-rich N) so a "zoom way out" never tries to lay out the whole country.

This pairs naturally with §1 — once you track `visibleRegion`, both viewport filtering and "search this area" fall out of the same state.

---

## 3. Large list search & filtering

**Files:** `ios/TTF/TTF/Views/List/RestaurantListView.swift`, `ios/TTF/TTF/Services/RestaurantStore.swift`.

```swift
// RestaurantListView
private var displayedRestaurants: [RestaurantSummary] {
    store.filteredSummaries(matching: searchQuery)
}
// RestaurantStore
func filteredSummaries(matching query: String) -> [RestaurantSummary] {
    ...
    return summaries.filter { $0.name.localizedCaseInsensitiveContains(trimmed) }
}
var summaries: [RestaurantSummary] {            // recomputed on EVERY access
    mapEntries.map(RestaurantSummary.init(from:))
}
```

**Findings:**

1. **Search is client-side and name-only.** Web filters on name + address + cuisine tags (`matchesExploreSearch`); iOS matches `name` only. Searching "pizza" or a street name returns nothing on iOS. Easy parity win — widen the predicate.
2. **`summaries` is recomputed on every read**, and `displayedRestaurants` reads it on every keystroke/re-render. That's an O(n) allocation of the whole array per keystroke. Negligible at 115 rows, wasteful at thousands. Store the mapped summaries alongside `mapEntries` (compute once when data loads) instead of via a computed property.
3. **`List` is the right container** — it recycles rows like `UITableView`, so it beats `LazyVStack` for large datasets. Keep `List`; just make sure row identity is stable (it is — `RestaurantSummary: Identifiable` by `id`).
4. **The server search endpoint is unused.** `APIClient.listRestaurants(query:)` → `GET /v1/restaurants?q=` (server-side `ILIKE`) exists but no view calls it; the list filters the cached `/map` payload instead. That's a deliberate, reasonable choice for a small cached catalog — but document it, and when you switch to server search you **must** add debounce + cancellation (next point).
5. **If/when search goes server-side**, use `.searchable` + `.task(id:)` for debounce and automatic cancellation (latest-wins), which is the current idiomatic pattern (no Combine needed):

   ```swift
   .searchable(text: $searchQuery, prompt: "Search restaurants")
   .task(id: searchQuery) {
       try? await Task.sleep(for: .milliseconds(300))   // debounce; cancelled on next keystroke
       guard !Task.isCancelled else { return }
       await viewModel.search(searchQuery, api: api)
   }
   ```

   `.task(id:)` cancels the previous task when the id changes, so the `Task.sleep` doubles as the debounce and stale requests can't overwrite newer results.

---

## 4. Autocomplete

**Finding:** there is no autocomplete of any kind. `.searchable` only filters the already-loaded list.

Two complementary kinds are worth adding, both standard MapKit:

1. **Place / address autocomplete with `MKLocalSearchCompleter`** — for "take me to a town/neighborhood," which is the natural front door to the "search this area" seeding in §1: type a place → recenter the map → offer to seed it. `MKLocalSearchCompleter` is first-party (no Google dependency), feeds suggestions via its delegate, and you resolve a chosen suggestion to coordinates with `MKLocalSearch`.

   Wrap it in an `@Observable @MainActor` model, **debounce `queryFragment` updates**, and **discard stale callbacks** (a fast typist will outrun the completer; keep only the latest). The community-standard gotcha is exactly this latest-wins/duplicate-suppression problem.

2. **In-catalog name suggestions** — surface matching restaurant names from the loaded set as you type (cheap, instant, no network), then fall back to `MKLocalSearchCompleter` for places not in the catalog.

Keep it dependency-free: `MKLocalSearchCompleter` covers both addresses and POIs without pulling in the Google Places iOS SDK.

---

## 5. Networking & caching

**File:** `ios/TTF/TTF/Services/APIClient.swift`.

1. **HTTP caching is switched off:**

   ```swift
   config.requestCachePolicy = .reloadIgnoringLocalCacheData
   ```

   [`BEST_PRACTICES.md`](BEST_PRACTICES.md) §caching specifies the server should send `ETag` + `Cache-Control: ... stale-while-revalidate` and answer `304 Not Modified` on repeat map pans. With this policy, **iOS throws all of that away** and refetches the full payload every time. Switch to `.useProtocolCachePolicy` and give the session a real `URLCache` (memory + disk). `URLSession` will then honor ETags and 304s automatically — directly relevant once map scrolling triggers fetches (§1).

2. **URLs are built by string concatenation + manual percent-encoding:**

   ```swift
   path += "?q=\(encoded)"
   ```

   Fine for one param; fragile the moment you add bbox/radius (`min_lat`, `max_lat`, …). Use `URLComponents` + `URLQueryItem` so encoding and multi-param assembly are correct by construction.

3. **No retry/backoff.** The store warms Cloud Run on launch (nice), but transient failures during a scroll-triggered fetch just surface as errors. A small retry (2–3 attempts, exponential backoff) on idempotent GETs would smooth over cold starts and flaky networks. Keep it off POSTs.

4. **`async let` warm + fetch in `RestaurantStore.load` is good** — keep that pattern.

---

## 6. Concurrency, state & dead code

1. **Two dead-code view models.** `MapViewModel` and `RestaurantListViewModel` are compiled (referenced in `project.pbxproj`) but **never instantiated** — the views use `RestaurantStore` directly. Notably, `RestaurantListViewModel.load` is the *only* place that calls the server-side `listRestaurants(query:)`. Either:
   - **delete both** (the store is the real source of truth), or
   - **route the views through them** if you want per-screen state separate from the shared cache.

   Leaving them as-is is the worst option — they imply a wiring that doesn't exist and will mislead the next contributor (human or agent).

2. **No cancellation handle for in-flight work.** `RestaurantStore.load` guards re-entrancy with `if isLoading { return }`, but holds no `Task` it can cancel. That's fine for one-shot loads, but the moment search/seed becomes async-on-input you need stored, cancellable `Task`s (or `.task(id:)`) so the **latest** query wins and stale responses can't clobber fresh state. Patterns shown in §1 and §3.

3. **`@MainActor` placement.** The store and view models mark individual methods `@MainActor`. Since these `@Observable` types exist to drive the UI, prefer annotating the **whole class** `@MainActor` (cleaner isolation, fewer hops, Swift-6-ready). Minor, but do it as you touch them.

---

## 7. Cross-cutting

- **Location consent (when you add Core Location):** request `when-in-use` only on an **explicit** user action ("Show restaurants near me"), never on launch — matches web's rule in [`BEST_PRACTICES.md`](BEST_PRACTICES.md) and `useNearbyCoverage` (geolocation only on button press). Degrade gracefully to the pilot-center default if denied.
- **Accessibility:** `Marker` labels are read, but the bottom legend and the count overlay should carry `accessibilityLabel`s, and "Search this area" needs a clear label + busy state for VoiceOver.
- **Testing the new paths:** the repo's stated strategy ([`IOS_DESIGN.md`](IOS_DESIGN.md) §11) is recorded-JSON fixtures + `URLProtocol` stubs. Apply it to the new coverage client: assert `429` → friendly message, `queued` → poll → refresh, and that debounce/cancellation yield latest-wins. Tier logic is already a pure function — keep unit-testing it.
- **Don't duplicate tier/threshold logic** the server owns. Pins should keep mapping `median_minutes` → tier color only (as they do now).

---

## 8. Prioritized roadmap

**P0 — the thing you asked about**
1. Add `onMapCameraChange(frequency: .onEnded)` → track `visibleRegion`.
2. Add `ensureCoverage` / `getCoverageJob` to `APIClient` + a `CoverageModel` (poll + latest-wins cancellation).
3. "Search this area" button when the viewport is sparse, gated on sign-in — port of web's `SearchArea` + `useNearbyCoverage`.

**P1 — scale & correctness**
4. Filter rendered markers to `visibleRegion` (§2).
5. Switch `URLSession` to `.useProtocolCachePolicy` + a real `URLCache`; build URLs with `URLComponents` (§5).
6. Resolve the dead view models; widen list search to name + address + cuisine; cache `summaries` (§3, §6).

**P2 — polish & growth**
7. `MKLocalSearchCompleter` autocomplete → recenter → seed (§4).
8. Pin clustering (MKMapView wrapper or ClusterMap) once pin counts climb (§2).
9. Server-side bbox params + geohash/SWR caching for viewport reads as the catalog grows (§1 end, §5).

---

## Sources

**MapKit / SwiftUI rendering & camera**
- [Performance issues using MapKit for SwiftUI — Apple Developer Forums](https://developer.apple.com/forums/thread/740509)
- [Clustering on MapKit for SwiftUI iOS17+ — Apple Developer Forums](https://developer.apple.com/forums/thread/787802)
- [Map Annotation Clustering in iOS 17 — Medium](https://medium.com/@emrdgrmnci/map-annotation-clustering-in-ios-17-e43e94f9db60)
- [ClusterMap (quadtree, off-main-thread clustering)](https://github.com/vospennikov/ClusterMap)
- [Building a searchable map with SwiftUI and MapKit — Pol Piella](https://www.polpiella.dev/mapkit-and-swiftui-searchable-map/)
- [Meet MapKit for SwiftUI — WWDC23](https://developer.apple.com/videos/play/wwdc2023/10043/)
- [Mastering MapKit in SwiftUI: Camera — Swift with Majid](https://swiftwithmajid.com/2023/12/12/mastering-mapkit-in-swiftui-camera/)
- [Integrating MapKit with SwiftUI — Hacking with Swift](https://www.hackingwithswift.com/books/ios-swiftui/integrating-mapkit-with-swiftui)

**Search, debounce & concurrency**
- [Yielding and debouncing in Swift Concurrency — Swift with Majid](https://swiftwithmajid.com/2025/02/18/yielding-and-debouncing-in-swift-concurrency/)
- [Creating a debounced search context for performant SwiftUI searches — Daniel Saidi](https://danielsaidi.com/blog/2025/01/08/creating-a-debounced-search-context-for-performant-swiftui-searches)
- [Delay server requests for a user's search query — tanaschita](https://tanaschita.com/combine-swiftui-search-query-debounce/)

**Autocomplete**
- [Building a Debounced Autocomplete in Swift with Combine and MapKit — Medium](https://medium.com/@srikanthvelaga55/building-a-debounced-autocomplete-in-swift-with-combine-and-mapkit-ef2f35ae519d)
- [Location Search with Auto Complete Suggestions — DEV](https://dev.to/edmondso006/swift-5-location-search-with-auto-complete-location-suggestions-20a1)
- [MKLocalSearchCompleter results gotchas (iOS 17) — Apple Developer Forums](https://developer.apple.com/forums/thread/761790)

**Networking & list performance**
- [Modern Networking in iOS with URLSession and async/await — DEV](https://dev.to/markkazakov/modern-networking-in-ios-with-urlsession-and-asyncawait-a-practical-guide-4o0o)
- [Deep dive into Swift URLCache & CachePolicy — Medium](https://aldo10012.medium.com/deep-dive-into-swift-urlcache-cachepolicy-e5528537e16e)
- [Reduce network traffic with ETags using URLSession — Thorsten Stark](https://thorsten-stark.de/posts/Reduce-network-traffic/)
- [SwiftUI: List vs LazyVStack — STRV](https://www.strv.com/blog/swiftui-list-vs-lazyvstack)
- [List or LazyVStack — fatbobman](https://fatbobman.com/en/posts/list-or-lazyvstack/)

---

*Companion docs: [IOS_DESIGN.md](IOS_DESIGN.md) (Phase 3 implementation plan), [MAP_SEARCH_AND_SEEDING.md](MAP_SEARCH_AND_SEEDING.md) (how search/seeding work + web coverage MVP), [BEST_PRACTICES.md](BEST_PRACTICES.md) (caching, bbox, geolocation UX).*
