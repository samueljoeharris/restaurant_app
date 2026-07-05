"""Preference-aware discovery matching: family profile vs. restaurant data (#88).

Matches are computed from crowd-reported attribute aggregates
(``aggregates.build_attribute_aggregates``) and the restaurant's cuisine
tags. A restaurant "fits" a profile when it has at least one confident
positive signal and no known cuisine conflict.

Guardrail: allergy/dietary matches are community-reported decision support,
surfaced from parent ratings — never a verified safety guarantee. Any
user-facing copy built from these reasons must keep that framing (e.g.
"reported by parents") and never imply the venue is verified safe for an
allergy.

Not every family_profile vocabulary key has a corresponding venue attribute
yet (pescatarian/halal/kosher restrictions, and the noise_level/table_spacing/
kid_food_speed_general numeric-or-enum atmosphere signals which need
product-defined thresholds). Those simply produce no match reason today —
see the #88 follow-up issue for broadening coverage.
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
}
# Boolean atmosphere metrics only (see module docstring for the numeric/enum gap).
_ATMOSPHERE_METRIC: dict[str, tuple[str, str]] = {
    "stroller_space": ("stroller_friendly", "stroller friendly"),
    "booster_seats": ("booster_seats", "has booster seats"),
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
