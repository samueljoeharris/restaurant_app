# Map styling — Little Scout Bluebird

Web uses **Google Maps** with a Cloud Map Style and Map ID; iOS uses **MapKit** with POI filtering only (basemap colors are not customizable on MapKit).

## Quick reference


| Item                     | Value                                                             |
| ------------------------ | ----------------------------------------------------------------- |
| Style JSON (import this) | `[design/google-map-style.json](../design/google-map-style.json)` |
| GCP project (dev)        | `ttf-restaurant-dev`                                              |
| Map type                 | **JavaScript**                                                    |
| Rendering                | **Vector** (required for cloud styling + Advanced Markers)        |
| Tilt / rotation          | **Off** (flat, north-up explore map)                              |
| Map variant              | `**roadmap`**                                                     |
| Build env                | `VITE_GOOGLE_MAPS_MAP_ID`                                         |


---

## Why the old JSON failed

The previous file in `design/google-map-style.json` was a **palette reference** (`colors.land`, `settings.hidePoiBusiness`, etc.). That is **not** a valid Google Cloud map style.

Cloud styling expects the **v2 JSON schema**:

```json
{
  "variant": "light",
  "backgroundColor": "#FBF6EC",
  "styles": [
    {
      "id": "natural.land",
      "geometry": { "fillColor": "#FBF6EC" }
    }
  ]
}
```

Each entry in `styles` must have:

- `**id**` — a documented map feature id (e.g. `natural.water`, `pointOfInterest.recreation.park`), not a free-form name.
- `**geometry` and/or `label**` — styler objects with allowed keys only.

**Legacy embedded JSON** (`featureType`, `elementType`, `stylers`) is a different format. The console can *convert* legacy JSON with a warning, but our old file was neither legacy nor cloud schema.

Official references:

