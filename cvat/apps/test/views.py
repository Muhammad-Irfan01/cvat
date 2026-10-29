# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from drf_spectacular.utils import extend_schema
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from cvat.apps.engine.models import Task

from .permissions import TaskLabelCountsPermission
from .queries import count_annotations_per_label
from .serializers import TaskLabelCountsSerializer


@extend_schema(tags=["test"])
class TaskLabelCountsViewSet(viewsets.GenericViewSet):
    queryset = Task.objects.select_related("project", "organization")
    iam_permission_class = TaskLabelCountsPermission

    # The task is looked up by id only. Without this, CVAT's default list
    # filters would try to read query parameters as filters on tasks.
    filter_backends = []

    @extend_schema(
        summary="Get the number of annotations per label in a task",
        responses=TaskLabelCountsSerializer,
    )
    @action(detail=True, methods=["GET"], url_path="label-counts")
    def label_counts(self, request, pk):
        # get_object() runs the permission check: 404 if the task does not
        # exist, 403 if the user may not view its annotations.
        task = self.get_object()

        serializer = TaskLabelCountsSerializer(count_annotations_per_label(task))
        return Response(serializer.data)
