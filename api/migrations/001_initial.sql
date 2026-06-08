CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Identity lives in Firebase Auth; contributions store firebase_uid only.

CREATE TABLE restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    google_place_id TEXT,
    google_maps_url TEXT,
    cuisine_tags TEXT[] NOT NULL DEFAULT '{}',
    pilot_city TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX restaurants_pilot_city_idx ON restaurants (pilot_city);
CREATE INDEX restaurants_geo_idx ON restaurants (lat, lng);

CREATE TABLE metric_definitions (
    key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    metric_type TEXT NOT NULL,
    category TEXT NOT NULL,
    input_widget TEXT NOT NULL,
    min_sample_size INT NOT NULL DEFAULT 3,
    enum_values TEXT[],
    min_value INT,
    max_value INT
);

CREATE TABLE restaurant_attribute_ratings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    metric_key TEXT NOT NULL REFERENCES metric_definitions (key),
    firebase_uid TEXT NOT NULL,
    value JSONB NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    visit_context TEXT
);

CREATE INDEX attribute_ratings_restaurant_idx ON restaurant_attribute_ratings (restaurant_id);
CREATE INDEX attribute_ratings_firebase_uid_idx ON restaurant_attribute_ratings (firebase_uid);

CREATE TABLE ttf_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    firebase_uid TEXT NOT NULL,
    ordered_at TIMESTAMPTZ NOT NULL,
    served_at TIMESTAMPTZ NOT NULL,
    elapsed_minutes INT NOT NULL,
    item_type TEXT NOT NULL,
    item_quality INT NOT NULL CHECK (item_quality BETWEEN 1 AND 5),
    portion_size TEXT NOT NULL,
    daypart TEXT NOT NULL,
    party_size_kids INT NOT NULL DEFAULT 1,
    wait_context TEXT,
    photo_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ttf_observations_restaurant_idx ON ttf_observations (restaurant_id);
CREATE INDEX ttf_observations_firebase_uid_idx ON ttf_observations (firebase_uid);

CREATE TABLE restaurant_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    firebase_uid TEXT NOT NULL,
    text TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX restaurant_notes_restaurant_idx ON restaurant_notes (restaurant_id);
