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
