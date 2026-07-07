# Remove paper-dot texture from page body, keep it as an opt-in utility

Labels: next, area:web
Relates: none

## Goal
Per `docs/MODERNIZATION.md` ("Design-system decisions"), the paper-dot texture should be reserved for large empty-state areas only, not applied to every page body. Today `web/src/styles/globals.css` applies the dot background image to `body` globally, so it shows behind every screen. Strip it from the global body style and expose it as an opt-in class for empty states.

## Changes
1. In `web/src/styles/globals.css`, the `body` rule (inside `@layer base`) currently sets `background-image: radial-gradient(color-mix(in srgb, var(--color-paper-dot) ...) ...)` and `background-size: var(--paper-dot-spacing) ...)` unconditionally. Remove these two declarations from the `body` selector, leaving `@apply m-0 font-sans text-base leading-normal text-text bg-bg;` as the plain background.
2. Add a new opt-in utility class in the same file (e.g. `.paper-dot-bg`) that carries exactly the `background-image`/`background-size` declarations just removed, reusing the existing `--color-paper-dot`, `--paper-dot-opacity`, `--paper-dot-size`, `--paper-dot-spacing` custom properties (these come from `design/tokens.json` `paper.*` + `color.paperDot`, generated into `web/src/styles/tokens.generated.css` — do not change the generator).
3. Search `web/src` for large empty-state surfaces that should now opt in explicitly: `web/src/components/ui/EmptyState.tsx`, `web/src/pages/ExploreMapPage.tsx`, `web/src/pages/SavedPage.tsx`, `web/src/pages/PlaceRestaurantDetailPage.tsx`, `web/src/pages/MyContributionsPage.tsx`, `web/src/components/ScoutMascot.tsx` — apply `.paper-dot-bg` to genuinely large/empty surfaces (e.g. the empty-state container in `EmptyState.tsx`), not small components. Use judgment; if none of these currently render a large enough empty area to warrant the texture, it's fine to add the class only to `EmptyState.tsx`'s root container.
4. Visually confirm no page body still shows the dot pattern by default after the change (spot-check `/map`, `/saved`, `/account`).

## Acceptance
- [ ] `body` in `web/src/styles/globals.css` no longer sets `background-image`/`background-size` for the dot texture
- [ ] A new `.paper-dot-bg` (or equivalently named) utility class exists carrying those declarations, reusing the existing CSS custom properties — no new tokens invented
- [ ] At least `web/src/components/ui/EmptyState.tsx` opts in via the new class
- [ ] No other file was modified outside `web/src/styles/globals.css` and the empty-state component(s) touched in step 3

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 1b
