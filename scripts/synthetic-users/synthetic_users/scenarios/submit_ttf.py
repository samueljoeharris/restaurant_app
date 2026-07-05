"""submit_ttf scenario (#89): submit one random-but-plausible TTF observation."""

from __future__ import annotations

from ..drivers.base import SyntheticDriver
from ..personas import Persona, random_ttf_body
from ..registry_client import RegistryClient
from ..runlog import RunLogger
from .common import ScenarioFailed, ScenarioResult, no_registered_users_result, pick_search_query, step


def run(
    *,
    driver: SyntheticDriver,
    registry: RegistryClient,
    persona: Persona,
    logger: RunLogger,
    agent_label: str,
    dry_run: bool = False,
) -> ScenarioResult:
    user = registry.pick_user()
    if not user:
        return no_registered_users_result(logger, "submit_ttf", agent_label)
    email = user["email"]
    query = pick_search_query(persona)
    body = random_ttf_body(persona)

    try:
        auth = step(
            logger, agent_label, "submit_ttf", "sign_in", lambda: driver.sign_in(email, user["password"])
        )
        results = step(
            logger,
            agent_label,
            "submit_ttf",
            "search_restaurants",
            lambda: driver.search_restaurants(query),
        )
        if not results:
            raise ScenarioFailed(f"no restaurants found for {query!r}")
        restaurant_id = results[0]["id"]
        observation = step(
            logger,
            agent_label,
            "submit_ttf",
            "submit_ttf",
            lambda: driver.submit_ttf(restaurant_id, body, auth["id_token"]),
        )
        obs_id = observation.get("id") if isinstance(observation, dict) else None
        if obs_id:
            step(
                logger,
                agent_label,
                "submit_ttf",
                "record_observation",
                lambda: registry.record_observation(email, obs_id),
            )
    except ScenarioFailed as exc:
        return ScenarioResult("submit_ttf", agent_label, False, str(exc), email)
    return ScenarioResult("submit_ttf", agent_label, True, f"submitted TTF at {restaurant_id}", email)
