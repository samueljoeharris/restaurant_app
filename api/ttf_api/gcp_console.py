"""Deep links into Google Cloud Console for seed/refresh infrastructure."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from urllib.parse import quote

from ttf_api.config import settings

LOG_WINDOW_PAD = timedelta(minutes=5)


def _project() -> str:
    return settings.firebase_project_id


def _region() -> str:
    return settings.gcp_region.strip() or "us-central1"


def seed_job_log_marker(job_id: str) -> str:
    return f"[seed_job:{job_id}]"


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def seed_job_logs_url(
    job_id: str,
    *,
    created_at: datetime,
    started_at: datetime | None = None,
    finished_at: datetime | None = None,
) -> str:
    """Cloud Logging query for one seed run's stdout on ttf-api."""
    project = _project()
    service = settings.cloud_run_api_service
    marker = seed_job_log_marker(job_id)
    query = (
        f'resource.type="cloud_run_revision"\n'
        f'resource.labels.service_name="{service}"\n'
        f'("{marker}" OR "{job_id}")'
    )
    start = _as_utc(started_at or created_at) - LOG_WINDOW_PAD
    end = _as_utc(finished_at or datetime.now(tz=UTC)) + LOG_WINDOW_PAD
    return (
        f"https://console.cloud.google.com/logs/query;"
        f"query={quote(query, safe='')};"
        f"startTime={quote(start.isoformat(), safe='')};"
        f"endTime={quote(end.isoformat(), safe='')}"
        f"?project={project}"
    )


def cloud_run_service_url() -> str:
    project = _project()
    region = _region()
    service = settings.cloud_run_api_service
    return (
        f"https://console.cloud.google.com/run/detail/{region}/{service}"
        f"/logs?project={project}"
    )


def pubsub_subscription_url() -> str | None:
    name = settings.restaurant_seed_pubsub_subscription.strip()
    if not name:
        return None
    return (
        f"https://console.cloud.google.com/cloudpubsub/subscription/detail/{name}"
        f"?project={_project()}"
    )


def pubsub_topic_url() -> str | None:
    topic = settings.restaurant_seed_pubsub_topic.strip()
    if not topic:
        return None
    short_name = topic.rsplit("/", 1)[-1]
    return (
        f"https://console.cloud.google.com/cloudpubsub/topic/detail/{short_name}"
        f"?project={_project()}"
    )


def scheduler_job_url() -> str | None:
    name = settings.restaurant_refresh_scheduler_job.strip()
    if not name:
        return None
    return (
        f"https://console.cloud.google.com/cloudscheduler/jobs/edit/{_region()}/{name}"
        f"?project={_project()}"
    )


def gcp_links_for_seed_job(job: dict) -> dict:
    """Per-run and shared GCP console links for admin UI."""
    return {
        "run_logs_url": seed_job_logs_url(
            str(job["id"]),
            created_at=job["created_at"],
            started_at=job.get("started_at"),
            finished_at=job.get("finished_at"),
        ),
        "cloud_run_url": cloud_run_service_url(),
        "pubsub_subscription_url": pubsub_subscription_url(),
        "pubsub_topic_url": pubsub_topic_url(),
        "scheduler_url": scheduler_job_url(),
    }
