# Objectives

Targets I set before writing the code. Raw output for every number is pasted under
**Results**. Machine and CVAT commit are listed in [PLAN.md](PLAN.md#environment).

## MO-1 — Endpoint response time

| Field | Entry |
|---|---|
| What is measured | Wall-clock time of `GET /api/test/tasks/<id>/label-counts` for the COCO task, from the client sending the request to the last byte of the response. |
| How | `docs/bench/label_counts.sh`: curl with `-w '%{time_total}'`, through the CVAT proxy on `localhost:8080`, logged in with basic auth. One warm-up request is thrown away, then 20 sequential requests. The value for one run is the median of those 20. |
| Target | Median of 5 runs at or below **100 ms**. Spread (max − min of the 5 run medians) reported next to it. |
| Conditions | Local Docker stack, the COCO 2017 val task (image count in the Plan), no other requests to the server, nothing heavy running on the host. |
| Not included | The first request after a server restart (cold DB cache), the browser render time of the chart, and live WebSocket updates. |

**Why 100 ms.** The page shows one number per label, so the request should feel instant;
100 ms is the usual threshold for that. The query has to read every annotation of the
task, and the COCO val set holds about 36 000 boxes over 5 000 images, so this is not a
target the endpoint clears by doing nothing: a naive version that loads the annotations
into Python and counts there will miss it. For comparison I also measure CVAT's own
`GET /api/tasks/<id>` with the same script, so the number has a reference point.

## Results

Measured 29 Oct 2026 on the machine in the [Plan](PLAN.md#environment), task #4 (COCO,
5000 images, 41 866 shapes, 80 labels), CVAT commit `4a09e27ff`.

| Run | Endpoint | Auth | Median of 5 runs | Spread | Target ≤ 100 ms |
|---|---|---|---|---|---|
| A | `/api/test/tasks/4/label-counts` | basic (as planned) | 619.3 ms | 7.8 ms | missed |
| A | `/api/tasks/4` (CVAT, reference) | basic | 603.0 ms | 10.4 ms | — |
| B | `/api/test/tasks/4/label-counts` | token | **46.3 ms** | **0.9 ms** | **met** |
| B | `/api/tasks/4` (CVAT, reference) | token | 30.3 ms | 0.6 ms | — |

**Method change, and why.** Run A followed the method as written and missed the target.
The reference endpoint, which does almost nothing, was just as slow, so the time was not
in my code. Basic auth makes Django hash the password on every request (PBKDF2), about
575 ms on this machine:

```
basic: 0.623729   token: 0.046782
basic: 0.626197   token: 0.048108
basic: 0.623737   token: 0.047047
```

The page never pays that cost: the browser sends a session cookie, which, like a token,
is checked with a single lookup. So run B uses a token, obtained once from
`POST /api/auth/login`, and is the result I report for MO-1. Run A stays here because it
is what the method I committed to produced.

**Where the 46 ms goes.** Inside the server process, the counting function takes
22.9 ms; Postgres runs the shape query in 25.3 ms, using the `job_id` index and sorting
41 866 rows by label. The remaining ~23 ms is CVAT's request pipeline (token lookup, OPA
permission call, serialization, proxy), which also explains most of the 30 ms reference.

**Is the target too easy?** No. The naive version, loading every annotation and counting
in Python, takes 606 ms on its own and misses the target by 6x:

```
in-process, median/min/max ms
  grouped query (queries.py):   22.9 / 22.0 / 23.9  (20 calls)
  naive, count in Python:       606.1 / 601.0 / 610.3  (5 calls)
```

**Limit.** The query time grows with the number of shapes in the task (the sort is over
every shape). With ~23 ms of fixed pipeline cost, the target leaves ~77 ms for the query,
so a task of roughly 3x the COCO val set would reach it. That is an estimate from these
numbers, not a measurement.

### Raw output, run A (basic auth, `docs/bench/label_counts.sh <path> admin:***`)

```
GET http://localhost:8080/api/test/tasks/4/label-counts
5 runs x 20 requests, 1 warm-up per run, times in ms
run 1: median 617.8  raw: 639.8 627.2 622.4 626.7 622.1 627.0 632.6 618.5 634.0 612.6 610.7 611.0 616.3 617.1 606.5 602.8 623.5 605.8 604.9 612.7
run 2: median 614.05  raw: 616.1 608.9 598.9 614.8 602.5 612.1 612.9 607.2 617.7 611.3 610.1 617.2 621.9 620.9 616.4 612.5 615.9 615.7 613.3 619.6
run 3: median 619.3  raw: 611.2 610.8 614.2 619.4 610.4 612.1 609.9 626.9 609.4 608.7 620.5 619.1 626.3 619.9 626.2 619.2 623.9 624.3 620.2 624.7
run 4: median 621.4  raw: 623.3 625.1 624.7 625.3 621.2 623.3 622.9 670.2 621.2 632.1 614.2 614.0 619.9 617.4 635.4 620.9 613.5 621.6 610.5 611.7
run 5: median 621.8  raw: 608.5 614.6 609.5 627.2 623.8 609.7 618.8 619.1 640.4 625.2 627.0 623.0 621.4 621.4 620.3 658.9 629.4 622.0 625.3 621.6
run medians: 617.8 614.05 619.3 621.4 621.8
median of runs: 619.3 ms
spread (max - min): 7.8 ms

GET http://localhost:8080/api/tasks/4
5 runs x 20 requests, 1 warm-up per run, times in ms
run 1: median 602.95  raw: 622.6 604.9 615.4 611.0 607.4 605.6 604.1 608.3 603.1 596.2 602.0 596.1 602.8 596.2 595.3 601.2 598.2 602.0 595.1 603.4
run 2: median 606.4  raw: 595.1 600.3 605.3 605.3 612.2 608.4 612.9 606.6 605.5 613.5 608.1 605.6 604.2 604.1 613.6 616.0 606.2 611.3 606.9 606.2
run 3: median 606.1  raw: 604.6 611.9 600.9 597.8 604.4 601.0 607.1 624.2 649.5 611.8 601.0 625.4 593.5 588.8 625.0 605.9 603.6 610.0 608.7 606.3
run 4: median 596.05  raw: 597.6 591.9 587.9 592.8 587.3 594.9 597.2 589.0 600.1 598.7 599.7 594.5 586.2 602.0 597.5 591.4 603.7 587.7 602.8 614.2
run 5: median 598.85  raw: 595.5 602.1 594.5 602.8 595.8 598.3 595.5 590.8 597.2 603.6 599.4 599.9 593.8 592.2 623.0 603.2 595.1 601.1 613.3 605.4
run medians: 602.95 606.4 606.1 596.05 598.85
median of runs: 602.95 ms
spread (max - min): 10.4 ms
```

