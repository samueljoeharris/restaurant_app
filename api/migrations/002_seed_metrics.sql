INSERT INTO metric_definitions (key, label, metric_type, category, input_widget, min_sample_size, enum_values, min_value, max_value)
VALUES
    ('stroller_friendly', 'Stroller friendly', 'boolean', 'access', 'toggle', 3, NULL, NULL, NULL),
    ('high_chair_availability', 'High chair availability', 'enum', 'access', 'enum_select', 3,
     ARRAY['always', 'usually', 'sometimes', 'never'], NULL, NULL),
    ('changing_table', 'Changing table', 'enum', 'access', 'enum_select', 3,
     ARRAY['mens', 'womens', 'both', 'none'], NULL, NULL),
    ('noise_level', 'Noise level', 'numeric', 'atmosphere', 'slider', 3, NULL, 1, 5),
    ('lighting_comfort', 'Lighting comfort', 'numeric', 'atmosphere', 'slider', 3, NULL, 1, 5),
    ('table_spacing', 'Table spacing', 'enum', 'atmosphere', 'enum_select', 3,
     ARRAY['roomy', 'average', 'cramped'], NULL, NULL),
    ('kids_menu_exists', 'Kids menu exists', 'boolean', 'kids_menu', 'toggle', 3, NULL, NULL, NULL),
    ('healthy_kids_options', 'Healthy kids options', 'boolean', 'kids_menu', 'toggle', 3, NULL, NULL, NULL),
    ('free_kids_meal_with_adult', 'Free kids meal with adult', 'boolean', 'kids_menu', 'toggle', 3, NULL, NULL, NULL),
    ('kid_food_speed_general', 'Kid food speed (general)', 'numeric', 'service', 'slider', 3, NULL, 1, 5),
    ('booster_seats', 'Booster seats', 'boolean', 'safety', 'toggle', 3, NULL, NULL, NULL),
    ('allergy_accommodation', 'Allergy accommodation', 'enum', 'safety', 'enum_select', 3,
     ARRAY['excellent', 'good', 'limited', 'unknown'], NULL, NULL)
ON CONFLICT (key) DO NOTHING;
