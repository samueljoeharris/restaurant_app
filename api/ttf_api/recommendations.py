"""Family-fit ranker: score nearby restaurants for a profile (#92)."""

from __future__ import annotations

from datetime import datetime, timezone
from math import atan2, cos, radians, sin, sqrt
from typing import Any

from ttf_api.aggregates import build_attribute_aggregates
from ttf_api.family_match import _ALLERGY_METRIC, _RESTRICTION_METRIC, match_reasons


def _recency_weight(last_updated: datetime | None) -> float:
    if last_updated is None:
        return 0.5
    if last_updated.tzinfo is None:
        last_updated = last_updated.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - last_updated).days
    if days <= 30:
        return 1.0
    if days <= 90:
        return 0.75
    return 0.5


def _ttf_score(median_minutes: float | None, sample_size: int, last_updated: datetime | None) -> float:
    if sample_size == 0 or median_minutes is None:
        base = 0.3
    elif median_minutes <= 5:
        base = 1.0
    elif median_minutes <= 10:
        base = 0.85
    elif median_minutes <= 15:
        base = 0.70
    elif median_minutes <= 20:
        base = 0.55
    else:
        base = 0.40

    if sample_size == 0:
        return base
    sample_confidence = min(1.0, sample_size / 3.0)
    confidence = 0.25 + 0.75 * sample_confidence * _recency_weight(last_updated)
    return base * confidence


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_m = 6_371_000
    phi1, phi2 = radians(lat1), radians(lat2)
    dphi = radians(lat2 - lat1)
    dlambda = radians(lng2 - lng1)
    a = sin(dphi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(dlambda / 2) ** 2
    return 2 * radius_m * atan2(sqrt(a), sqrt(1 - a))


def _is_confident_negative(aggregates: dict[str, Any], metric_key: str) -> bool:
    entry = aggregates.get(metric_key)
    if not entry or entry.get("status") != "ok":
        return False
    return (entry.get("aggregate") or {}).get("value") is False


def _is_confident_positive(aggregates: dict[str, Any], metric_key: str) -> bool:
    entry = aggregates.get(metric_key)
    if not entry or entry.get("status") != "ok":
        return False
    return (entry.get("aggregate") or {}).get("value") is True


def _constraint_multiplier(aggregates: dict[str, Any], profile: dict[str, Any]) -> float:
    """Heavy penalty for confident negative constraint signals; small boost for positive ones."""
    multiplier = 1.0
    touched: set[str] = set()

    for key in profile.get("allergies") or []:
        mapping = _ALLERGY_METRIC.get(key)
        if not mapping:
            continue
        metric_key = mapping[0]
        if metric_key in touched:
            continue
        if _is_confident_negative(aggregates, metric_key):
            multiplier *= 0.2
            touched.add(metric_key)
        elif _is_confident_positive(aggregates, metric_key):
            multiplier = min(1.2, multiplier * 1.05)
            touched.add(metric_key)

    for key in profile.get("dietary_restrictions") or []:
        mapping = _RESTRICTION_METRIC.get(key)
        if not mapping:
            continue
        metric_key = mapping[0]
        if metric_key in touched:
            continue
        if _is_confident_negative(aggregates, metric_key):
            multiplier *= 0.2
            touched.add(metric_key)
        elif _is_confident_positive(aggregates, metric_key):
            multiplier = min(1.2, multiplier * 1.05)
            touched.add(metric_key)

    if profile.get("allergies") and _is_confident_positive(aggregates, "allergy_menu_available"):
        multiplier = min(1.2, multiplier * 1.05)

    return multiplier


def _match_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Use only hard constraints (allergies + dietary restrictions) for v1 recommendations."""
    return {
        "allergies": list(profile.get("allergies") or []),
        "dietary_restrictions": list(profile.get("dietary_restrictions") or []),
        "cuisine_likes": [],
        "cuisine_dislikes": [],
        "atmosphere_preferences": [],
    }


def _build_why(row: dict[str, Any], reasons: list[str]) -> str:
    parts: list[str] = []
    median = row.get("median_minutes")
    sample_size = row.get("sample_size", 0) or 0

    if median is not None and sample_size > 0:
        parts.append(f"{int(median)} min kid food")
    else:
        parts.append("No speed data yet")

    if sample_size > 0:
        parts.append(f"{sample_size} parent report{'s' if sample_size != 1 else ''}")

    for reason in reasons[:2]:
        parts.append(f"{reason} reported")
    if len(reasons) > 2:
        parts.append(f"+{len(reasons) - 2} more")

    return " · ".join(parts)


def score_restaurant(
    row: dict[str, Any],
    aggregates: dict[str, Any],
    profile: dict[str, Any],
    center_lat: float,
    center_lng: float,
    radius_m: float,
) -> tuple[float, list[str], str]:
    """Return (score, reasons, why) for a candidate restaurant.

    ``aggregates`` is the dict keyed by metric_key (the ``attributes`` field
    from ``build_attribute_aggregates``).
    """
    median = row.get("median_minutes")
    if median is not None:
        median = float(median)
    sample_size = row.get("sample_size", 0) or 0
    ttf_score = _ttf_score(median, sample_size, row.get("last_updated"))
    constraint = _constraint_multiplier(aggregates, profile)

    distance_m = _haversine_m(center_lat, center_lng, row["lat"], row["lng"])
    distance_factor = 1.0 - min(1.0, distance_m / radius_m) * 0.15

    score = round(ttf_score * constraint * distance_factor, 3)

    reasons = match_reasons(list(row.get("cuisine_tags") or []), aggregates, _match_profile(profile))
    why = _build_why(row, reasons)
    return score, reasons, why


def recommendation_for_restaurant(
    conn,
    row: dict[str, Any],
    profile: dict[str, Any],
    center_lat: float,
    center_lng: float,
    radius_m: float,
) -> tuple[float, list[str], str]:
    """Build aggregates and score a single restaurant."""
    aggregates = build_attribute_aggregates(conn, row["id"])["attributes"]
    return score_restaurant(row, aggregates, profile, center_lat, center_lng, radius_m)
