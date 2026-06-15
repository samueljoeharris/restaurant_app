# Plan — Combine Map + Search into one view (search sidebar overlay)

Status: in progress · Branch: `cursor/combine-map-search-sidebar-8b9a`

## Goal

Merge the separate **Map** (`/map`) and **Explore / search** (`/restaurants`) pages into a
single full-bleed map view where the search box, filters, and results live in a **sidebar
that overlays the map**.

## Design

### Layout

- Full-screen map fills the viewport (reuses the existing flush map layout).
- Search + filters + results render in a `MapSearchSidebar` overlay:
  - **Desktop (≥768px):** fixed left panel, always open.
  - **Mobile:** Google-Maps-style bottom sheet — collapsed peek (drag handle + result count)
    that expands on tap so the map stays usable.
- The map legend shifts right to clear the desktop sidebar; the existing restaurant detail
  sheet (`.map-sheet`) stays on the right, so the two overlays don't collide.

### Shared data + interaction

- Map pins and the list render from **one filtered dataset**, so scout/town/ZIP/type filters
  affect both pins and the list.
- Click a **list card** → focuses/pans the map and opens the detail sheet.
- Click a **pin** → highlights and scrolls to its card in the sidebar.
- Place/restaurant autocomplete and radius search resolve **in-place** on the combined view
  instead of navigating away.

### Routing / navigation

- Both `/map` and `/restaurants` render the combined `ExploreMapPage`, so existing deep links
  keep working: `?filter=`, `?focus=`, `?place_id=`, `?lat=&lng=&radius=&place=`.
- Bottom nav merges the old **Map** + **Explore** tabs into a single **Explore** tab; both
  routes use the flush (full-bleed) layout.

## Implementation steps

1. **`RestaurantMap`** — controlled selection (`selectedId` / `onSelectChange`), a `withSidebar`
   flag to offset the legend, and a `fitKey` so the camera re-fits when switching between the
   full catalog and a radius search.
2. **`RestaurantListCard`** — optional `onSelect` / `active` props so a card can focus the map
   and show a highlighted state instead of always navigating to detail.
3. **`MapSearchSidebar`** — new overlay shell component (desktop left panel / mobile bottom sheet).
4. **`ExploreMapPage`** — new page combining the map + explore logic: catalog vs radius vs
   pending-place data loading, client-side filtering, locate-me, and background area seeding.
5. **Routing** — point `/map` and `/restaurants` at `ExploreMapPage`; merge bottom-nav tabs;
   apply the flush layout to both; remove the now-unused `MapPage` and `RestaurantListPage`.
6. **CSS** — sidebar overlay (panel + bottom sheet), active card highlight, legend offset.

## Testing

- Local full stack via Docker: API + Postgres + Firebase Auth emulator, seeded with varied
  restaurants (fast/ok/slow TTF, ratings-only, notes-only, and empty) across several towns.
- `tsc --noEmit`, `npm run build`, and `npm run lint` must pass.
- Manual GUI testing: desktop left panel, mobile bottom sheet, filters affecting pins + list,
  card ↔ pin selection sync, and radius search.
- **Maps key caveat:** Google Maps tiles/pins require `VITE_GOOGLE_MAPS_API_KEY` (a secret not
  present in the cloud test env). A temporary, non-committed "map preview" stub is used locally
  to exercise the full pin/sidebar/sheet interaction; it is reverted before committing.

## CI/CD

- Run `./scripts/ci-check.sh` (web build + lint; Docker required).
- Commit to `main` and confirm the **CI/CD / CI** check passes, then verify the path-aware
  **Web** deploy job (this change is `web/**` only) goes green on GitHub Actions.

## Out of scope

- No API, infra, or iOS changes (web-only).
- No new live free-text filtering beyond the existing autocomplete + `q` URL param.
- No changes to the restaurant data model or endpoints.
