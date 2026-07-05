"""Search scenario (#89): sign in, search, open a restaurant."""

from __future__ import annotations

from ..drivers.base import SyntheticDriver
from ..personas import Persona
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
        return no_registered_users_result(logger, "search", agent_label)
    email = user["email"]
    query = pick_search_query(persona)

    try:
        step(logger, agent_label, "search", "sign_in", lambda: driver.sign_in(email, user["password"]))
        results = step(
            logger, agent_label, "search", "search_restaurants", lambda: driver.search_restaurants(query)
        )
        if results:
            step(
                logger,
                agent_label,
                "search",
                "get_restaurant",
                lambda: driver.get_restaurant(results[0]["id"]),
            )
    except ScenarioFailed as exc:
        return ScenarioResult("search", agent_label, False, str(exc), email)
    return ScenarioResult("search", agent_label, True, f"searched {query!r}", email)
