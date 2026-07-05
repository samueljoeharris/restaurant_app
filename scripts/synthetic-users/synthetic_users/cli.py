"""CLI entry point (#89): `python -m synthetic_users run ...`

Run from scripts/synthetic-users/ (so both this package and the sibling
registry.py resolve on sys.path), e.g.:

    cd scripts/synthetic-users
    python -m synthetic_users run --scenario team --agents 5 --target dev --dry-run
"""

from __future__ import annotations

import argparse
from pathlib import Path

from .config import resolve_target
from .drivers.api_driver import ApiDriver
from .paths import DEFAULT_RUN_LOG_DIR
from .registry_client import RegistryClient
from .runlog import RunLogger, utc_now_iso
from .team import DEFAULT_TEAM_ROTATION, SCENARIOS, run_team


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="synthetic_users",
        description="In-repo synthetic user agent team (#89) — off by default, dev-only.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_run = sub.add_parser("run", help="Run one scenario, or the team rotation")
    p_run.add_argument(
        "--scenario",
        required=True,
        choices=[*SCENARIOS, "team"],
        help="A single scenario name, or 'team' for the default rotation",
    )
    p_run.add_argument(
        "--agents",
        type=int,
        default=1,
        help="Number of personas to run concurrently (default 1)",
    )
    p_run.add_argument(
        "--target",
        required=True,
        choices=["dev"],
        help="Hard-coded to dev — this tool refuses any other target",
    )
    p_run.add_argument("--driver", choices=["api", "browser"], default="api")
    p_run.add_argument(
        "--dry-run",
        action="store_true",
        help="Log intended calls with no network access at all (safe without secrets)",
    )
    p_run.add_argument("--jitter-max-seconds", type=float, default=5.0)
    p_run.add_argument("--registry", type=Path, default=None, help="Override the registry JSON path")
    p_run.add_argument("--log-dir", type=Path, default=DEFAULT_RUN_LOG_DIR)
    p_run.set_defaults(func=cmd_run)

    return parser


def cmd_run(args: argparse.Namespace) -> int:
    target = resolve_target(args.target)
    registry = RegistryClient(args.registry)

    log_dir = Path(args.log_dir)
    log_dir.mkdir(parents=True, exist_ok=True)
    log_path = log_dir / f"{utc_now_iso().replace(':', '-')}-{args.scenario}.jsonl"
    logger = RunLogger(log_path)

    def driver_factory():
        if args.driver == "browser":
            from .drivers.browser_driver import BrowserDriver

            return BrowserDriver(target, dry_run=args.dry_run)
        return ApiDriver(target, dry_run=args.dry_run)

    # "team" spans the default rotation; a single named scenario repeats
    # itself across --agents personas.
    rotation = DEFAULT_TEAM_ROTATION if args.scenario == "team" else (args.scenario,)

    results = run_team(
        agents=args.agents,
        driver_factory=driver_factory,
        registry=registry,
        logger=logger,
        dry_run=args.dry_run,
        jitter_max_seconds=args.jitter_max_seconds,
        rotation=rotation,
    )

    print(logger.summary())
    return 0 if all(r.ok for r in results) else 1


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    return args.func(args)
