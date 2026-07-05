"""Family profile v2 (#85): vocabulary validation units + profile round-trip.

The round-trip tests are DB-backed and skip unless TTF_TEST_DATABASE_URL is
set — see tests/conftest.py.
"""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from tests.conftest import auth_header
from ttf_api.family_profile import (
    ALLERGENS,
    ATMOSPHERE_PREFERENCES,
    DIETARY_RESTRICTIONS,
    validate_choice_list,
    validate_cuisine_tags,
)


class TestVocabularyValidation:
    def test_choice_list_accepts_known_keys_and_dedupes(self):
        assert validate_choice_list(
            ["peanut", "Dairy", "peanut", " sesame "], ALLERGENS, "allergy"
        ) == ["peanut", "dairy", "sesame"]

    def test_choice_list_rejects_unknown_key(self):
        with pytest.raises(HTTPException) as exc:
            validate_choice_list(["peanut", "gluten"], ALLERGENS, "allergy")
        assert exc.value.status_code == 400
        assert "gluten" in exc.value.detail

    def test_restriction_and_atmosphere_vocabularies(self):
        assert validate_choice_list(
            list(DIETARY_RESTRICTIONS), DIETARY_RESTRICTIONS, "dietary restriction"
        ) == list(DIETARY_RESTRICTIONS)
        assert validate_choice_list(
            list(ATMOSPHERE_PREFERENCES), ATMOSPHERE_PREFERENCES, "atmosphere preference"
        ) == list(ATMOSPHERE_PREFERENCES)

    def test_cuisine_tags_normalized_and_deduped(self):
        assert validate_cuisine_tags(
            ["Pizza", "  thai  food ", "pizza", "", "  "], "cuisine likes"
        ) == ["pizza", "thai food"]

    def test_cuisine_tags_reject_too_many(self):
        with pytest.raises(HTTPException) as exc:
            validate_cuisine_tags([f"tag-{i}" for i in range(21)], "cuisine likes")
        assert exc.value.status_code == 400

    def test_cuisine_tags_reject_too_long(self):
        with pytest.raises(HTTPException) as exc:
            validate_cuisine_tags(["x" * 41], "cuisine likes")
        assert exc.value.status_code == 400


class TestFamilyProfileRoundTrip:
    def test_defaults_are_empty(self, client, db):
        res = client.get("/v1/me/profile", headers=auth_header("family-1"))
        assert res.status_code == 200
        body = res.json()
        assert body["allergies"] == []
        assert body["allergy_notes"] is None
        assert body["dietary_restrictions"] == []
        assert body["cuisine_likes"] == []
        assert body["cuisine_dislikes"] == []
        assert body["atmosphere_preferences"] == []
        assert body["preference_notes"] is None

    def test_patch_round_trips(self, client, db):
        patch = {
            "allergies": ["peanut", "tree_nut", "sesame"],
            "allergy_notes": "Mild kiwi sensitivity",
            "dietary_restrictions": ["vegetarian", "gluten_free"],
            "cuisine_likes": ["Pizza", "sushi"],
            "cuisine_dislikes": ["seafood"],
            "atmosphere_preferences": ["booth_seating", "quiet_preferred"],
            "preference_notes": "Booths near the window if possible",
        }
        res = client.patch("/v1/me/profile", json=patch, headers=auth_header("family-2"))
        assert res.status_code == 200
        body = res.json()
        assert body["allergies"] == ["peanut", "tree_nut", "sesame"]
        assert body["allergy_notes"] == "Mild kiwi sensitivity"
        assert body["dietary_restrictions"] == ["vegetarian", "gluten_free"]
        assert body["cuisine_likes"] == ["pizza", "sushi"]
        assert body["cuisine_dislikes"] == ["seafood"]
        assert body["atmosphere_preferences"] == ["booth_seating", "quiet_preferred"]
        assert body["preference_notes"] == "Booths near the window if possible"

        # Persisted, not just echoed.
        res = client.get("/v1/me/profile", headers=auth_header("family-2"))
        assert res.json()["allergies"] == ["peanut", "tree_nut", "sesame"]
        assert res.json()["cuisine_likes"] == ["pizza", "sushi"]

    def test_patch_clears_with_empty_values(self, client, db):
        uid = "family-3"
        client.patch(
            "/v1/me/profile",
            json={"allergies": ["dairy"], "allergy_notes": "note", "cuisine_likes": ["thai"]},
            headers=auth_header(uid),
        )
        res = client.patch(
            "/v1/me/profile",
            json={"allergies": [], "allergy_notes": "", "cuisine_likes": []},
            headers=auth_header(uid),
        )
        assert res.status_code == 200
        body = res.json()
        assert body["allergies"] == []
        assert body["allergy_notes"] is None
        assert body["cuisine_likes"] == []

    def test_patch_omitted_fields_untouched(self, client, db):
        uid = "family-4"
        client.patch(
            "/v1/me/profile",
            json={"allergies": ["egg"], "dietary_restrictions": ["vegan"]},
            headers=auth_header(uid),
        )
        res = client.patch(
            "/v1/me/profile", json={"kids_ages": [3, 6]}, headers=auth_header(uid)
        )
        body = res.json()
        assert body["kids_ages"] == [3, 6]
        assert body["allergies"] == ["egg"]
        assert body["dietary_restrictions"] == ["vegan"]

    def test_patch_rejects_unknown_vocabulary(self, client, db):
        res = client.patch(
            "/v1/me/profile",
            json={"allergies": ["peanut", "not-an-allergen"]},
            headers=auth_header("family-5"),
        )
        assert res.status_code == 400
        res = client.patch(
            "/v1/me/profile",
            json={"dietary_restrictions": ["paleo-ish"]},
            headers=auth_header("family-5"),
        )
        assert res.status_code == 400
        res = client.patch(
            "/v1/me/profile",
            json={"atmosphere_preferences": ["mosh_pit"]},
            headers=auth_header("family-5"),
        )
        assert res.status_code == 400

    def test_family_profile_not_in_admin_contributor_detail(self, client, db):
        """Privacy: family profile data never leaves the account's own endpoints."""
        uid = "family-private"
        client.patch(
            "/v1/me/profile",
            json={"allergies": ["peanut"], "allergy_notes": "secret"},
            headers=auth_header(uid),
        )
        res = client.get(f"/v1/admin/users/{uid}", headers=auth_header("it-admin"))
        assert res.status_code == 200
        text = res.text
        assert "peanut" not in text
        assert "secret" not in text
        assert "allergies" not in text
