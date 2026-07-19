-- Default all notification channels to off for new accounts.
-- Users can still opt in from Account settings.
ALTER TABLE user_notification_preferences
    ALTER COLUMN cadence SET DEFAULT 'realtime_bundle';

ALTER TABLE user_notification_preferences
    ALTER COLUMN alert_new_ttf SET DEFAULT FALSE;
