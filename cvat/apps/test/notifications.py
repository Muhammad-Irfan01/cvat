# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

"""
Tells open label-counts pages that a task's annotations changed.

Annotations are saved by several processes (each uvicorn worker, and the RQ
workers that import annotations), and the page's WebSocket is held by one
uvicorn worker. Redis pub/sub connects them: savers publish the task id,
every WebSocket of that task is subscribed to it.

The message carries no counts. The page re-reads them over HTTP, so the
access check and the counting code stay in one place.
"""

import logging

import redis
import redis.asyncio
from django.conf import settings

logger = logging.getLogger(__name__)


def task_channel(task_id: int) -> str:
    return f"test:label-counts:task:{task_id}"


def _redis_options() -> dict:
    return {
        "host": settings.REDIS_INMEM_SETTINGS["HOST"],
        "port": settings.REDIS_INMEM_SETTINGS["PORT"],
        "password": settings.REDIS_INMEM_SETTINGS["PASSWORD"] or None,
    }


def publish_task_changed(task_id: int) -> None:
    # A lost notification only delays the chart until the next change or reload,
    # so a Redis problem must never fail the annotation save that triggered it.
    try:
        with redis.Redis(**_redis_options()) as client:
            client.publish(task_channel(task_id), "changed")
    except redis.RedisError:
        logger.warning("Could not publish label counts change of task %s", task_id, exc_info=True)


def async_redis_client() -> redis.asyncio.Redis:
    return redis.asyncio.Redis(**_redis_options())
