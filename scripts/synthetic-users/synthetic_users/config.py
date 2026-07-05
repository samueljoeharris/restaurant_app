"""Target resolution for synthetic user runs (#89).

Intentionally a closed set — "dev" is the only key, so there is nothing to
mistype into hitting prod. `guardrails.py` re-checks the resolved URLs
anyway, in case this dict is ever extended.
"""

from __future__ import annotations

from dataclasses import dataclass

from .guardrails import assert_dev_api_url, assert_dev_project, assert_dev_web_url


@dataclass(frozen=True)
class TargetConfig:
    name: str
    web_base_url: str
    api_base_url: str
    gcp_project: str


_TARGETS: dict[str, TargetConfig] = {
    "dev": TargetConfig(
        name="dev",
        web_base_url="https://app.dev.littlescout.app",
        api_base_url="https://api.dev.littlescout.app",
        gcp_project="ttf-restaurant-dev",
    ),
}


def resolve_target(name: str) -> TargetConfig:
    try:
        target = _TARGETS[name]
    except KeyError as exc:
        raise ValueError(
            f"Unknown target {name!r}. Only {sorted(_TARGETS)} are supported."
        ) from exc
    assert_dev_web_url(target.web_base_url)
    assert_dev_api_url(target.api_base_url)
    assert_dev_project(target.gcp_project)
    return target
