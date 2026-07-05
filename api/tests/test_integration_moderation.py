"""DB-backed integration tests for moderation approve/reject and aggregate
exclusion (#62 §2).

Skipped unless TTF_TEST_DATABASE_URL is set — see tests/conftest.py.
"""

from __future__ import annotations

from tests.conftest import ADMIN_UID, auth_header

TTF_BODY = {
    "elapsed_minutes": 10,
    "item_type": "fries",
    "item_quality": 4,
    "portion_size": "kid",
    "daypart": "lunch",
    "party_size_kids": 1,
}


def _pending_item_id(client, rid: str, content_type: str) -> str:
    queue = client.get(
        "/v1/admin/moderation",
        params={"status": "pending", "content_type": content_type},
        headers=auth_header(ADMIN_UID),
    )
    assert queue.status_code == 200
    items = [i for i in queue.json()["items"] if i["restaurant_id"] == rid]
    assert len(items) == 1
    return items[0]["id"]


def test_new_user_note_held_then_approved_and_published(client, make_restaurant):
    rid = make_restaurant()
    created = client.post(
        f"/v1/restaurants/{rid}/notes",
        json={"text": "Great high chairs"},
        headers=auth_header("mod-new-user"),
    )
    assert created.status_code == 201
    assert created.json()["pending_review"] is True

    # Held content is not publicly visible and emits no activity yet.
    notes = client.get(f"/v1/restaurants/{rid}/notes")
    assert notes.json()["notes"] == []

    item_id = _pending_item_id(client, rid, "note")
    approved = client.post(
        f"/v1/admin/moderation/{item_id}/approve",
        json={"review_notes": "looks fine"},
        headers=auth_header(ADMIN_UID),
    )
    assert approved.status_code == 200

    notes = client.get(f"/v1/restaurants/{rid}/notes").json()["notes"]
    assert len(notes) == 1
    assert notes[0]["text"] == "Great high chairs"


def test_approve_emits_activity_for_watchers(client, make_restaurant, make_trusted_user):
    rid = make_restaurant()
    watcher = make_trusted_user("mod-watcher")
    client.post(f"/v1/me/watches/{rid}", headers=auth_header(watcher))

    client.post(
        f"/v1/restaurants/{rid}/notes",
        json={"text": "Crayons at the door"},
        headers=auth_header("mod-held-author"),
    )
    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 0  # held → no event yet

    item_id = _pending_item_id(client, rid, "note")
    client.post(
        f"/v1/admin/moderation/{item_id}/approve",
        json={},
        headers=auth_header(ADMIN_UID),
    )
    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 1


def test_rejected_note_stays_hidden(client, db, make_restaurant):
    rid = make_restaurant()
    client.post(
        f"/v1/restaurants/{rid}/notes",
        json={"text": "spammy text"},
        headers=auth_header("mod-rejected-user"),
    )
    item_id = _pending_item_id(client, rid, "note")
    rejected = client.post(
        f"/v1/admin/moderation/{item_id}/reject",
        json={"review_notes": "spam"},
        headers=auth_header(ADMIN_UID),
    )
    assert rejected.status_code == 200

    assert client.get(f"/v1/restaurants/{rid}/notes").json()["notes"] == []
    with db() as conn:
        row = conn.execute(
            "SELECT moderation_status, visibility FROM restaurant_notes WHERE restaurant_id = %s",
            (rid,),
        ).fetchone()
    assert row["moderation_status"] == "rejected"
    assert row["visibility"] == "removed"


def test_pending_ttf_excluded_from_aggregate_until_approved(client, make_restaurant):
    rid = make_restaurant()
    created = client.post(
        f"/v1/restaurants/{rid}/ttf",
        json=TTF_BODY,
        headers=auth_header("mod-ttf-new-user"),
    )
    assert created.status_code == 201
    assert created.json()["pending_review"] is True

    agg = client.get(f"/v1/restaurants/{rid}/ttf").json()
    assert agg["sample_size"] == 0

    item_id = _pending_item_id(client, rid, "ttf_observation")
    client.post(
        f"/v1/admin/moderation/{item_id}/approve",
        json={},
        headers=auth_header(ADMIN_UID),
    )

    agg = client.get(f"/v1/restaurants/{rid}/ttf").json()
    assert agg["sample_size"] == 1
    assert agg["median_minutes"] == 10


def test_exclude_and_restore_observation_updates_aggregate(
    client, db, make_restaurant, make_trusted_user
):
    rid = make_restaurant()
    user = make_trusted_user("mod-excluder")
    for minutes in (10, 30):
        res = client.post(
            f"/v1/restaurants/{rid}/ttf",
            json={**TTF_BODY, "elapsed_minutes": minutes},
            headers=auth_header(user),
        )
        assert res.status_code == 201
        assert res.json()["pending_review"] is False

    agg = client.get(f"/v1/restaurants/{rid}/ttf").json()
    assert agg["sample_size"] == 2
    assert agg["median_minutes"] == 20

    with db() as conn:
        slow_id = conn.execute(
            "SELECT id FROM ttf_observations WHERE restaurant_id = %s AND elapsed_minutes = 30",
            (rid,),
        ).fetchone()["id"]

    excluded = client.post(
        f"/v1/admin/observations/{slow_id}/exclude",
        json={"reason": "test outlier"},
        headers=auth_header(ADMIN_UID),
    )
    assert excluded.status_code == 200
    agg = client.get(f"/v1/restaurants/{rid}/ttf").json()
    assert agg["sample_size"] == 1
    assert agg["median_minutes"] == 10

    restored = client.post(
        f"/v1/admin/observations/{slow_id}/restore",
        headers=auth_header(ADMIN_UID),
    )
    assert restored.status_code == 200
    agg = client.get(f"/v1/restaurants/{rid}/ttf").json()
    assert agg["sample_size"] == 2
    assert agg["median_minutes"] == 20


def test_moderation_endpoints_require_admin(client, make_restaurant):
    rid = make_restaurant()
    client.post(
        f"/v1/restaurants/{rid}/notes",
        json={"text": "needs review"},
        headers=auth_header("mod-plain-user"),
    )
    queue = client.get("/v1/admin/moderation", headers=auth_header("mod-plain-user"))
    assert queue.status_code == 403
