CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT UNIQUE NOT NULL,
    display_name TEXT,
    contribution_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    value JSONB NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    visit_context TEXT
);

CREATE INDEX attribute_ratings_restaurant_idx ON restaurant_attribute_ratings (restaurant_id);

CREATE TABLE ttf_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
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

CREATE TABLE restaurant_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    tags TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX restaurant_notes_restaurant_idx ON restaurant_notes (restaurant_id);
