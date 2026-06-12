-- Tombstone support, change log, and auto-refresh configuration.

ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS tombstoned_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS tombstone_reason TEXT;

ALTER TABLE restaurants
    DROP CONSTRAINT IF EXISTS restaurants_status_check;

ALTER TABLE restaurants
    ADD CONSTRAINT restaurants_status_check
    CHECK (status IN ('active', 'closed', 'outside_area', 'tombstoned'));

CREATE TABLE IF NOT EXISTS restaurant_changelog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID REFERENCES restaurants (id) ON DELETE SET NULL,
    google_place_id TEXT,
    restaurant_name TEXT,
    action TEXT NOT NULL
        CHECK (action IN ('added', 'updated', 'tombstoned', 'reactivated', 'closed', 'outside_area')),
    previous_status TEXT,
    new_status TEXT,
    reason TEXT,
    seed_job_id UUID REFERENCES restaurant_seed_jobs (id) ON DELETE SET NULL,
    changed_fields JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS restaurant_changelog_created_idx
    ON restaurant_changelog (created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_changelog_restaurant_idx
    ON restaurant_changelog (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS restaurant_changelog_job_idx
    ON restaurant_changelog (seed_job_id);

CREATE TABLE IF NOT EXISTS location_refresh_config (
    pilot_city TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT true,
    schedule_cron TEXT NOT NULL DEFAULT '0 9 * * 1',
    schedule_timezone TEXT NOT NULL DEFAULT 'America/New_York',
    default_location TEXT,
    default_lat DOUBLE PRECISION,
    default_lng DOUBLE PRECISION,
    default_radius_m INT NOT NULL DEFAULT 8000,
    last_scheduled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by TEXT
);

ALTER TABLE restaurant_seed_jobs
    ADD COLUMN IF NOT EXISTS tombstoned_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reactivated_count INT NOT NULL DEFAULT 0;

INSERT INTO location_refresh_config (
    pilot_city,
    default_location,
    default_lat,
    default_lng,
    default_radius_m
) VALUES (
    'dedham-ma',
    'Dedham, Massachusetts',
    42.2418,
    -71.1662,
    8000
) ON CONFLICT (pilot_city) DO NOTHING;
