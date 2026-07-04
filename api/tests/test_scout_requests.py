"""Which seed jobs mark new venues as scout-requested (#63).

Pure-function coverage for ttf_api.seed_jobs.is_scout_request — coverage
requests and admin seeds count; scheduled refresh and anonymous/system runs
must not inflate the scouting queue.
"""

import pytest

from ttf_api.seed_jobs import is_scout_request


@pytest.mark.parametrize(
    ("requested_by", "refresh", "expected"),
    [
        ("firebase-uid-123", False, True),  # user coverage request
        ("admin-uid-456", False, True),  # admin seed form
        ("scheduled-refresh", False, False),  # scheduler-created job
        ("firebase-uid-123", True, False),  # refresh runs never mark
        ("scheduled-refresh", True, False),
        (None, False, False),  # system/bootstrap job without requester
        ("", False, False),
    ],
)
def test_is_scout_request(requested_by, refresh, expected):
    assert is_scout_request(requested_by, refresh=refresh) is expected
