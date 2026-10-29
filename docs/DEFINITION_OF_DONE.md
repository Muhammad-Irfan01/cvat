# Definition of Done

Written before the code. Each line is ticked only with evidence beside it: a number, a
command and its output, a screenshot, or a commit. A tick without evidence counts as
unticked.

## Floor (items 1–4)

- [ ] The endpoint returns per-label counts read from the database. Checked against a
      known task: the counts match an independent count of the same annotations
      (`instances_val2017.json` for the imported images, and a direct SQL query).
- [ ] The UI page is reachable from the task page and calls the endpoint.
- [ ] The counts are drawn as a bar chart, one bar per label.
- [ ] Empty case: a task with no annotations shows a clear "no annotations" message,
      not an empty chart.
- [ ] Error case: a failed request shows an error message, and the page does not crash.

## Beyond the floor

- [ ] No login → `401`, shown with curl output.
- [ ] Logged-in user with no access to the task → `403`, shown with curl output.
- [ ] MO-1 measured: 5 runs, raw output saved, median and spread in
      [OBJECTIVES.md](OBJECTIVES.md).
- [ ] MO-1 target met, or missed with the reason written down.
- [ ] One filter or grouping beyond the plain count, and why I chose it.
- [ ] The chart updates live over WebSocket when annotations change.
- [ ] The page recovers when the connection drops and comes back.
- [ ] Decision record at the end of the Plan.

## Hygiene

- [ ] Backend change lives in `cvat/apps/test`; the only edits outside it are the
      registration lines (settings, URLs) and the UI route.
- [ ] No dead code, commented-out blocks or stray files in the diff.
- [ ] Commits show the work progressing, each message says what and why.
- [ ] Everything I did not finish is listed below, with the reason.

## Not finished

_Filled in at the end._
