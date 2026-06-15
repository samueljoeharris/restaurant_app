"""Tests for the ETag/Cache-Control HTTP caching middleware.

These build a tiny local FastAPI app rather than importing ttf_api.main, which
transitively imports psycopg/firebase (not installed in the test env).
"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from ttf_api.http_cache import CACHE_CONTROL, ETagMiddleware, compute_etag


def test_compute_etag_is_stable_for_same_bytes() -> None:
    assert compute_etag(b"hello") == compute_etag(b"hello")


def test_compute_etag_differs_for_different_bytes() -> None:
    assert compute_etag(b"hello") != compute_etag(b"world")


def test_compute_etag_is_quoted() -> None:
    etag = compute_etag(b"hello")
    assert etag.startswith('"') and etag.endswith('"')


def _build_app() -> FastAPI:
    app = FastAPI()
    app.add_middleware(ETagMiddleware)

    @app.get("/v1/metrics")
    def metrics() -> dict:
        return {"value": 42}

    @app.get("/other")
    def other() -> dict:
        return {"value": 1}

    @app.post("/v1/metrics")
    def create() -> dict:
        return {"created": True}

    return app


def test_cacheable_get_has_etag_and_cache_control() -> None:
    client = TestClient(_build_app())
    resp = client.get("/v1/metrics")
    assert resp.status_code == 200
    assert resp.headers["ETag"]
    assert resp.headers["Cache-Control"] == CACHE_CONTROL


def test_matching_if_none_match_returns_304_empty_body() -> None:
    client = TestClient(_build_app())
    first = client.get("/v1/metrics")
    etag = first.headers["ETag"]

    second = client.get("/v1/metrics", headers={"If-None-Match": etag})
    assert second.status_code == 304
    assert second.content == b""
    assert second.headers["ETag"] == etag
    assert second.headers["Cache-Control"] == CACHE_CONTROL


def test_wrong_if_none_match_returns_200_with_body() -> None:
    client = TestClient(_build_app())
    resp = client.get("/v1/metrics", headers={"If-None-Match": '"deadbeef"'})
    assert resp.status_code == 200
    assert resp.json() == {"value": 42}
    assert resp.headers["ETag"]


def test_non_cacheable_path_has_no_etag() -> None:
    client = TestClient(_build_app())
    resp = client.get("/other")
    assert resp.status_code == 200
    assert "ETag" not in resp.headers


def test_post_is_untouched() -> None:
    client = TestClient(_build_app())
    resp = client.post("/v1/metrics")
    assert resp.status_code == 200
    assert "ETag" not in resp.headers
