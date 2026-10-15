# Isolated polling and GPS capacity preparation

Status: harness prepared, first isolated ramp and ten-minute 80/120/160-trip soaks completed; see
[16 October results](BACKEND_LOAD_RESULTS_2026-10-16.md). One-trip smoke
verification is not a capacity result.
Never use this tool against a live service or run meaningful load on the production
Pi while real trips are active. Data isolation is not CPU/RAM/storage isolation.

Preparation verified 16 October 2026: argument-safety tests and lint passed. The
final three-second smoke made six successful requests (two per endpoint), with
two GPS records updated after startup, two ownership rows, one paired trip and
SQLite integrity `ok`. Maximum observed request time was about 58 ms; six requests
are far too few to establish meaningful latency percentiles or safe capacity.
Subsequent maintenance-gated stages are recorded separately in the results above.

## Scope

`scripts/backend-load.mjs` starts the actual API in a separate child process on an
OS-assigned **127.0.0.1** port. Its SQLite file is created in a new private
`/tmp/gumwheel-backend-load-*` directory. The production API is not restarted or
contacted, and production `.env` is not loaded. The child receives a minimal
environment and a fresh test encryption key before any API/database imports.
This matters because `server/db.ts` opens a default database at import time.

Fixtures use synthetic accounts/session hashes and normal core publish, request,
accept, GPS and pickup-confirmation functions to create non-sample paired trips.
Mail verification is intentionally not load-tested; fixture accounts are inserted
only into the disposable database. The sample simulator is disabled. Worker fetch
is blocked so unintended provider requests fail closed. Do not add live provider
keys or routes to this tool. It does not accept a target URL or database argument.

## Workload v1 (deliberately reduced)

For every trip, both participants send:

| Request | Cadence per participant |
| --- | --- |
| GET current ride | 10 seconds |
| GET ride details | 8 seconds |
| POST GPS location | 20 seconds; driver offset ten seconds from rider |

Approximately **0.55 requests/second per trip** at steady state. Starts are spread
across time to avoid artificial synchronized read bursts. Synthetic locations are
fixed, accurate points with fresh capture timestamps; there are no device GPS calls.
The smoke mode sends each request immediately, once per participant.

This is not the full frontend workload: it excludes profile session checks,
additional tracking/current polls, search, history, route preview, signup,
provider calls, sample-timer work and lifecycle mutations during measurement.
Seeding occurs before measurement. The results apply only to this defined mix,
with a fresh synthetic database—not a mature production history.

## Commands

From the repository root, with dependencies installed:

```bash
# No server or load starts by default.
node --import tsx scripts/backend-load.mjs

# Fixed one-trip / two-participant / three-second functional smoke.
node --import tsx scripts/backend-load.mjs --smoke

# Only AFTER agreeing a maintenance window or using a separate machine:
node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=1 --seconds=120

# Sustained workload used after the first ramp, with renewed operator approval:
node --import tsx scripts/backend-load.mjs --run --maintenance-confirmed --trips=80 --seconds=600
```

The first approved ramp skipped the longer one-trip baseline after smoke checks:
5, 10, 20, 40, 80 and 160 trips. Future runs require a fresh maintenance window
and stage selection based on observations. Inspect each report before proceeding.
The confirmation flag is an operator acknowledgement, not automatic proof that
production has no active users. Load is capped at 250 trips and 30–600 seconds;
these are harness safety bounds, not supported capacity claims. Unknown, duplicate,
out-of-range and conflicting arguments are rejected before server startup.

## Measurements and stop conditions

JSON reports contain per-endpoint count/failures and p50/p95/p99/max latency,
scheduler skips/start lag, API RSS, generator RSS, process CPU (100% = one core),
event-loop p99 delay, system free RAM, database and WAL sizes. The final check
verifies SQLite integrity, active trip count, independent ownership rows and that
every participant's latest fix was updated after the workload began.

Responses are checked for the expected ride, status and current-source permission,
not just HTTP 200. Tokens and response bodies are not printed or included in reports.

Provisional automatic guardrails stop scheduling new work at:

