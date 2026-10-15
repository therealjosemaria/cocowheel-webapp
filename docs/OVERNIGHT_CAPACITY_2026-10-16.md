# Two-workload capacity investigation — 16 October 2026

Owner authorized autonomous sequential iterations during an overnight empty-trip
window, up to eight hours. Objective: identify degradation, not force a crash.
One API worker; no production configuration or behavior changes. All loads use
private synthetic SQLite databases, random loopback ports and blocked providers.
See [harness contract](BACKEND_LOAD_TEST.md) and [prior soaks](BACKEND_LOAD_RESULTS_2026-10-16.md).

Harness revision `d7e7be1` adds optional statement timing, GPS phase selection and
history/discovery fixtures. The first instrumented controls ran during development
of these extensions; the same polling/profile code is retained in that commit.
Tests for argument safety, ESLint and the original smoke passed. The restricted
sandbox initially lost spawned-process test output; the same tests passed when
rerun with the process permissions needed for the harness. No test failure was
hidden by changing assertions.

## Investigation 1: polling and GPS bursts

The earlier ten-minute synchronized runs established increasing pressure between
120 and 160 trips: GPS P95 307 → 505 ms, read P99 about 20 → 314 ms, and event-loop
samples above 250 ms increased from eight to 43. No errors/skips occurred.
This is a measured degradation range, not an absolute failure limit.

To test whether synchronized arrival bursts contribute, each comparison used
160 trips, 320 participants, 120 seconds and exactly 10,560 requests. Only GPS
phases changed; per-device intervals and driver/rider offsets were retained.

| Run | SQL timing | GPS P95 ms | Current/details P99 ms | Peak CPU % of one core | Peak event-loop P99 ms |
| --- | --- | --- | --- | --- | --- |
| Synchronized | On | 578.0 | 182.8 / 181.1 | 99.8 | 348.1 |
| Staggered | On | 11.0 | 15.9 / 16.7 | 49.4 | 76.8 |
| Staggered confirmation | Off | 10.9 | 17.7 / 17.2 | 48.7 | 74.5 |

All passed semantic responses, integrity, updated fixes and ownership counts;
zero errors and skipped arrivals. Statement counts matched across instrumented
controls: 63,360 expiry operations, 146,880 selects and 7,680 other writes.
Expiry execution total was about 3.2 seconds in either case, selects about
5.4 seconds, other statements about 0.08–0.09 seconds. This excludes preparation,
transaction begin/commit, JavaScript, serialization and socket queueing. It is
not proof that durable writes are cheap or that expiry dominates overall cost.

Staggering alone dramatically lowered observed latency and peak CPU for this
workload. Synchronized bursts are therefore a demonstrated contributor, not just
a source-code hypothesis. The uninstrumented staggered confirmation supports that
the improvement is not an artifact of statement timing. Trials are sequential,
not randomized repeated statistical experiments; host noise still applies.

**Practical interpretation:** 120 synchronized trips is a tested point below the
marked latency jump at 160; 160 staggered trips passed a short confirmation. Do
not translate either into a public-user limit or assume browsers remain evenly
staggered. Reconnects can synchronize traffic. No frontend jitter or API
optimization was implemented. For initial planning, retain headroom below the
120-trip burst-heavy point until full-workload and network testing is done.

## Investigation 2: history and discovery reads

Each pair is two verified synthetic accounts. Each account has 20 completed rides
(shared within the pair), alongside one paired fixture and 20 independent public
offers. Both accounts request history and availability every ten seconds. Rate:
0.4 requests/second/pair. Starts are staggered, but the two endpoints for each
account share a phase. GPS writes, providers and full browser polling are absent.
Historical rows are clones rather than lifecycle replays. Fixture creation and
its retained process-memory footprint precede measurement; this affects RSS.

| Pairs | Participants | Completed rows | Duration s | Requests | History / discovery P95 ms | Peak API RSS MiB | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 5 | 10 | 100 | 30 | 60 | 19.5 / 22.7 | 114.6 | Validation, SQL timing on |
| 20 | 40 | 400 | 120 | 960 | 20.2 / 20.3 | 164.2 | Passed |
| 40 | 80 | 800 | 120 | 1,920 | 20.4 / 19.1 | 199.9 | Passed |
| 80 | 160 | 1,600 | 120 | 3,840 | 21.9 / 19.3 | 267.9 | Passed |
| 160 | 320 | 3,200 | 120 | 7,680 | 26.2 / 21.7 | 400.4 | Passed |
| 250 | 500 | 5,000 | 1.53 actual | 104 | 929.9 / 931.4 | 542.1 | Memory guardrail |
| 200 | 400 | 4,000 | 120 | 9,600 | 46.9 / 45.7 | 467.5 | Passed after stepping down |
| 200 | 400 | 4,000 | 600 | 48,000 | 42.6 / 42.2 | 463.2 | Sustained confirmation passed |

