-- Broaden preference-aware discovery matching (#101).
--
-- Two of the three remaining #101 gaps need a new venue-side, community-rated
-- attribute (same boolean pattern as 014_dietary_attributes.sql): halal/kosher
-- accommodation, and booth/outdoor seating (the two ATMOSPHERE_PREFERENCES
-- keys with no backing metric at all). The third gap — numeric/enum
-- thresholds for noise_level/table_spacing/kid_food_speed_general — reuses
-- existing metrics and needs no schema change; see ttf_api/family_match.py.

INSERT INTO metric_definitions (key, label, metric_type, category, input_widget, min_sample_size, enum_values, min_value, max_value)
VALUES
    ('halal_accommodation', 'Halal accommodation', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('kosher_accommodation', 'Kosher accommodation', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('booth_seating', 'Booth seating', 'boolean', 'atmosphere', 'toggle', 3, NULL, NULL, NULL),
    ('outdoor_seating', 'Outdoor seating', 'boolean', 'atmosphere', 'toggle', 3, NULL, NULL, NULL)
ON CONFLICT (key) DO NOTHING;
