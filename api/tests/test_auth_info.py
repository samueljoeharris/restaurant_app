"""Tests for the public auth config endpoint."""

from __future__ import annotations

import pytest

from ttf_api.config import Settings
from ttf_api.routers.auth_info import auth_config


def test_auth_config_prod_is_minimal(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "ttf_api.routers.auth_info.settings",
        Settings(auth_dev_mode=False, firebase_project_id="prod-project"),
    )
    result = auth_config()
    assert result == {
        "firebase_project_id": "prod-project",
        "auth_dev_mode": False,
    }


def test_auth_config_dev_includes_emulator_hints(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "ttf_api.routers.auth_info.settings",
        Settings(
            auth_dev_mode=True,
            firebase_project_id="dev-project",
            firebase_auth_emulator_host="localhost:9099",
        ),
    )
    result = auth_config()
    assert result["firebase_project_id"] == "dev-project"
    assert result["auth_dev_mode"] is True
    assert result["emulator_enabled"] is True
    assert result["emulator_host"] == "localhost:9099"
    assert result["dev_token_hint"] == "Bearer dev:<uid>"
