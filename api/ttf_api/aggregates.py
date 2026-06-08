"""Attribute rating aggregation for restaurant detail."""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from psycopg import Connection


def _rating_weight(observed_at: datetime) -> float:
    """Favor recent visits; full weight at 0 days, floor 0.25 after ~1 year."""
    now = datetime.now(timezone.utc)
    if observed_at.tzinfo is None:
        observed_at = observed_at.replace(tzinfo=timezone.utc)
    days = max(0.0, (now - observed_at).total_seconds() / 86400)
    return max(0.25, 1.0 - days / 365)


def _normalize_value(raw: Any) -> Any:
    if isinstance(raw, dict) and "value" in raw:
        return raw["value"]
    return raw


def _aggregate_boolean(values: list[tuple[Any, float]]) -> dict:
    true_weight = sum(w for v, w in values if v is True)
    false_weight = sum(w for v, w in values if v is False)
    if true_weight == false_weight == 0:
        return {"value": None, "confidence": 0.0}
    is_true = true_weight >= false_weight
    total = true_weight + false_weight
    return {
        "value": is_true,
        "confidence": round(max(true_weight, false_weight) / total, 2),
        "true_pct": round(100 * true_weight / total, 1),
    }


def _aggregate_numeric(values: list[tuple[Any, float]]) -> dict:
    nums = [(float(v), w) for v, w in values if isinstance(v, (int, float))]
    if not nums:
        return {"value": None}
    total_w = sum(w for _, w in nums)
    avg = sum(v * w for v, w in nums) / total_w
    return {"value": round(avg, 2)}


def _aggregate_enum(values: list[tuple[Any, float]]) -> dict:
    scores: dict[str, float] = defaultdict(float)
    for v, w in values:
        if v is None:
            continue
        key = str(v)
        scores[key] += w
    if not scores:
        return {"value": None, "confidence": 0.0}
    winner = max(scores, key=scores.get)
    total = sum(scores.values())
    return {
        "value": winner,
        "confidence": round(scores[winner] / total, 2),
        "distribution": {k: round(v / total, 2) for k, v in sorted(scores.items())},
    }


def build_attribute_aggregates(conn: Connection, restaurant_id: UUID) -> dict:
    metrics = conn.execute(
        """
        SELECT key, label, metric_type, category, min_sample_size, enum_values
        FROM metric_definitions
        ORDER BY category, key
        """
    ).fetchall()

    rows = conn.execute(
        """
        SELECT metric_key, value, observed_at
        FROM restaurant_attribute_ratings
        WHERE restaurant_id = %s
        """,
        (restaurant_id,),
    ).fetchall()

    by_metric: dict[str, list[tuple[Any, float]]] = defaultdict(list)
    for row in rows:
        by_metric[row["metric_key"]].append(
            (_normalize_value(row["value"]), _rating_weight(row["observed_at"]))
        )

    attributes: dict[str, dict] = {}
    for metric in metrics:
        key = metric["key"]
        samples = by_metric.get(key, [])
        sample_size = len(samples)
        min_n = metric["min_sample_size"]

        entry: dict[str, Any] = {
            "key": key,
            "label": metric["label"],
            "category": metric["category"],
            "metric_type": metric["metric_type"],
            "sample_size": sample_size,
            "min_sample_size": min_n,
        }

        if sample_size < min_n:
            entry["status"] = "insufficient_data"
            entry["message"] = "Be the first to rate"
            attributes[key] = entry
            continue

        entry["status"] = "ok"
        mtype = metric["metric_type"]
        if mtype == "boolean":
            entry["aggregate"] = _aggregate_boolean(samples)
        elif mtype == "numeric":
            entry["aggregate"] = _aggregate_numeric(samples)
        elif mtype == "enum":
            entry["aggregate"] = _aggregate_enum(samples)
        else:
            entry["aggregate"] = {"value": samples[-1][0]}

        attributes[key] = entry

    return {"attributes": attributes}
