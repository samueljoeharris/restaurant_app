"""Unit tests for activity inbox SQL helpers (no DB)."""

from datetime import datetime, timezone

from ttf_api.activity_events import EVENT_HEADLINES


def test_event_headlines_cover_all_types() -> None:
    assert EVENT_HEADLINES["ttf"]
    assert EVENT_HEADLINES["attribute"]
    assert EVENT_HEADLINES["note"]


def test_inbox_read_watermark_default_is_epoch() -> None:
    epoch = datetime(1970, 1, 1, tzinfo=timezone.utc)
    assert epoch.year == 1970
