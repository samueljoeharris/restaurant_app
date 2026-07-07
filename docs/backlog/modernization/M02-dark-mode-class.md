# Align dark mode: class-based strategy across web and DS tokens

Labels: next, area:web, type:debt
Relates: none

## Goal
Web already ships a manual `.dark` class toggle via `useTheme()`, but the design-system token CSS only ships a `prefers-color-scheme` media query. Per `docs/MODERNIZATION.md` ("Design-system decisions", canvas `1b`), the class strategy is the adopted pattern — the DS docs and generated tokens need to say so explicitly, with the media query kept only as a first-load fallback for users who haven't set an explicit preference.

## Changes
1. Confirm `web/src/hooks/useTheme.ts` toggles a `.dark` class on `<html>` (or another root element) and persists the user's explicit choice (check for `localStorage`/similar). Note the exact mechanism in `DESIGN_TOKENS.md` (see step 3).
2. Confirm `scripts/generate-design-tokens.mjs` `generateWebCss()` already emits both a `@theme { ... }` block (light values) and a `.dark { ... }` block (dark values) — it does, based on current source. No functional change needed here unless M01 regeneration surfaces a discrepancy.
3. Update `docs/DESIGN_TOKENS.md` to document the resolution order explicitly:
   - On first load with no stored preference: `prefers-color-scheme: dark` may be used as an initial guess (if `web/src/styles/globals.css` or `tokens.generated.css` still contains a `@media (prefers-color-scheme: dark)` block, verify it and note it's fallback-only).
   - Once the user toggles the app's theme control, the `.dark` class on the root element wins over the OS preference, and the generated `.dark { --color-*: ... }` block in `tokens.generated.css` is what actually applies (Tailwind's `@custom-variant dark (&:where(.dark, .dark *))` in `web/src/styles/globals.css` implements this).
4. In `docs/design-system/tokens/colors.css` (kept in sync with canon per M01), make sure the `.dark` class selector is documented alongside the `@media (prefers-color-scheme: dark)` fallback — add a short comment noting the class takes precedence, matching the bundle reference copy's structure and the product's actual `useTheme()` behavior.
5. Grep for any remaining bare `prefers-color-scheme` reliance in `web/src` that isn't gated behind the `.dark` class check (i.e. code that reads OS theme directly instead of via `useTheme()`) and file a note if found — do not silently "fix" unrelated code in this pass, just flag it in the PR description.

## Acceptance
- [ ] `docs/DESIGN_TOKENS.md` explicitly documents `.dark` class as primary, `prefers-color-scheme` as first-load-only fallback
- [ ] `docs/design-system/tokens/colors.css` carries a comment clarifying the same precedence
- [ ] No behavior change to `useTheme()` unless a bug was found during the audit (if so, describe it as a separate follow-up, don't silently fix)
- [ ] Manual check: toggling theme in the running app still overrides OS dark/light setting immediately

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 1b
