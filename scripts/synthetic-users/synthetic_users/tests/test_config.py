from __future__ import annotations

import pytest

from synthetic_users.config import resolve_target


def test_resolve_target_dev():
    target = resolve_target("dev")
    assert target.name == "dev"
    assert target.web_base_url.endswith(".dev.littlescout.app")
    assert target.api_base_url.endswith(".dev.littlescout.app")
    assert target.gcp_project == "ttf-restaurant-dev"


def test_resolve_target_rejects_unknown_name():
    with pytest.raises(ValueError, match="Unknown target"):
        resolve_target("prod")
