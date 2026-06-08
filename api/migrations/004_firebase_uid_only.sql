-- Drop local users table; store Firebase UID on contributions directly.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
    ALTER TABLE ttf_observations ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
    ALTER TABLE restaurant_attribute_ratings ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
    ALTER TABLE restaurant_notes ADD COLUMN IF NOT EXISTS firebase_uid TEXT;

    UPDATE ttf_observations o
    SET firebase_uid = u.firebase_uid
    FROM users u
    WHERE o.user_id = u.id AND o.firebase_uid IS NULL;

    UPDATE restaurant_attribute_ratings r
    SET firebase_uid = u.firebase_uid
    FROM users u
    WHERE r.user_id = u.id AND r.firebase_uid IS NULL;

    UPDATE restaurant_notes n
    SET firebase_uid = u.firebase_uid
    FROM users u
    WHERE n.user_id = u.id AND n.firebase_uid IS NULL;

    ALTER TABLE ttf_observations DROP CONSTRAINT IF EXISTS ttf_observations_user_id_fkey;
    ALTER TABLE restaurant_attribute_ratings DROP CONSTRAINT IF EXISTS restaurant_attribute_ratings_user_id_fkey;
    ALTER TABLE restaurant_notes DROP CONSTRAINT IF EXISTS restaurant_notes_user_id_fkey;

    ALTER TABLE ttf_observations DROP COLUMN IF EXISTS user_id;
    ALTER TABLE restaurant_attribute_ratings DROP COLUMN IF EXISTS user_id;
    ALTER TABLE restaurant_notes DROP COLUMN IF EXISTS user_id;

    ALTER TABLE ttf_observations ALTER COLUMN firebase_uid SET NOT NULL;
    ALTER TABLE restaurant_attribute_ratings ALTER COLUMN firebase_uid SET NOT NULL;
    ALTER TABLE restaurant_notes ALTER COLUMN firebase_uid SET NOT NULL;

    DROP TABLE users;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ttf_observations_firebase_uid_idx ON ttf_observations (firebase_uid);
CREATE INDEX IF NOT EXISTS attribute_ratings_firebase_uid_idx ON restaurant_attribute_ratings (firebase_uid);
