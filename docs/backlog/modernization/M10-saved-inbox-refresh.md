# Refresh /saved: merge activity inbox + watch list into one surface

Labels: next, area:web
Relates: #61, #59

## Goal
Per canvas `2e`, `/saved` should lead with "Updates on your spots" (so the return visit answers "what changed"), then a push-prime banner, then the watch list using the DS `RestaurantListCard` pattern instead of the page's bespoke row. Today's `/saved` (`web/src/pages/SavedPage.tsx`) only shows a one-line "N updates since you last checked" dismissible strip — the actual per-update detail (`UpdateCard`-style headline + restaurant) only exists inside `ActivityInbox.tsx`, which is a bell-icon dropdown popover rendered in `web/src/components/AppSidebar.tsx` / `web/src/components/MobileAppHeader.tsx`, not on the `/saved` page at all. This issue merges that content onto the page.

## Changes
1. `web/src/pages/SavedPage.tsx` currently renders (in order): `OnboardingModal`, `PushPrimeBanner`, a dismissible "N updates" strip (around lines 124-140), then a loading/empty state, then presumably the watch list (not shown in the excerpt read — verify the rest of the file). Reorder/rebuild so "Updates on your spots" is the first content section, above the watch list.
2. Add a real updates section: reuse `ActivityInbox.tsx`'s data fetch (`api.getActivityInbox(idToken, { limit: 30, unread_only: false })`, around line 29) — either extract the fetch+list-rendering into a shared hook/component usable both by the header dropdown and this new inline section, or render a purpose-built inline list on `/saved` calling the same API. Do not duplicate the endpoint call logic without at least sharing the data-fetching hook.
3. Design system references an `UpdateCard` component (`name`, `tier`, `is-new`/`time`, body text) — check `docs/design-system/components/core/` for an existing `UpdateCard.jsx`/`.d.ts` reference to match props against; if no equivalent exists in `web/src/components/ui/`, build one there reusing `Badge`/`Card` primitives rather than one-off markup.
4. Replace the current one-line "N updates since you last checked" strip (`stripVisible` block) with "Mark all read" action wired to the existing `markReadNow` from `useActivityBadge()` (already used in `ActivityInbox.tsx` line 17, 60-62) — reuse this hook rather than re-deriving unread state.
5. `PushPrimeBanner` (`web/src/components/PushPrimeBanner.tsx`) currently renders with `border-brand/25 bg-brand-soft` (sky-soft). Per canvas `2e` this banner should use mango-soft (`bg-accent-soft`/`border-accent` per the token naming in `design/tokens.json`, or the equivalent generated Tailwind class after M01 lands) to visually distinguish "notification prompt" from "informational" surfaces — confirm the exact generated class name in `web/src/styles/tokens.generated.css` post-M01 and update the two className strings in `PushPrimeBanner.tsx` (around line 25).
6. Watch rows: `SavedPage.tsx` defines a local `SavedRow` function component (not a separate file — grep confirms no standalone `SavedRow.tsx` exists) rendering name/address/TTF badge inline with `WatchButton`. Per canvas `2e`, replace this with the DS `RestaurantListCard` pattern — check whether an existing shared `RestaurantListCard`-equivalent component already exists elsewhere in `web/src/components/` (e.g. used on `ExploreMapPage.tsx`'s list sheet) before building a new one; if one exists, reuse it here instead of the bespoke `SavedRow`.
7. Keep the existing mascot empty-state (`ScoutMascot` + "Tap 💛 Watch on a restaurant to follow updates here." copy, around lines 145-152) unchanged.
8. `#59` (push delivery) and `#61` (watchlist v1 remaining) are referenced context, not blocking dependencies — this issue should not need to implement real push sending; the "Get a ping when a saved spot speeds up?" banner enable action can remain a browser `Notification.requestPermission()` call as it is today unless `#59`/`#61` have already landed real push wiring (check before assuming).

## Acceptance
- [ ] `/saved` shows an "Updates on your spots" section with real per-update cards (restaurant name, tier/headline, recency), sourced from the same activity-inbox API data used by the header bell dropdown
- [ ] "Mark all read" on `/saved` uses the same `useActivityBadge().markReadNow` as the header dropdown — reading state stays consistent between the two surfaces
- [ ] Push-prime banner renders with mango/accent-soft styling, not brand/sky-soft
- [ ] Watch list rows use a shared `RestaurantListCard`-style component instead of the page-local `SavedRow` function, if such a shared component exists or is added
- [ ] Empty state (no watched restaurants) still shows the mascot + existing copy
- [ ] PR description notes whether the activity-inbox fetch logic was shared via a new hook or duplicated, and why

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 2e
