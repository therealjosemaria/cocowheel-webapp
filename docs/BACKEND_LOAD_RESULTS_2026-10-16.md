# First isolated backend polling/GPS ramp — 16 October 2026

## Conditions and scope

Measured harness revision: `ac67fce`. The operator confirmed no real trips were
active and approved 5, 10, then doubling. Previously successful smoke checks
allowed skipping the longer one-trip baseline. Each stage ran separately for
120 seconds, using a fresh synthetic SQLite database and loopback API process.
Production was not restarted or modified. Production health returned `ok` before
and after the ramp; this is a health check, not full browser verification.

Host: four CPU cores, approximately 8,063 MiB RAM. Generator and API shared the
host with existing services. Initial snapshot showed approximately 4,053 MiB
available memory and 81 GB disk free; swap already contained about 1,172 MiB.

The [workload and safety controls](BACKEND_LOAD_TEST.md) apply: approximately
0.55 requests/second/trip, two participants per trip. Reads are staggered; GPS
writes are synchronized per role, creating bursts every ten seconds. External
providers are blocked. This excludes full frontend polling, internet/tunnel
latency, signup, search, history, simulation and lifecycle actions under load.

## Results

All stages reached their duration, with zero HTTP/semantic errors and zero skipped
scheduled requests. All final SQLite integrity checks passed, as did active-trip,
location-source and updated-location counts for every participant.

| Trips | Participants | Requests | Current P95 ms | Details P95 ms | GPS P95 ms | Peak API CPU % of one core | Peak API RSS MiB |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 10 | 330 | 7.9 | 9.5 | 35.8 | 7.6 | 101.5 |
| 10 | 20 | 660 | 7.8 | 9.9 | 49.6 | 8.2 | 110.9 |
| 20 | 40 | 1,320 | 8.2 | 9.6 | 80.7 | 17.6 | 126.1 |
| 40 | 80 | 2,640 | 7.5 | 8.6 | 150.6 | 30.9 | 171.4 |
| 80 | 160 | 5,280 | 6.5 | 7.5 | 243.8 | 50.2 | 224.7 |
| 160 | 320 | 10,560 | 11.0 | 11.1 | 566.1 | 99.4 | 312.9 |

Total: 20,790 requests. At 160 trips, GPS P99 was 776 ms; read P99 was
208–222 ms and maximum request latency was 837 ms. Peak sampled event-loop P99
was 337 ms (versus 165 ms at 80 trips). Maximum generator start lag was 90 ms.
CPU/event-loop peaks did not persist for the five consecutive samples required
by automatic guardrails, so the stage completed normally.

## Interpretation and next test

P95 is the latency at or below which 95% of measured requests completed. It is a
standard percentile, but the harness's one-second stop threshold is provisional,
not a universal standard. Overall rolling P95 can mask endpoint-specific pressure;
the per-endpoint figures above matter, especially synchronized GPS writes.

160 trips showed meaningful CPU and tail-latency pressure without observed failure.
The ramp stopped there: the next doubling exceeds the existing 250-trip safety cap.
We did not measure a breaking point or establish a safe admission limit. No
production limit or configuration was changed. These short, fresh-database runs
cannot certify sustained capacity, real mobile GPS freshness or fault tolerance.

Recommended follow-up: repeat 80 trips in a longer maintenance window, then refine
between 80 and 160 with realistic polling and representative synthetic history.
Measure sustained resource use and endpoint-specific tail latency before deciding
operational headroom. Do not extrapolate this to 320 real users.

## Retained local evidence

Reports remain in private temporary directories on the test host (not durable
backups). Each directory contains `report.json` and synthetic database artifacts:

- 5: `/tmp/gumwheel-backend-load-s9fdTj`
- 10: `/tmp/gumwheel-backend-load-QMOkCP`
- 20: `/tmp/gumwheel-backend-load-fFuuxc`
- 40: `/tmp/gumwheel-backend-load-5jKxvd`
- 80: `/tmp/gumwheel-backend-load-2YCpqT`
- 160: `/tmp/gumwheel-backend-load-EXYhft`

