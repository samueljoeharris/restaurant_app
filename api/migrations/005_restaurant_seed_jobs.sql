ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS last_places_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_seen_in_places_at TIMESTAMPTZ;

ALTER TABLE restaurants
    DROP CONSTRAINT IF EXISTS restaurants_status_check;

ALTER TABLE restaurants
    ADD CONSTRAINT restaurants_status_check
    CHECK (status IN ('active', 'closed', 'outside_area'));

CREATE INDEX IF NOT EXISTS restaurants_status_idx ON restaurants (status);

CREATE TABLE IF NOT EXISTS restaurant_seed_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilot_city TEXT NOT NULL,
    area_key TEXT NOT NULL,
    query TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius_m INT NOT NULL,
    refresh BOOLEAN NOT NULL DEFAULT false,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'skipped')),
    requested_by TEXT,
    error TEXT,
    inserted_count INT NOT NULL DEFAULT 0,
    updated_count INT NOT NULL DEFAULT 0,
    closed_count INT NOT NULL DEFAULT 0,
    outside_area_count INT NOT NULL DEFAULT 0,
    skipped_count INT NOT NULL DEFAULT 0,
    out_of_area_count INT NOT NULL DEFAULT 0,
    unique_places_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS restaurant_seed_jobs_area_idx
    ON restaurant_seed_jobs (pilot_city, area_key, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_seed_jobs_status_idx
    ON restaurant_seed_jobs (status);
