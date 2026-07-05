"""Repo-relative paths shared across the synthetic_users package (#89)."""

from __future__ import annotations

from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent  # scripts/synthetic-users/synthetic_users
SCRIPTS_SYNTHETIC_DIR = PACKAGE_DIR.parent  # scripts/synthetic-users
SCRIPTS_DIR = SCRIPTS_SYNTHETIC_DIR.parent  # scripts
REPO_ROOT = SCRIPTS_DIR.parent  # repo root

SET_SYNTHETIC_CLAIM_SCRIPT = REPO_ROOT / "api" / "scripts" / "set_synthetic_claim.py"
DEFAULT_RUN_LOG_DIR = SCRIPTS_SYNTHETIC_DIR / "runs"