No artifacts were deleted. Keep synthetic session material private; share only
reviewed reports. No UI changes, deployment or API restart were required.

## Follow-up: ten-minute 80-trip soak

The operator approved the next longer test in the continuing maintenance window.
Repository revision `967a200`, unchanged harness from `ac67fce`.
Command: `node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=80 --seconds=600`.
Workload and guardrails were unchanged; duration increased fivefold, not concurrency.
80 trips / 160 participants ran for 600.097 seconds at approximately 44 requests/s.

| Endpoint | Requests | Errors | P95 ms | P99 ms | Maximum ms |
| --- | --- | --- | --- | --- | --- |
| Current ride | 9,600 | 0 | 6.0 | 15.8 | 120.4 |
| Ride details | 12,000 | 0 | 7.3 | 15.9 | 80.5 |
| GPS write | 4,800 | 0 | 226.1 | 264.5 | 304.3 |

Total 26,400 requests; zero skipped arrivals; maximum scheduler start lag 74.3 ms.
Normal duration stop, exit code zero. SQLite integrity was `ok`; all 80 rides
remained paired, with 160 location sources and 160 fixes updated after startup.

Resource evidence from 599 worker samples:

- Peak API CPU 48.9% of one core; sample mean 11.8%.
- Peak API RSS 230.6 MiB. First-minute mean 218.5 MiB; final-minute mean
  230.6 MiB. Warm-up growth settled during the observed run; this does not prove
  absence of a slow memory leak over hours or days.
- Peak sampled event-loop P99 192.8 ms, below the 250 ms guardrail threshold.
- SQLite file grew from 462,848 to 503,808 bytes; peak WAL 4,136,512 bytes.
- Worker-reported minimum system free memory 3,814.8 MiB. Host `free` snapshots
  use different memory accounting: available memory was approximately 4,109 MiB
  before and 4,132 MiB after. Do not equate those with the worker's free metric.

Production health returned `ok` before, midway and after the run. Both isolated
test processes exited. No production records, settings or services were changed,
and no external providers were exercised. No browser or fault-recovery test was
performed. The raw report and synthetic artifacts remain privately retained at
`/tmp/gumwheel-backend-load-KBGwjy/report.json`; nothing was deleted.

GPS P95 was comparable to the previous 80-trip stage (226 ms versus 244 ms), with
no observed sustained-load degradation over ten minutes. This supports only this
reduced loopback workload at 80 trips, not a real-user admission limit. A proposed
next step is 120 trips at the same duration/guardrails in a separately approved
window, before repeating 160. Keep fuller polling, representative history, network
latency and failure/recovery tests separate so their effects can be measured.

## Follow-up: ten-minute 120-trip soak

Operator-approved next stage, repository revision `de13cad`, unchanged harness.
Command: `node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=120 --seconds=600`.
120 trips / 240 participants ran for 600.135 seconds, approximately 66 requests/s.
The workload, isolation and automatic guardrails were unchanged.

| Endpoint | Requests | Errors | P95 ms | P99 ms | Maximum ms |
| --- | --- | --- | --- | --- | --- |
| Current ride | 14,400 | 0 | 6.2 | 18.8 | 177.5 |
| Ride details | 18,000 | 0 | 7.2 | 20.1 | 145.2 |
| GPS write | 7,200 | 0 | 307.3 | 375.4 | 573.9 |

Total 39,600 requests, zero errors and zero skipped polls; maximum scheduler start
lag 85.5 ms. Normal duration stop, exit code zero. SQLite integrity `ok`, 120 paired
rides, 240 location sources and all 240 participant fixes updated after startup.

Across 599 worker samples, API CPU peaked at 73.3% of one core (sample mean 17.6%).
Peak API RSS was 267.9 MiB; first-minute mean 260.8 MiB, final-minute mean 267.9 MiB.
Memory settled during this observation window; this is not a long-term leak test.
Peak sampled event-loop P99 was 275.5 ms. Eight samples exceeded 250 ms, with no
consecutive overloaded samples, versus five required for automatic shutdown. Treat this
as a pressure signal despite the successful run. GPS-write P95 increased from
226 ms at 80 trips to 307 ms at 120 trips, while read P95 stayed near 6–7 ms.

