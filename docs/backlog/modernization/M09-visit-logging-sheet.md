# #84: visit logging v1 — one bottom sheet, whole visit

Labels: later, area:web, area:api
Relates: #84, #45

## Goal
Today, logging a visit means leaving the restaurant detail page entirely — `RestaurantDetailPage.tsx`'s "Log a visit" button routes to `/restaurants/:id/submit` (`LogVisitPage.tsx`), which renders either the full-page chat (`ReviewChat`) or the full-page manual form (`TtfSubmitPage.tsx`, which already has working timer start/stop/elapsed logic — see `docs/TTF_SUBMIT_TIMER_IDEAS.md` and lines ~109-212 of `TtfSubmitPage.tsx`). Per canvas `4d` and `docs/MODERNIZATION.md`, #84 wants this collapsed into a bottom sheet that opens ON the detail page — no route change mid-meal — with the timer as the time-sensitive step 1, everything else optional and deferrable.

## Changes
1. New component, e.g. `web/src/components/VisitLogSheet.tsx`, triggered from `RestaurantDetailPage.tsx`'s existing "Log a visit" button (currently a route link via `restaurantSubmitPath`/`restaurantManualSubmitPath`, see `web/src/lib/mapEntryKey.ts`) — open as an in-page bottom sheet instead of navigating away. Reuse whatever bottom-sheet primitive already exists in the codebase (check `web/src/pages/ExploreMapPage.tsx`'s list sheet and `web/src/components/ui/` for an existing sheet/drawer component before building a new one).
2. Step 1 — timer (required, time-sensitive): reuse the existing timer state machine from `TtfSubmitPage.tsx` (`timerStart`/`timerStopped`/`timerNow`, `formatTimer`, `elapsedTier`, around lines 34-212) rather than re-implementing it — extract into a shared hook (e.g. `web/src/hooks/useTtfTimer.ts`) consumed by both `TtfSubmitPage.tsx` and the new sheet, so the manual full-page form and the sheet don't fork the timer logic. Sheet UI: big `MM:SS` display, "Food's here — stop" primary button, and a typed-time fallback ("or type it: about 10 min") for parents who forgot to start the timer.
3. Step 2 — optional gear chips (high chairs yes/no, changing table yes/no, noise calm/loud) — reuse `AttributeInput`/`ChoiceChip` components, not new markup.
4. Step 3 — optional "did they eat it?" (ate it / picked / nope) — same chip pattern.
5. Note field (voice or text) that feeds the same chat extraction pipeline as `ReviewChat`/`web/src/lib/reviewChat.ts` (`extractContributionDraft`) — do not build a second, separate extraction path.
6. Submission: the sheet must produce the same contribution payload shape submitted by both `TtfSubmitPage.tsx` (manual) and `ReviewChat.tsx` (chat) — check `api.submitContributions`/`submitPlaceContributions` request bodies in `web/src/api/client.ts` and `ContributionDraft`/`ContributionSchema` types in `web/src/types.ts` to confirm one shared schema; do not add a fourth submission shape.
7. "Save whole visit — works offline, syncs later": confirm whether any offline-queue/retry mechanism already exists in the codebase (check `web/src/lib/` for a service-worker or local-queue pattern) before promising this in the UI — if nothing exists yet, this issue must add a minimal local-storage-backed retry queue (save the payload locally on submit failure due to network error, retry on next app load/online event) rather than shipping the copy without the behavior.
8. Steps 2/3/note can be finished later from `/account/contributions` (`MyContributionsPage.tsx`) rather than blocking the sheet close — confirm a partial/incomplete contribution can be saved and re-opened for editing (this may already be possible via the existing edit route `/…/ttf/:observationId/edit` — check `TtfContributionEditPage.tsx`).

## Acceptance
- [ ] "Log a visit" from `RestaurantDetailPage.tsx` opens an in-page bottom sheet, not a route navigation, on the flow this issue targets
- [ ] Timer logic is shared (single implementation) between `TtfSubmitPage.tsx` and the new sheet, not duplicated
- [ ] Steps 2 and 3 are visibly optional and the sheet can be saved/closed with only the timer completed
- [ ] The note field's text is passed through the same `extractContributionDraft` pipeline used by the chat flow
- [ ] The payload the sheet submits matches the existing contribution schema used by both the manual form and chat flow — no new/parallel schema
- [ ] Offline-save behavior is either implemented (minimal local retry queue) or the "works offline, syncs later" copy is not shipped until it is — PR description states which
- [ ] Partially-completed visits (timer only, no gear/note) can be found and finished later from `/account/contributions`

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 4d
