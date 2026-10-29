# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from cvat.apps.engine.permissions import TaskPermission


class TaskLabelCountsPermission:
    """
    A user may read the label counts of a task exactly when they may read its
    annotations. Instead of writing a new rule, this hands the decision to
    CVAT's existing task rule for the "view:annotations" scope
    (cvat/apps/engine/rules/tasks.rego).
    """

    @classmethod
    def create(cls, request, view, obj, iam_context):
        return [
            TaskPermission.create_base_perm(
                request, view, TaskPermission.Scopes.VIEW_ANNOTATIONS, iam_context, obj
            )
        ]
