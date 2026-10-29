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

_Filled in after the measurement: raw output, the 5 run medians, median and spread, and
whether the target was met. If it was missed, the reason._
