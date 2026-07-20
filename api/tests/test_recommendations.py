"""Pure scoring tests for the family-fit ranker (#92)."""

from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from ttf_api.recommendations import score_restaurant


def _row(
    *,
    median_minutes: float | None = None,
    sample_size: int = 0,
    last_updated: datetime | None = None,
    lat: float = 42.24,
    lng: float = -71.17,
    cuisine_tags: list[str] | None = None,
) -> dict:
    return {
        "id": "r1",
        "name": "Testaurant",
        "address": "1 Main St",
        "lat": lat,
        "lng": lng,
        "cuisine_tags": cuisine_tags or [],
        "median_minutes": median_minutes,
        "sample_size": sample_size,
        "last_updated": last_updated,
    }


def _profile(allergies: list[str] | None = None, dietary_restrictions: list[str] | None = None) -> dict:
    return {
        "allergies": allergies or [],
        "dietary_restrictions": dietary_restrictions or [],
    }


def _agg_ok(metric_key: str, value: bool) -> dict:
    return {metric_key: {"status": "ok", "aggregate": {"value": value}}}


class TestTtfScoring(unittest.TestCase):
    def test_fast_known_ttf_outscores_unknown(self) -> None:
        profile = _profile()
        fast, _, _ = score_restaurant(
            _row(median_minutes=4, sample_size=3, last_updated=datetime.now(timezone.utc)),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        unknown, _, _ = score_restaurant(
            _row(median_minutes=None, sample_size=0),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertGreater(fast, unknown)

    def test_larger_sample_and_recent_data_boost_score(self) -> None:
        profile = _profile()
        recent = datetime.now(timezone.utc)
        old = recent - timedelta(days=120)
        small, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=1, last_updated=recent),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        large_old, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=5, last_updated=old),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        large_recent, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=5, last_updated=recent),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertGreater(large_old, small)
        self.assertGreater(large_recent, large_old)


class TestConstraintScoring(unittest.TestCase):
    def test_negative_constraint_heavy_penalty(self) -> None:
        profile = _profile(dietary_restrictions=["gluten_free"])
        neutral, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        negative, _, why = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            _agg_ok("gluten_free_options", False),
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertLess(negative, neutral)

    def test_positive_constraint_small_boost(self) -> None:
        profile = _profile(dietary_restrictions=["gluten_free"])
        neutral, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        positive, _, why = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            _agg_ok("gluten_free_options", True),
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertGreater(positive, neutral)
        self.assertIn("gluten-free options reported", why)

    def test_allergies_boost_allergy_menu_signal(self) -> None:
        profile = _profile(allergies=["peanut"])
        base, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        with_menu, _, why = score_restaurant(
            _row(median_minutes=10, sample_size=3),
            _agg_ok("allergy_menu_available", True),
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertGreater(with_menu, base)
        self.assertIn("allergy menu available reported", why)


class TestDistanceTieBreaker(unittest.TestCase):
    def test_closer_restaurant_scores_higher_when_ttf_equal(self) -> None:
        profile = _profile()
        close, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=3, lat=42.24, lng=-71.17),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        far, _, _ = score_restaurant(
            _row(median_minutes=10, sample_size=3, lat=42.30, lng=-71.25),
            {},
            profile,
            42.24,
            -71.17,
            8000,
        )
        self.assertGreater(close, far)


class TestWhyString(unittest.TestCase):
    def test_why_includes_ttf_and_reports(self) -> None:
        _, _, why = score_restaurant(
            _row(median_minutes=8, sample_size=5, last_updated=datetime.now(timezone.utc)),
            {},
            _profile(),
            42.24,
            -71.17,
            8000,
        )
        self.assertIn("8 min kid food", why)
        self.assertIn("5 parent reports", why)

    def test_why_handles_no_speed_data(self) -> None:
        _, _, why = score_restaurant(
            _row(median_minutes=None, sample_size=0),
            {},
            _profile(),
            42.24,
            -71.17,
            8000,
        )
        self.assertIn("No speed data yet", why)


if __name__ == "__main__":
    unittest.main()
