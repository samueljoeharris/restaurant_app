"""Server-side account deletion — Postgres contributions + Firebase Auth user."""

from __future__ import annotations

import hashlib
import logging
import time
from urllib.parse import unquote

from firebase_admin import auth as firebase_auth
from firebase_admin import exceptions as firebase_exceptions

from ttf_api.apple_sign_in import revoke_apple_tokens
from ttf_api.config import settings
from ttf_api.db import get_conn
from ttf_api.firebase_init import init_firebase

logger = logging.getLogger(__name__)


def _uid_hash(firebase_uid: str) -> str:
    return hashlib.sha256(firebase_uid.encode()).hexdigest()[:16]


def _collect_photo_urls(conn, firebase_uid: str) -> list[str]:
    rows = conn.execute(
        """
        SELECT photo_url FROM ttf_observations
        WHERE firebase_uid = %s AND photo_url IS NOT NULL AND photo_url <> ''
        """,
        (firebase_uid,),
    ).fetchall()
    return [row[0] for row in rows]


def _blob_name_from_url(url: str, bucket_name: str) -> str | None:
    if url.startswith(f"gs://{bucket_name}/"):
        return unquote(url[len(f"gs://{bucket_name}/") :])
    for prefix in (
        f"https://storage.googleapis.com/{bucket_name}/",
        f"https://{bucket_name}.storage.googleapis.com/",
    ):
        if url.startswith(prefix):
            return unquote(url[len(prefix) :])
    return None


def _delete_user_photos(photo_urls: list[str]) -> int:
    if not photo_urls or not settings.uploads_bucket_name:
        return 0
    try:
        from google.cloud import storage
    except ImportError:
        logger.warning("google_cloud_storage_unavailable skip_photo_cleanup")
        return 0

    client = storage.Client()
    bucket = client.bucket(settings.uploads_bucket_name)
    deleted = 0
    for url in photo_urls:
        blob_name = _blob_name_from_url(url, settings.uploads_bucket_name)
        if not blob_name:
            continue
        try:
            bucket.blob(blob_name).delete()
            deleted += 1
        except Exception as exc:
            logger.warning("photo_delete_failed url=%s err=%s", url, exc)
    return deleted


def _delete_postgres_data(conn, firebase_uid: str) -> dict[str, int]:
    watches = conn.execute(
        "DELETE FROM restaurant_watches WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    push_tokens = conn.execute(
        "DELETE FROM device_push_tokens WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    push_log = conn.execute(
        "DELETE FROM push_dispatch_log WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
    # user_notification_preferences cascades from user_profiles
    profiles = conn.execute(
        "DELETE FROM user_profiles WHERE firebase_uid = %s",
        (firebase_uid,),
    ).rowcount
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
    return {
        "watches": watches,
        "push_tokens": push_tokens,
        "push_log": push_log,
        "profiles": profiles,
        "ttf": ttf,
        "attributes": attrs,
        "notes": notes,
    }


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


def delete_user_account(
    firebase_uid: str,
    *,
    skip_firebase: bool = False,
    apple_authorization_code: str | None = None,
) -> None:
    """Delete all user-authored data and the Firebase Auth record."""
    started = time.monotonic()
    uid_hash = _uid_hash(firebase_uid)

    with get_conn() as conn:
        photo_urls = _collect_photo_urls(conn, firebase_uid)
        counts = _delete_postgres_data(conn, firebase_uid)

    photos_deleted = _delete_user_photos(photo_urls)

    if apple_authorization_code:
        revoke_apple_tokens(apple_authorization_code)

    if not skip_firebase:
        _revoke_and_delete_firebase_user(firebase_uid)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    logger.info(
        "account_deleted uid_hash=%s ttf=%s attributes=%s notes=%s photos=%s skip_firebase=%s elapsed_ms=%s",
        uid_hash,
        counts["ttf"],
        counts["attributes"],
        counts["notes"],
        photos_deleted,
        skip_firebase,
        elapsed_ms,
    )