- [Use JSON with cloud-based maps styling](https://developers.google.com/maps/documentation/javascript/cloud-customization/json)
- [JSON reference (feature ids + stylers)](https://developers.google.com/maps/documentation/javascript/cloud-customization/json-reference)

---

## What JSON can and cannot control

### Supported in JSON (`styles[]`)


| Styler (geometry)                              | Styler (label)                                             | Example ids                                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------- |
| `visible`, `fillColor`, `fillOpacity`          | `visible`, `textFillColor`, `textFillOpacity`              | `natural.land`, `natural.water`                   |
| `strokeColor`, `strokeOpacity`, `strokeWeight` | `textStrokeColor`, `textStrokeOpacity`, `textStrokeWeight` | `infrastructure.roadNetwork.road.local`           |
|                                                | `pinFillColor`, `pinGlyphColor`, `pinOutlineColor`         | `pointOfInterest`, `pointOfInterest.foodAndDrink` |


Top-level optional keys: `variant` (`light`|`dark`), `backgroundColor`, `monochrome`, `metadata` (ignored by map clients).

The Bluebird file styles land, water, parks, roads, buildings, city labels, hides POI/transit labels, and hides transit geometry.

### Per-feature JSON support (console-validated)

Google lists many feature `id`s in the [JSON reference](https://developers.google.com/maps/documentation/javascript/cloud-customization/json-reference), but the **console rejects `geometry` and/or `label` on some ids**. Not every feature accepts both elements.

| Feature `id` | `geometry` | `label` | Notes |
|--------------|------------|---------|-------|
| `natural.land`, `natural.water`, roads, parks | yes | water: yes | Core Bluebird palette |
| `infrastructure.building` | yes | yes (`visible` only) | |
| `infrastructure.roadNetwork` | no | yes | Parent id is label-only — style road subclasses for geometry |
| `political.city` | no | yes | Text color stylers OK |
| `political.neighborhood`, `political.sublocality` | no | yes (`visible` only) | `textFillColor` / `textStrokeColor` rejected |
| `political.landParcel` | **no** | **no** | **Omit entirely** — not styleable via JSON |
| `infrastructure.urbanArea` | **no** | — | **Omit** — use `natural.land` for ivory land instead |

If import shows *"Property geometry is not allowed"* on `infrastructure.roadNetwork`, you added a `geometry` block to the parent — keep geometry on `…road.local` / `…arterial` / `…highway` only.

Land-parcel labels cannot be hidden in JSON; reduce clutter via **Map settings → POI density: Low**.

### **Not** in JSON — set in Map Settings (console UI)

These require a tile refetch and **must** be chosen in the style editor **Map settings** panel after import:

- **POI density** (reduce business/POI clutter further)
- **Building display** (footprints vs 3D)
- **Landmark display** (illustrated vs standard)

After importing JSON, open **Customize → Map settings** and set POI density to **Low** (or your preference).

---

## Enable Bluebird basemap (dev)

### Part A — Create and publish the map style

1. Open [Google Cloud Console → Map Styles](https://console.cloud.google.com/google/maps-apis/studio/maps) for `**ttf-restaurant-dev`**.
2. Click **Create style**.
3. Open the **JSON** tab.
4. **Upload** `[design/google-map-style.json](../design/google-map-style.json)` or paste its contents.
5. Confirm:
  - No error banner (“Your JSON contains N errors”).
  - Preview shows ivory land and sky-tint water.
  - **Customize** is enabled.
6. Click **Customize**.
7. Open **Map settings** (gear):
  - **POI density:** Low
  - **Buildings:** Footprints (or Standard — lighter is fine)
  - **Landmarks:** Standard
8. Click **Save**.
9. Name: `Little Scout Bluebird (light)` → **Save** (publishes automatically on first save).

### Part B — Create a Map ID

1. Go to [Map Management](https://console.cloud.google.com/google/maps-apis/studio/maps) → **Map IDs** (or **Map management** in the left nav).
2. **Create map ID**.
3. Settings:

  | Field             | Value          |
  | ----------------- | -------------- |
  | Name              | `ok`           |
  | Map type          | **JavaScript** |
  | Rendering type    | **Vector**     |
  | Tilt and rotation | **Unchecked**  |

4. **Save**. Copy the Map ID (e.g. `a1b2c3d4e5f6g7h8`).

### Part C — Attach style to the Map ID

1. On the Map ID detail page, edit **Map styles** / **Style association**.
2. For variant `**roadmap`**, assign **Little Scout Bluebird (light)**.
3. Save. Changes can take a few minutes to propagate (Google cites up to ~6 hours in edge cases; usually much faster).

### Part D — Wire the Map ID into builds

**Local** — add to `web/.env.local` (after `./scripts/sync-secrets.sh`):

```bash
VITE_GOOGLE_MAPS_MAP_ID=your-map-id-here
```

Restart Vite (`cd web && npm run dev`).

**GitHub Actions (app.dev deploys)** — repo **Variables**:

1. Repo → **Settings → Secrets and variables → Actions → Variables**
2. Add `VITE_GOOGLE_MAPS_MAP_ID` = your Map ID
3. Re-run web deploy (push a web change or **workflow_dispatch** on `reusable-web.yml`)

The web Dockerfile and `[.github/workflows/reusable-web.yml](../.github/workflows/reusable-web.yml)` pass this at build time. It is **not** a secret (same as Firebase public config).

**Fallback:** if unset, the app uses `DEMO_MAP_ID` (default Google basemap). Teardrop pins and overlays still work.

### Part E — Verify

1. Open [app.dev.littlescout.app/map](https://app.dev.littlescout.app/map) (or local `/map`).
2. Expect:
  - Warm ivory land (`#FBF6EC`)
  - Sky-tint water (`#D6EDF7`)
  - Sage parks (`#A8C9A0`)
  - Muted roads; no Google POI pin clutter
  - Little Scout teardrop pins on top

See [TEST_FLOWS.md](./TEST_FLOWS.md) — **WEB-MAP-01**, **WEB-MAP-02**.

---

## Palette ↔ tokens

Colors match `[design/tokens.json](../design/tokens.json)`:


| Token          | Hex       | JSON `id`                                                     |
| -------------- | --------- | ------------------------------------------------------------- |
| `mapLand`      | `#FBF6EC` | `natural.land`, `backgroundColor` |
| `mapWater`     | `#D6EDF7` | `natural.water`                                               |
| `mapPark`      | `#A8C9A0` | `pointOfInterest.recreation.park`                             |
| `surfaceMuted` | `#F5EFE3` | local roads, `natural.land.landCover`                         |
| `border`       | `#E8DFD0` | road strokes                                                  |
| `textMuted`    | `#6B7A85` | road/water/city labels                                        |


---

## iOS — MapKit

`RestaurantMapView` uses:

```swift
.mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
```

Custom **teardrop tier pins** match web; land/water tones remain Apple defaults (“cousin not twin” with web).

---

## Pin colors

Semantic tiers (`ttfFast`, `ttfOk`, …) and the search-focus pin (`pinSearchFocus`) come from `[design/tokens.json](../design/tokens.json)`. Pins with ratings/notes but no TTF data render the `ttfUnknown` tier color rather than a distinct off-palette color (issue #120). These are **app overlays**, not part of the Google basemap style.

---

## Prod (later)

Repeat Parts A–D in `**ttf-restaurant-prod`**, create a prod Map ID, and set `VITE_GOOGLE_MAPS_MAP_ID` for prod web deploys. Keep dev and prod Map IDs separate.

---

## Terraform note

Browser **API key** is Terraform-managed (`infra/terraform/environments/*/maps-web.tf`). **Map styles and Map IDs** are not native Terraform resources today; use the console steps above (or the [Map Management API](https://developers.google.com/maps/documentation/mapmanagement/overview) if you automate later).