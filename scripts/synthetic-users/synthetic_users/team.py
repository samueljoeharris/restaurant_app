"""Team orchestrator (#89): runs N personas concurrently with jittered pacing.

A "scenario module" is anything exposing `run(*, driver, registry, persona,
logger, agent_label, dry_run) -> ScenarioResult` — see scenarios/common.py.
The SCENARIOS mapping is the default; tests inject their own for pure,
network-free coverage of the dispatch/rotation logic.
"""

from __future__ import annotations

import random
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Callable, Protocol

from .personas import persona_for_index
from .registry_client import RegistryClient
from .runlog import RunLogger
from .scenarios import post_note, rate_attributes, review_chat, search, signup, submit_ttf, update_ttf
from .scenarios.common import ScenarioResult


class ScenarioModule(Protocol):
    def run(self, **kwargs: Any) -> ScenarioResult: ...


SCENARIOS: dict[str, ScenarioModule] = {
    "signup": signup,
    "search": search,
    "submit_ttf": submit_ttf,
    "update_ttf": update_ttf,
    "rate_attributes": rate_attributes,
    "post_note": post_note,
    "review_chat": review_chat,
}

# Rotation used by `--scenario team`: signup is deliberately excluded from the
# default mix (registry growth is a one-off action, not everyday activity).
DEFAULT_TEAM_ROTATION: tuple[str, ...] = (
    "search",
    "submit_ttf",
    "rate_attributes",
    "post_note",
)


def run_one_agent(
    *,
    agent_index: int,
    scenario_name: str,
    scenarios: dict[str, ScenarioModule],
    driver_factory: Callable[[], Any],
    registry: RegistryClient,
    logger: RunLogger,
    dry_run: bool,
    jitter_max_seconds: float,
) -> ScenarioResult:
    if jitter_max_seconds > 0:
        time.sleep(random.uniform(0, jitter_max_seconds))
    agent_label = f"agent-{agent_index:02d}"
    persona = persona_for_index(agent_index)
    driver = driver_factory()
    module = scenarios[scenario_name]
    return module.run(
        driver=driver,
        registry=registry,
        persona=persona,
        logger=logger,
        agent_label=agent_label,
        dry_run=dry_run,
    )


def run_team(
    *,
    agents: int,
    driver_factory: Callable[[], Any],
    registry: RegistryClient,
    logger: RunLogger,
    dry_run: bool = False,
    jitter_max_seconds: float = 5.0,
    rotation: tuple[str, ...] = DEFAULT_TEAM_ROTATION,
    scenarios: dict[str, ScenarioModule] | None = None,
) -> list[ScenarioResult]:
    """Runs `agents` personas concurrently, each executing one scenario from
    `rotation` (round-robin by agent index), with a small random pre-sleep
    per agent so requests don't all land in the same instant."""
    scenarios = scenarios if scenarios is not None else SCENARIOS
    unknown = [name for name in rotation if name not in scenarios]
    if unknown:
        raise ValueError(f"Unknown scenario(s) in rotation: {unknown}")

    results: list[ScenarioResult] = []
    with ThreadPoolExecutor(max_workers=max(1, min(agents, 8))) as pool:
        futures = [
            pool.submit(
                run_one_agent,
                agent_index=i,
                scenario_name=rotation[i % len(rotation)],
                scenarios=scenarios,
                driver_factory=driver_factory,
                registry=registry,
                logger=logger,
                dry_run=dry_run,
                jitter_max_seconds=jitter_max_seconds,
            )
            for i in range(agents)
        ]
        for future in as_completed(futures):
            results.append(future.result())
    return results
