"""rate_attributes scenario (#89): rate one community attribute (e.g. high
chair availability, noise level) for a restaurant."""

from __future__ import annotations

import random

from ..drivers.base import SyntheticDriver
from ..personas import Persona, random_value_for_metric
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
        return no_registered_users_result(logger, "rate_attributes", agent_label)
    email = user["email"]
    query = pick_search_query(persona)

    try:
        auth = step(
            logger,
            agent_label,
            "rate_attributes",
            "sign_in",
            lambda: driver.sign_in(email, user["password"]),
        )
        results = step(
            logger,
            agent_label,
            "rate_attributes",
            "search_restaurants",
            lambda: driver.search_restaurants(query),
        )
        if not results:
            raise ScenarioFailed(f"no restaurants found for {query!r}")
        restaurant_id = results[0]["id"]
        metrics = step(
            logger, agent_label, "rate_attributes", "list_metrics", lambda: driver.list_metrics()
        )
        if not metrics:
            raise ScenarioFailed("no metric definitions available")
        metric = random.choice(metrics)
        value = random_value_for_metric(metric)
        step(
            logger,
            agent_label,
            "rate_attributes",
            "submit_attribute",
            lambda: driver.submit_attribute(restaurant_id, metric["key"], value, auth["id_token"]),
        )
    except ScenarioFailed as exc:
        return ScenarioResult("rate_attributes", agent_label, False, str(exc), email)
    return ScenarioResult(
        "rate_attributes", agent_label, True, f"rated {metric['key']}={value!r}", email
    )
