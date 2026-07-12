"""DB-backed tests for /v1/me/contributions filtering (#87).

The restaurant_id filter powers the "Log it again" prefill. Skipped unless
TTF_TEST_DATABASE_URL is set — see tests/conftest.py.
"""

from __future__ import annotations

from tests.conftest import auth_header

TTF_BODY = {
    "elapsed_minutes": 10,
    "item_type": "fries",
    "item_quality": 4,
    "portion_size": "kid",
    "daypart": "lunch",
    "party_size_kids": 2,
}


def test_contributions_filter_by_restaurant(client, make_restaurant, make_trusted_user):
    uid = make_trusted_user("copy-visit-user")
    rid_a = make_restaurant("Prefill A")
    rid_b = make_restaurant("Prefill B")

    assert (
        client.post(f"/v1/restaurants/{rid_a}/ttf", json=TTF_BODY, headers=auth_header(uid))
        .status_code
        == 201
    )
    assert (
        client.post(
            f"/v1/restaurants/{rid_a}/attributes",
            json={"metric_key": "high_chair_availability", "value": True},
            headers=auth_header(uid),
        ).status_code
        == 201
    )
    assert (
        client.post(f"/v1/restaurants/{rid_b}/ttf", json=TTF_BODY, headers=auth_header(uid))
        .status_code
        == 201
    )

    res = client.get(
        f"/v1/me/contributions?restaurant_id={rid_a}", headers=auth_header(uid)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["total"] == 2
    assert {item["restaurant_id"] for item in body["items"]} == {rid_a}
    assert {item["kind"] for item in body["items"]} == {"ttf", "attribute"}

    res = client.get(
        f"/v1/me/contributions?restaurant_id={rid_a}&kind=ttf", headers=auth_header(uid)
    )
    body = res.json()
    assert body["total"] == 1
    assert body["items"][0]["kind"] == "ttf"
    assert body["items"][0]["party_size_kids"] == 2

    # Unfiltered listing still sees both restaurants.
    res = client.get("/v1/me/contributions", headers=auth_header(uid))
    assert res.json()["total"] == 3


def test_contributions_list_reflects_pending_review(client, make_restaurant, make_trusted_user):
    """#129: the list endpoint's pending_review must mirror submit-time moderation
    status (moderation_status == 'pending'), not always report published.
    """
    rid = make_restaurant("Pending Review Spot")

    # A brand-new (untrusted) user's submissions are held for review — same
    # "new_user_hold" path exercised by test_integration_moderation.py.
    held_uid = "pending-review-new-user"
    ttf_submit = client.post(
        f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(held_uid)
    )
    assert ttf_submit.status_code == 201
    assert ttf_submit.json()["pending_review"] is True

    note_submit = client.post(
        f"/v1/restaurants/{rid}/notes",
        json={"text": "Waiting on review"},
        headers=auth_header(held_uid),
    )
    assert note_submit.status_code == 201
    assert note_submit.json()["pending_review"] is True

    attr_submit = client.post(
        f"/v1/restaurants/{rid}/attributes",
        json={"metric_key": "high_chair_availability", "value": True},
        headers=auth_header(held_uid),
    )
    assert attr_submit.status_code == 201
    assert attr_submit.json()["pending_review"] is True

    held_list = client.get("/v1/me/contributions", headers=auth_header(held_uid))
    assert held_list.status_code == 200
    held_items = held_list.json()["items"]
    assert len(held_items) == 3
    assert {item["kind"]: item["pending_review"] for item in held_items} == {
        "ttf": True,
        "note": True,
        "attribute": True,
    }

    # A trusted user auto-publishes, so the same list endpoint reports
    # pending_review False.
    trusted_uid = make_trusted_user("pending-review-trusted-user")
    trusted_submit = client.post(
        f"/v1/restaurants/{rid}/ttf", json=TTF_BODY, headers=auth_header(trusted_uid)
    )
    assert trusted_submit.status_code == 201
    assert trusted_submit.json()["pending_review"] is False

    trusted_list = client.get("/v1/me/contributions", headers=auth_header(trusted_uid))
    assert trusted_list.json()["items"][0]["pending_review"] is False
