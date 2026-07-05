"""Shared fixtures for API tests.

DB-backed integration tests run only when TTF_TEST_DATABASE_URL points at a
disposable Postgres database (its contents are truncated between tests):

    TTF_TEST_DATABASE_URL=postgresql://ttf_app:ttf_local@localhost:5432/ttf_test \
        python -m pytest tests -q

Without the variable those tests skip, so plain `pytest` stays runnable with
no database (matching the unit-test-only CI gate).
"""

from __future__ import annotations

import os

import pytest

TEST_DB_ENV = "TTF_TEST_DATABASE_URL"

ADMIN_UID = "it-admin"


def auth_header(uid: str) -> dict[str, str]:
    """Dev-mode bearer header (AUTH_DEV_MODE resolves dev:<uid> tokens)."""
    return {"Authorization": f"Bearer dev:{uid}"}


@pytest.fixture(scope="session")
def integration_app():
    url = os.environ.get(TEST_DB_ENV)
    if not url:
        pytest.skip(f"{TEST_DB_ENV} not set — DB-backed integration tests skipped")

    from ttf_api.config import settings

    settings.database_url = url
    settings.auth_dev_mode = True
    settings.auth_dev_admin_uids = ADMIN_UID
    settings.app_check_enforce = False
    settings.moderation_enabled = True
    settings.moderation_new_user_hold = True

    from ttf_api.db import run_migrations

    run_migrations()

    from ttf_api.main import app

    return app


@pytest.fixture(scope="session")
def client(integration_app):
    from fastapi.testclient import TestClient

    # No lifespan context: migrations already ran above, and startup would
    # only re-run them.
    return TestClient(integration_app)


@pytest.fixture()
def db(integration_app):
    """Reset mutable state between tests (schema + seeded metrics survive)."""
    from ttf_api.db import get_conn

    with get_conn() as conn:
        conn.execute(
            """
            TRUNCATE restaurants, user_profiles, admin_audit_log,
                     content_reports RESTART IDENTITY CASCADE
            """
        )
    yield get_conn


@pytest.fixture()
def make_restaurant(db):
    """Insert a catalog restaurant directly and return its id as str."""

    def _make(name: str = "Testaurant") -> str:
        with db() as conn:
            row = conn.execute(
                """
                INSERT INTO restaurants (name, address, lat, lng, pilot_city)
                VALUES (%s, '1 Main St', 42.24, -71.17, 'dedham-ma')
                RETURNING id
                """,
                (name,),
            ).fetchone()
        return str(row["id"])

    return _make


@pytest.fixture()
def make_trusted_user(db):
    """Create a user profile whose submissions publish immediately."""

    def _make(uid: str) -> str:
        with db() as conn:
            conn.execute(
                """
                INSERT INTO user_profiles (firebase_uid, trust_level, auto_publish)
                VALUES (%s, 'trusted', TRUE)
                ON CONFLICT (firebase_uid)
                DO UPDATE SET trust_level = 'trusted', auto_publish = TRUE
                """,
                (uid,),
            )
        return uid

    return _make
