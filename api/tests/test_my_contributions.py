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
