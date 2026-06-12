-- Requested seed locations: every area we want in the catalog, refreshed on schedule.

CREATE TABLE IF NOT EXISTS seed_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pilot_city TEXT NOT NULL,
    area_key TEXT NOT NULL,
    label TEXT NOT NULL,
    query TEXT,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    radius_m INT NOT NULL DEFAULT 8000,
    enabled BOOLEAN NOT NULL DEFAULT true,
    source TEXT NOT NULL DEFAULT 'seed'
        CHECK (source IN ('seed', 'admin', 'migration')),
    created_by TEXT,
    last_refreshed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pilot_city, area_key)
);

CREATE INDEX IF NOT EXISTS seed_locations_enabled_idx
    ON seed_locations (pilot_city, enabled);

-- Catalog-wide refresh jobs (Place Details on every known restaurant) share the
-- seed jobs table; 'kind' distinguishes them from area searches.
ALTER TABLE restaurant_seed_jobs
    ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'area'
        CHECK (kind IN ('area', 'catalog'));

-- Backfill: every area that was successfully seeded becomes a requested location.
INSERT INTO seed_locations (pilot_city, area_key, label, query, lat, lng, radius_m, source)
SELECT DISTINCT ON (pilot_city, area_key)
    pilot_city,
    area_key,
    COALESCE(query, area_key),
    query,
    lat,
    lng,
    radius_m,
    'migration'
FROM restaurant_seed_jobs
WHERE status = 'succeeded'
  AND refresh = false
ORDER BY pilot_city, area_key, created_at DESC
ON CONFLICT (pilot_city, area_key) DO NOTHING;

-- Backfill: the original pilot metro (area_key matches SeedArea.area_key format).
INSERT INTO seed_locations (pilot_city, area_key, label, query, lat, lng, radius_m, source)
VALUES (
    'dedham-ma',
    '42.242:-71.166:8000',
    'Dedham, Massachusetts',
    'Dedham, Massachusetts',
    42.2418,
    -71.1662,
    8000,
    'migration'
) ON CONFLICT (pilot_city, area_key) DO NOTHING;
