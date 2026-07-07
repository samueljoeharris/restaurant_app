# Refresh /account/contributions — surface moderation status, visit grouping

Labels: next, area:web
Relates: none

## Goal
Canvas `2f` wants `/account/contributions` to show visit-grouped cards (already partly true — `web/src/lib/visitGrouping.ts`'s `groupContributionsIntoVisits` is already used by `MyContributionsPage.tsx`) with moderation status surfaced as a DS `Badge` (Live / In review). Verified: today's `MyContributionsPage.tsx` only uses `Badge` for the contribution-kind label (Speed/Rating/Note, around line 305) — the `pending_review?: boolean` field already present on `UserTtfContribution`/attribute/note contribution types (`web/src/types.ts`, around lines 490-497) is never read or rendered. The moderation state is genuinely hidden today, matching the canvas's claim.

## Changes
1. `web/src/pages/MyContributionsPage.tsx`: for each visit-grouped card (built via `groupContributionsIntoVisits`, imported from `web/src/lib/visitGrouping.ts`), add a `Badge` in the card header showing the visit's moderation status:
   - If any contribution item in the visit group has `pending_review: true`, show `<Badge variant="warning">In review</Badge>`.
   - Otherwise show `<Badge variant="success">Live</Badge>`.
   - Reuse the existing `Badge` component/variants already imported (line 8) — check `web/src/components/ui/Badge.tsx` for the exact variant names (`success`/`warning` used elsewhere in the codebase, e.g. admin moderation pages) rather than inventing new ones.
2. Confirm `groupContributionsIntoVisits` (`web/src/lib/visitGrouping.ts`) already exposes enough per-group data to compute the badge (e.g. does it return the raw `UserContribution[]` per group, or only summarized fields?) — if it drops `pending_review` during grouping, extend the grouping function's return type rather than re-deriving status separately in the page component.
3. "Log it again" (`web/src/lib/logItAgain.ts`, `fetchLogAgainPrefill`, already imported and used per `#87`) — confirm it continues to prefill the manual form correctly; no functional change expected here, just re-verify after any type changes from step 2.
4. "Edit" action per contribution row: confirm it deep-links to `/account/contributions/ttf/:observationId/edit` (`TtfContributionEditPage`, registered in `web/src/App.tsx` around line 118-120) for TTF-kind items — check whether attribute/note-kind contributions have an equivalent edit route, or whether Edit is currently TTF-only; if attribute/note edit isn't wired, don't fabricate a link that 404s — either add the route or restrict the Edit action to TTF items as today.
5. Visual pass: apply DS radii/spacing/token updates from M01 to the visit-grouped card containers (border/surface-muted header per canvas `2f`) — this should mostly fall out of M01's token regeneration; verify no hardcoded hex/pixel values remain in this page's card styling.

## Acceptance
- [ ] Each visit-grouped card on `/account/contributions` shows a "Live" or "In review" `Badge` reflecting the group's actual `pending_review` state
- [ ] A contribution with `pending_review: true` on any item in its group renders "In review", not "Live"
- [ ] "Log it again" still works and prefills the manual form after any type/grouping changes
- [ ] Edit links only point to routes that exist (TTF edit confirmed at `/account/contributions/ttf/:observationId/edit`; do not add dead links for attribute/note edit unless that route is added in this issue)
- [ ] No hardcoded (non-token) colors or radii remain in the visit-card styling touched by this issue

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 2f
