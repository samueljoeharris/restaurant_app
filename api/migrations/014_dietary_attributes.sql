-- Community-ratable dietary-accommodation attributes (#88).
--
-- Preference-aware discovery needs venue-side signal to match against family
-- profile allergies/dietary_restrictions (#85). These are boolean, parent-
-- rated attributes like the existing kids_menu/safety categories — reported
-- by the community, not verified by Little Scout or the venue.

INSERT INTO metric_definitions (key, label, metric_type, category, input_widget, min_sample_size, enum_values, min_value, max_value)
VALUES
    ('gluten_free_options', 'Gluten-free options', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('vegetarian_friendly', 'Vegetarian-friendly menu', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('vegan_friendly', 'Vegan options', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('dairy_free_options', 'Dairy-free options', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('nut_free_options', 'Nut-free options', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL),
    ('allergy_menu_available', 'Allergy menu available', 'boolean', 'dietary', 'toggle', 3, NULL, NULL, NULL)
ON CONFLICT (key) DO NOTHING;
