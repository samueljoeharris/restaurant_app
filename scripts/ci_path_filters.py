#!/usr/bin/env python3
"""Canonical CI/CD path filters — shared by deploy.yml and ci-check.sh.

Edit FILTER_GROUPS here only; deploy.yml and ci-check.sh consume this module.
Run: python3 scripts/ci_path_filters.py --print-filters  (debug)
"""
from __future__ import annotations

import argparse
import fnmatch
import os
import subprocess
import sys
from dataclasses import dataclass
from typing import Iterable

# --- Filter groups (single source of truth) ---------------------------------

FILTER_GROUPS: dict[str, list[str]] = {
    # GCP Terraform — orchestrator edits alone must NOT run apply.
    "infra": [
        "infra/**",
        ".github/workflows/reusable-terraform.yml",
    ],
    "apiBase": [
        "api/**",
        ".github/workflows/reusable-api.yml",
    ],
    "webBase": [
        "web/**",
        ".github/workflows/reusable-web.yml",
        ".github/workflows/reusable-admin-web.yml",
    ],
    # Cross-stack API contract — client, routes, OpenAPI, and shared schemas.
    "apiContract": [
        "web/src/api/**",
        "api/ttf_api/routers/**",
        "api/openapi.yaml",
        "api/ttf_api/schemas.py",
        "api/ttf_api/contribution_schema.py",
    ],
    # Shared design system — regenerates web + iOS token outputs.
    "design": [
        "design/**",
        "scripts/generate-design-tokens.mjs",
        "scripts/verify-design-tokens.sh",
    ],
    "ios": [
        "ios/**",
        ".github/workflows/tool-ios.yml",
    ],
    # Pipeline orchestrator — re-run service CI/deploy wiring, not Terraform.
    "pipeline": [
        ".github/workflows/deploy.yml",
        "scripts/ci_path_filters.py",
    ],
}

# Combined stack flags for deploy / CI gating.
STACK_RULES: dict[str, list[str]] = {
    "infra": ["infra"],
    "api": ["apiBase", "apiContract", "pipeline"],
    "web": ["webBase", "apiContract", "design", "pipeline"],
    "ios": ["ios", "design"],
    "tokens": ["design", "webBase", "ios"],
}


@dataclass(frozen=True)
class StackFlags:
    infra: bool = False
    api: bool = False
    web: bool = False
    ios: bool = False
    tokens: bool = False

    def as_dict(self) -> dict[str, bool]:
        return {
            "infra": self.infra,
            "api": self.api,
            "web": self.web,
            "ios": self.ios,
            "tokens": self.tokens,
        }


def normalize_path(path: str) -> str:
    path = path.replace("\\", "/")
    if path.startswith("./"):
        return path[2:]
    return path


def match_pattern(pattern: str, path: str) -> bool:
    path = normalize_path(path)
    pattern = normalize_path(pattern)
    if pattern.endswith("/**"):
        prefix = pattern[:-3]
        return path == prefix or path.startswith(f"{prefix}/")
    if "**" in pattern:
        rx = "^" + fnmatch.translate(pattern).replace(r"\*\*", ".*") + "$"
        import re

        return bool(re.match(rx, path))
    return path == pattern or fnmatch.fnmatchcase(path, pattern)


def group_matches(group: str, changed_files: Iterable[str]) -> bool:
    patterns = FILTER_GROUPS[group]
    for path in changed_files:
        path = path.strip()
        if not path:
            continue
        for pattern in patterns:
            if match_pattern(pattern, path):
                return True
    return False


def evaluate_groups(changed_files: Iterable[str]) -> dict[str, bool]:
    files = list(changed_files)
    return {name: group_matches(name, files) for name in FILTER_GROUPS}


def evaluate_stacks(changed_files: Iterable[str]) -> StackFlags:
    groups = evaluate_groups(changed_files)
    stacks: dict[str, bool] = {}
    for stack, group_names in STACK_RULES.items():
        stacks[stack] = any(groups.get(name, False) for name in group_names)
    return StackFlags(**stacks)


def git_changed_files(before: str, after: str) -> list[str]:
    before = (before or "").strip()
    after = (after or "HEAD").strip()
    zero = "0" * 40
    if before and before != zero:
        cmd = ["git", "diff", "--name-only", before, after]
    elif subprocess.run(["git", "rev-parse", f"{after}~1"], capture_output=True).returncode == 0:
        cmd = ["git", "diff", "--name-only", f"{after}~1", after]
    else:
        cmd = ["git", "show", "--name-only", "--pretty=format:", after]
    result = subprocess.run(cmd, capture_output=True, text=True, check=False)
    if result.returncode != 0:
        return []
    return [line for line in result.stdout.splitlines() if line.strip()]


def emit_github_output(flags: StackFlags) -> None:
    out_path = os.environ.get("GITHUB_OUTPUT")
    if not out_path:
        raise SystemExit("GITHUB_OUTPUT is not set")
    with open(out_path, "a", encoding="utf-8") as out:
        for key, value in flags.as_dict().items():
            out.write(f"{key}={'true' if value else 'false'}\n")


def emit_shell_env(flags: StackFlags) -> None:
    mapping = {
        "infra": "RUN_INFRA",
        "api": "RUN_API",
        "web": "RUN_WEB",
        "ios": "RUN_IOS",
        "tokens": "RUN_TOKENS",
    }
    for stack, env_name in mapping.items():
        value = "true" if flags.as_dict()[stack] else "false"
        print(f"{env_name}={value}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--github-output",
        action="store_true",
        help="Write stack flags to GITHUB_OUTPUT (uses BEFORE/AFTER env or git HEAD)",
    )
    parser.add_argument(
        "--shell-env",
        action="store_true",
        help="Print RUN_* shell variables for ci-check.sh",
    )
    parser.add_argument(
        "--print-filters",
        action="store_true",
        help="Print filter groups and stack rules",
    )
    parser.add_argument(
        "--files",
        nargs="*",
        help="Changed file paths (default: read stdin lines)",
    )
    parser.add_argument("--before", default=os.environ.get("BEFORE", ""))
    parser.add_argument("--after", default=os.environ.get("AFTER", ""))
    args = parser.parse_args()

    if args.print_filters:
        for name, patterns in FILTER_GROUPS.items():
            print(f"[{name}]")
            for p in patterns:
                print(f"  - {p}")
        print("\n[stacks]")
        for stack, groups in STACK_RULES.items():
            print(f"  {stack}: {' | '.join(groups)}")
        return 0

    if args.files:
        changed = args.files
    elif not sys.stdin.isatty():
        changed = [line.strip() for line in sys.stdin if line.strip()]
    else:
        changed = git_changed_files(args.before, args.after or "HEAD")

    flags = evaluate_stacks(changed)

    if args.github_output:
        emit_github_output(flags)
    elif args.shell_env:
        emit_shell_env(flags)
    else:
        for key, value in flags.as_dict().items():
            print(f"{key}={'true' if value else 'false'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