SQLite size was 700,416 bytes at both first and last sample; peak WAL 4,136,512
bytes. Worker minimum free-system memory was 3,775.9 MiB. Host available-memory
snapshots were approximately 4,140 MiB before and 4,174 MiB after; swap usage
remained approximately 1,172 MiB. These memory metrics have different accounting.

Production health returned `ok` before, midway and after the test. Both isolated
processes exited. Production data/configuration remained unchanged; no restart,
external API load, browser test or fault injection was performed. Raw evidence
and synthetic database artifacts remain in `/tmp/gumwheel-backend-load-FLkug7/`
(`report.json`); no artifacts were deleted.

This establishes a successful ten-minute 120-trip reduced loopback test, not a
safe real-user ceiling. Proposed next stage: 160 trips for ten minutes in an
approved maintenance window, retaining all guardrails and stopping on sustained
degradation. The earlier short 160-trip stage already showed CPU/tail-latency
pressure; a longer run must not disable thresholds merely to finish.

## Follow-up: ten-minute 160-trip soak

Operator approved this stage after reviewing 120-trip results. Repository revision
`e43d025`, unchanged harness, workload and guardrails.
Command: `node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=160 --seconds=600`.
160 trips / 320 participants ran for 600.169 seconds at approximately 88 requests/s.

| Endpoint | Requests | Errors | P95 ms | P99 ms | Maximum ms |
| --- | --- | --- | --- | --- | --- |
| Current ride | 19,200 | 0 | 16.4 | 303.6 | 808.2 |
| Ride details | 24,000 | 0 | 17.1 | 314.2 | 816.1 |
| GPS write | 9,600 | 0 | 504.6 | 601.5 | 833.1 |

52,800 requests completed with zero errors and zero skipped polls. Maximum
scheduler start lag was 103.6 ms. Normal duration stop and exit code zero.
SQLite integrity `ok`; all 160 rides remained paired, with 320 independent
location sources and all 320 participant fixes updated after startup.

Across 599 worker samples:

- API CPU peaked at 99.9% of one core; sample mean 24.4%. One sample exceeded 90%.
- Peak event-loop P99 was 405.5 ms; 43 samples exceeded 250 ms. The longest
  combined CPU/event-loop overload streak was one sample, below the five-sample
  automatic stop rule. Periodic pressure can therefore pass this guardrail.
- API RSS peaked at 314.7 MiB; first-minute mean 304.4 MiB, final-minute mean
  309.1 MiB. No continuing large memory rise was observed within ten minutes.
- SQLite grew from 831,488 to 856,064 bytes; peak WAL 4,136,512 bytes.
- Worker minimum free-system memory was 3,680 MiB. Host available-memory snapshots
  were approximately 4,158 MiB before and 4,116 MiB after, with swap usage unchanged
  at approximately 1,172 MiB. These memory metrics use different accounting.

Production health returned `ok` before, midway and after. Both isolated processes
exited. No production data/configuration changes, restart, external provider load,
browser verification or fault injection occurred. Retained raw report:
`/tmp/gumwheel-backend-load-xtdWQk/report.json`. Synthetic database artifacts remain
in that private directory; nothing was deleted.

### Assessment: pause the ramp

The workload completed correctly, but latency degradation is materially visible:
read P99 increased from about 19–20 ms at 120 trips to 304–314 ms at 160, while GPS
P95 increased from 307 to 505 ms. There were 43 event-loop threshold exceedances
versus eight at 120. This is not a crash or measured breaking point, but neither
is it evidence of comfortable headroom. Do not raise an admission limit to 160
based on these results.

