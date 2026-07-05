from __future__ import annotations

import json

import pytest

from synthetic_users.guardrails import GuardrailViolation
from synthetic_users.registry_client import RegistryClient


def test_next_email_follows_scout_agent_scheme(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    assert client.next_email() == "scout-agent-01@littlescout.app"


def test_add_user_then_find_user_round_trips(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    email = client.next_email()
    client.add_user(email, "hunter2", uid="uid-1")

    found = client.find_user(email)
    assert found is not None
    assert found["firebase_uid"] == "uid-1"
    assert found["observation_ids"] == []


def test_add_user_advances_next_email(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    client.add_user(client.next_email(), "pw")
    assert client.next_email() == "scout-agent-02@littlescout.app"


def test_add_user_rejects_duplicate_email(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    email = client.next_email()
    client.add_user(email, "pw")
    with pytest.raises(ValueError, match="already exists"):
        client.add_user(email, "pw")


def test_add_user_rejects_non_agent_email(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    with pytest.raises(GuardrailViolation):
        client.add_user("someone@example.com", "pw")


def test_record_observation_appends_and_dedupes(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    email = client.next_email()
    client.add_user(email, "pw")

    client.record_observation(email, "obs-1")
    client.record_observation(email, "obs-1")  # duplicate, should not double up
    client.record_observation(email, "obs-2")

    user = client.find_user(email)
    assert user["observation_ids"] == ["obs-1", "obs-2"]


def test_record_observation_missing_user_raises(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    with pytest.raises(ValueError, match="not found"):
        client.record_observation("scout-agent-99@littlescout.app", "obs-1")


def test_pick_user_with_observations_filters(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    no_obs_email = client.next_email()
    client.add_user(no_obs_email, "pw")
    with_obs_email = client.next_email()
    client.add_user(with_obs_email, "pw")
    client.record_observation(with_obs_email, "obs-1")

    picked = client.pick_user(with_observations=True)
    assert picked["email"] == with_obs_email


def test_pick_user_empty_registry_returns_none(tmp_path):
    client = RegistryClient(tmp_path / "registry.json")
    assert client.pick_user() is None


def test_registry_file_matches_sibling_cli_format(tmp_path):
    """The written file must stay readable by registry.py's own CLI/format."""
    path = tmp_path / "registry.json"
    client = RegistryClient(path)
    client.add_user(client.next_email(), "pw", uid="uid-1")

    data = json.loads(path.read_text())
    assert data["email_domain"] == "littlescout.app"
    assert data["email_prefix"] == "scout-agent"
    assert isinstance(data["users"], list)
    assert data["users"][0]["email"] == "scout-agent-01@littlescout.app"