All rows had zero failed responses/skips and passed final integrity and fixture
checks, including the early-stop stage. The 250-pair stage crossed the unchanged
512 MiB API memory cap at its first resource sample and exited nonzero as designed.
It is **not** a sustained latency result or a physical out-of-memory event. The Pi
still had memory available; this was the test's conservative process budget.
No threshold was raised to force continuation.

At 200 pairs the two-minute peak CPU was 99.9% of one core, event-loop P99 peak
147 ms and endpoint P99 85/101 ms. This is a ceiling probe with limited headroom,
not a recommended operating target.

The ten-minute confirmation completed in 600.215 seconds. History/discovery P99
was 71.0/79.5 ms; maxima 453.2/473.5 ms. Zero errors/skips; maximum scheduler lag
57.9 ms. Peak API CPU 98.9% of one core, sample mean 61.6%. Only one CPU sample
exceeded 90%; none of the event-loop P99 samples exceeded 250 ms (peak 153.9 ms).
RSS moved from 460.0 MiB in the first sample to 461.5 MiB in the last, peaking at
463.2 MiB. SQLite remained 5,636,096 bytes; WAL 4,593,832 bytes. Integrity, 200
paired fixtures, 400 ownership rows and zero post-start GPS updates all matched.

**Boundary:** 200 pairs / 400 simulated readers sustained this defined mix at
80 requests/s; 250 pairs / 500 readers crossed the memory guardrail at startup.
The boundary is bracketed, not an exact threshold. Concurrency, history size and
fixture-creation memory all changed together. 160 pairs / 320 readers had more
resource headroom in the short test; it is a conservative planning point for this
isolated read workload, not a certified full-app admission limit.

## Evidence retained privately

Each directory below contains `report.json` and synthetic database artifacts.
No artifacts were deleted. Do not publish synthetic session material.

| Stage | Directory under `/tmp/` |
| --- | --- |
| Synchronized instrumented GPS | `gumwheel-backend-load-mgCyCs` |
| Staggered instrumented GPS | `gumwheel-backend-load-7gKu5F` |
| Staggered uninstrumented GPS | `gumwheel-backend-load-kIscU9` |
| History validation 5 | `gumwheel-backend-load-OvXdcZ` |
| History 20 | `gumwheel-backend-load-NNiJ1d` |
| History 40 | `gumwheel-backend-load-IVgbGw` |
| History 80 | `gumwheel-backend-load-TvaxBU` |
| History 160 | `gumwheel-backend-load-waI5pp` |
| History 250 stopped | `gumwheel-backend-load-Sj1eNo` |
| History 200 short | `gumwheel-backend-load-hx85yq` |
| History 200 ten-minute soak | `gumwheel-backend-load-zg31Dq` |

## Boundaries of these conclusions

These workloads are isolated from production data, not host resources. Generator
and API share the Pi. Results cannot be added together as independent capacity;
the real app mixes these costs. History size and concurrency both grow in the
second ramp, so it is not a pure concurrency-only experiment. Different history
depths may produce different boundaries. No external API quota, tunnel/internet,
mobile rendering, restart recovery or actual device GPS reliability was tested.
No production admission limit has been configured. A push is not a verified
frontend deployment, and no API restart is required for these test-only changes.

## Completion and follow-up

Both investigations reached useful degradation/guardrail boundaries without
forcing a crash. The original GPS burst workload showed clear degradation between
120 and 160 trips; the read workload passed at 200 pairs and stopped at 250.
The overnight extension issued 103,844 requests excluding the six-request smoke;
all returned semantically valid responses, including the 104 drained during the
guardrail stop. This total includes three 10,560-request GPS comparisons and all
history stages above. It excludes earlier daytime ramp/soak runs.

Production health was checked during testing, after the guardrail stop and after
the final soak, returning `ok`. The final generator/API processes exited. No
records were removed, no production configuration changed, and no real GPS or
provider credentials were used. The capped stop was intentional, not a crash.

Recommended implementation priorities (not applied): reduce redundant expiry/view
work without weakening lifecycle checks, profile transaction/commit time before
changing persistence, investigate bounded/paginated history, and test reconnect
jitter as an explicit product change. Then measure a mixed full-app workload with
representative history and real network overhead before setting an admission cap.
Recovery/fault injection and external provider exhaustion remain separate tasks.

Final verification: all 71 repository tests passed, targeted ESLint passed and
`git diff --check` passed. No UI code changed, so no browser visual check or
frontend build was run for these test-only changes. Deployment status was not
verified; production API health was verified independently as described above.
After the trials, a pre-start validation cap of 5,000 completed fixture rows was
added with regression coverage. It prevents combining maximum account count and
maximum history depth into a much larger untested setup; no measured trial exceeds
this cap. Resource monitoring starts after fixture setup, so this count bound is
not a guarantee that every possible setup fits the 512 MiB runtime budget.
