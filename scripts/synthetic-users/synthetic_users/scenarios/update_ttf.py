"""update_ttf scenario (#89): edit an existing TTF observation for a known agent user."""

from __future__ import annotations

import random

from ..drivers.base import SyntheticDriver
from ..personas import Persona, random_ttf_body
from ..registry_client import RegistryClient
from ..runlog import RunLogger
from .common import ScenarioFailed, ScenarioResult, no_registered_users_result, step


def run(
    *,
    driver: SyntheticDriver,
    registry: RegistryClient,
    persona: Persona,
    logger: RunLogger,
    agent_label: str,
    dry_run: bool = False,
) -> ScenarioResult:
    user = registry.pick_user(with_observations=True)
    if not user:
        return no_registered_users_result(logger, "update_ttf", agent_label, with_observations=True)
    email = user["email"]
    observation_id = random.choice(user["observation_ids"])
    body = random_ttf_body(persona)

    try:
        auth = step(
            logger, agent_label, "update_ttf", "sign_in", lambda: driver.sign_in(email, user["password"])
        )
        step(
            logger,
            agent_label,
            "update_ttf",
            "update_ttf",
            lambda: driver.update_ttf(observation_id, body, auth["id_token"]),
        )
    except ScenarioFailed as exc:
        return ScenarioResult("update_ttf", agent_label, False, str(exc), email)
    return ScenarioResult("update_ttf", agent_label, True, f"updated {observation_id}", email)
