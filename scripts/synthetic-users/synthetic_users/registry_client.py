"""Library wrapper around the sibling registry.py CLI (#89).

registry.py (scripts/synthetic-users/registry.py) already implements the
agent-user registry format and Secret Manager sync path; this reuses its
load/save so the CLI and this package can never disagree on the file format.
"""

from __future__ import annotations

import importlib.util
import sys
import threading
from pathlib import Path
from typing import Any

from .guardrails import assert_synthetic_email
from .paths import SCRIPTS_SYNTHETIC_DIR

if str(SCRIPTS_SYNTHETIC_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_SYNTHETIC_DIR))

_spec = importlib.util.spec_from_file_location(
    "synthetic_users._registry_script", SCRIPTS_SYNTHETIC_DIR / "registry.py"
)
assert _spec and _spec.loader
_registry = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_registry)


class RegistryClient:
    """Thread-safe wrapper — the team orchestrator may read/write concurrently."""

    def __init__(self, path: Path | None = None):
        self.path = path or _registry.registry_path()
        self._lock = threading.Lock()

    def load(self) -> dict[str, Any]:
        return _registry.load_registry(self.path)

    def save(self, data: dict[str, Any]) -> None:
        _registry.save_registry(self.path, data)

    def find_user(self, email: str) -> dict[str, Any] | None:
        return _registry._find_user(self.load(), email)  # noqa: SLF001 — same-repo reuse

    def next_email(self) -> str:
        with self._lock:
            data = self.load()
            index = int(data.get("next_index", 1))
            prefix = data.get("email_prefix", _registry.EMAIL_PREFIX)
            domain = data.get("email_domain", _registry.EMAIL_DOMAIN)
            email = f"{prefix}-{index:02d}@{domain}"
            assert_synthetic_email(email)
            return email

    def add_user(self, email: str, password: str, uid: str = "") -> dict[str, Any]:
        assert_synthetic_email(email)
        with self._lock:
            data = self.load()
            if _registry._find_user(data, email):  # noqa: SLF001
                raise ValueError(f"User already exists: {email}")
            user = {
                "email": email.strip().lower(),
                "password": password,
                "firebase_uid": uid,
                "observation_ids": [],
                "created_at": _registry._utc_now(),  # noqa: SLF001
                "last_scenario_at": _registry._utc_now(),  # noqa: SLF001
            }
            data["users"].append(user)
            prefix = data.get("email_prefix", _registry.EMAIL_PREFIX)
            local = email.split("@", 1)[0]
            if local.startswith(f"{prefix}-") and local[len(prefix) + 1 :].isdigit():
                idx = int(local[len(prefix) + 1 :]) + 1
                data["next_index"] = max(int(data.get("next_index", 1)), idx)
            self.save(data)
            return user

    def pick_user(self, with_observations: bool = False) -> dict[str, Any] | None:
        import random

        users = self.load()["users"]
        if with_observations:
            users = [u for u in users if u.get("observation_ids")]
        return random.choice(users) if users else None

    def record_observation(self, email: str, observation_id: str) -> None:
        with self._lock:
            data = self.load()
            user = _registry._find_user(data, email)  # noqa: SLF001
            if not user:
                raise ValueError(f"User not found: {email}")
            obs_ids: list[str] = list(user.get("observation_ids") or [])
            if observation_id not in obs_ids:
                obs_ids.append(observation_id)
            user["observation_ids"] = obs_ids
            user["last_scenario_at"] = _registry._utc_now()  # noqa: SLF001
            self.save(data)
