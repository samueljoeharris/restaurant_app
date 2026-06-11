"""Refresh the configured pilot area's restaurant catalog from Google Places."""

from __future__ import annotations

import sys

from ttf_api.db import run_migrations
from ttf_api.places_seed import PlacesSeedError
from ttf_api.seed_jobs import run_default_refresh


def main() -> int:
    run_migrations()
    try:
        job = run_default_refresh(force=True)
    except PlacesSeedError as exc:
        print(exc, file=sys.stderr)
        return 1

    print(
        "Refresh complete — "
        f"status: {job['status']}, inserted: {job['inserted_count']}, "
        f"updated: {job['updated_count']}, closed: {job['closed_count']}, "
        f"outside area: {job['outside_area_count']}, unique places: {job['unique_places_count']}"
    )
    if job["status"] != "succeeded":
        print(job["error"] or "Refresh failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
