# Retire pinRatings/pinNotes off-palette map-pin colors

Labels: next, area:web, type:debt
Relates: none

## Goal
`design/tokens.json` carries `pinRatings` (`#9B6FD9`, purple) and `pinNotes` (`#5BA8D6`) as map-pin colors, both outside the Bluebird palette. Per `docs/MODERNIZATION.md` ("Design-system decisions"), pins should render TTF-tier colors plus the sanctioned discover/search-focus styles only — no purple in Bluebird. Retire these tokens end-to-end.

## Changes
1. In `design/tokens.json`, remove the `pinRatings` and `pinNotes` keys from the `color` block. Keep `pinSearchFocus` (sky blue, on-palette) as-is.
2. In `scripts/generate-design-tokens.mjs`, the `main()` function currently reads `tokens.color.pinRatings` and `tokens.color.pinNotes` to patch `web/src/lib/mapPin.ts` (see the `pinColorsBlock` template around the `WEB_MAP_PIN_PATH` write). Update this block to only emit `SEARCH_FOCUS_PIN_COLOR` — drop the `PIN_RATINGS_COLOR`/`PIN_NOTES_COLOR` exports and the code that reads the now-removed tokens.
3. In `web/src/lib/mapPin.ts`:
   - Remove the `PIN_RATINGS_COLOR` and `PIN_NOTES_COLOR` exports (now unpatched by the generator per step 2).
   - `mapPinKind()` currently distinguishes `"ratings"` and `"notes"` kinds from `"confirmed_ttf"`/`"early_ttf"`/`"empty"`. Decide how those two kinds should render: fold them into `"empty"` styling (TTF-unknown tier color) since they no longer have a distinct sanctioned color, or drop the kind distinction entirely if `mapPinHasBadges()`/consumers don't need it — check callers first (see step 4) before deciding.
   - Update `mapPinFill()` to stop returning `PIN_RATINGS_COLOR`/`PIN_NOTES_COLOR` — fall through to `TTF_TIER_COLORS.unknown` for those kinds instead.
4. Update consumers found via `grep -rn "PIN_RATINGS_COLOR\|PIN_NOTES_COLOR" web/src`:
   - `web/src/components/RestaurantMap.tsx` (lines ~317, ~321 as of this writing) renders legend swatches using these constants — remove those legend rows or replace with the TTF-tier legend only.
   - `web/src/components/admin/ActivityChart.tsx` uses `PIN_NOTES_COLOR` for an admin bar-chart color (a different concern from map pins — it's reusing the constant, not actually drawing a map pin). Replace it with a palette-appropriate color (e.g. `--ls-ink-muted` / `text-muted` token, or `accent`), since it's an admin data-viz color, not a pin. Flag this in the PR description as a naming smell worth a follow-up (the admin chart should not have depended on a map-pin constant).
   - `web/src/components/RestaurantMapPins.tsx` calls `mapPinKind()` — verify its rendering still works once `"ratings"`/`"notes"` kinds map to unknown-tier styling.
5. Run `cd web && npm run tokens:generate` and commit the regenerated `web/src/styles/tokens.generated.css`, `ios/TTF/TTF/Resources/Colors.xcassets/**` (the `PinRatings.colorset`/`PinNotes.colorset` directories should disappear), and other generated outputs — this gives iOS parity for free per `docs/MODERNIZATION.md` ("Platforms").

## Acceptance
- [ ] `pinRatings`/`pinNotes` no longer exist anywhere in `design/tokens.json`
- [ ] `web/src/lib/mapPin.ts` no longer exports `PIN_RATINGS_COLOR`/`PIN_NOTES_COLOR`
- [ ] `web/src/components/RestaurantMap.tsx` legend no longer shows a purple or off-palette swatch
- [ ] `web/src/components/admin/ActivityChart.tsx` uses an on-palette color not sourced from the retired pin tokens
- [ ] `ios/TTF/TTF/Resources/Colors.xcassets/PinRatings.colorset` and `PinNotes.colorset` no longer exist after `npm run tokens:generate`
- [ ] No remaining reference to `PIN_RATINGS_COLOR`/`PIN_NOTES_COLOR`/`pinRatings`/`pinNotes` anywhere in `web/src` or `design/tokens.json` (grep confirms zero hits)

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 1b
