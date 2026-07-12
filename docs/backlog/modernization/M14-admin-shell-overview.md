# Admin shell nav + overview refresh

Labels: next, area:web

## Goal
Bring the admin sidebar in `AdminLayout` in line with the routes that already exist in `web/src/AdminApp.tsx` (`/admin/data`, `/admin/tools/locations`), and replace the overview page's generic activity feed with a "Needs a human" widget that surfaces the operator's actual queue: flagged content, speed outliers, and burst detection from `moderation_service.py`.

## Changes
1. In `web/src/components/admin/AdminLayout.tsx`, add two nav entries after "Users": `📈 Data` → `/admin/data` and `🗺️ Locations` → `/admin/tools/locations`. Both routes are already registered in `web/src/AdminApp.tsx` (lines 53 and 55) but have no sidebar entry today — confirm by reading the current nav array before editing.
2. In `web/src/pages/admin/AdminDashboardPage.tsx`, remove the `ActivityChart` import/usage (`web/src/components/admin/ActivityChart.tsx`). Note it currently imports `PIN_NOTES_COLOR` from `web/src/lib/mapPin.ts` — that token is slated for retirement per `docs/MODERNIZATION.md` ("Off-palette pin colors ... Retire"), so this removal also clears one of its two remaining call sites.
3. Add a "Needs a human" card fed by a new/extended `moderation_service.py` query (see `get_attention_counts` at `api/ttf_api/moderation_service.py:40` for the existing pattern) that returns the top N items across: pending flagged content (PII/report flags), speed outliers (observation far from restaurant median), and burst detection (many notes for one venue in a short window). Each row shows a short label + age badge, matching canvas `5a`'s three example rows (phone-number flag, speed outlier, burst).
4. Keep the existing `Stat`/`StatGrid` (`web/src/components/ui/Stat.tsx`) 4-card row: Pending moderation, Contributions · 7d, Active scouts · 7d, Speed coverage — per canvas `5a`. The "pending moderation" stat must use the pop/alert token (`--ls-pop` / `accentPop` in `design/tokens.json`, or the post-M01 equivalent), never the TTF slow/red token (`ttfSlow`/`--ls-ttf-slow`) — that hex means slow food, not "needs attention."
5. Leave `AdminAttentionStats`/`adminAttention` API wiring in place if reused for the stat cards; only the activity-feed portion of the page is replaced.

## Acceptance
- [ ] Sidebar (`AdminLayout.tsx`) shows Overview, Moderation, Restaurants, Users, Data, Locations, Account in that order, matching `AdminApp.tsx` routes exactly.
- [ ] `/admin` overview renders 4 stat cards (Pending moderation, Contributions 7d, Active scouts 7d, Speed coverage).
- [ ] "Needs a human" widget replaces `ActivityChart`; it lists flagged/outlier/burst items sourced from `moderation_service.py`, each linking into `/admin/moderation`.
- [ ] Pending-moderation stat card uses the pop/alert color token, not any `ttf-slow`/error-red token.
- [ ] `ActivityChart.tsx`'s `PIN_NOTES_COLOR` import is no longer reachable from the overview page (check other call sites of `PIN_NOTES_COLOR` in `web/src/lib/mapPin.ts` before deleting the component outright).

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 5a
