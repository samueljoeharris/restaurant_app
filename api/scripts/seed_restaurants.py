#!/usr/bin/env python3
"""Seed/refresh restaurants for the default area from Google Places API (New)."""

from __future__ import annotations

import sys

from ttf_api.config import settings
from ttf_api.db import run_migrations
from ttf_api.places_seed import PlacesSeedError
from ttf_api.seed_jobs import run_default_refresh


def main() -> int:
    if not settings.maps_api_key.strip():
        print("MAPS_API_KEY is required. Add it to .env at repo root, then re-run.", file=sys.stderr)
        return 1

    run_migrations()
    try:
        job = run_default_refresh(force=True)
    except PlacesSeedError as exc:
        print(exc, file=sys.stderr)
        return 1

    print(
        f"Done — inserted: {job['inserted_count']}, updated: {job['updated_count']}, "
        f"closed: {job['closed_count']}, outside area: {job['outside_area_count']}, "
        f"out of area: {job['out_of_area_count']}, skipped: {job['skipped_count']}, "
        f"unique places: {job['unique_places_count']}"
    )
    if job["status"] != "succeeded":
        print(job["error"] or "Seed failed", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
