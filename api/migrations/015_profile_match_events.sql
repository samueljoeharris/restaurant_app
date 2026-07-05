-- Preference-aware discovery match notifications (#88).
--
-- profile_match events are targeted at one specific user directly (the
-- profile owner), not derived from a restaurant_watches row like the
-- existing ttf/attribute/note event types. target_firebase_uid carries that
-- direct recipient; it stays NULL for the watch-based event types.

ALTER TABLE activity_events
    DROP CONSTRAINT IF EXISTS activity_events_event_type_check;

ALTER TABLE activity_events
    ADD CONSTRAINT activity_events_event_type_check
        CHECK (event_type IN ('ttf', 'attribute', 'note', 'profile_match')),
    ADD COLUMN target_firebase_uid TEXT;

CREATE INDEX idx_activity_target_uid ON activity_events (target_firebase_uid, created_at DESC)
    WHERE target_firebase_uid IS NOT NULL;
