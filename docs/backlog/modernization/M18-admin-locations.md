# Locations & catalog refresh hi-fi

Labels: later, area:web, area:api
Relates: #42

## Goal
`AdminCatalogRefreshPage.tsx` is ~29KB of forms and tables (seed form, auto-refresh config, refresh audit log, runs table, change log) with no visual hierarchy — confirmed by reading the file: six flat `<section>` blocks in a row with no separation of "start something new" from "monitor what's running." Split it into an intent card (seed a new area, with a quota preflight before queueing — Places API spend is the real constraint) and a state table (area/job status), per canvas `6b`.

## Changes
1. Route stays `/admin/tools/locations` (`AdminApp.tsx:55`, backed by `AdminCatalogRefreshPage.tsx`). No route change.
2. Split the page into two top-level regions: **"Seed a new area"** (intent — currently the `<form>` around line 495 using `location`/`radiusMi`/`force` state) and **area/job state** (currently the "Runs" section around line 641, backed by `seed_jobs.py`'s `list_seed_jobs`/`RestaurantSeedJob.status`).
3. "Seed a new area" card gets, per canvas `6b`: a mini map for pin-drop + radius drag (replacing/augmenting the current `location` text input + `radiusMi` slider at lines 173-174), a venue count estimate, and a quota preflight check shown BEFORE "Queue seed job" is enabled — none of this (`quota`, `estimate`, `preflight`) exists anywhere in `AdminCatalogRefreshPage.tsx`, `seed_jobs.py`, or `places_seed.py` today, so this is new surface, not a copy change. Preflight should call the Places API (or a lightweight nearby-search dry run) to project venue count and estimated quota cost, and block "Queue seed job" if it would exceed a configurable budget.
4. Area/job table: keep `seed_jobs.py`'s existing states (`pending`, `running`, `succeeded`, `failed` — see `run_seed_job`, `api/ttf_api/seed_jobs.py:262`) but render them as canvas `6b` shows: active area name, status pill, running-% (compute from job progress if tracked, otherwise show job counts), and a "failed · retry" action wired to re-queue (`create_seed_job`, `api/ttf_api/seed_jobs.py:57`).
5. Make the existing "Runs" list expandable into a per-job log view (the wireframe's "JOB LOG (EXPANDS)"); if job-level log lines aren't persisted today, scope this to whatever `error`/status transitions are already stored (`run_seed_job` sets `error` on failure, `api/ttf_api/seed_jobs.py:378`) rather than inventing a new logging pipeline in this issue.
6. Keep "Auto-refresh" config and "Refresh audit log" sections (`config`/`saveConfig`, and the audit log table sourced from `admin_audit.py`) — they are out of scope for this visual split; only their placement in the page hierarchy should change (secondary/settings area, not competing with the primary seed-vs-monitor split).
7. Update `docs/MAP_SEARCH_AND_SEEDING.md` if the seeding UX section describes the old single-page layout, so the doc doesn't drift from the new admin UI.

## Acceptance
- [ ] Page visually separates "seed a new area" (intent) from "area/job state" (monitoring), matching canvas `6b`.
- [ ] Quota preflight (venue estimate + budget check) runs and blocks queueing before any Places API spend, not after.
- [ ] Job table shows per-area status (active/running %/failed-retry) sourced from `seed_jobs.py`.
- [ ] A failed job's "retry" action re-queues via `create_seed_job`.
- [ ] Job log expands per-row showing at least the stored `error`/status-transition history.
- [ ] Auto-refresh config and refresh audit log remain functionally intact, relocated rather than removed.
- [ ] `docs/MAP_SEARCH_AND_SEEDING.md` updated if it references the pre-split page layout.

## Design reference
docs/design-system/reference/modernization-review/Modernization Review.dc.html — section 6b
