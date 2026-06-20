"""Unit tests for admin moderation helpers."""

from ttf_api.ugc_sql import PUBLIC_NOTE_FILTER, TTF_AGGREGATE_FILTER
from ttf_api.ugc_write import _URL_PATTERN


def test_url_pattern_detects_http() -> None:
    assert _URL_PATTERN.search("see https://example.com")
    assert not _URL_PATTERN.search("family friendly spot")


def test_aggregate_filters_require_approved() -> None:
    assert "moderation_status = 'approved'" in TTF_AGGREGATE_FILTER
    assert "excluded_from_aggregate = FALSE" in TTF_AGGREGATE_FILTER
    assert "visibility = 'public'" in PUBLIC_NOTE_FILTER