- API RSS above 512 MiB or system **free** memory below 512 MiB (not Linux reclaimable
  available memory; deliberately conservative).
- Five consecutive one-second samples with API CPU above 90% of one core or
  event-loop p99 above 250 ms.
- Five failed HTTP/semantic responses, or rolling p95 latency above one second
  after 100 responses.
- Duration expiry, worker exit, or Ctrl+C/SIGTERM.

Requests have a five-second timeout; active work drains before shutdown. One
in-flight request per participant/endpoint is allowed; skipped arrivals are recorded.
Skipped arrivals or generator lag must be treated as unmet offered load, not as
proof that the server sustained the desired rate. Early stop, failed responses or
failed final checks yield a nonzero exit status. No automatic next-stage ramp occurs.

The worker uses the same host as the load generator, so shared CPU and storage can
distort results. No tunnel/internet/browser rendering measurements are included.
Latency includes loopback HTTP and JSON parsing. These reports do not directly
measure SQLite lock wait or certify GPS freshness under real mobile networks.

## Artifacts and cleanup

The tool prints the exact temporary `report.json` path and retains its synthetic
SQLite/WAL artifacts for inspection. Those files contain synthetic session material;
keep the private directory private and share only reviewed reports. No real user
database is copied. After reviewing, remove only that explicitly validated temporary
directory, not a wildcard or repository data directory. The worker is shut down in
the runner's cleanup path; abrupt machine/process failure can leave artifacts.

## Before the actual capacity run

1. Agree the maintenance window; confirm no real trips need this Pi's resources.
2. Record host CPU/RAM/swap/disk, other services and current API health.
3. Run smoke; inspect all final checks and zero failures.
4. Run the first 120-second stage, inspect latency/resources/skips, then decide.
5. Stop at sustained degradation; allow recovery and verify production health.
6. Derive headroom only after repeated and longer sustained runs; do not set an
   admission limit from a three-second smoke or a single short stage.

No production limit, service configuration or provider budget is changed by this
preparation. Backups, restart recovery, fault injection and provider quotas are
separate follow-up tests.

## Overnight diagnostic extensions

The owner authorized autonomous sequential tests for up to eight hours after the
overnight request, stopping at measurable degradation rather than forced failure.
No production behavior or safety thresholds are changed.
Completed experiments and boundary interpretations are recorded in the
[overnight report](OVERNIGHT_CAPACITY_2026-10-16.md). No further unattended runs
are scheduled by this harness.

- `--gps=synchronized|staggered` (default synchronized) changes only GPS phases.
  Staggering distributes each pair deterministically over 20 seconds while
  preserving the ten-second driver/rider offset and total offered volume.
- `--profile` times statement execution (`get`, `all`, `run`) by expiry/select/write
  category, excluding setup. It does not time statement preparation, transaction
  begin/commit, JSON serialization or network queueing; totals are not total DB
  cost. Only counts/timings are retained, never SQL parameters or response bodies.
- Reports add ten-second latency windows and label the schedule/workload/profile
  configuration. Resource samples still lack explicit timestamps; exact cross-
  correlation requires additional instrumentation and must not be claimed.
- Generator failures use an incremental counter rather than rescanning its entire
  response history on every request. Compare schedules on this same revised harness.
- `--workload=history --history=20` switches to history and availability reads,
  each every ten seconds per participant (0.4 requests/s per synthetic pair).
  Fixture depth is bounded 1–100, with at most 5,000 total completed rows;
  default 20 completed rides per account. Each
  pair shares those completed rides; the database has pairs × depth historical
  rides, plus paired fixture rides and 20 separately owned public offers.
  Completed rows are synthetic clones, not a claim that lifecycle transitions
  were exercised during measurement. Public offers use normal publish logic.
  This workload sends no GPS writes and expects zero post-start fix updates.
  Responses must contain the expected history count and 20 discoverable offers.

Existing bounds (250 pairs, 600 seconds), loopback-only targeting, provider block,
private fixtures and guardrails remain. History fixture construction is excluded
from measured load; setup still has the existing 30-second readiness deadline.
Do not compare history request rates directly with GPS rates as equal-cost work.
