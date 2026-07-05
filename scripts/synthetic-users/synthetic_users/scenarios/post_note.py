"""post_note scenario (#89): post a short freeform note for a restaurant."""

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
        return no_registered_users_result(logger, "post_note", agent_label)
    email = user["email"]
    query = pick_search_query(persona)
    text = f"{persona.note_style} (synthetic agent note)"

    try:
        auth = step(
            logger, agent_label, "post_note", "sign_in", lambda: driver.sign_in(email, user["password"])
        )
        results = step(
            logger,
            agent_label,
            "post_note",
            "search_restaurants",
            lambda: driver.search_restaurants(query),
        )
        if not results:
            raise ScenarioFailed(f"no restaurants found for {query!r}")
        restaurant_id = results[0]["id"]
        step(
            logger,
            agent_label,
            "post_note",
            "submit_note",
            lambda: driver.submit_note(restaurant_id, text, auth["id_token"]),
        )
    except ScenarioFailed as exc:
        return ScenarioResult("post_note", agent_label, False, str(exc), email)
    return ScenarioResult("post_note", agent_label, True, f"posted note at {restaurant_id}", email)
