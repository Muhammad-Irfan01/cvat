# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from cvat.apps.engine.models import Task

from .notifications import publish_task_changed


@receiver(post_save, sender=Task, dispatch_uid="test.notify_label_counts_changed")
def notify_label_counts_changed(sender, instance: Task, update_fields=None, **kwargs):
    # Every change to a job's annotations ends in JobAnnotation._set_updated_date()
    # (cvat/apps/dataset_manager/task.py), which touches the task: a save with
    # update_fields={"updated_date"}. That covers drawing in the UI, the annotations
    # API and imports, without changing CVAT's own code.
    if update_fields and "updated_date" in update_fields:
        # Publish only once the annotations are committed, otherwise the page
        # could re-read the counts before the new annotations are visible.
        transaction.on_commit(lambda: publish_task_changed(instance.id))
