# Regenerate design/tokens.json to DS canon + CI hex guard

Labels: now, area:web, area:ios, type:debt
Relates: none

## Goal
`design/tokens.json` has drifted from the canonical Bluebird palette documented in `docs/design-system/tokens/colors.css`. TTF tier colors, ink, borders, and page background are all off-canon on `main`, which means web, iOS, and admin currently disagree with the design system about what "fast" or "warm ink" looks like. Regenerate the JSON to canon and add a CI guard so it can't drift again.

Note: `docs/design-system/tokens/colors.css` was already synced to true canon (light + dark blocks, plus a `.dark` class block) in the modernization-review PR — use it directly as the source of truth; its `/* tokenName */` comments map 1:1 to `tokens.json` `color.*` keys. The original bundle copy lives at `docs/design-system/reference/modernization-review/_ds/little-scout-design-system-caae7dd4-bedf-4827-8394-80a86b04b790/tokens/colors.css` if you need to cross-check.

## Changes
1. In `design/tokens.json`, update the `color` block's `light` values (dark values mostly already match canon per the bundle's dark block — verify each):
   - `ttfFast.light` `#2D8F4E` → `#2E8B57`
   - `ttfOk.light` `#D4A017` → `#E0A52E`
   - `ttfSlow.light` `#C0392B` → `#D6543B`
   - `ttfUnknown.light` `#9CA3AF` → `#B4AA98`
   - `text.light` `#2F3A42` → `#2C2722`
   - `textMuted.light` `#5C6B76` → `#837766`
   - `bg.light` `#FBF6EC` → `#FFFFFF`
   - `surfaceMuted.light` `#F5EFE3` → `#F5F4F3`
   - `border.light` `#E8DFD0` → `#EADFC9`
   - `borderStrong.light` `#D4C8B8` → `#DCCDAE`
   - `brandHover.light` `#3296C4` → `#2B8CBC`
   - `error.light` `#B42318` → `#D6543B` (= ttfSlow, one source of truth for semantic data colors per `docs/MODERNIZATION.md` "Token canon")
   - `success.light` `#067647` → `#2E8B57` (= ttfFast)
   - `warning.light` `#B54708` → `#E0A52E` (= ttfOk)
   - `bg.dark` `#1A2332` → `#151E27`
   - `mapLand.light`/`.dark` `#FBF6EC` → `#F6EFE1`
   - `mapWater.light`/`.dark` `#D6EDF7` → `#CDE7F4`
   - `mapPark.light`/`.dark` `#A8C9A0` → `#DCEAD2`
   - Cross-check every other dark-mode key (`brand`, `brandSoft`, `accent*`, `surface*`, `ttf*`, `success/warning/error`) against the dark block in the bundle's `colors.css` and correct any further mismatches found — don't assume only the keys listed above are wrong.
2. In `design/tokens.json` `radius` block: `lg` `20px` → `18px` (DS scale: buttons 14, cards 18, pills full — per `docs/MODERNIZATION.md`).
3. Verify `docs/design-system/tokens/colors.css` still matches the bundle copy's values (it was synced in the modernization-review PR; the values should already be canon — nothing to change unless drifted since).
4. Run `cd web && npm run tokens:generate` (invokes `scripts/generate-design-tokens.mjs`). Commit the regenerated outputs:
   - `web/src/styles/tokens.generated.css`
   - `web/src/lib/ttfTier.ts`
   - `web/src/lib/mapPin.ts` (only the generated pin-color block is patched — do not hand-edit)
   - `ios/TTF/TTF/Utilities/Theme.swift`
   - `ios/TTF/TTF/Utilities/TtfTier.swift`
   - `ios/TTF/TTF/Resources/Colors.xcassets/**`
   - `ios/TTF/TTF/Resources/Assets.xcassets/AccentColor.colorset/Contents.json`
5. Extend `scripts/verify-design-tokens.sh` (currently only re-runs the generator and diffs the generated-output files) with an additional step that greps each `/* tokenName */` annotated hex out of `docs/design-system/tokens/colors.css` and asserts it equals the corresponding `design/tokens.json` `color.<tokenName>.light` value, failing the script (non-zero exit) on any mismatch — this catches drift in the *source* JSON, not just stale generated output.

## Acceptance
- [ ] `design/tokens.json` light-mode hex values match every value listed in "Changes" step 1
- [ ] `radius.lg` is `18px` in `design/tokens.json`
- [ ] `docs/design-system/tokens/colors.css` values still match the bundle reference copy (hex-for-hex)
- [ ] `npm run tokens:generate` run from `web/` completes with no manual edits needed afterward
- [ ] `git diff` is empty for all six generated-output paths after running `scripts/verify-design-tokens.sh` (i.e. the script's own generate-and-diff step passes)
- [ ] `scripts/verify-design-tokens.sh` fails (non-zero exit) when a hex in `design/tokens.json` is intentionally mismatched against `docs/design-system/tokens/colors.css` (test this locally, then revert)
- [ ] CI runs `scripts/verify-design-tokens.sh` (confirm it's wired into the existing CI workflow, or add it if not)

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 1a
