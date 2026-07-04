-- "Needs scouting" should mean requested-by-someone, not bulk pre-seeded (#63).
-- scout_requested_at marks venues a user or operator explicitly asked for:
-- materialized places, user coverage requests, and admin seed runs. Scheduled
-- refresh and migration/bootstrap rows stay NULL until someone asks.

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS scout_requested_at TIMESTAMPTZ;

-- Backfill: restaurants first added by a seed job that a human requested
-- (user coverage request or admin seed form). Scheduled refresh writes
-- requested_by = 'scheduled-refresh'; bulk bootstrap rows have no seed job.
UPDATE restaurants r
SET scout_requested_at = cl.created_at
FROM restaurant_changelog cl
JOIN restaurant_seed_jobs j ON j.id = cl.seed_job_id
WHERE cl.restaurant_id = r.id
  AND cl.action = 'added'
  AND j.requested_by IS NOT NULL
  AND j.requested_by <> 'scheduled-refresh'
  AND r.scout_requested_at IS NULL;
