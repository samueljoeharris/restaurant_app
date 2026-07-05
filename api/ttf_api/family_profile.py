"""Family profile v2 vocabularies + validation (#85).

The allergen / dietary-restriction / atmosphere vocabularies are enum-ish
string keys kept in code (not DB enums) so they can grow without migrations.
Web and iOS render human labels; the API stores and validates the keys.

Data model (user_profiles columns, all private to the account):

- ``allergies``               JSONB string array of ``ALLERGENS`` keys
- ``allergy_notes``           TEXT free-form "other allergies"
- ``dietary_restrictions``    JSONB string array of ``DIETARY_RESTRICTIONS`` keys
- ``cuisine_likes``           JSONB string array of free-form cuisine tags
                              (lowercased; matches restaurants.cuisine_tags)
- ``cuisine_dislikes``        JSONB string array, same format as likes
- ``atmosphere_preferences``  JSONB string array of ``ATMOSPHERE_PREFERENCES``
                              keys (chosen to map onto metric_definitions
                              attribute keys for preference-aware discovery)
- ``preference_notes``        TEXT free-form "anything else"

Privacy: this data is only surfaced via the authenticated /v1/me/profile
endpoint. It must never appear in public aggregates, activity events, or
admin contributor views.
"""

from __future__ import annotations

from fastapi import HTTPException

# Major allergens (FDA "big nine"); "other" goes in allergy_notes free text.
ALLERGENS = (
    "peanut",
    "tree_nut",
    "dairy",
    "egg",
    "gluten_wheat",
    "soy",
    "shellfish",
    "fish",
    "sesame",
)

DIETARY_RESTRICTIONS = (
    "vegetarian",
    "vegan",
    "pescatarian",
    "gluten_free",
    "dairy_free",
    "nut_free",
    "halal",
    "kosher",
)

# Seating/atmosphere preference keys. Where possible these correspond to
# metric_definitions attribute keys so discovery can compute match reasons:
#   quiet_preferred -> noise_level, roomy_tables -> table_spacing,
#   stroller_space -> stroller_friendly, quick_service -> kid_food_speed_general,
#   booster_seats -> booster_seats.
ATMOSPHERE_PREFERENCES = (
    "booth_seating",
    "outdoor_seating",
    "quiet_preferred",
    "roomy_tables",
    "stroller_space",
    "booster_seats",
    "quick_service",
)

_MAX_CUISINE_TAGS = 20
_MAX_CUISINE_TAG_LENGTH = 40


def validate_choice_list(values: list[str], allowed: tuple[str, ...], field: str) -> list[str]:
    """Validate a list of vocabulary keys; dedupe preserving order."""
    allowed_set = set(allowed)
    cleaned: list[str] = []
    for value in values:
        key = value.strip().lower()
        if key not in allowed_set:
            raise HTTPException(status_code=400, detail=f"Unknown {field} value: {value!r}")
        if key not in cleaned:
            cleaned.append(key)
    return cleaned


def validate_cuisine_tags(values: list[str], field: str) -> list[str]:
    """Normalize free-form cuisine tags: lowercase, trimmed, deduped."""
    if len(values) > _MAX_CUISINE_TAGS:
        raise HTTPException(
            status_code=400, detail=f"At most {_MAX_CUISINE_TAGS} {field} allowed"
        )
    cleaned: list[str] = []
    for value in values:
        tag = " ".join(value.split()).lower()
        if not tag:
            continue
        if len(tag) > _MAX_CUISINE_TAG_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"{field} entries must be at most {_MAX_CUISINE_TAG_LENGTH} characters",
            )
        if tag not in cleaned:
            cleaned.append(tag)
    return cleaned
