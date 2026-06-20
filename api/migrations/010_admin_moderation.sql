-- Admin moderation: trust on user_profiles, moderation queue, content visibility, merge support.

-- Trust columns on existing user_profiles (009).
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS trust_level TEXT NOT NULL DEFAULT 'new',
    ADD COLUMN IF NOT EXISTS auto_publish BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS trust_notes TEXT,
    ADD COLUMN IF NOT EXISTS trust_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS trust_updated_by_uid TEXT,
    ADD COLUMN IF NOT EXISTS trust_updated_by_email TEXT;

ALTER TABLE user_profiles
    DROP CONSTRAINT IF EXISTS user_profiles_trust_level_check;

ALTER TABLE user_profiles
    ADD CONSTRAINT user_profiles_trust_level_check
    CHECK (trust_level IN ('new', 'standard', 'trusted', 'restricted'));

-- Content visibility / moderation on UGC tables.
ALTER TABLE restaurant_notes
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE restaurant_notes
    DROP CONSTRAINT IF EXISTS restaurant_notes_visibility_check;

ALTER TABLE restaurant_notes
    ADD CONSTRAINT restaurant_notes_visibility_check
    CHECK (visibility IN ('hidden', 'public', 'removed'));

ALTER TABLE restaurant_notes
    DROP CONSTRAINT IF EXISTS restaurant_notes_moderation_status_check;

ALTER TABLE restaurant_notes
    ADD CONSTRAINT restaurant_notes_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed'));

ALTER TABLE ttf_observations
    ADD COLUMN IF NOT EXISTS excluded_from_aggregate BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS exclusion_reason TEXT,
    ADD COLUMN IF NOT EXISTS excluded_by_uid TEXT,
    ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE ttf_observations
    DROP CONSTRAINT IF EXISTS ttf_observations_moderation_status_check;

ALTER TABLE ttf_observations
    ADD CONSTRAINT ttf_observations_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed'));

ALTER TABLE restaurant_attribute_ratings
    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS moderation_status TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE restaurant_attribute_ratings
    DROP CONSTRAINT IF EXISTS restaurant_attribute_ratings_visibility_check;

ALTER TABLE restaurant_attribute_ratings
    ADD CONSTRAINT restaurant_attribute_ratings_visibility_check
    CHECK (visibility IN ('hidden', 'public', 'removed'));

ALTER TABLE restaurant_attribute_ratings
    DROP CONSTRAINT IF EXISTS restaurant_attribute_ratings_moderation_status_check;

ALTER TABLE restaurant_attribute_ratings
    ADD CONSTRAINT restaurant_attribute_ratings_moderation_status_check
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed'));

-- Moderation queue.
CREATE TABLE IF NOT EXISTS moderation_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL
        CHECK (content_type IN ('note', 'ttf_observation', 'attribute_rating', 'ai_draft')),
    content_id UUID NOT NULL,
    restaurant_id UUID NOT NULL REFERENCES restaurants (id) ON DELETE CASCADE,
    firebase_uid TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'escalated', 'removed')),
    visibility TEXT NOT NULL DEFAULT 'hidden'
        CHECK (visibility IN ('hidden', 'public', 'removed')),
    source TEXT NOT NULL
        CHECK (source IN ('user_submit', 'auto_flag', 'user_report', 'admin_escalation')),
    flag_reasons TEXT[] NOT NULL DEFAULT '{}',
    report_count INT NOT NULL DEFAULT 0,
    assigned_to_uid TEXT,
    reviewer_uid TEXT,
    reviewer_email TEXT,
    review_notes TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (content_type, content_id)
);

CREATE INDEX IF NOT EXISTS moderation_items_status_idx
    ON moderation_items (status, created_at DESC);

CREATE INDEX IF NOT EXISTS moderation_items_restaurant_idx
    ON moderation_items (restaurant_id, status);

CREATE INDEX IF NOT EXISTS moderation_items_uid_idx
    ON moderation_items (firebase_uid, status);

-- Public report intake.
CREATE TABLE IF NOT EXISTS content_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content_type TEXT NOT NULL
        CHECK (content_type IN ('note', 'ttf_observation', 'attribute_rating')),
    content_id UUID NOT NULL,
    reporter_uid TEXT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS content_reports_content_idx
    ON content_reports (content_type, content_id);

-- Restaurant merge support.
ALTER TABLE restaurants
    ADD COLUMN IF NOT EXISTS merged_into_id UUID REFERENCES restaurants (id);

CREATE INDEX IF NOT EXISTS restaurants_merged_into_idx
    ON restaurants (merged_into_id)
    WHERE merged_into_id IS NOT NULL;

ALTER TABLE restaurant_changelog
    DROP CONSTRAINT IF EXISTS restaurant_changelog_action_check;

ALTER TABLE restaurant_changelog
    ADD CONSTRAINT restaurant_changelog_action_check
    CHECK (action IN (
        'added', 'updated', 'tombstoned', 'reactivated', 'closed', 'outside_area', 'merged'
    ));

-- Extend admin audit log categories (008).
ALTER TABLE admin_audit_log
    DROP CONSTRAINT IF EXISTS admin_audit_log_category_check;

ALTER TABLE admin_audit_log
    ADD CONSTRAINT admin_audit_log_category_check
    CHECK (category IN (
        'refresh_config', 'seed_location',
        'moderation', 'observation', 'user_trust', 'restaurant'
    ));
