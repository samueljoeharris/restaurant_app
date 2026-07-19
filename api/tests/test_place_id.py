"""Unit tests for place_id validation."""

from __future__ import annotations

import unittest

from ttf_api.place_id import validate_and_quote_place_id


class PlaceIdValidationTests(unittest.TestCase):
    def test_valid_place_id_is_unchanged(self) -> None:
        self.assertEqual(
            validate_and_quote_place_id("ChIJgUbEo8cfqokR5lP9_Wh_DaM"),
            "ChIJgUbEo8cfqokR5lP9_Wh_DaM",
        )

    def test_place_id_with_unsafe_characters_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "invalid place_id"):
            validate_and_quote_place_id("../etc/passwd")

    def test_empty_place_id_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "non-empty string"):
            validate_and_quote_place_id("")


if __name__ == "__main__":
    unittest.main()
