"""Authoritative contribution schemas for AI-assisted review parsing."""

from __future__ import annotations

from typing import Any

from psycopg import Connection

TTF_ITEM_TYPES = ["fries", "apple_slices", "bread", "kids_meal", "other"]
TTF_PORTION_SIZES = ["kid", "regular", "shareable"]
TTF_DAYPARTS = ["breakfast", "lunch", "dinner", "late"]

TTF_SCHEMA: dict[str, Any] = {
    "description": "Kid food speed observation — time from order to kid-friendly starter on the table.",
    "required_fields": [
        "elapsed_minutes",
        "item_type",
        "item_quality",
        "portion_size",
        "daypart",
        "party_size_kids",
    ],
    "optional_fields": ["wait_context", "photo_url"],
    "fields": {
        "elapsed_minutes": {
            "type": "integer",
            "min": 1,
            "max": 180,
            "description": "Minutes from order to kid food arriving.",
        },
        "item_type": {
            "type": "enum",
            "values": TTF_ITEM_TYPES,
            "description": "What kid-friendly item arrived first.",
        },
        "item_quality": {
            "type": "integer",
            "min": 1,
            "max": 5,
            "description": "Quality of the kid starter (1=poor, 5=excellent).",
        },
        "portion_size": {
            "type": "enum",
            "values": TTF_PORTION_SIZES,
            "description": "Portion size served.",
        },
        "daypart": {
            "type": "enum",
            "values": TTF_DAYPARTS,
            "description": "Meal period of the visit.",
        },
        "party_size_kids": {
            "type": "integer",
            "min": 1,
            "max": 12,
            "description": "Number of children in the party.",
        },
        "wait_context": {
            "type": "string",
            "max_length": 500,
            "description": "Optional context (busy lunch, high chair delay, etc.).",
        },
    },
}

NOTE_SCHEMA: dict[str, Any] = {
    "description": "Freeform parent tip or note about the restaurant.",
    "required_fields": ["text"],
    "optional_fields": ["tags"],
    "fields": {
        "text": {
            "type": "string",
            "min_length": 1,
            "max_length": 2000,
            "description": "Parent-facing tip or observation.",
        },
        "tags": {
            "type": "string_array",
            "max_items": 10,
            "description": "Optional short tags (e.g. high_chair, stroller).",
        },
    },
}


def _metric_field_spec(row: dict[str, Any]) -> dict[str, Any]:
    spec: dict[str, Any] = {
        "type": row["metric_type"],
        "label": row["label"],
        "category": row["category"],
        "input_widget": row["input_widget"],
    }
    if row["enum_values"]:
        spec["values"] = list(row["enum_values"])
    if row["min_value"] is not None:
        spec["min"] = row["min_value"]
    if row["max_value"] is not None:
        spec["max"] = row["max_value"]
    return spec


def build_contribution_schema(conn: Connection) -> dict[str, Any]:
    rows = conn.execute(
        """
        SELECT key, label, metric_type, category, input_widget,
               min_sample_size, enum_values, min_value, max_value
        FROM metric_definitions
        ORDER BY category, key
        """
    ).fetchall()

    attributes = {
        row["key"]: _metric_field_spec(row)
        for row in rows
    }

    return {
        "version": 1,
        "description": (
            "Little Scout contribution types: TTF kid-food-speed observations, "
            "shared parent attribute ratings, and freeform notes."
        ),
        "ttf": TTF_SCHEMA,
        "note": NOTE_SCHEMA,
        "attributes": {
            "description": "Shared parent ratings keyed by metric_key.",
            "required_fields": ["metric_key", "value"],
            "optional_fields": ["visit_context"],
            "metrics": attributes,
        },
    }
