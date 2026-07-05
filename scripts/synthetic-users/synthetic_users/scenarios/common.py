"""Shared scenario plumbing (#89): one result type, one step-logging helper.

Every scenario module exposes `run(*, driver, registry, persona, logger,
agent_label, dry_run=False) -> ScenarioResult` so `team.py` can dispatch to
any of them uniformly.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

from ..runlog import LogEvent, RunLogger, utc_now_iso

T = TypeVar("T")


@dataclass
class ScenarioResult:
    scenario: str
    agent: str
    ok: bool
    detail: str
    email: str | None = None


class ScenarioFailed(RuntimeError):
    """Raised by step() to short-circuit a scenario; the message is already logged."""


def step(
    logger: RunLogger,
    agent: str,
    scenario: str,
    action: str,
    fn: Callable[[], T],
) -> T:
    """Runs fn(), logs exactly one JSONL event, and turns any exception into
    ScenarioFailed so the caller's except block can build a ScenarioResult."""
    started = time.monotonic()
    try:
        result = fn()
    except Exception as exc:  # noqa: BLE001 — any failure ends the scenario, logged either way
        duration_ms = (time.monotonic() - started) * 1000
        logger.log(LogEvent(utc_now_iso(), agent, scenario, action, False, str(exc), duration_ms))
        raise ScenarioFailed(str(exc)) from exc
    duration_ms = (time.monotonic() - started) * 1000
    logger.log(LogEvent(utc_now_iso(), agent, scenario, action, True, "", duration_ms))
    return result


def no_registered_users_result(
    logger: RunLogger, scenario: str, agent_label: str, *, with_observations: bool = False
) -> ScenarioResult:
    """A scenario's precondition (a registered agent user) wasn't met. Still
    logs one event so `RunLogger.summary()` reflects every agent, not just
    the ones that got past their first driver call."""
    detail = (
        "no agent user with prior observations; run submit_ttf first"
        if with_observations
        else "no registered users; run the signup scenario first"
    )
    logger.log(LogEvent(utc_now_iso(), agent_label, scenario, "precondition", False, detail))
    return ScenarioResult(scenario, agent_label, False, detail)


def pick_search_query(persona: Any) -> str:
    import random

    return random.choice(persona.cuisine_bias)
