# Data & observations hi-fi

Labels: next, area:web, area:api

## Goal
`/admin/data` ships on `main` with zero design reference (canvas `6a` is a wireframe, not a kit screen). Keep `AdminObservationsPage.tsx`'s existing filters/columns/exclude-reason enum/pagination as-is and add the three concrete gaps the wireframe calls out: a computed "vs median %" column, visual treatment for excluded rows, CSV export, and deep-linking from the moderation queue's outlier cards.

## Changes
1. Keep unchanged: `web/src/pages/admin/AdminObservationsPage.tsx`'s `EXCLUDE_REASONS = ["mistaken_entry", "duplicate", "implausible", "other"]`, `PAGE_SIZE = 30`, and the existing When/Restaurant/Speed/Venue median/User/Actions columns and User UID / Daypart / Excluded filters.
2. Add a computed "vs median %" column between "Venue median" and "User": `((elapsed_minutes - restaurant_median_minutes) / restaurant_median_minutes) * 100`, formatted like canvas `6a`'s example (`median 7 · +543%`). Compute client-side from fields already returned by `api.adminObservations` (`elapsed_minutes`, `restaurant_median_minutes`); no new API field needed unless those two aren't both present on every row (verify against `AdminObservationRow` in `web/src/types.ts`).
3. Row tint: excluded rows already get `text-error line-through` on the speed cell (line 157); extend this to a full-row muted background (canvas `6a` uses a light tint + gray text for the excluded row) so excluded observations are scannable at a glance, not just the one cell.
4. Add a "⬇ export csv" control in the filter bar that exports the current filtered result set (respecting `uid`/`daypart`/`excluded` params) — either client-side CSV generation from the loaded page, or a new `GET /v1/admin/observations/export` endpoint if the export should cover all matching rows beyond the current page of 30.
5. Deep-link support: `AdminObservationsPage.tsx` already reads `?uid=` via `useSearchParams` into `excluded` only today (line 25 reads `excluded`, but `uid`/`daypart` are local state not seeded from the URL) — read `uid` and `daypart` from `searchParams` on mount too, so links like `/admin/data?uid=<uid>` from moderation's speed-outlier cards (canvas `5b`) pre-filter correctly. Add the outbound link from `AdminModerationPage.tsx`'s outlier row ("Review →") to `/admin/data?uid=<firebase_uid>`.

## Acceptance
- [ ] Existing filters, columns, exclude-reason enum, and 30-per-page pagination are unchanged.
- [ ] New "vs median %" column renders and matches the sign/percentage shown in canvas `6a`.
- [ ] Excluded rows get a full-row muted treatment, not just a struck-through speed value.
- [ ] CSV export produces a file honoring the active filters.
- [ ] Navigating from a moderation outlier card lands on `/admin/data` pre-filtered by the same `uid`.

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 6a
