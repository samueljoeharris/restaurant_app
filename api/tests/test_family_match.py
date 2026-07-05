"""Preference-aware discovery matching (#88).

Pure matching-logic tests need no DB; the endpoint/notification tests are
DB-backed and skip unless TTF_TEST_DATABASE_URL is set (tests/conftest.py).
"""

from __future__ import annotations

from datetime import datetime, timezone

from psycopg.types.json import Jsonb

from tests.conftest import auth_header
from ttf_api.family_match import has_matchable_preferences, match_reasons
from ttf_api.activity_events import list_activity_for_restaurant, list_inbox_events

_EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def _profile(**overrides):
    base = {
        "allergies": [],
        "dietary_restrictions": [],
        "cuisine_likes": [],
        "cuisine_dislikes": [],
        "atmosphere_preferences": [],
    }
    base.update(overrides)
    return base


def _ok_agg(metric_key: str, value: bool) -> dict:
    return {metric_key: {"status": "ok", "aggregate": {"value": value}}}


class TestHasMatchablePreferences:
    def test_empty_profile_is_not_matchable(self):
        assert has_matchable_preferences(_profile()) is False

    def test_any_populated_field_is_matchable(self):
        assert has_matchable_preferences(_profile(cuisine_likes=["thai"])) is True
        assert has_matchable_preferences(_profile(allergies=["peanut"])) is True


class TestMatchReasons:
    def test_cuisine_dislike_hard_excludes(self):
        profile = _profile(cuisine_dislikes=["seafood"])
        assert match_reasons(["seafood", "american"], {}, profile) == []

    def test_cuisine_like_adds_reason(self):
        profile = _profile(cuisine_likes=["thai"])
        assert match_reasons(["thai", "asian"], {}, profile) == ["a cuisine you like"]

    def test_dietary_restriction_matches_confident_positive_aggregate(self):
        profile = _profile(dietary_restrictions=["gluten_free"])
        aggregates = _ok_agg("gluten_free_options", True)
        assert match_reasons([], aggregates, profile) == ["gluten-free options"]

    def test_dietary_restriction_no_reason_when_not_confident(self):
        profile = _profile(dietary_restrictions=["gluten_free"])
        aggregates = {"gluten_free_options": {"status": "early", "aggregate": {"value": True}}}
        assert match_reasons([], aggregates, profile) == []

    def test_dietary_restriction_no_reason_when_aggregate_negative(self):
        profile = _profile(dietary_restrictions=["vegan"])
        aggregates = _ok_agg("vegan_friendly", False)
        assert match_reasons([], aggregates, profile) == []

    def test_allergy_maps_to_metric_and_general_signal(self):
        profile = _profile(allergies=["peanut"])
        aggregates = {
            **_ok_agg("nut_free_options", True),
            **_ok_agg("allergy_menu_available", True),
        }
        reasons = match_reasons([], aggregates, profile)
        assert "nut-free options" in reasons
        assert "allergy menu available" in reasons

    def test_atmosphere_boolean_metric_matches(self):
        profile = _profile(atmosphere_preferences=["booster_seats"])
        aggregates = _ok_agg("booster_seats", True)
        assert match_reasons([], aggregates, profile) == ["has booster seats"]

    def test_no_reasons_and_no_dislike_conflict_means_no_match(self):
        profile = _profile(dietary_restrictions=["pescatarian"])  # intentionally unmapped
        assert match_reasons(["american"], {}, profile) == []

    def test_halal_restriction_matches_confident_positive_aggregate(self):
        profile = _profile(dietary_restrictions=["halal"])
        aggregates = _ok_agg("halal_accommodation", True)
        assert match_reasons([], aggregates, profile) == ["halal accommodation"]

    def test_kosher_restriction_matches_confident_positive_aggregate(self):
        profile = _profile(dietary_restrictions=["kosher"])
        aggregates = _ok_agg("kosher_accommodation", True)
        assert match_reasons([], aggregates, profile) == ["kosher accommodation"]

    def test_booth_and_outdoor_seating_atmosphere_match(self):
        profile = _profile(atmosphere_preferences=["booth_seating", "outdoor_seating"])
        aggregates = {
            **_ok_agg("booth_seating", True),
            **_ok_agg("outdoor_seating", True),
        }
        reasons = match_reasons([], aggregates, profile)
        assert "booth seating" in reasons
        assert "outdoor seating" in reasons

    def test_quiet_preferred_matches_below_noise_threshold(self):
        profile = _profile(atmosphere_preferences=["quiet_preferred"])
        aggregates = {"noise_level": {"status": "ok", "aggregate": {"value": 2.0}}}
        assert match_reasons([], aggregates, profile) == ["a quiet atmosphere"]

    def test_quiet_preferred_no_match_above_noise_threshold(self):
        profile = _profile(atmosphere_preferences=["quiet_preferred"])
        aggregates = {"noise_level": {"status": "ok", "aggregate": {"value": 3.5}}}
        assert match_reasons([], aggregates, profile) == []

    def test_quiet_preferred_no_match_when_not_confident(self):
        profile = _profile(atmosphere_preferences=["quiet_preferred"])
        aggregates = {"noise_level": {"status": "early", "aggregate": {"value": 1.0}}}
        assert match_reasons([], aggregates, profile) == []

    def test_quick_service_matches_above_speed_threshold(self):
        profile = _profile(atmosphere_preferences=["quick_service"])
        aggregates = {"kid_food_speed_general": {"status": "ok", "aggregate": {"value": 4.0}}}
        assert match_reasons([], aggregates, profile) == ["quick kid food"]

    def test_quick_service_no_match_below_speed_threshold(self):
        profile = _profile(atmosphere_preferences=["quick_service"])
        aggregates = {"kid_food_speed_general": {"status": "ok", "aggregate": {"value": 2.0}}}
        assert match_reasons([], aggregates, profile) == []

    def test_roomy_tables_matches_enum_winner(self):
        profile = _profile(atmosphere_preferences=["roomy_tables"])
        aggregates = {
            "table_spacing": {
                "status": "ok",
                "aggregate": {"value": "roomy", "confidence": 0.8, "distribution": {"roomy": 0.8}},
            }
        }
        assert match_reasons([], aggregates, profile) == ["roomy tables"]

    def test_roomy_tables_no_match_when_enum_winner_differs(self):
        profile = _profile(atmosphere_preferences=["roomy_tables"])
        aggregates = {
            "table_spacing": {
                "status": "ok",
                "aggregate": {"value": "cramped", "confidence": 0.6, "distribution": {"cramped": 0.6}},
            }
        }
        assert match_reasons([], aggregates, profile) == []


