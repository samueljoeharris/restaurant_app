# Restaurants + Users pages refresh

Labels: next, area:web

## Goal
Bring the Restaurants and Users admin tables up to the canvas's hi-fi pattern: semantic tier-color dots and provenance in the restaurant drawer, and scout-themed trust labels + audit-logged actions on the users page. Depends on the token canon fix (M01) landing first, since the tier dots must use the corrected TTF hexes.

## Changes

### Restaurants (`/admin/restaurants`, canvas 5c)
1. `web/src/pages/admin/AdminRestaurantsPage.tsx` currently renders speed as plain text (`r.ttf_sample_size > 0 ? ... : "—"`, line ~188) with no color coding at all. Add a tier dot (9px circle) before the minutes value, colored by TTF tier using the same tokens as the mobile app: `ttfFast`/`ttfOk`/`ttfSlow`/`ttfUnknown` from `design/tokens.json` (post-M01 canon: fast `#2E8B57`, ok `#E0A52E`, slow `#D6543B`, none `#B4AA98`). This directly targets the drift called out in `docs/MODERNIZATION.md`: today `design/tokens.json` has `ttfFast: #2D8F4E`, `ttfOk: #D4A017`, `ttfSlow: #C0392B` — different hexes than `success`/`warning`/`error`, so admin and app currently disagree about what "fast" looks like. Do not hardcode hexes; consume the token.
2. In the detail drawer (same file, drawer section ~line 209+), add a "Place record" block: Google place id + linked status, seed provenance ("Seeded via `<area>` · refreshed `<n>`d ago" — from `places_seed.py`), and a changelog count ("Changelog: N events" from `api/ttf_api/restaurant_changelog.py`, which currently only exposes `log_change()` — add a `count_changes(restaurant_id)` or reuse an existing list endpoint if one exists before adding a new one).
3. Add two drawer actions: "Refresh from Places" (calls the existing places refresh path used by `places_seed.py` / catalog refresh, scoped to one restaurant) and "View as parent ↗" (opens the public restaurant detail page in the main app, e.g. `PUBLIC_APP_URL` + `/restaurants/:id` per `web/src/buildTarget.ts`).

### Users (`/admin/users`, canvas 5d)
4. `web/src/lib/contributorTrust.ts` currently labels tiers "New", "Standard", "Trusted", "Restricted" (`CONTRIBUTOR_TRUST_TIERS`, and mirrored in `web/src/components/admin/StatusBadge.tsx`'s `TRUST_LABELS`). Per canvas `5d`, give these scout-themed display labels that match the app's own badge language (`web/src/lib/scoutProfile.ts`'s `trailScoutBadge`: "New scout" / "Trail Scout"): map `new` → "New scout", `standard` → "Pathfinder", `trusted` → "Trail Scout", `restricted` → "Limited". Note: "Pathfinder" and "Limited" do not exist anywhere in the codebase today (`scoutProfile.ts` only implements a 2-tier New scout/Trail Scout badge by contribution count) — this issue introduces the 4-tier scout vocabulary for admin; do not change the underlying `trust_level` values, only display labels (add a `shortLabel`/scout-name field, keep `value` stable for API calls).
5. In `web/src/pages/admin/AdminUsersPage.tsx`, tint the row background with `ttf-slow-soft` (`--ls-ttf-slow-soft` / `ttfSlow` soft variant) when `trust_level === "restricted"`, matching canvas `5d`'s "Limited" row.
6. Confirm all trust-tier and disable/enable/delete actions already write to `admin_audit_log` (migration `008_admin_audit_log.sql`, `api/ttf_api/admin_audit.py`) — `set_user_trust`, `disable_user`, `enable_user` in `moderation_service.py` should already call `write_admin_audit`; add the call if any of the three is missing it.

## Acceptance
- [ ] Restaurant table tier dots use `design/tokens.json` TTF tokens (post-M01 hexes), not hardcoded colors.
- [ ] Drawer shows place id/link status, seed provenance, and changelog event count.
- [ ] "Refresh from Places" and "View as parent" buttons present and functional in the drawer.
- [ ] Users table shows scout-themed tier names (New scout / Pathfinder / Trail Scout / Limited) while `trust_level` API values are unchanged.
- [ ] Restricted ("Limited") rows are tinted with the `ttf-slow-soft` token.
- [ ] Every trust/disable/enable/delete action confirmed to write an `admin_audit_log` row.

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 5c, 5d
