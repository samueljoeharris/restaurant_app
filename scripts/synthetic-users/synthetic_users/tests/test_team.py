from __future__ import annotations

import pytest

from synthetic_users.registry_client import RegistryClient
from synthetic_users.runlog import RunLogger
from synthetic_users.scenarios.common import ScenarioResult
from synthetic_users.team import run_team


class _FakeScenario:
    """Records which agent/persona hit it, with no network or driver calls."""

    def __init__(self, name: str):
        self.name = name
        self.calls: list[dict] = []

    def run(self, *, driver, registry, persona, logger, agent_label, dry_run=False):
        self.calls.append({"agent_label": agent_label, "persona": persona.key})
        return ScenarioResult(self.name, agent_label, True, "ok")


def test_run_team_dispatches_round_robin_across_rotation(tmp_path):
    scenario_a = _FakeScenario("a")
    scenario_b = _FakeScenario("b")
    registry = RegistryClient(tmp_path / "registry.json")
    logger = RunLogger(tmp_path / "run.jsonl")

    results = run_team(
        agents=4,
        driver_factory=lambda: object(),
        registry=registry,
        logger=logger,
        dry_run=True,
        jitter_max_seconds=0,
        rotation=("a", "b"),
        scenarios={"a": scenario_a, "b": scenario_b},
    )

    assert len(results) == 4
    assert all(r.ok for r in results)
    # Agents 0 and 2 -> "a"; agents 1 and 3 -> "b" (round robin by index).
    assert len(scenario_a.calls) == 2
    assert len(scenario_b.calls) == 2


def test_run_team_rejects_unknown_scenario_in_rotation(tmp_path):
    registry = RegistryClient(tmp_path / "registry.json")
    logger = RunLogger(tmp_path / "run.jsonl")

    with pytest.raises(ValueError, match="Unknown scenario"):
        run_team(
            agents=1,
            driver_factory=lambda: object(),
            registry=registry,
            logger=logger,
            rotation=("does_not_exist",),
            scenarios={"a": _FakeScenario("a")},
        )


def test_run_team_assigns_distinct_personas_by_agent_index(tmp_path):
    scenario = _FakeScenario("solo")
    registry = RegistryClient(tmp_path / "registry.json")
    logger = RunLogger(tmp_path / "run.jsonl")

    run_team(
        agents=3,
        driver_factory=lambda: object(),
        registry=registry,
        logger=logger,
        dry_run=True,
        jitter_max_seconds=0,
        rotation=("solo",),
        scenarios={"solo": scenario},
    )

    personas_seen = {call["persona"] for call in scenario.calls}
    # With 3 agents and >=3 distinct personas available, each agent gets a
    # different one (persona_for_index round-robins deterministically).
    assert len(personas_seen) == 3
