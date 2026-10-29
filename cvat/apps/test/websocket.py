# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

"""
WebSocket at /api/test/ws/tasks/<id>/label-counts.

The page opens it next to the label counts chart. After a successful access
check the socket sends {"event": "label_counts_changed", "task_id": <id>}
each time the task's annotations change, and the page re-reads the counts.

CVAT has no WebSocket support (no Django Channels), so this is a small plain
ASGI app placed in front of Django in cvat/asgi.py. It handles only this path
and leaves every HTTP request to Django.

If the check fails the socket is accepted and closed at once with a code the
page can show, because a socket refused before "accept" gives the browser no
reason at all:
  4401 not logged in, 4403 no access to the task (or foreign origin),
  4404 task does not exist.
"""

import asyncio
import io
import json
import re
from importlib import import_module
from urllib.parse import urlsplit

from asgiref.sync import sync_to_async
from django.conf import settings
from django.contrib.auth import get_user
from django.core.handlers.asgi import ASGIRequest
from django.db import close_old_connections

from cvat.apps.engine.models import Task
from cvat.apps.iam.middleware import get_organization as get_request_iam_context
from cvat.apps.iam.permissions import get_iam_context

from .notifications import async_redis_client, task_channel
from .permissions import TaskLabelCountsPermission

LABEL_COUNTS_PATH = re.compile(r"^/api/test/ws/tasks/(?P<task_id>\d+)/label-counts$")

CLOSE_NOT_LOGGED_IN = 4401
CLOSE_FORBIDDEN = 4403
CLOSE_TASK_NOT_FOUND = 4404


def with_label_counts_websocket(django_application):
    """Wraps CVAT's ASGI application so that it also serves the label counts WebSocket."""

    async def application(scope, receive, send):
        if scope["type"] != "websocket":
            return await django_application(scope, receive, send)

        match = LABEL_COUNTS_PATH.match(scope["path"])
        if match:
            return await serve_label_counts(scope, receive, send, int(match["task_id"]))

        # Django cannot handle WebSockets, and CVAT has no other WebSocket endpoint.
        await receive()
        await send({"type": "websocket.close"})

    return application


def _check_access(scope, task_id: int) -> int | None:
    """
    Runs the same checks as the HTTP endpoint. Returns a close code when the
    connection must be refused, or None when it is allowed.
    """
    # Same database connection handling as Django does around a request.
    close_old_connections()
    try:
        # ASGIRequest builds headers, cookies and query parameters from the scope.
        request = ASGIRequest({**scope, "method": "GET"}, io.BytesIO())

        # Browsers send cookies with WebSockets to any site, so a page on another
        # origin could open this socket as the user. Only CVAT's own pages may.
        origin = request.headers.get("Origin")
        if origin and urlsplit(origin).netloc != request.get_host():
            return CLOSE_FORBIDDEN

        # The browser logs in with CVAT's session cookie.
        session_store = import_module(settings.SESSION_ENGINE).SessionStore
        request.session = session_store(request.COOKIES.get(settings.SESSION_COOKIE_NAME))
        request.user = get_user(request)
        if not request.user.is_authenticated:
            return CLOSE_NOT_LOGGED_IN

        task = Task.objects.select_related("project", "organization").filter(id=task_id).first()
        if task is None:
            return CLOSE_TASK_NOT_FOUND

        request.iam_context = get_request_iam_context(request)
        iam_context = get_iam_context(request, task)
        permissions = TaskLabelCountsPermission.create(request, None, task, iam_context)
        if not all(permission.check_access().allow for permission in permissions):
            return CLOSE_FORBIDDEN

        return None
    finally:
        close_old_connections()


async def serve_label_counts(scope, receive, send, task_id: int) -> None:
    message = await receive()
    if message["type"] != "websocket.connect":
        return

    await send({"type": "websocket.accept"})

    close_code = await sync_to_async(_check_access)(scope, task_id)
    if close_code is not None:
        await send({"type": "websocket.close", "code": close_code})
        return

    redis_client = async_redis_client()
    pubsub = redis_client.pubsub()
    await pubsub.subscribe(task_channel(task_id))
    change_event = json.dumps({"event": "label_counts_changed", "task_id": task_id})

    async def forward_changes() -> None:
        async for redis_message in pubsub.listen():
            if redis_message["type"] == "message":
                await send({"type": "websocket.send", "text": change_event})

    forwarder = asyncio.create_task(forward_changes())
    try:
        # The page sends nothing; wait until it goes away.
        while (await receive())["type"] != "websocket.disconnect":
            pass
    finally:
        forwarder.cancel()
        await pubsub.unsubscribe()
        await pubsub.aclose()
        await redis_client.aclose()
