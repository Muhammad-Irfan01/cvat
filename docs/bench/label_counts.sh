#!/usr/bin/env bash
# Measures MO-1 (see docs/OBJECTIVES.md): response time of one CVAT endpoint.
#
# Usage: docs/bench/label_counts.sh <path> <user:password | "Token <key>">
#   e.g. docs/bench/label_counts.sh /api/test/tasks/4/label-counts admin:secret
#        docs/bench/label_counts.sh /api/test/tasks/4/label-counts "Token 1a2b..."
#
# Basic auth makes Django hash the password on every request (PBKDF2, ~575 ms on
# this machine), which hides the endpoint's own time. A token, like the browser's
# session cookie, is checked with one database lookup.
#
# One run = 1 warm-up request (thrown away) + 20 sequential requests.
# The value of a run is the median of its 20 times. The script does 5 runs and
# prints every raw time, the 5 run medians, their median and their spread.

set -euo pipefail

path="$1"
credentials="$2"
if [[ "$credentials" == Token\ * ]]; then
    auth=(-H "Authorization: ${credentials}")
    auth_kind="token"
else
    auth=(-u "$credentials")
    auth_kind="basic"
fi
url="http://localhost:8080${path}"
runs=5
requests_per_run=20

# Prints the median of the numbers given on stdin, one per line.
median() {
    sort -n | awk '{ values[NR] = $1 }
        END { print (NR % 2) ? values[(NR + 1) / 2] : (values[NR / 2] + values[NR / 2 + 1]) / 2 }'
}

# Prints the time of one request in milliseconds, and stops if it is not a 200.
time_request_ms() {
    local result
    result=$(curl -s -o /dev/null "${auth[@]}" -w '%{http_code} %{time_total}' "$url")
    if [[ "${result%% *}" != "200" ]]; then
        echo "request failed with status ${result%% *}" >&2
        exit 1
    fi
    awk -v seconds="${result#* }" 'BEGIN { printf "%.1f\n", seconds * 1000 }'
}

echo "GET ${url}  (${auth_kind} auth)"
echo "${runs} runs x ${requests_per_run} requests, 1 warm-up per run, times in ms"

run_medians=()
for run in $(seq 1 "$runs"); do
    time_request_ms > /dev/null

    times=()
    for _ in $(seq 1 "$requests_per_run"); do
        times+=("$(time_request_ms)")
    done

    run_median=$(printf '%s\n' "${times[@]}" | median)
    run_medians+=("$run_median")
    echo "run ${run}: median ${run_median}  raw: ${times[*]}"
done

sorted=$(printf '%s\n' "${run_medians[@]}" | sort -n)
echo "run medians: ${run_medians[*]}"
echo "median of runs: $(printf '%s\n' "${run_medians[@]}" | median) ms"
echo "spread (max - min): $(awk -v min="$(head -1 <<< "$sorted")" -v max="$(tail -1 <<< "$sorted")" \
    'BEGIN { printf "%.1f", max - min }') ms"
