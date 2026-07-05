"""DB-backed integration tests for watchlist + activity inbox (#61 §3).

Covers watch idempotency, inbox excluding the actor's own events, the
mark-read watermark, and restaurant-deletion cascade. Skipped unless
TTF_TEST_DATABASE_URL is set — see tests/conftest.py.
"""

from __future__ import annotations

from datetime import datetime, timezone

from tests.conftest import auth_header

TTF_BODY = {
    "elapsed_minutes": 10,
    "item_type": "fries",
    "item_quality": 4,
    "portion_size": "kid",
    "daypart": "lunch",
    "party_size_kids": 1,
}


def test_watch_is_idempotent(client, make_restaurant):
    rid = make_restaurant()
    first = client.post(f"/v1/me/watches/{rid}", headers=auth_header("watcher-1"))
    assert first.status_code == 201
    second = client.post(f"/v1/me/watches/{rid}", headers=auth_header("watcher-1"))
    assert second.status_code == 201

    listing = client.get("/v1/me/watches", headers=auth_header("watcher-1"))
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 1
    assert len(body["items"]) == 1
    assert body["items"][0]["restaurant"]["id"] == rid


def test_unwatch_removes_watch_and_404s_when_absent(client, make_restaurant):
    rid = make_restaurant()
    client.post(f"/v1/me/watches/{rid}", headers=auth_header("watcher-2"))

    gone = client.delete(f"/v1/me/watches/{rid}", headers=auth_header("watcher-2"))
    assert gone.status_code == 204
    again = client.delete(f"/v1/me/watches/{rid}", headers=auth_header("watcher-2"))
    assert again.status_code == 404

    listing = client.get("/v1/me/watches", headers=auth_header("watcher-2"))
    assert listing.json()["total"] == 0


def test_inbox_excludes_own_contributions(client, make_restaurant, make_trusted_user):
    rid = make_restaurant()
    watcher = make_trusted_user("inbox-watcher")
    contributor = make_trusted_user("inbox-contributor")
    client.post(f"/v1/me/watches/{rid}", headers=auth_header(watcher))

    # The watcher's own submission must not show up in their inbox.
    own = client.post(f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(watcher))
    assert own.status_code == 201
    assert own.json()["pending_review"] is False  # trusted → published

    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 0

    # Another user's submission does.
    other = client.post(
        f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(contributor)
    )
    assert other.status_code == 201

    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 1

    inbox = client.get("/v1/me/activity", headers=auth_header(watcher))
    items = inbox.json()["items"]
    assert len(items) == 1
    assert items[0]["event_type"] == "ttf"
    assert items[0]["restaurant_id"] == rid


def test_mark_read_watermark(client, make_restaurant, make_trusted_user):
    rid = make_restaurant()
    watcher = make_trusted_user("read-watcher")
    contributor = make_trusted_user("read-contributor")
    client.post(f"/v1/me/watches/{rid}", headers=auth_header(watcher))
    client.post(f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(contributor))

    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 1

    marked = client.post(
        "/v1/me/activity/mark-read",
        json={"through": datetime.now(timezone.utc).isoformat()},
        headers=auth_header(watcher),
    )
    assert marked.status_code == 200
    assert marked.json()["unread_count"] == 0

    # Watermark only moves forward: an older `through` cannot regress it.
    regressed = client.post(
        "/v1/me/activity/mark-read",
        json={"through": "2000-01-01T00:00:00+00:00"},
        headers=auth_header(watcher),
    )
    assert regressed.json()["unread_count"] == 0


def test_restaurant_deletion_cascades_watches_and_activity(
    client, db, make_restaurant, make_trusted_user
):
    rid = make_restaurant()
    watcher = make_trusted_user("cascade-watcher")
    contributor = make_trusted_user("cascade-contributor")
    client.post(f"/v1/me/watches/{rid}", headers=auth_header(watcher))
    client.post(f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(contributor))

    with db() as conn:
        conn.execute("DELETE FROM restaurants WHERE id = %s", (rid,))
        watches = conn.execute(
            "SELECT COUNT(*)::int AS n FROM restaurant_watches WHERE restaurant_id = %s",
            (rid,),
        ).fetchone()["n"]
        events = conn.execute(
            "SELECT COUNT(*)::int AS n FROM activity_events WHERE restaurant_id = %s",
            (rid,),
        ).fetchone()["n"]
    assert watches == 0
    assert events == 0

    listing = client.get("/v1/me/watches", headers=auth_header(watcher))
    assert listing.json()["total"] == 0
    unread = client.get("/v1/me/activity/unread-count", headers=auth_header(watcher))
    assert unread.json()["unread_count"] == 0
