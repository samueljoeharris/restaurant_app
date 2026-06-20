#!/usr/bin/env python3
"""Manage the synthetic agent user registry (Secret Manager → .secrets/ via sync-secrets.sh)."""

from __future__ import annotations

import argparse
import json
import os
import random
import secrets
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_REGISTRY_PATH = Path(".secrets/agent-users-registry.json")
EMAIL_DOMAIN = "littlescout.app"
EMAIL_PREFIX = "scout-agent"


def _utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _default_registry() -> dict[str, Any]:
    return {
        "email_domain": EMAIL_DOMAIN,
        "email_prefix": EMAIL_PREFIX,
        "next_index": 1,
        "users": [],
    }


def registry_path(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit)
    env = os.environ.get("AGENT_USERS_REGISTRY_PATH", "").strip()
    if env:
        return Path(env)
    return DEFAULT_REGISTRY_PATH


def load_registry(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return _default_registry()
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Registry root must be an object: {path}")
    data.setdefault("email_domain", EMAIL_DOMAIN)
    data.setdefault("email_prefix", EMAIL_PREFIX)
    data.setdefault("next_index", 1)
    data.setdefault("users", [])
    return data


def save_registry(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2)
        fh.write("\n")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def _find_user(data: dict[str, Any], email: str) -> dict[str, Any] | None:
    email_lower = email.strip().lower()
    for user in data["users"]:
        if str(user.get("email", "")).lower() == email_lower:
            return user
    return None


def cmd_list(args: argparse.Namespace) -> int:
    data = load_registry(args.registry)
    users = data["users"]
    if not users:
        print("No agent users in registry.")
        return 0
    for user in users:
        obs = user.get("observation_ids") or []
        print(
            f"{user.get('email')}  uid={user.get('firebase_uid') or '-'}  "
            f"observations={len(obs)}  last={user.get('last_scenario_at') or '-'}"
        )
    return 0


def cmd_next_email(args: argparse.Namespace) -> int:
    data = load_registry(args.registry)
    index = int(data.get("next_index", 1))
    email = f"{data.get('email_prefix', EMAIL_PREFIX)}-{index:02d}@{data.get('email_domain', EMAIL_DOMAIN)}"
    password = args.password or secrets.token_urlsafe(12)
    print(json.dumps({"email": email, "password": password, "index": index}, indent=2))
    return 0


def cmd_add_user(args: argparse.Namespace) -> int:
    path = args.registry
    data = load_registry(path)
    if _find_user(data, args.email):
        print(f"User already exists: {args.email}", file=sys.stderr)
        return 1

    user = {
        "email": args.email.strip().lower(),
        "password": args.password,
        "firebase_uid": args.uid or "",
        "observation_ids": [],
        "created_at": _utc_now(),
        "last_scenario_at": _utc_now(),
    }
    data["users"].append(user)

    prefix = data.get("email_prefix", EMAIL_PREFIX)
    domain = data.get("email_domain", EMAIL_DOMAIN)
    try:
        local = args.email.split("@", 1)[0]
        if local.startswith(f"{prefix}-") and local[len(prefix) + 1 :].isdigit():
            idx = int(local[len(prefix) + 1 :]) + 1
            data["next_index"] = max(int(data.get("next_index", 1)), idx)
    except (IndexError, ValueError):
        pass

    save_registry(path, data)
    print(f"Added {user['email']} to {path}")
    return 0


def cmd_set_uid(args: argparse.Namespace) -> int:
    path = args.registry
    data = load_registry(path)
    user = _find_user(data, args.email)
    if not user:
        print(f"User not found: {args.email}", file=sys.stderr)
        return 1
    user["firebase_uid"] = args.uid
    user["last_scenario_at"] = _utc_now()
    save_registry(path, data)
    print(f"Updated uid for {args.email}")
    return 0


def cmd_record_observation(args: argparse.Namespace) -> int:
    path = args.registry
    data = load_registry(path)
    user = _find_user(data, args.email)
    if not user:
        print(f"User not found: {args.email}", file=sys.stderr)
        return 1
    obs_ids: list[str] = list(user.get("observation_ids") or [])
    if args.observation_id not in obs_ids:
        obs_ids.append(args.observation_id)
    user["observation_ids"] = obs_ids
    user["last_scenario_at"] = _utc_now()
    save_registry(path, data)
    print(f"Recorded observation {args.observation_id} for {args.email}")
    return 0


def cmd_pick_user(args: argparse.Namespace) -> int:
    data = load_registry(args.registry)
    users = list(data["users"])
    if args.with_observations:
        users = [u for u in users if u.get("observation_ids")]
    if not users:
        print("No matching agent users in registry.", file=sys.stderr)
        return 1
    user = random.choice(users)
    print(json.dumps(user, indent=2))
    return 0


def cmd_random_ttf(_args: argparse.Namespace) -> int:
    payload = {
        "elapsed_minutes": random.randint(5, 25),
        "item_type": random.choice(["fries", "apple_slices", "bread", "kids_meal", "other"]),
        "item_quality": random.randint(3, 5),
        "portion_size": random.choice(["kid", "regular", "shareable"]),
        "daypart": random.choice(["breakfast", "lunch", "dinner", "late"]),
        "party_size_kids": random.randint(1, 3),
    }
    print(json.dumps(payload, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Synthetic agent user registry")
    parser.add_argument(
        "--registry",
        type=Path,
        default=registry_path(None),
        help=f"Registry JSON path (default: {DEFAULT_REGISTRY_PATH})",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list", help="List registered agent users").set_defaults(func=cmd_list)

    p_next = sub.add_parser("next-email", help="Print next scout-agent email + generated password")
    p_next.add_argument("--password", help="Use this password instead of generating one")
    p_next.set_defaults(func=cmd_next_email)

    p_add = sub.add_parser("add-user", help="Add a user to the registry")
    p_add.add_argument("--email", required=True)
    p_add.add_argument("--password", required=True)
    p_add.add_argument("--uid", help="Firebase UID after signup")
    p_add.set_defaults(func=cmd_add_user)

    p_uid = sub.add_parser("set-uid", help="Set Firebase UID for an existing user")
    p_uid.add_argument("--email", required=True)
    p_uid.add_argument("--uid", required=True)
    p_uid.set_defaults(func=cmd_set_uid)

    p_obs = sub.add_parser("record-observation", help="Append a TTF observation id for a user")
    p_obs.add_argument("--email", required=True)
    p_obs.add_argument("--observation-id", required=True)
    p_obs.set_defaults(func=cmd_record_observation)

    p_pick = sub.add_parser("pick-user", help="Pick a random registered user (JSON)")
    p_pick.add_argument(
        "--with-observations",
        action="store_true",
        help="Only users with at least one observation (for update_ttf)",
    )
    p_pick.set_defaults(func=cmd_pick_user)

    sub.add_parser("random-ttf", help="Print random valid TTF field values (JSON)").set_defaults(
        func=cmd_random_ttf
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
