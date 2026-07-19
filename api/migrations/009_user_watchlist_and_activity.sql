-- User profiles, watchlist, activity events, notification prefs, push tokens.

CREATE TABLE user_profiles (
    firebase_uid TEXT PRIMARY KEY,
    kids_ages SMALLINT[] NOT NULL DEFAULT '{}',
    home_lat DOUBLE PRECISION,
    home_lng DOUBLE PRECISION,
    home_label TEXT,
    onboarding_completed_at TIMESTAMPTZ,
    inbox_read_through TIMESTAMPTZ NOT NULL DEFAULT '1970-01-01'::timestamptz,
    timezone TEXT NOT NULL DEFAULT 'America/New_York',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE restaurant_watches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (firebase_uid, restaurant_id)
);

CREATE INDEX idx_watches_user ON restaurant_watches (firebase_uid, created_at DESC);
CREATE INDEX idx_watches_restaurant ON restaurant_watches (restaurant_id);

CREATE TABLE user_notification_preferences (
    firebase_uid TEXT PRIMARY KEY REFERENCES user_profiles(firebase_uid) ON DELETE CASCADE,
    cadence TEXT NOT NULL DEFAULT 'realtime_bundle'
        CHECK (cadence IN ('weekly', 'daily', 'realtime_bundle')),
    quiet_hours_start TIME NOT NULL DEFAULT '20:00',
    quiet_hours_end TIME NOT NULL DEFAULT '08:00',
    alert_new_ttf BOOLEAN NOT NULL DEFAULT FALSE,
    alert_new_rating BOOLEAN NOT NULL DEFAULT FALSE,
    alert_new_note BOOLEAN NOT NULL DEFAULT FALSE,
    alert_every_review BOOLEAN NOT NULL DEFAULT FALSE,
    push_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE activity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('ttf', 'attribute', 'note')),
    source_id UUID NOT NULL,
    actor_firebase_uid TEXT NOT NULL,
    headline TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activity_restaurant_time ON activity_events (restaurant_id, created_at DESC);
CREATE INDEX idx_activity_created ON activity_events (created_at DESC);

CREATE TABLE device_push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('web', 'ios')),
    token TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (firebase_uid, platform, token)
);

CREATE INDEX idx_push_tokens_user ON device_push_tokens (firebase_uid);

CREATE TABLE push_dispatch_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid TEXT NOT NULL,
    event_count INT NOT NULL,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_dispatch_user ON push_dispatch_log (firebase_uid, sent_at DESC);
