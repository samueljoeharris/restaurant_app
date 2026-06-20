# Map styling — Little Scout Bluebird

Web uses **Google Maps** with a Cloud Map Style; iOS uses **MapKit** with POI filtering only (basemap colors are not customizable on MapKit).

## Web — Google Cloud Map Style

1. Open [Google Cloud Console → Map Styles](https://console.cloud.google.com/google/maps-apis/studio/maps) for `ttf-restaurant-dev`.
2. Create a style from [`design/google-map-style.json`](../design/google-map-style.json) palette:
   - **Land:** `#FBF6EC` (warm ivory)
   - **Water:** `#D6EDF7` (sky tint)
   - **Parks:** `#A8C9A0` (sage)
   - **Roads / labels:** muted; reduce POI and business icons
3. Create a **Map ID** and attach the style.
4. Set build env: `VITE_GOOGLE_MAPS_MAP_ID=<your-map-id>` (see `web/Dockerfile`, `.github/workflows/reusable-web.yml`).
5. Local: add to `web/.env.local` after sync.

Fallback: if unset, the app uses `DEMO_MAP_ID` (default Google basemap). Teardrop pins and overlays still apply.

## iOS — MapKit

`RestaurantMapView` uses:

```swift
.mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
```

Custom **teardrop tier pins** match web; land/water tones remain Apple defaults (“cousin not twin” with web).

## Pin colors

Semantic tiers (`ttfFast`, `ttfOk`, …) and pin kinds (`pinRatings`, `pinNotes`) come from [`design/tokens.json`](../design/tokens.json).

## Validation

See [TEST_FLOWS.md](./TEST_FLOWS.md) — `WEB-MAP-01` (basemap + Map ID), `WEB-MAP-02` (teardrop pins), `IOS-MAP-01`.
