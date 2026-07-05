"""Persona presets for synthetic user simulation (#89).

Kept intentionally small and hand-picked rather than fully randomized, so
generated data is plausible and varied instead of uniform noise.
"""

from __future__ import annotations

import random
from dataclasses import dataclass
from typing import Any

VALID_ITEM_TYPES = ("fries", "apple_slices", "bread", "kids_meal", "other")
VALID_PORTIONS = ("kid", "regular", "shareable")
VALID_DAYPARTS = ("breakfast", "lunch", "dinner", "late")


@dataclass(frozen=True)
class Persona:
    key: str
    label: str
    kids_ages: tuple[int, ...]
    cuisine_bias: tuple[str, ...]
    daypart_bias: tuple[str, ...]
    contribution_style: str  # "brief" | "thorough" | "chatty"
    note_style: str


PERSONAS: tuple[Persona, ...] = (
    Persona(
        "toddler_lunch",
        "Busy toddler parent",
        (2,),
        ("pizza", "cafe", "american"),
        ("lunch",),
        "brief",
        "Quick note, in and out with a toddler.",
    ),
    Persona(
        "big_family_weekend",
        "Big family weekender",
        (4, 7, 10),
        ("italian", "mexican", "family"),
        ("lunch", "dinner"),
        "thorough",
        "Detailed note — mentions seating, noise, and how fast the kids ate.",
    ),
    Persona(
        "early_riser",
        "Early riser with an infant",
        (1,),
        ("breakfast", "cafe"),
        ("breakfast",),
        "brief",
        "Short note, focused on high chairs and changing tables.",
    ),
    Persona(
        "after_school",
        "After-school snack run",
        (6, 9),
        ("asian", "american", "burgers"),
        ("late", "dinner"),
        "chatty",
        "Friendly note about the after-school crowd and kids menu.",
    ),
    Persona(
        "date_night_plus_kid",
        "One kid in tow",
        (5,),
        ("italian", "seafood"),
        ("dinner",),
        "thorough",
        "Balances the adult experience with how the kid handled it.",
    ),
)


def persona_for_index(index: int) -> Persona:
    """Deterministic round-robin so a fixed --agents N always yields the same mix."""
    return PERSONAS[index % len(PERSONAS)]


def random_ttf_body(persona: Persona) -> dict[str, Any]:
    """Random-but-plausible TTF submission fields, biased by the persona."""
    context = persona.note_style if persona.contribution_style != "brief" else None
    return {
        "elapsed_minutes": random.randint(5, 25),
        "item_type": random.choice(VALID_ITEM_TYPES),
        "item_quality": random.randint(3, 5),
        "portion_size": random.choice(VALID_PORTIONS),
        "daypart": random.choice(persona.daypart_bias) if persona.daypart_bias else "lunch",
        "party_size_kids": max(1, min(12, len(persona.kids_ages))),
        "wait_context": context,
    }


def random_value_for_metric(metric: dict[str, Any]) -> Any:
    """A plausible rating value for a metric definition returned by /v1/metrics."""
    metric_type = metric.get("metric_type")
    if metric_type == "boolean":
        return random.choice([True, False])
    if metric_type == "enum" and metric.get("enum_values"):
        return random.choice(metric["enum_values"])
    if metric_type == "numeric":
        lo = metric.get("min_value") if metric.get("min_value") is not None else 1
        hi = metric.get("max_value") if metric.get("max_value") is not None else 5
        return random.randint(int(lo), int(hi))
    return True