Recommended next work is diagnostic, not another concurrency increase: instrument
time-window/endpoint latency and CPU, investigate synchronous database/API work,
and compare staggered GPS writes with the synchronized bursts as a separately
labelled workload. Correlation with bursts is a hypothesis until measured; the
current aggregate report does not prove the bottleneck. Any profiling or harness
changes need their own checks. Full frontend polling, mature history, network
latency, long-duration leaks and recovery remain outside these results.

## Diagnostic review after the soaks

Read-only source and retained synthetic-database review at revision `a03c45a`.
No new load, production database access, service restart, optimization or worker
change was performed. Findings below describe the paired, verified-account
workload tested; other paths can behave differently.

### Confirmed request-path work

| Endpoint | Calls to global expiry cleanup per request | Path |
| --- | --- | --- |
| Current ride | 3 | HTTP dispatch → currentOpenRides → getRide |
| Ride details | 3 | HTTP dispatch → getRide for authorization/hydration → getRide for response |
| GPS write | 3 | HTTP dispatch → submitLocation → getRide for response |

Each `expireStaleRides` call executes two UPDATE statements examining eligible
rides. With 52,800 successful requests, the tested paths imply 316,800 expiry
UPDATE executions during the 160-trip measurement, even with no expired fixtures.
This is derived from the call graph, not a profiler count. No-op UPDATE executions
are not equivalent to 316,800 disk writes or commits.

`GET /api/rides/:id` constructs the full view twice around optional address-label
hydration. Removing either call blindly could break authorization or return stale
labels; optimization needs regression coverage. GPS submissions perform one
transaction containing ownership checks, the latest-fix upsert, a separate moving
flag update and a ride last-activity update, then construct the full ride response.
The separate moving update is in the same transaction, not a separate commit.
Database operations use synchronous better-sqlite3 on the API thread.

Verified sessions return early from `findSession`; they do not execute the legacy
guest last-seen UPDATE. That guest write is therefore not the explanation for
these verified-account measurements.

### Query-plan evidence

Opened only `/tmp/gumwheel-backend-load-xtdWQk/synthetic.sqlite` read-only and used
`EXPLAIN QUERY PLAN`; no statements were executed to modify it.

- The exact current-driver lookup uses `rides_discovery_index (status=?)` and
  `USE TEMP B-TREE FOR ORDER BY`. There is no driver-account-specific index on
  rides in this fixture. The plan cannot seek directly by driver account.
- An equivalent active-expiry predicate uses the same status index, without an
  indexed last-activity range. It examines matching-status candidates as the
  active population grows. This does not establish how expensive that is.
- Public ride ID and location primary-key lookups already have indexes. Do not
  describe the entire database as unindexed.

### What remains unproven

The harness synchronizes every rider GPS update, then every driver update ten
seconds later: at 160 trips that is a burst of 160 writes, not evenly distributed
traffic. Reports preserve endpoint-wide latency aggregates and resource samples,
but not timestamped per-request latency or timestamps on resource samples.
They cannot reliably correlate individual stalls with writes, checkpoints or
specific functions after the fact. SQL lock wait, commit time and per-function
CPU time were not measured. SQLite is a candidate, not a proven bottleneck.

The load generator also shares the host and scans accumulated responses for
failures on each completion. Its growing bookkeeping cost is another possible
measurement influence; zero skipped polls does not eliminate all generator bias.

### Next diagnostic experiment (not yet implemented or run)

Keep one API worker and production unchanged. Add isolated-harness instrumentation
for elapsed timestamps, per-endpoint time windows, request handling duration and
exclusive SQL/transaction timing (avoid double-counting nested transactions).
Collect normalized operation counts only, never SQL parameters, tokens or GPS.
Measure instrumentation overhead with an uninstrumented control.

At fixed concurrency, compare the existing synchronized GPS schedule against a
labelled staggered schedule with the same request count/cadence, retaining driver/
rider offsets and all stop conditions. Run each separately in an approved empty-
trip window. Only then select a narrowly scoped optimization and repeat the
baseline. Do not remove expiry enforcement, ownership checks or durable writes
merely because their paths appear expensive.
