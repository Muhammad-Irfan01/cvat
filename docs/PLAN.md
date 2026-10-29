# Plan — Annotation Analytics (CVAT)

Branch `dev-test01`. This file is the first commit on the branch, before any code.
If the plan changes, I add a dated note under **Changes** instead of rewriting the plan.

## Environment

| Item | Value |
|---|---|
| CVAT commit cloned | `4a09e27ff869b7aebbfdb07b29c4a34904a0221d` (upstream `develop`, 28 Oct 2026) |
| CPU | Intel Core i7-10850H @ 2.70 GHz, 6 cores / 12 threads |
| RAM | 22 GiB |
| OS | Ubuntu 26.04.1 LTS, kernel 7.0.0-42-generic |
| Docker | 29.1.3, Compose 2.40.3 |
| Dataset | COCO 2017 val, `instances_val2017.json`, __N__ images (filled in after import) |

## Goal

A per-task count of annotations by label: an API read from the database, a page in the
CVAT UI that draws it as a bar chart, protected by CVAT's own login and task permissions.

## Approach (as I understand it before reading the code in depth)

- **Data:** annotations live in `cvat/apps/engine/models.py` as `LabeledShape`,
  `LabeledTrack` and `LabeledTag`, all subclasses of the abstract `Annotation`, which
  holds a `job` FK and a `label` FK to `Label`. A task reaches its jobs through
  `Job.segment` → `Segment.task`. The count is one grouped query per annotation type:
  filter by `job__segment__task_id`, group by `label_id`/`label__name`, `Count("id")`.
  `Label.task` is null for tasks inside a project (labels belong to the project), so I
  group on the label itself, never on `label.task`.
- **Backend:** new Django app `cvat/apps/test`, registered in settings and URLs. One
  view, `GET /api/test/tasks/<id>/label-counts`. Authentication and access checks use
  CVAT's existing auth classes and its OPA-based permission layer (`cvat/apps/iam`),
  reusing the task "view" rule, not a hand-written check.
- **Frontend:** a route in `cvat-ui` reached from the task page, which calls the endpoint
  and draws a bar chart. Explicit states for loading, empty (task has no annotations)
  and error (failed request, 401 and 403 shown with distinct messages).

## Order and time budget (8 h of work; Docker builds and dataset import not counted)

| # | Step | Time |
|---|---|---|
| 0 | Write Plan, Objectives, Definition of Done; commit Plan first | 0:30 |
| 1 | Read CVAT: annotation models, IAM/OPA permissions, how apps and URLs are registered | 0:45 |
| 2 | Endpoint returning per-label counts, checked against a hand count on the COCO task (items 1, 5) | 1:15 |
| 3 | UI page and bar chart, empty and error states (items 2–4) | 1:30 |
| 4 | Auth evidence: no login → 401, user without task access → 403, recorded with curl (item 5) | 0:20 |
| 5 | Speed objective: benchmark script, 5 runs, median and spread, raw output saved (item 6) | 0:40 |
| 6 | One filter beyond the plain count (item 7) | 0:30 |
| 7 | Live updates over WebSocket and reconnect (items 8, 9) | 1:30 |
| 8 | Decision record, Definition of Done ticked with evidence | 0:30 |
| — | Buffer | 0:30 |

Items 1–4 are the floor. I do not start step 7 until step 3 is finished and working.

## Already decided to skip

- Video-specific handling: a track counts as **one** annotation, not one per frame.
- Project-level or cross-task aggregation; the endpoint is per task only.
- Frontend unit tests; the checks are manual and listed in the Definition of Done.
- Any change to CVAT's existing endpoints or models; the feature stays inside `cvat/apps/test`
  and one new UI route.

## Risks

- WebSocket: the server already runs under uvicorn (`supervisord/server.conf`, `cvat.asgi:application`),
  but CVAT has no WebSocket routing and the reverse proxy must pass the upgrade. If it threatens
  items 1–7, I stop and write down why.
- The COCO import is large; I use a subset of images that the machine handles comfortably.

## Changes

_None yet._

## Decision record

_Written if I reach item 10._
