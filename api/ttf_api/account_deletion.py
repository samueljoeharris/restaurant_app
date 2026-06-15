"""Server-side account deletion — Postgres contributions + Firebase Auth user."""

from __future__ import annotations

import hashlib
import logging
import time

from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions

from ttf_api.firebase_init import init_firebase
from ttf_api.db import get_conn

logger = logging.getLogger(__name__)


def _uid_hash(firebase_uid: str) -> str:
    return hashlib.sha256(firebase_uid.encode()).hexdigest()[:16]


def _delete_postgres_data(conn, firebase_uid: str) -> dict[str, int]:
    ttf = conn.execute(
        "DELETE FROM ttf_observations WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    attrs = conn.execute(
        "DELETE FROM restaurant_attribute_ratings WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    notes = conn.execute(
        "DELETE FROM restaurant_notes WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    return {"ttf": ttf, "attributes": attrs, "notes": notes}


def _revoke_and_delete_firebase_user(firebase_uid: str) -> None:
    init_firebase()
    try:
        firebase_auth.revoke_refresh_tokens(firebase_uid)
    except firebase_exceptions.NotFoundError:
        pass
    try:
        firebase_auth.delete_user(firebase_uid)
    except firebase_exceptions.NotFoundError:
        pass


def delete_user_account(firebase_uid: str, *, skip_firebase: bool = False) -> None:
    """Delete all user-authored data and the Firebase Auth record."""
    started = time.monotonic()
    uid_hash = _uid_hash(firebase_uid)

    with get_conn() as conn:
        counts = _delete_postgres_data(conn, firebase_uid)

    if not skip_firebase:
        _revoke_and_delete_firebase_user(firebase_uid)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "account_deleted uid_hash=%s ttf=%s attributes=%s notes=%s skip_firebase=%s elapsed_ms=%s",
        uid_hash,
        counts["ttf"],
        counts["attributes"],
        counts["notes"],
        skip_firebase,
        elapsed_ms,
    )