### Raw output, run B (token auth, `docs/bench/label_counts.sh <path> "Token ***"`)

```
GET http://localhost:8080/api/test/tasks/4/label-counts  (token auth)
5 runs x 20 requests, 1 warm-up per run, times in ms
run 1: median 46.05  raw: 45.9 45.6 45.7 45.9 45.9 45.6 45.6 57.4 49.9 45.3 47.0 47.5 46.0 52.3 46.7 46.7 46.2 45.9 46.4 46.1
run 2: median 46.7  raw: 49.1 46.7 47.2 45.9 46.3 48.3 48.8 45.8 46.6 48.8 46.7 46.1 54.1 52.6 45.4 45.6 45.3 45.8 46.7 46.8
run 3: median 46.9  raw: 46.8 47.2 46.4 46.4 49.7 47.1 45.7 45.2 47.3 47.1 47.5 47.0 47.1 48.6 46.0 45.6 45.7 46.0 45.5 50.2
run 4: median 46.2  raw: 46.2 46.2 47.3 46.0 46.2 45.1 45.0 46.4 44.9 48.1 46.2 46.8 45.5 47.7 45.3 47.8 47.8 47.0 46.0 45.6
run 5: median 46.3  raw: 46.3 46.5 45.3 45.6 48.1 48.4 47.6 47.2 46.3 45.3 44.8 45.7 47.0 45.7 45.4 47.0 45.9 46.4 47.9 45.4
run medians: 46.05 46.7 46.9 46.2 46.3
median of runs: 46.3 ms
spread (max - min): 0.9 ms

GET http://localhost:8080/api/tasks/4  (token auth)
5 runs x 20 requests, 1 warm-up per run, times in ms
run 1: median 30  raw: 31.0 36.4 33.2 29.6 29.4 30.3 29.9 30.0 30.3 29.5 30.3 30.0 29.6 29.9 29.4 29.1 30.1 31.9 29.4 30.5
run 2: median 30.45  raw: 30.2 29.8 30.3 29.3 29.9 29.8 30.5 34.6 39.3 32.5 32.0 29.5 30.9 30.4 30.2 29.7 33.3 34.4 37.4 35.7
run 3: median 30.45  raw: 36.4 30.9 31.2 30.8 30.1 30.8 31.2 29.1 29.6 31.2 29.3 29.6 29.3 29.5 32.8 36.1 28.8 30.1 30.9 30.0
run 4: median 29.8  raw: 29.8 29.3 29.8 29.1 29.4 29.7 31.2 29.8 31.0 33.3 30.0 29.8 30.6 30.0 29.5 29.8 29.4 29.8 30.9 30.7
run 5: median 30.3  raw: 31.6 30.1 29.1 30.8 35.7 31.3 29.8 30.5 29.8 29.4 31.3 29.8 31.2 31.6 30.8 30.7 29.9 29.7 29.6 29.7
run medians: 30 30.45 30.45 29.8 30.3
median of runs: 30.3 ms
spread (max - min): 0.6 ms
```

### Query plan (`EXPLAIN (ANALYZE, BUFFERS)` of the shape query, key lines)

```
GroupAggregate  (actual time=21.148..25.036 rows=80 loops=1)
  Group Key: engine_labeledshape.label_id
  ->  Sort  (actual time=19.544..21.640 rows=41866 loops=1)
        Sort Key: engine_labeledshape.label_id
        Sort Method: quicksort  Memory: 3519kB
        ->  Nested Loop  (actual time=0.251..13.420 rows=41866 loops=1)
              ->  (5 annotation jobs of task 4, via engine_segment_task_id index)
              ->  Bitmap Heap Scan on engine_labeledshape  (actual time=0.251..2.055 rows=8373 loops=5)
                    Filter: (parent_id IS NULL)
                    ->  Bitmap Index Scan on engine_labeledshape_job_id_b7694c3a
Planning Time: 0.176 ms
Execution Time: 25.313 ms
```
