-- Family profile v2: allergies, dietary restrictions, preferences (#85).
--
-- Vocabulary values (allergen keys, restriction keys, atmosphere keys) are
-- enum-ish strings validated in code (ttf_api/family_profile.py), NOT DB
-- enums, so the sets can grow without migrations. Arrays are stored as JSONB
-- string arrays. Free-text "other" fields live alongside as plain TEXT.
--
-- Privacy: these columns are private to the account. They are only ever
-- surfaced through the authenticated /v1/me/profile endpoint and must never
-- be included in public aggregates, activity events, or admin contributor
-- views.

ALTER TABLE user_profiles
    ADD COLUMN allergies JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN allergy_notes TEXT,
    ADD COLUMN dietary_restrictions JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN cuisine_likes JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN cuisine_dislikes JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN atmosphere_preferences JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN preference_notes TEXT;
