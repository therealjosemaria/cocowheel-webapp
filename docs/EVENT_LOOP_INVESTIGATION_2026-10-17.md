# Event-loop outlier investigation — 17 October 2026

## Question and baseline

Investigate the single >250 ms per-second event-loop P99 measurement in the
[disk-backed 100-user baseline](results/mixed-2026-10-16-disk-100-users.json).
The baseline remains unchanged. One outlying measurement window does not prove
there was exactly one slow operation; its report contains aggregate endpoint
latencies and timer histograms, not request traces or SQL/GC timings.

The spike was at `2026-10-16T12:28:34.739Z`, sample index 506, about 8½ minutes
into the run: event-loop P99 285.737 ms, CPU 4.51% of one core, RSS 153.36 MiB.
The preceding window was 20.74 ms with CPU 6.07%; the next was 42.57 ms with
CPU 11.86%; subsequent windows returned to approximately 20 ms. Memory was flat
across the spike. Sustained CPU saturation is therefore not supported by this
window, but the counters cannot exclude brief CPU work, GC, synchronous disk
waiting or descheduling. The 20 ms normal reading reflects sampling resolution,
not a minimum HTTP response latency.

The earlier RAM-backed soak had no equivalent >250 ms window. That comparison
makes storage/host conditions worth investigating, but is not a controlled
attribution to the SD card. Production settings and application code are unchanged.

## Reproduction and instrumentation

Application revision `a767d98`; working-tree diagnostic harness hash is recorded
in the new report. Use the same 100-account workload (25 driver/rider pairs and
50 browsers), duration, staggered scheduling and fresh SD-card-backed fixture:

```sh
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=100 --seconds=600 --diagnostics
```

See [the harness guide](MIXED_LOAD_TESTING.md) for maintenance checks, safety stops
and diagnostic definitions. Read-only aggregate checks found zero open real trips
and a healthy production API before and during the repeat. The test uses a separate
loopback process/database and no external APIs, email, real GPS or production
mutations. No other intentional load tests or full regression suites ran alongside
the measurement. This is shared hardware, not an otherwise idle dedicated host.

Instrumentation measures individual prepared-statement execution, GC durations,
event-loop utilization, Linux runnable scheduling wait, resource I/O counts and
host swap counters. It retains slow HTTP responses without account/ride IDs or
payloads. SQL preparation and implicit transaction commit are not separately
timed in the first diagnostic repeat; kernel/block-device latency is not traced.
Instrumentation overhead and these gaps limit causal conclusions.

## First diagnostic repeat: reproduced, larger

[Retained report](results/mixed-2026-10-17-diagnostic-100-users.json), finished
`2026-10-16T13:36:56.856Z` (17 October Sydney time): 19,658 requests,
150 completed journeys, zero failed responses/skips, integrity/FK/acknowledged
row counts passed. One of 598 measurement windows exceeded 250 ms:
**1,039.139 ms at 13:32:17.717Z**, index 319, roughly 5⅓ minutes into the run.
It did not recur at the original 8½-minute point, arguing against a fixed timer
at that offset (not ruling out a workload-dependent trigger).

22 responses (0.112%) exceeded 500 ms; two GPS responses (0.0102%) exceeded one
second, maximum 1,022.148 ms. All returned success. These are individual latency
misses despite the harness passing its sustained stop/completeness criteria;
aggregate latency objectives still passed. Do not summarize this as no latency
problem. Nearby responses across unrelated endpoints queued behind the pause.

At the outlier: CPU 2.61% of one core, RSS 160.02 MiB, scheduler runnable wait
0.138 ms; no GC event overlapping the pause and no swap-counter change across
the run. Wrapped SQL max was 0.101 ms in that window (4.600 ms over the run).
Longest GC event anywhere was 13.792 ms. These do not explain a one-second stall.
The metrics interval itself stretched to 1,923.767 ms. This is consistent with
the worker being blocked rather than simply a slow client/generator; the
generator's maximum scheduling lag remained 22.446 ms.

Peak API RSS 162.03 MiB; peak one-core CPU 21.86%. No production changes or
failure occurred. The outlier remains an open finding, not a fixed defect.

## Narrower follow-up

Inspection of installed `better-sqlite3/lib/methods/transaction.js` confirms that
internal BEGIN/COMMIT statements bypass public `db.prepare`. A second repeat adds
whole-transaction and callback timing, leaving begin/commit/rollback together as
boundary time, and traces only `fsync`/`fdatasync` system calls in the synthetic
process tree:

```sh
strace -f --seccomp-bpf -e trace=fsync,fdatasync -T -ttt \
  -o /tmp/gumwheel-mixed-sync-20261017.log \
  node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed \
  --users=100 --seconds=600 --diagnostics
```

