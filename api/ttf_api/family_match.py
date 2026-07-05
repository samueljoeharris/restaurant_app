"""Preference-aware discovery matching: family profile vs. restaurant data (#88, #101).

Matches are computed from crowd-reported attribute aggregates
(``aggregates.build_attribute_aggregates``) and the restaurant's cuisine
tags. A restaurant "fits" a profile when it has at least one confident
positive signal and no known cuisine conflict.

Guardrail: allergy/dietary matches are community-reported decision support,
surfaced from parent ratings — never a verified safety guarantee. Any
user-facing copy built from these reasons must keep that framing (e.g.
"reported by parents") and never imply the venue is verified safe for an
allergy.

Numeric/enum atmosphere thresholds (#101 product decision — see the #101
issue comment for the write-up): applied only once the metric clears
``min_sample_size`` (``status == "ok"``), same confidence bar as the boolean
checks.

- ``quiet_preferred`` -> ``noise_level`` (numeric 1-5, 1 quiet .. 5 loud):
  matches at average <= 2.5, i.e. the quieter half of the scale.
- ``quick_service`` -> ``kid_food_speed_general`` (numeric 1-5, 1 slow ..
  5 fast): matches at average >= 3.5, i.e. the faster half of the scale.
- ``roomy_tables`` -> ``table_spacing`` (enum roomy/average/cramped):
  matches when the confidence-weighted winning value is exactly "roomy".

Every ``ALLERGENS`` / ``DIETARY_RESTRICTIONS`` / ``ATMOSPHERE_PREFERENCES``
vocabulary key (family_profile.py) now maps to a metric-backed match reason,
*except* ``pescatarian``: intentionally unmapped — there's no clear boolean
venue signal distinct from "has seafood/fish options" that a restaurant could
be community-rated on, so it stays a cuisine/notes-only preference with no
attribute match.
"""

from __future__ import annotations

from typing import Any
from uuid import UUID

from psycopg import Connection

from ttf_api.activity_events import emit_activity_event
from ttf_api.aggregates import build_attribute_aggregates

# System actor for notifications not authored by a specific user (never a
# real Firebase uid, so it's always excluded by the "not my own activity"
# filters that already gate the inbox).
SYSTEM_ACTOR = "system:catalog"

# allergy/restriction/atmosphere vocab key -> (metric_definitions key, reason phrase)
_ALLERGY_METRIC: dict[str, tuple[str, str]] = {
    "peanut": ("nut_free_options", "nut-free options"),
    "tree_nut": ("nut_free_options", "nut-free options"),
    "dairy": ("dairy_free_options", "dairy-free options"),
    "gluten_wheat": ("gluten_free_options", "gluten-free options"),
}
_RESTRICTION_METRIC: dict[str, tuple[str, str]] = {
    "vegetarian": ("vegetarian_friendly", "vegetarian-friendly menu"),
    "vegan": ("vegan_friendly", "vegan options"),
    "gluten_free": ("gluten_free_options", "gluten-free options"),
    "dairy_free": ("dairy_free_options", "dairy-free options"),
    "nut_free": ("nut_free_options", "nut-free options"),
    "halal": ("halal_accommodation", "halal accommodation"),
    "kosher": ("kosher_accommodation", "kosher accommodation"),
    # "pescatarian" intentionally unmapped — see module docstring.
}
# Boolean atmosphere metrics.
_ATMOSPHERE_METRIC: dict[str, tuple[str, str]] = {
    "stroller_space": ("stroller_friendly", "stroller friendly"),
    "booster_seats": ("booster_seats", "has booster seats"),
    "booth_seating": ("booth_seating", "booth seating"),
    "outdoor_seating": ("outdoor_seating", "outdoor seating"),
}
# Numeric atmosphere thresholds: (metric key, reason phrase, cutoff, want_at_least).
# See module docstring for the product rationale behind each cutoff.
_NUMERIC_ATMOSPHERE_METRIC: dict[str, tuple[str, str, float, bool]] = {
    "quiet_preferred": ("noise_level", "a quiet atmosphere", 2.5, False),
    "quick_service": ("kid_food_speed_general", "quick kid food", 3.5, True),
}
# Enum atmosphere match: (metric key, reason phrase, expected winning value).
_ENUM_ATMOSPHERE_METRIC: dict[str, tuple[str, str, str]] = {
    "roomy_tables": ("table_spacing", "roomy tables", "roomy"),
}
_GENERAL_ALLERGY_METRIC = ("allergy_menu_available", "allergy menu available")


def has_matchable_preferences(profile: dict[str, Any]) -> bool:
    """True if a profile has at least one preference the matcher can use."""
    return any(
        profile.get(field)
        for field in (
            "allergies",
            "dietary_restrictions",
            "cuisine_likes",
            "cuisine_dislikes",
            "atmosphere_preferences",
        )
    )


def _is_confident_positive(aggregates: dict[str, Any], metric_key: str) -> bool:
    """True only once a metric has cleared min_sample_size (status "ok").

    Deliberately stricter than the detail page (which also surfaces "early"
    signals): a match reason implies "parents say this venue works for you",
    so it waits for the same confidence bar the attribute itself defines
    rather than a 1-rating early signal.
    """
    entry = aggregates.get(metric_key)
    if not entry or entry.get("status") != "ok":
        return False
    agg = entry.get("aggregate") or {}
    return agg.get("value") is True


