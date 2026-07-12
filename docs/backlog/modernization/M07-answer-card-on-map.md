# #90: "Best for your family" answer card on /map

Labels: next, area:web
Relates: #90, #92, #93, #72

## Goal
`docs/MODERNIZATION.md` picked direction A (canvas `4a`, "answer card on the map") over the question-first home rebuild (`4b`) for #90 — minimal delta from the shipped `/map`, ranked by the existing `family_match.py` matcher (#92, already on `main`). Build one ranked answer card overlaying the map, above the existing list sheet.

## Changes
1. New component, e.g. `web/src/components/FamilyAnswerCard.tsx`, rendered inside `web/src/pages/ExploreMapPage.tsx` (1055 lines — the app's heaviest page; the map + list sheet layout is already there, look for the sheet/pin-selection state around line 245 and the pins-plus-sheet composition around line 673). Position the card absolutely over the map, above the list sheet's peek height (`--map-sheet-peek-height` / `layout.mapSheetPeekHeight` token from `design/tokens.json`).
2. Card content, per canvas `4a`:
   - Eyebrow: "BEST FOR YOUR FAMILY RIGHT NOW" (brand-colored label).
   - Restaurant name + TTF badge (reuse `RestaurantTtfStats`/`ttfTier` styling, not a new badge component).
   - 2-3 reason bullets (e.g. "fast at lunch for toddlers", "high chairs + stroller space", "8 min walk") — source these from whatever `family_match.py` / `api/ttf_api/family_match.py` returns as match reasons (check the response shape it currently returns; if it doesn't yet expose human-readable reason strings, that's a gap — flag it and either extend the API response or synthesize reasons client-side from the attributes it does expose, whichever is smaller).
   - Primary button "Take us there" (deep-link to directions, matching whatever existing "Take us there"/directions affordance already exists elsewhere in the app, e.g. check `RestaurantHero.tsx`/`RestaurantMap.tsx` for an existing pattern before inventing a new one).
   - Secondary "Next pick" button that advances to the next-ranked result.
   - Below the card: a "runner-up" pill showing the #2 ranked pick's name + TTF minutes.
3. Ranking data source: call the family-match ranking for the venues currently in view (check whether `api/ttf_api/family_match.py` is already exposed via a router — if not, this issue includes adding a thin endpoint, e.g. `GET /restaurants/family-match?lat=&lng=&radius=`, following the existing router conventions in `api/ttf_api/routers/`). Wire `web/src/api/client.ts` with a matching call.
4. Anonymous / signed-out state (#72): `web/src/lib/routeAccess.ts` already treats `/map` as a public route for signed-out browsing. When there's no `idToken` (no family profile to rank against), render the card in a generic "most reliable nearby" mode (e.g. sort by TTF confidence/fastest) with a footer: "Sign in to personalize this pick" linking to `/login`. Do not hide the card entirely for signed-out users — that would break the "#72 anonymous browse... see answer before sign-up" intent from `docs/MODERNIZATION.md`.
5. Small-phone collapse behavior (explicit risk called out in the canvas note): on narrow viewports, the card can visually collide with the list sheet's peek. Add a collapse/minimize affordance (e.g. tap to shrink the card to a single-line pill, or auto-collapse when the list sheet is dragged up past a threshold) — reuse whatever sheet-drag state `ExploreMapPage.tsx` already tracks rather than adding a second independent gesture system.
6. Keep existing map/pin interaction untouched — this card overlays, it does not replace the map or the list sheet.

## Acceptance
- [ ] `/map` renders one ranked answer card above the list sheet when restaurants are in view
- [ ] Card shows reason bullets, "Take us there" primary action, "Next pick" secondary action, and a runner-up pill
- [ ] Signed-out visitors on `/map` see the card with a "sign in to personalize" footer instead of no card
- [ ] Card has a collapse/minimize behavior verified at a small-phone width (375px or narrower) so it doesn't permanently obscure the list sheet
- [ ] Existing map pin/list/search interactions are unaffected
- [ ] PR description states whether `family_match.py` needed a new API endpoint or reused an existing one, and whether reason strings came from the API or were synthesized client-side

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 4a