This adds observer/tracing overhead and is a diagnosis cohort, not a directly
comparable uninstrumented performance benchmark. The syscall trace includes no
buffers/payloads. Read-only `/proc` descriptor inspection confirmed the traced
worker's descriptor 22 was the synthetic database and 23 its WAL, not production.
The exact private fixture path is intentionally omitted from the public report.

### Second repeat: sync mechanism observed, large outlier not reproduced

[Full report](results/mixed-2026-10-17-transaction-sync-100-users.json), finished
`2026-10-16T13:48:26.398Z`; [sanitized sync trace](results/mixed-2026-10-17-filesystem-sync.json).
19,658 requests, 150 completed journeys, zero failures/skips, all requests within
500 ms; slowest 74.200 ms. Peak event-loop P99 91.488 ms, **zero of 599 windows
above 250 ms**. Peak CPU 19.10% of one core, RSS 155.64 MiB. Integrity, foreign
keys, unique acceptance and acknowledged row-count checks passed again.

The longest measured transaction took 70.712 ms: callback 0.163 ms, boundary
70.548 ms. Its approximate wall-clock start is 13:38:39.281Z, derived from the
worker-monotonic timestamp and its enclosing metrics timestamp. In that interval:

| Synthetic file | Sync start (UTC) | Elapsed |
| --- | --- | --- |
| WAL | 13:38:39.281Z | 60.244 ms |
| Database | 13:38:39.342Z | 9.792 ms |

The two syncs total **70.036 ms**, about **99.0%** of that transaction's elapsed
time. This is direct evidence of storage-sync waiting at a transaction boundary
for this smaller pause. It is not evidence that a SQL query itself ran for 70 ms.
The trace has 38 sync calls including startup/shutdown; none exceeded 60.244 ms.
No one-second sync was observed in this repeat.

## Interpretation: what is known, likely and still unknown

- **Confirmed:** a >250 ms outlier is reproducible, but not reliably every run.
  Original: 285.737 ms; first repeat: 1,039.139 ms; second repeat: 91.488 ms maximum.
  The first repeat delayed multiple endpoint responses together, not just one GPS
  request. It recovered without errors or missing persisted lifecycle records.
- **Confirmed mechanism in the smaller traced pause:** synchronous transaction
  boundary waits for filesystem sync, holding up the Node event loop. Low CPU
  during such waiting is expected; more free RAM or CPU cores alone does not
  establish a fix.
- **Leading explanation, not proven for the original/one-second outliers:**
  intermittent SQLite checkpoint/storage-sync waiting. SQLite documents that WAL
  checkpoints can run in the committing thread and cause occasional slower commits;
  NORMAL mode does not sync on every commit. This explains why delays need not
  appear on every request. See [SQLite WAL performance considerations](https://www.sqlite.org/wal.html#performance_considerations).
- **Still unknown:** whether the two large pauses were the same mechanism, and
  whether any storage wait arose from SD-card firmware, filesystem/writeback or
  other host activity. The original lacks tracing; the first repeat did not time
  transaction boundaries; the traced repeat did not reproduce the large stall.
  Do not label the SD card defective, declare a unique root cause, or claim a fix.
- **Not supported by the first repeat's large-pause evidence:** sustained CPU
  saturation, swapping or a long GC event. This does not exclude those causes
  under different future loads.

Only one above-threshold measurement window in a run is not a guarantee of a
one-time event. Periodic checkpoints plus variable storage latency are a plausible
reason for isolated outliers; their frequency is not established by three short
runs. Instrumentation changes timing, so a clean traced run cannot disprove this.

## Finding and verification

**LAT-001 remains open:** intermittent event-loop tail stalls in the SD-card mixed
workload. No optimization, checkpoint policy, durability setting, worker count or
production limit was changed. If continuing diagnosis, retain transaction/sync
instrumentation for another approved trip-free window, optionally add low-overhead
block-I/O/host-pressure correlation. Do not stress production or weaken durability
to hide the symptom. Any proposed mitigation needs its own controlled comparison
and recovery/integrity retest before deployment.

Both new runs together completed **39,316 successful requests and 300 journeys**.
API health and aggregate zero-real-trip checks passed before, periodically during,
and after the tests. These are core API loopback tests, not external providers,
real browser/GPS, tunnel/network, hardware failure or certified production capacity.

Final validation: **87 regression tests pass**, including diagnostic argument
rejection, and ESLint passes. Test DB was isolated. No UI changed, so no new visual
review/build is claimed; no API restart or verified frontend deployment. Commit/push
records the harness and evidence, not a production performance fix.
