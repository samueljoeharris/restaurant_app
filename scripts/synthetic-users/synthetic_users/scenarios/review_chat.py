"""review_chat scenario (#89): exercise the chat-through-your-review flow —
reply loop, extract a draft, submit it as contributions."""

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
        return no_registered_users_result(logger, "review_chat", agent_label)
    email = user["email"]
    query = pick_search_query(persona)

    try:
        auth = step(
            logger, agent_label, "review_chat", "sign_in", lambda: driver.sign_in(email, user["password"])
        )
        results = step(
            logger,
            agent_label,
            "review_chat",
            "search_restaurants",
            lambda: driver.search_restaurants(query),
        )
        if not results:
            raise ScenarioFailed(f"no restaurants found for {query!r}")
        restaurant = results[0]
        messages = [
            {"role": "user", "text": f"We went to {restaurant['name']} with the kids. {persona.note_style}"}
        ]
        reply = step(
            logger,
            agent_label,
            "review_chat",
            "reply",
            lambda: driver.review_chat_reply(restaurant["name"], messages, auth["id_token"]),
        )
        messages.append({"role": "assistant", "text": reply.get("reply", "")})
        messages.append({"role": "user", "text": "That's everything, thanks!"})
        extracted = step(
            logger,
            agent_label,
            "review_chat",
            "extract",
            lambda: driver.review_chat_extract(messages, auth["id_token"]),
        )
        draft = extracted.get("draft") if isinstance(extracted, dict) else None
        if draft:
            step(
                logger,
                agent_label,
                "review_chat",
                "submit_contributions",
                lambda: driver.submit_contributions(restaurant["id"], draft, auth["id_token"]),
            )
    except ScenarioFailed as exc:
        return ScenarioResult("review_chat", agent_label, False, str(exc), email)
    return ScenarioResult(
        "review_chat", agent_label, True, f"chatted through a review at {restaurant['id']}", email
    )