class TestFamilyMatchEndpoint:
    def _insert_rating(self, conn, restaurant_id: str, metric_key: str, value, count: int):
        for i in range(count):
            conn.execute(
                """
                INSERT INTO restaurant_attribute_ratings (
                    restaurant_id, metric_key, firebase_uid, value,
                    visibility, moderation_status
                ) VALUES (%s, %s, %s, %s, 'public', 'approved')
                """,
                (restaurant_id, metric_key, f"rater-{metric_key}-{i}", Jsonb(value)),
            )

    def test_endpoint_returns_match_with_reasons(self, client, db, make_restaurant):
        restaurant_id = make_restaurant("Gluten Free Grill")
        with db() as conn:
            conn.execute(
                "UPDATE restaurants SET cuisine_tags = %s WHERE id = %s",
                (["american"], restaurant_id),
            )
            self._insert_rating(conn, restaurant_id, "gluten_free_options", True, 3)

        uid = "family-match-1"
        client.patch(
            "/v1/me/profile",
            json={"dietary_restrictions": ["gluten_free"]},
            headers=auth_header(uid),
        )
        res = client.post(
            "/v1/me/family-matches",
            json={"restaurant_ids": [restaurant_id]},
            headers=auth_header(uid),
        )
        assert res.status_code == 200
        result = res.json()["results"][restaurant_id]
        assert result["matches"] is True
        assert result["reasons"] == ["gluten-free options"]

    def test_endpoint_excludes_cuisine_dislike(self, client, db, make_restaurant):
        restaurant_id = make_restaurant("Seafood Shack")
        with db() as conn:
            conn.execute(
                "UPDATE restaurants SET cuisine_tags = %s WHERE id = %s",
                (["seafood"], restaurant_id),
            )

        uid = "family-match-2"
        client.patch(
            "/v1/me/profile",
            json={"cuisine_dislikes": ["seafood"]},
            headers=auth_header(uid),
        )
        res = client.post(
            "/v1/me/family-matches",
            json={"restaurant_ids": [restaurant_id]},
            headers=auth_header(uid),
        )
        assert res.status_code == 200
        result = res.json()["results"][restaurant_id]
        assert result["matches"] is False
        assert result["reasons"] == []

    def test_endpoint_requires_auth(self, client, db, make_restaurant):
        restaurant_id = make_restaurant("No Auth Bistro")
        res = client.post("/v1/me/family-matches", json={"restaurant_ids": [restaurant_id]})
        assert res.status_code == 401


class TestProfileMatchNotification:
    def test_catalog_add_notifies_matching_profile_via_inbox_not_thread(
        self, client, db, make_restaurant
    ):
        from ttf_api.family_match import notify_profile_matches_for_restaurant
        from ttf_api.db import get_conn

        uid = "family-notify-1"
        client.patch(
            "/v1/me/profile",
            json={"cuisine_likes": ["thai"]},
            headers=auth_header(uid),
        )
        restaurant_id = make_restaurant("Thai Place")
        with db() as conn:
            conn.execute(
                "UPDATE restaurants SET cuisine_tags = %s WHERE id = %s",
                (["thai"], restaurant_id),
            )

        with get_conn() as conn:
            notified = notify_profile_matches_for_restaurant(
                conn,
                restaurant_id=restaurant_id,
                restaurant_name="Thai Place",
                cuisine_tags=["thai"],
            )
            assert notified == 1

            inbox = list_inbox_events(conn, uid, read_through=_EPOCH)
            assert len(inbox) == 1
            assert inbox[0]["event_type"] == "profile_match"
            assert "Thai Place" in inbox[0]["headline"]

            # The user must watch the restaurant for the per-spot thread to
            # return anything at all — but even watching, profile_match must
            # never appear there (privacy: derived from private profile data).
            conn.execute(
                "INSERT INTO restaurant_watches (firebase_uid, restaurant_id) VALUES (%s, %s)",
                (uid, restaurant_id),
            )
            thread = list_activity_for_restaurant(conn, uid, restaurant_id)
            assert thread == []

    def test_notify_skips_profiles_with_no_preferences(self, db, make_restaurant):
        from ttf_api.family_match import notify_profile_matches_for_restaurant
        from ttf_api.db import get_conn

        restaurant_id = make_restaurant("Anywhere Cafe")
        with get_conn() as conn:
            notified = notify_profile_matches_for_restaurant(
                conn,
                restaurant_id=restaurant_id,
                restaurant_name="Anywhere Cafe",
                cuisine_tags=["american"],
            )
        assert notified == 0
