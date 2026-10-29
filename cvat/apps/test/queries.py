# Copyright (C) CVAT.ai Corporation
#
# SPDX-License-Identifier: MIT

from collections import Counter, defaultdict

from django.db.models import Count

from cvat.apps.engine.models import JobType, LabeledImage, LabeledShape, LabeledTrack, Task


def count_annotations_per_label(task: Task) -> dict:
    """
    Count the annotations of a task, grouped by label and, inside each label,
    by annotation type.

    - Shapes, tracks and tags each count as one annotation.
      A track counts once, not once per frame it appears on.
    - Shapes are split by their shape type (rectangle, polygon, mask, ...).
      Tracks and tags have no single shape type, so they are counted under
      "track" and "tag".
    - Skeleton points are shapes with a parent. They belong to their skeleton,
      so only the skeleton itself is counted.
    - Ground truth jobs are skipped. They re-annotate frames that the regular
      jobs already cover, so including them would count those frames twice.

    Every label of the task is returned, including labels with no annotations,
    so the chart can show a zero bar instead of hiding the label.
    """
    annotations_in_task = {
        "job__segment__task_id": task.id,
        "job__type": JobType.ANNOTATION,
    }
    shapes = LabeledShape.objects.filter(**annotations_in_task, parent__isnull=True)
    tracks = LabeledTrack.objects.filter(**annotations_in_task, parent__isnull=True)
    tags = LabeledImage.objects.filter(**annotations_in_task)

    # One GROUP BY query per annotation table. The database does the counting
    # and sends back one row per label (and shape type), not one row per annotation.
    counts_by_type = defaultdict(Counter)
    for row in shapes.values("label_id", "type").annotate(count=Count("id")):
        counts_by_type[row["label_id"]][row["type"]] += row["count"]
    for row in tracks.values("label_id").annotate(count=Count("id")):
        counts_by_type[row["label_id"]]["track"] += row["count"]
    for row in tags.values("label_id").annotate(count=Count("id")):
        counts_by_type[row["label_id"]]["tag"] += row["count"]

    labels = [
        {
            "id": label.id,
            "name": label.name,
            "color": label.color,
            "count": counts_by_type[label.id].total(),
            "by_type": dict(counts_by_type[label.id]),
        }
        for label in task.get_labels()
    ]
    labels.sort(key=lambda label: (-label["count"], label["name"]))

    return {
        "task_id": task.id,
        "total": sum(label["count"] for label in labels),
        "labels": labels,
    }
