"""Shared SQL fragments for UGC visibility and TTF aggregates."""

TTF_AGGREGATE_FILTER = """
    excluded_from_aggregate = FALSE
    AND moderation_status = 'approved'
"""

PUBLIC_NOTE_FILTER = """
    visibility = 'public'
    AND moderation_status = 'approved'
"""

PUBLIC_ATTRIBUTE_FILTER = """
    visibility = 'public'
    AND moderation_status = 'approved'
"""

TTF_AGGREGATE_SUBQUERY = f"""
    SELECT restaurant_id,
        COUNT(*)::int AS sample_size,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY elapsed_minutes) AS median_minutes,
        AVG(item_quality)::float AS avg_quality,
        MAX(created_at) AS last_updated
    FROM ttf_observations
    WHERE {TTF_AGGREGATE_FILTER}
    GROUP BY restaurant_id
"""

PUBLIC_NOTE_COUNT_SUBQUERY = f"""
    SELECT restaurant_id, COUNT(*)::int AS note_count
    FROM restaurant_notes
    WHERE {PUBLIC_NOTE_FILTER}
    GROUP BY restaurant_id
"""

PUBLIC_ATTRIBUTE_COUNT_SUBQUERY = f"""
    SELECT restaurant_id, COUNT(*)::int AS attribute_rating_count
    FROM restaurant_attribute_ratings
    WHERE {PUBLIC_ATTRIBUTE_FILTER}
    GROUP BY restaurant_id
"""
