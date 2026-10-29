# Definition of Done

Written before the code. Each line is ticked only with evidence beside it: a number, a
command and its output, a screenshot, or a commit. A tick without evidence counts as
unticked.

## Floor (items 1–4)

- [x] The endpoint returns per-label counts read from the database. Checked against a
      known task: the counts match an independent count of the same annotations
      (`instances_val2017.json` for the imported images, and a direct SQL query).
      Evidence: [E1](#e1-counts-on-a-hand-built-task), [E2](#e2-counts-on-coco).
      Commits `121f91857`, `bc5f392db`.
- [x] The UI page is reachable from the task page and calls the endpoint.
      Actions → "Label counts" opens `/tasks/<id>/label-counts`
      ([screenshot](img/actions-menu.png)). Commit `d4ff76045`.
- [x] The counts are drawn as a bar chart, one bar per label. 80 bars for the COCO task
      ([screenshot](img/chart-coco.png)). Commit `ba0443bce`.
- [x] Empty case: a task with no annotations shows a clear "no annotations" message,
      not an empty chart. Task #2 ([screenshot](img/empty-state.png)). Commit `f84669053`.
- [x] Error case: a failed request shows an error message, and the page does not crash.
      [E3](#e3-page-states). 403 shown in [screenshot](img/error-403.png).
      Commit `f84669053`.

## Beyond the floor

- [x] No login → `401`, shown with curl output. No credentials, a wrong password and an
      invalid token all get 401. [E4](#e4-access-checks).
- [x] Logged-in user with no access to the task → `403`, shown with curl output.
      [E4](#e4-access-checks). The same user gets 200 once assigned to the task and 403
      again once unassigned, and every decision matches CVAT's own
      `GET /api/tasks/<id>/annotations`.
- [x] MO-1 measured: 5 runs, raw output saved, median and spread in
      [OBJECTIVES.md](OBJECTIVES.md). Script `docs/bench/label_counts.sh`; raw output of
      every request in [Results](OBJECTIVES.md#results).
- [x] MO-1 target met, or missed with the reason written down. Met with token auth:
      **46.3 ms** median, 0.9 ms spread (target ≤ 100 ms). Missed with basic auth as first
      planned (619.3 ms), because of per-request password hashing; the reason and the
      method change are written in [Results](OBJECTIVES.md#results).
- [x] One filter or grouping beyond the plain count, and why I chose it. Each label's
      count is split by annotation type (`by_type` in the response, "Shape type" switch on
      the page). Why: it answers what each class is made of, and on COCO it explains the
      count gap in the Plan: 41 420 polygons + 446 masks, where the 446 masks are exactly
      COCO's 446 `iscrowd` regions. [E5](#e5-grouping-by-annotation-type),
      [screenshot](img/chart-coco-by-type.png). Commits `35c07d258`, `c956d6200`.
- [x] The chart updates live over WebSocket when annotations change. An open page went from
      Total 7 to Total 9 after two boxes were added through the API, without a reload
      ([screenshot](img/live-update.png)); an annotation import run by an RQ worker also
      reaches the socket. The socket refuses no login (4401), no access (4403), a missing
      task (4404) and a foreign Origin (4403). [E6](#e6-live-updates).
      Commits `9478d26be`, `e795115b3`, `d4aed2dbf`.
- [x] The page recovers when the connection drops and comes back. With the page open,
      `cvat_server` was restarted and the socket blocked; 2 boxes were added while it was
      down. The page showed "reconnecting" with the last counts, then went back to Live
      and showed the 2 missed boxes (Total 11 → 13) without a reload
      ([screenshot](img/reconnected.png)). A refused socket (no access) is not retried.
      [E7](#e7-recovery-after-a-dropped-connection). Commit `928668671`.
- [x] Decision record at the end of the Plan. [Plan, Decision record](PLAN.md#decision-record):
      re-read over HTTP on a "changed" event, rather than pushing counts through Django
      Channels, and what that cost.

## Hygiene

- [x] Backend change lives in `cvat/apps/test`; the only edits outside it are the
      registration lines (settings, URLs) and the UI route. Plus two I did not plan:
      `cvat/asgi.py` (+6 lines, mounts the WebSocket, item 8) and the "Label counts" entry
      in the task Actions menu (+6 lines). The UI lives in
      `cvat-ui/src/components/label-counts-page/`. The diff only adds lines:
      `git diff --stat 4a09e27ff -- . ':!docs'` → 20 files, 830 insertions, 0 deletions.
- [x] No dead code, commented-out blocks or stray files in the diff. A search of the diff
      for `console.log`, `print(`, `debugger`, `TODO`, `FIXME` and commented-out code
      found none. CVAT's pinned formatters on the Python code: `black 26` "12 files would
      be left unchanged", `isort 7` clean; `eslint`, `stylelint` and `tsc` clean on the UI
      files. `docs/img/` (screenshots) and `docs/bench/` (the MO-1 script) are evidence,
      kept on purpose; the Docker override and test scripts stay outside the repository.
- [x] Commits show the work progressing, each message says what and why. The plan is the
      first commit, objectives and this checklist the second, then one or more commits per
      item, each with a body explaining why (`git log 4a09e27ff..dev-test01`).
- [x] Everything I did not finish is listed below, with the reason.

## Not finished

- **No automated tests.** Every check above is manual, with its raw output pasted. The
  Plan skipped frontend tests up front; backend tests would need CVAT's test setup with
  the OPA server, and I spent the time on the evidence instead. The first tests I would
  add: counts on the hand-built task (E1), and 401/403 against the endpoint (E4).
- **Not exercised in the browser:** the 401 message (CVAT sends a logged-out user to the
  login page before the page loads) and a 5xx response. Both fall into branches of
  `describeError` that I read but did not run.
- **Live updates cover annotation changes only.** Renaming a label or changing its color
  saves a `Label`, not the task's `updated_date`, so an open page shows the old name until
  the next annotation change or a reload.
- **Not measured:** the endpoint on tasks larger than COCO val (the ~3x limit in
  OBJECTIVES.md is an estimate), and the load of many pages open on one busy task (the
  cost named in the decision record).
- **Small known gaps in the WebSocket:** a connection without an `Origin` header (not a
  browser) is allowed, since it still needs the session cookie; and the page shows "Live"
  for a moment before a refused socket is closed, because the server accepts the socket
  first so that it can send a close code the page can read.
- **Not built into the Docker images.** I ran the change by bind-mounting the changed
  files into the stock `cvat/server:dev` and `cvat/ui:dev` containers (see the Plan); I
  did not rebuild the images with the change.

## Evidence

### E1. Counts on a hand-built task

Task #1: 3 images, labels cat, dog, bird. Uploaded: 3 cat boxes, 1 cat tag, 1 dog box,
1 dog track spanning 2 frames, nothing for bird. Expected: cat 4, dog 2, bird 0, total 6.

```
$ curl -s -u admin:*** http://localhost:8080/api/test/tasks/1/label-counts
{"task_id":1,"total":6,"labels":[{"id":1,"name":"cat","color":"#6080c0","count":4},
{"id":2,"name":"dog","color":"#406040","count":2},{"id":3,"name":"bird","color":"#404040","count":0}]}
```

Same count straight from Postgres (shapes + tracks + tags of the task, top-level only):

```
 name | count
------+-------
 cat  |     4
 dog  |     2
(2 rows)
```

### E2. Counts on COCO

Task #4: all 5000 COCO val images, `instances_val2017.json` imported as COCO 1.0.
API compared with a count made straight from the JSON:

```
COCO json annotations: 36781  (iscrowd: 446 )
API total:             41866  labels: 80
labels that differ: 77
  person          json= 11004 api= 12451 diff=+1447 crowd=227
  car             json=  1932 api=  2315 diff=+383 crowd=14
  chair           json=  1791 api=  2141 diff=+350 crowd=20
  ...
```

The difference is multi-part polygons (see Plan, Changes). The database shows it:

```
 shapes | ungrouped | multi_part_objects | objects
--------+-----------+--------------------+---------
  41866 |     33259 |               3522 |   36781

COCO objects whose polygon has >1 part: 3522  total parts in them: 8607
```

33 259 single shapes + 8 607 parts = 41 866 shapes, which is what the endpoint returns.
33 259 + 3 522 grouped objects = 36 781, the COCO total. Per label, counting each
(job, frame, group) once:

```
labels matching COCO json when grouped parts count once: 80 / 80
```

So every stored shape is counted, and none is counted twice or missed.

### E3. Page states

Text of the page in headless Chrome for each case:

```
=== empty  (task #2, labels but no annotations)
This task has no annotations yet. Counts appear here once objects are annotated.
=== 403  (user "outsider", task #1)
Could not load label counts
You do not have access to the annotations of task #1.
Try again
=== 404  (task #999)
Could not load label counts
Task #999 does not exist.
Try again
=== network down  (request to *label-counts* blocked in the browser)
Could not load label counts
The CVAT server could not be reached. Check your connection.
Try again
```

Not checked in the browser: the 401 message (CVAT's app sends a logged-out user to the
login page first), and a 5xx response.

### E4. Access checks

Task #4 (COCO). `outsider` and `annotator` are ordinary users (group `user`) with no
organization and no relation to the task unless stated. Body cut at 90 characters.

```
$ GET /api/test/tasks/4/label-counts    (status  body)
1. no credentials                                   401  {"detail":"Authentication credentials were not provided."}
2. wrong password (admin)                           401  {"detail":"Invalid username/password."}
3. invalid token                                    401  {"detail":"Invalid token."}
4. outsider (no relation to task #4)                403  {"detail":"You do not have permission to perform this action."}
5. annotator, not assigned yet                      403  {"detail":"You do not have permission to perform this action."}
  (admin sets task #4 assignee to 3: 200)
6. annotator, now assignee of task #4               200  {"task_id":4,"total":41866,"labels":[{"id":86,"name":"person","color":"#c06060","count":12
  (admin sets task #4 assignee to null: 200)
7. annotator, assignment removed                    403  {"detail":"You do not have permission to perform this action."}
8. admin                                            200  {"task_id":4,"total":41866,"labels":[{"id":86,"name":"person","color":"#c06060","count":12

Same users, CVAT's own GET /api/tasks/4/annotations vs the new endpoint:
user                         /api/tasks/4/annotations     /api/test/tasks/4/label-counts
no credentials               401                          401
outsider                     403                          403
annotator (not assigned)     403                          403
admin                        200                          200
```

The endpoint writes no access rule of its own (`cvat/apps/test/permissions.py`): it asks
CVAT's OPA policy for the task `view:annotations` scope, the same check behind
`GET /api/tasks/<id>/annotations`, which is why the two columns above agree.

### E5. Grouping by annotation type

Hand-built task #1 (3 cat boxes + 1 cat tag, 1 dog box + 1 dog track):

```
$ curl -s -u admin:*** http://localhost:8080/api/test/tasks/1/label-counts
{"task_id":1,"total":6,"labels":[{"id":1,"name":"cat","color":"#6080c0","count":4,"by_type":{"rectangle":3,"tag":1}},{"id":2,"name":"dog","color":"#406040","count":2,"by_type":{"rectangle":1,"track":1}},{"id":3,"name":"bird","color":"#404040","count":0,"by_type":{}}]}
```

COCO task #4, summed over all labels, and the largest label. Every label's `by_type`
adds up to its `count` (checked in the script):

```
total 41866
by type over all labels: {'mask': 446, 'polygon': 41420}
{'id': 86, 'name': 'person', 'color': '#c06060', 'count': 12451, 'by_type': {'mask': 227, 'polygon': 12224}}
COCO iscrowd annotations (stored by CVAT as masks): 446
person iscrowd annotations: 227
```

Screenshots: [hand-built task](img/chart-known-by-type.png),
[COCO](img/chart-coco-by-type.png).

### E6. Live updates

Raw output of a small WebSocket client (`ws://localhost:8080/api/test/ws/tasks/<id>/label-counts`,
logged in with the session cookie like the browser). Times are seconds since the client
started; the `PATCH` lines are the API calls made while the admin socket was open.

```
=== no login
[0.10s] open
[0.11s] close code=4401
=== outsider (no access to task 1)
[0.73s] open
[0.75s] close code=4403
=== admin, task 999 (does not exist)
[0.74s] open
[0.75s] close code=4404
=== admin, Origin http://evil.example
[0.74s] open
[0.75s] close code=4403
=== admin, task 1, two annotation changes made through the API while connected
    [~2s] PATCH create bird box: 200
    [~4s] PATCH delete bird box: 200
[0.74s] open
[2.61s] message {"event": "label_counts_changed", "task_id": 1}
[5.91s] message {"event": "label_counts_changed", "task_id": 1}
[8.74s] client closing
[8.75s] close code=1005
```

An annotation import (task #1, CVAT 1.1 format) runs in the `cvat_worker_import`
container, not in the server; the socket still gets the change:

```
{"rq_id":"action=import&target=task&target_id=1&subresource=annotations"} [202] import started at ~2s
[0.76s] open
[3.13s] message {"event": "label_counts_changed", "task_id": 1}
[3.14s] message {"event": "label_counts_changed", "task_id": 1}
[20.76s] client closing
[20.76s] close code=1005
```

The page itself, in headless Chrome, before and after two boxes were added through the API
while it stayed open (no reload in between):

```
before: Total: 7
PATCH add 2 bird boxes while the page is open: 200
after (same page, no reload): Live
after (same page, no reload): Total: 9
```

### E7. Recovery after a dropped connection

Headless Chrome with the page of task #1 open, driven by a script. "page:" is the tag
next to the title and the total, read from the page once a second. Step 2 blocks the
socket URL inside the browser, so reconnect attempts fail like during a network outage,
and restarts `cvat_server`, which drops the open socket.

```
[  6s] STEP 1: page open
[  6s] page: Live | Total: 11
[  7s] page: Live | Total: 11
[  8s] STEP 2: block the socket URL in the browser, then restart cvat_server
[ 10s] cvat_server restarted, waiting for the API
[ 26s] API is back
[ 26s] page: Connection lost, reconnecting… | Total: 11
[ 27s] page: Connection lost, reconnecting… | Total: 11
[ 29s] STEP 3: while the page is disconnected, add 2 boxes through the API -> 200
[ 29s] page: Connection lost, reconnecting… | Total: 11
[ 30s] page: Connection lost, reconnecting… | Total: 11
[ 31s] page: Connection lost, reconnecting… | Total: 11
[ 32s] STEP 4: unblock the socket URL (network is back)
[ 32s] page: Connection lost, reconnecting… | Total: 11
[ 33s] page: Connection lost, reconnecting… | Total: 11
[ 34s] page: Connection lost, reconnecting… | Total: 11
[ 35s] page: Connection lost, reconnecting… | Total: 11
[ 36s] page: Connection lost, reconnecting… | Total: 11
[ 37s] page: Connection lost, reconnecting… | Total: 11
[ 38s] page: Connection lost, reconnecting… | Total: 11
[ 39s] page: Connection lost, reconnecting… | Total: 11
[ 40s] page: Live | Total: 13
[ 41s] page: Live | Total: 13
[ 42s] page: Live | Total: 13
[ 43s] page: Live | Total: 13
[ 44s] page: Live | Total: 13
[ 45s] page: Live | Total: 13
[ 46s] page: Live | Total: 13
[ 47s] page: Live | Total: 13
[ 48s] page: Live | Total: 13
[ 49s] page: Live | Total: 13
[ 50s] page: Live | Total: 13
[ 51s] page: Live | Total: 13
[ 52s] page: Live | Total: 13
[ 53s] page: Live | Total: 13
[ 54s] page: Live | Total: 13
[ 55s] page: Live | Total: 13
[ 56s] page: Live | Total: 13
[ 57s] page: Live | Total: 13
[ 58s] page: Live | Total: 13
[ 59s] page: Live | Total: 13
[ 60s] page: Live | Total: 13
[ 61s] page: Live | Total: 13
[ 62s] page: Live | Total: 13
[ 63s] page: Live | Total: 13
[ 64s] page: Live | Total: 13
[ 65s] page: Live | Total: 13
[ 66s] page: Live | Total: 13
```

The reconnect came ~8 s after the network was back because the page had failed several
attempts during the outage, and the delay doubles each time (capped at 30 s).

A socket the server refuses is not retried. The page of task #1 opened as `outsider`,
watched for 12 s:

```
Annotations per label, task #1
Live updates are not available for this task
Could not load label counts
You do not have access to the annotations of task #1.
Try again
socket connection attempts in the last 20 s (expected 1): 1
```
