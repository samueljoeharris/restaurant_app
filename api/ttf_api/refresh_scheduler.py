"""Sync location_refresh_config to the Cloud Scheduler restaurant refresh job."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

from google.api_core import exceptions as gcp_exceptions
from google.cloud import scheduler_v1
from google.protobuf import field_mask_pb2

from ttf_api.config import settings

logger = logging.getLogger(__name__)

_CRON_RE = re.compile(r"^(\S+\s+){4,5}\S+$")


@dataclass(frozen=True)
class SchedulerSyncResult:
    status: str  # synced | skipped | failed
    detail: str | None = None


def validate_scheduler_cron(cron: str) -> None:
    if not _CRON_RE.match(cron.strip()):
        raise ValueError("Schedule must be a valid cron expression (5 or 6 fields)")


def sync_refresh_scheduler(config: dict) -> SchedulerSyncResult:
    """Apply DB refresh config to the Cloud Scheduler job (schedule, timezone, paused)."""
    job_id = settings.restaurant_refresh_scheduler_job.strip()
    if not job_id:
        return SchedulerSyncResult(
            status="skipped",
            detail="RESTAURANT_REFRESH_SCHEDULER_JOB is not configured",
        )

    project = settings.firebase_project_id
    region = settings.gcp_region.strip()
    if not region:
        return SchedulerSyncResult(
            status="skipped",
            detail="GCP_REGION is not configured",
        )

    try:
        validate_scheduler_cron(config["schedule_cron"])
    except ValueError as exc:
        return SchedulerSyncResult(status="failed", detail=str(exc))

    client = scheduler_v1.CloudSchedulerClient()
    job_name = client.job_path(project, region, job_id)

    try:
        job = client.get_job(name=job_name)
    except gcp_exceptions.NotFound:
        return SchedulerSyncResult(
            status="failed",
            detail=f"Cloud Scheduler job not found: {job_name}",
        )
    except gcp_exceptions.GoogleAPICallError as exc:
        logger.exception("Failed to load Cloud Scheduler job %s", job_name)
        return SchedulerSyncResult(status="failed", detail=str(exc))

    job.schedule = config["schedule_cron"]
    job.time_zone = config["schedule_timezone"]

    try:
        client.update_job(
            job=job,
            update_mask=field_mask_pb2.FieldMask(paths=["schedule", "time_zone"]),
        )
    except gcp_exceptions.GoogleAPICallError as exc:
        logger.exception("Failed to update Cloud Scheduler job %s", job_name)
        return SchedulerSyncResult(status="failed", detail=str(exc))

    try:
        if config["enabled"]:
            client.resume_job(name=job_name)
        else:
            client.pause_job(name=job_name)
    except gcp_exceptions.GoogleAPICallError as exc:
        logger.exception("Failed to pause/resume Cloud Scheduler job %s", job_name)
        return SchedulerSyncResult(status="failed", detail=str(exc))

    state = "enabled" if config["enabled"] else "paused"
    return SchedulerSyncResult(
        status="synced",
        detail=f"{job_id} schedule updated; job {state}",
    )
