from __future__ import annotations

import pytest

from synthetic_users.guardrails import (
    GuardrailViolation,
    assert_dev_api_url,
    assert_dev_project,
    assert_dev_web_url,
    assert_synthetic_email,
)


def test_assert_dev_web_url_accepts_dev_subdomain():
    assert_dev_web_url("https://app.dev.littlescout.app/map")


def test_assert_dev_web_url_rejects_prod():
    with pytest.raises(GuardrailViolation):
        assert_dev_web_url("https://app.littlescout.app/map")


def test_assert_dev_web_url_rejects_lookalike_host():
    with pytest.raises(GuardrailViolation):
        assert_dev_web_url("https://evil-app.dev.littlescout.app.attacker.example/")


def test_assert_dev_api_url_accepts_dev_subdomain():
    assert_dev_api_url("https://api.dev.littlescout.app/v1/health")


def test_assert_dev_api_url_rejects_prod():
    with pytest.raises(GuardrailViolation):
        assert_dev_api_url("https://api.littlescout.app/v1/health")


def test_assert_dev_project_accepts_dev_project():
    assert_dev_project("ttf-restaurant-dev")


def test_assert_dev_project_accepts_none():
    assert_dev_project(None)


def test_assert_dev_project_rejects_other_project():
    with pytest.raises(GuardrailViolation):
        assert_dev_project("ttf-restaurant-prod")


def test_assert_synthetic_email_accepts_agent_scheme():
    assert_synthetic_email("scout-agent-01@littlescout.app")


def test_assert_synthetic_email_rejects_non_agent_email():
    with pytest.raises(GuardrailViolation):
        assert_synthetic_email("someone@example.com")
