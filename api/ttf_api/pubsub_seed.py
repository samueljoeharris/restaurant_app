"""Pub/Sub enqueue for durable restaurant seed jobs."""

from __future__ import annotations

import json
import logging
from uuid import UUID

from ttf_api.config import settings

logger = logging.getLogger(__name__)


def publish_seed_job(job_id: UUID) -> bool:
    """Publish a seed job id to Pub/Sub. Returns False when Pub/Sub is not configured."""
    topic = settings.restaurant_seed_pubsub_topic.strip()
    if not topic:
        return False

    try:
        from google.cloud import pubsub_v1
    except ImportError as exc:
        raise RuntimeError("google-cloud-pubsub is required when RESTAURANT_SEED_PUBSUB_TOPIC is set") from exc

    publisher = pubsub_v1.PublisherClient()
    data = json.dumps({"job_id": str(job_id)}).encode("utf-8")
    future = publisher.publish(topic, data)
    future.result(timeout=30)
    logger.info("Published seed job %s to %s", job_id, topic)
    return True


def enqueue_seed_job(job_id: UUID, background_tasks=None) -> None:
    """Enqueue a seed job via Pub/Sub, falling back to in-process execution locally."""
    if publish_seed_job(job_id):
        return

    if background_tasks is not None:
        from ttf_api.seed_jobs import run_seed_job

        background_tasks.add_task(run_seed_job, job_id)
        return

    from ttf_api.seed_jobs import run_seed_job

    run_seed_job(job_id)
