# #91: family profile — 3 chip questions, replacing free-text onboarding

Labels: next, area:web, area:api
Relates: #91, #85

## Goal
#85 (family profile) was rescoped to #91 "minimal constraints only" per `docs/MODERNIZATION.md`. Today's `web/src/components/OnboardingModal.tsx` is a single free-text "Kids' ages (comma-separated)" input — not chips, not multi-question. Replace it with the 3-question chip sheet from canvas `4c`: ages, must-avoid, make-or-break — no free text, skippable, editable later from `/account`.

## Changes
1. Backend vocabulary already exists in `api/ttf_api/family_profile.py`:
   - `ALLERGENS` (peanut, tree_nut, dairy, egg, gluten_wheat, soy, shellfish, fish, sesame)
   - `DIETARY_RESTRICTIONS` (vegetarian, vegan, pescatarian, gluten_free, dairy_free, nut_free, halal, kosher)
   - `ATMOSPHERE_PREFERENCES` (booth_seating, outdoor_seating, quiet_preferred, roomy_tables, stroller_space, booster_seats, quick_service)
   These map to `api/migrations/013_family_profile_v2.sql`, `014_dietary_attributes.sql`, `015_profile_match_events.sql`, `016_atmosphere_dietary_attributes.sql` (all four migration files confirmed present in `api/migrations/`). Confirm the profile PATCH endpoint (used today via `api.patchProfile`) already accepts these fields; if any of the three question groups aren't yet writable via the API, extend the existing profile router rather than adding a new one.
2. Ages question: canvas `4c` uses age-band chips (baby / 1–3 / 4–7 / 8+), but the current code (`OnboardingModal.tsx`, `patchProfile` call around line 47-50) sends raw `kids_ages: number[]`. Decide the simplest mapping — either keep sending discrete ages under the hood (derive a representative age or range from the chosen band) or confirm the API already accepts an age-band enum; do not invent a new ages data model without checking `family_profile.py` / the relevant migration first.
3. Build a new sheet component (e.g. `web/src/components/FamilyProfileSheet.tsx`) replacing `OnboardingModal.tsx`'s form body, reusing the existing modal chrome (`useBodyScrollLock`, `useDialogFocus`, `useRegisterBlockingModal`, `Z.modal`, portal-to-`document.body` pattern — all already in `OnboardingModal.tsx`, don't rebuild this plumbing):
   - Section 1 "KIDS' AGES": chip group, single-select, from an age-band vocabulary.
   - Section 2 "ANYTHING WE MUST AVOID?": chip group sourced from `ALLERGENS`/`DIETARY_RESTRICTIONS`, multi-select, plus a "none" option.
   - Section 3 "WHAT MAKES OR BREAKS A SPOT?": chip group sourced from `ATMOSPHERE_PREFERENCES`, multi-select.
   - Primary button "Save — rank places for us"; secondary/ghost "Skip for now" (dashed border per canvas, matching the DS "never two filled buttons" rule already followed elsewhere, e.g. `RateAttributesPage.tsx`'s ghost skip).
   - Copy: "3 taps max · no free text · powers ranking" footer line.
4. Reuse `ChoiceChip`/`ChoiceChipGroup` (`web/src/components/ui/ChoiceChip.tsx`, already used by `AttributeInput.tsx`) for all three chip groups rather than inventing new chip markup.
5. Wire the new sheet into `web/src/pages/SavedPage.tsx`'s first-visit trigger (currently `showOnboarding` state, set when `!profile.onboarding_completed`, around line 65-75) — replace the `OnboardingModal` import/usage with the new component.
6. Make the same sheet reachable from `/account` (`web/src/pages/AccountPage.tsx`) as an edit action under a "WHO ARE YOU SCOUTING FOR?" card (canvas `2g`) — this card doesn't exist in `AccountPage.tsx` today; add it, showing the saved chips read-only with an "Edit" link that reopens the sheet pre-filled with current profile values.
7. Delete `web/src/components/OnboardingModal.tsx` once the new sheet fully replaces it, or repurpose the file in place — don't leave both components live long-term.

## Acceptance
- [ ] First `/saved` visit for a profile with `onboarding_completed: false` shows the new 3-question chip sheet, not the old free-text ages field
- [ ] All three question groups are chip-only — no text input anywhere in the sheet
- [ ] Sheet is skippable without blocking navigation
- [ ] `/account` shows a "Who are you scouting for?" card with the saved chips and an Edit action that reopens the same sheet pre-filled
- [ ] Saving the sheet persists via the existing (or minimally extended) profile PATCH endpoint — confirm against `api/migrations/013`–`016`
- [ ] `OnboardingModal.tsx` is either removed or fully superseded (no dead duplicate component left behind)

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 4c (also referenced from 2g)
