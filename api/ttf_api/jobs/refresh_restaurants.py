"""Refresh all requested locations and the full restaurant catalog from Google Places."""

from __future__ import annotations

import sys

from ttf_api.db import run_migrations
from ttf_api.places_seed import PlacesSeedError
from ttf_api.seed_jobs import create_scheduled_refresh_jobs, get_seed_job, run_seed_job


def main() -> int:
    run_migrations()
    failed = False
    try:
        jobs = create_scheduled_refresh_jobs()
        if not jobs:
            print("Auto-refresh disabled in location_refresh_config")
            return 0

        for created in jobs:
            run_seed_job(created["id"])
            job = get_seed_job(created["id"])
            if not job:
                raise PlacesSeedError("Refresh job disappeared before completion")
            print(
                f"[{job['kind']}] {job['query'] or job['area_key']} — "
                f"status: {job['status']}, inserted: {job['inserted_count']}, "
                f"updated: {job['updated_count']}, closed: {job['closed_count']}, "
                f"tombstoned: {job.get('tombstoned_count', 0)}, "
                f"unique places: {job['unique_places_count']}"
            )
            if job["status"] != "succeeded":
                print(job["error"] or "Refresh failed", file=sys.stderr)
                failed = True
    except PlacesSeedError as exc:
        print(exc, file=sys.stderr)
        return 1

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
