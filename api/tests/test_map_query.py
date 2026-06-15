"""Unit tests for the dependency-free bbox filter helper."""

import pytest

from ttf_api.map_query import build_bbox_filter


def test_all_none_returns_empty_fragment() -> None:
    assert build_bbox_filter(None, None, None, None) == ("", [])


def test_valid_bbox_returns_fragment_and_params_in_order() -> None:
    fragment, params = build_bbox_filter(1.0, 2.0, 3.0, 4.0)
    assert fragment == (" AND r.lat BETWEEN %s AND %s AND r.lng BETWEEN %s AND %s")
    assert params == [1.0, 2.0, 3.0, 4.0]


def test_partial_bounds_raise_value_error() -> None:
    with pytest.raises(ValueError, match="all of"):
        build_bbox_filter(1.0, 2.0, 3.0, None)


def test_inverted_lat_bounds_raise_value_error() -> None:
    with pytest.raises(ValueError, match="less than"):
        build_bbox_filter(2.0, 1.0, 3.0, 4.0)


def test_inverted_lng_bounds_raise_value_error() -> None:
    with pytest.raises(ValueError, match="less than"):
        build_bbox_filter(1.0, 2.0, 4.0, 3.0)