def _is_confident_numeric_threshold(
    aggregates: dict[str, Any], metric_key: str, threshold: float, want_at_least: bool
) -> bool:
    """True once a numeric metric clears its sample-size bar and the cutoff.

    Same "ok" confidence bar as ``_is_confident_positive``; see module
    docstring for how each cutoff was chosen.
    """
    entry = aggregates.get(metric_key)
    if not entry or entry.get("status") != "ok":
        return False
    value = (entry.get("aggregate") or {}).get("value")
    if not isinstance(value, (int, float)):
        return False
    return value >= threshold if want_at_least else value <= threshold


def _is_confident_enum_value(aggregates: dict[str, Any], metric_key: str, expected: str) -> bool:
    """True once an enum metric clears its sample-size bar and the winning value matches."""
    entry = aggregates.get(metric_key)
    if not entry or entry.get("status") != "ok":
        return False
    return (entry.get("aggregate") or {}).get("value") == expected


def match_reasons(
    cuisine_tags: list[str],
    aggregates: dict[str, Any],
    profile: dict[str, Any],
) -> list[str]:
    """Reasons this restaurant fits ``profile``, or [] if it doesn't match.

    A cuisine the family dislikes hard-excludes the restaurant (empty list).
    Otherwise reasons accumulate from liked cuisine plus any confident
    positive dietary/allergy/atmosphere attribute aggregate.
    """
    tags_lower = {t.lower() for t in cuisine_tags}
    dislikes = {t.lower() for t in profile.get("cuisine_dislikes") or []}
    if dislikes and tags_lower & dislikes:
        return []

    reasons: list[str] = []
    likes = {t.lower() for t in profile.get("cuisine_likes") or []}
    if likes and tags_lower & likes:
        reasons.append("a cuisine you like")

    allergies = profile.get("allergies") or []
    restrictions = profile.get("dietary_restrictions") or []
    atmosphere = profile.get("atmosphere_preferences") or []

    seen_metrics: set[str] = set()
    for key in restrictions:
        mapping = _RESTRICTION_METRIC.get(key)
        if mapping and mapping[0] not in seen_metrics and _is_confident_positive(aggregates, mapping[0]):
            reasons.append(mapping[1])
            seen_metrics.add(mapping[0])
    for key in allergies:
        mapping = _ALLERGY_METRIC.get(key)
        if mapping and mapping[0] not in seen_metrics and _is_confident_positive(aggregates, mapping[0]):
            reasons.append(mapping[1])
            seen_metrics.add(mapping[0])
    if allergies and _is_confident_positive(aggregates, _GENERAL_ALLERGY_METRIC[0]):
        reasons.append(_GENERAL_ALLERGY_METRIC[1])
    for key in atmosphere:
        mapping = _ATMOSPHERE_METRIC.get(key)
        if mapping and mapping[0] not in seen_metrics and _is_confident_positive(aggregates, mapping[0]):
            reasons.append(mapping[1])
            seen_metrics.add(mapping[0])
            continue
        numeric = _NUMERIC_ATMOSPHERE_METRIC.get(key)
        if numeric:
            metric_key, phrase, threshold, want_at_least = numeric
            if metric_key not in seen_metrics and _is_confident_numeric_threshold(
                aggregates, metric_key, threshold, want_at_least
            ):
                reasons.append(phrase)
                seen_metrics.add(metric_key)
            continue
        enum_mapping = _ENUM_ATMOSPHERE_METRIC.get(key)
        if enum_mapping:
            metric_key, phrase, expected = enum_mapping
            if metric_key not in seen_metrics and _is_confident_enum_value(
                aggregates, metric_key, expected
            ):
                reasons.append(phrase)
                seen_metrics.add(metric_key)

    return reasons


def compute_family_match(
    conn: Connection,
    restaurant_id: UUID,
    cuisine_tags: list[str],
    profile: dict[str, Any],
) -> dict[str, Any]:
    """Match a single restaurant against a profile (fetches its aggregates)."""
    aggregates = build_attribute_aggregates(conn, restaurant_id)["attributes"]
    reasons = match_reasons(cuisine_tags, aggregates, profile)
    return {"matches": bool(reasons), "reasons": reasons}


def _profiles_with_preferences(conn: Connection) -> list[dict[str, Any]]:
    return conn.execute(
        """
        SELECT firebase_uid, allergies, dietary_restrictions,
               cuisine_likes, cuisine_dislikes, atmosphere_preferences
        FROM user_profiles
        WHERE jsonb_array_length(allergies) > 0
           OR jsonb_array_length(dietary_restrictions) > 0
           OR jsonb_array_length(cuisine_likes) > 0
           OR jsonb_array_length(cuisine_dislikes) > 0
           OR jsonb_array_length(atmosphere_preferences) > 0
        """
    ).fetchall()


def notify_profile_matches_for_restaurant(
    conn: Connection,
    *,
    restaurant_id: UUID,
    restaurant_name: str,
    cuisine_tags: list[str],
) -> int:
    """Emit a profile_match activity event for every profile this restaurant fits.

    Called when a restaurant is newly added to (or reactivated in) the
    catalog. Cheap in practice: only profiles with at least one preference
    set are considered, and this only runs on catalog add/reactivate, not
    on every Places sync tick.
    """
    aggregates = build_attribute_aggregates(conn, restaurant_id)["attributes"]
    notified = 0
    for profile in _profiles_with_preferences(conn):
        reasons = match_reasons(cuisine_tags, aggregates, profile)
        if not reasons:
            continue
        headline = f"New spot looks good for {reasons[0]}: {restaurant_name}"
        emit_activity_event(
            conn,
            restaurant_id=restaurant_id,
            event_type="profile_match",
            source_id=restaurant_id,
            actor_firebase_uid=SYSTEM_ACTOR,
            headline=headline,
            target_firebase_uid=profile["firebase_uid"],
        )
        notified += 1
    return notified
