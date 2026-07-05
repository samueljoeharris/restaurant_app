"""Signup scenario (#89): create, tag synthetic, and register a new agent user."""

from __future__ import annotations

import secrets
import subprocess
import sys

from ..drivers.base import SyntheticDriver
from ..paths import SET_SYNTHETIC_CLAIM_SCRIPT
from ..personas import Persona
from ..registry_client import RegistryClient
from ..runlog import RunLogger
from .common import ScenarioFailed, ScenarioResult, step


def _tag_synthetic(email: str) -> None:
    result = subprocess.run(
        [sys.executable, str(SET_SYNTHETIC_CLAIM_SCRIPT), "--email", email],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        raise RuntimeError(f"set_synthetic_claim.py failed: {result.stderr.strip()}")


def run(
    *,
    driver: SyntheticDriver,
    registry: RegistryClient,
    persona: Persona,
    logger: RunLogger,
    agent_label: str,
    dry_run: bool = False,
) -> ScenarioResult:
    email = registry.next_email()
    password = secrets.token_urlsafe(12)

    try:
        auth = step(logger, agent_label, "signup", "sign_up", lambda: driver.sign_up(email, password))
        if not dry_run:
            step(logger, agent_label, "signup", "tag_synthetic", lambda: _tag_synthetic(email))
        step(
            logger,
            agent_label,
            "signup",
            "register",
            lambda: registry.add_user(email, password, uid=auth.get("uid", "")),
        )
    except ScenarioFailed as exc:
        return ScenarioResult("signup", agent_label, False, str(exc), email)
    return ScenarioResult("signup", agent_label, True, f"created {email}", email)
