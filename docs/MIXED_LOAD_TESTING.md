# Mixed-workload pre-pilot capacity campaign

Prepared 16 October 2026. This guide describes `scripts/mixed-load.mjs`;
dated measured results are recorded separately in the testing register. It is
not a production capacity promise or authorization to run during real trips.

## Safety and invocation

```sh
# Help only, no load
node scripts/mixed-load.mjs
# Functional smoke (requires the same live-trip-free window)
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=4 --seconds=90
# Ramp, inspect results between each stage
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=25 --seconds=120
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=50 --seconds=120
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=100 --seconds=600
```

Only 4, 25, 50 or 100 users and 30–600 seconds are accepted. Exact opt-in and
maintenance flags are required; duplicate/unknown/target/database arguments fail
before starting. The flag alone does not prove maintenance safety. Check open
non-sample rides and API health read-only before and during the run; stop synthetic
work if real activity appears. Do not stop the production service to create a window.

The parent forks a separate test API process with a minimal environment, random
key, private temporary database and OS-assigned loopback port. The worker blocks
provider fetch and email and disables sample simulation. Synthetic account sessions
are seeded, not mailed. The production DB is never opened by the harness; operator
safety checks outside the harness read only aggregate active-trip counts.

Storage correction during this campaign: initial runs used `/tmp`, which is
tmpfs on this Pi. Those results are retained but are RAM-backed measurements.
The harness now creates a unique private `data/.mixed-load-*` directory on the
project's SD-card ext4 filesystem. It never opens the production database, and
Git ignores the fixture. Final reports record SQLite journal/synchronous settings.
Compare storage cohorts separately, using their recorded harness hashes.
The first disk-backed run reported `journal_mode=wal`, `synchronous=1` (NORMAL).
No SQLite setting is changed by the harness. Successful writes/integrity here
are not evidence that the latest transactions survive sudden hardware power loss.

The worker exits on parent disconnect. SIGINT/SIGTERM stop scheduling; pending
requests drain (five-second timeout), followed by integrity checks and shutdown.
If graceful stop does not finish in ten seconds only the owned child is killed.
Synthetic files remain private in the reported temp directory; commit only sanitized
JSON reports. No production config, quotas, service restart or limits are changed.

## Mix and schedule

`floor(users / 4)` pairs cycle through real HTTP publish → join → accept → read
pickup code → confirm pickup → complete → verify history. Remaining users browse.
At 100 users this means **25 driver/rider pairs plus 50 browsers**, not 100 trips.
25 users means six pairs and 13 browsers; 50 means 12 pairs and 26 browsers.
Every account is a distinct synthetic identity. Each stage starts a fresh DB/process.

| Work | Cadence |
| --- | --- |
| All users: current ride | 10 seconds |
| All users: history and session | Each 30 seconds |
| Browsers: availability | 10 seconds |
| Browsers: ride matching (`/api/search`) | 20 seconds |
| Trip participants: details | Eight seconds while a readable ride exists |
| Accepted/paired participants: GPS | 20 seconds each, driver/rider offset ten seconds |

Periodic starts are deterministically spread. Pairs start one second apart; each
cycle waits five seconds between publish/request/accept/pair, travels synthetically
for 55 seconds after pairing, completes, checks history after five seconds, waits
15 seconds and republishes. Response time adds to lifecycle spacing. GPS uses
fixed fresh synthetic coordinates; completion uses the existing confirm-anyway
option. This is server work, not simulated driving or client GPS hardware.

There is one in-flight request per scheduled task; overlaps count as skipped load.
Lifecycle steps depend on responses, so this is a closed-loop human-action model,
not an unlimited arrival-rate test. Periodic start lag is reported. Pre-request
rider reads and GPS outside eligible states are intentionally not scheduled as
HTTP requests; those are not scheduler skips. History grows through real completed
cycles, starting empty; mature large histories are a separate tested workload.

## Measurement and stops

Reports contain source revision, exact harness hash, endpoint counts/status errors,
P50/P95/P99/max elapsed HTTP+JSON latency, successful-within-500/1000ms counts,
skips/maximum scheduling lag, lifecycle totals and timestamped per-second resource
samples. CPU 100% means one core, not the whole Pi. API and generator share hardware.

New scheduling stops for five failed/semantically incorrect responses; rolling
last-100-request P95 > one second; API RSS >512 MiB; host free RAM <512 MiB;
fixture-filesystem free space <256 MiB; or five consecutive samples with
CPU >90% of one core or event-loop P99 >250ms. These are safety guardrails, not
the production SLO detector. Aggregate rolling latency can hide a rare endpoint;
inspect each endpoint's results and sample counts separately.

Exit 0 also requires no skipped work, at least one completed journey, SQLite
integrity ok, no FK errors, no multiple accepted riders, published/completed row
counts matching acknowledged operations and pickup evidence count matching pairing.
Short runs that cannot finish a journey intentionally fail that completeness check.
Errors are not silently retried as successful logical actions; a failed lifecycle
step may be attempted again by the scheduler until the five-error stop, and each
attempt is recorded as a failure. Do not interpret that as an app retry policy.

## Optional event-loop diagnostics

Add `--diagnostics` to a permitted invocation to collect test-worker SQL execution
timings, GC events, event-loop utilization, Linux runnable scheduler waiting,
resource-I/O counters and host swap counters. The report also retains individual
responses taking at least 50 ms. No production instrumentation is installed.
The same guardrails and maintenance requirements apply. Example:

```sh
node --import tsx scripts/mixed-load.mjs --run --maintenance-confirmed --users=100 --seconds=600 --diagnostics
```

SQL timing covers prepared statement `get/all/run` execution, not preparation
or raw `exec`. Transaction diagnostics separately retain slow transaction total,
callback and boundary time (begin/commit/rollback overhead together, not a precise
commit-only measurement). This closes the public-prepare instrumentation gap:
better-sqlite3 prepares transaction-control statements internally. Slow statements
(20 ms or more) retain
only method and SQL verb, never parameters or full SQL. Their elapsed time includes
any OS preemption, so slow SQL alone does not prove disk latency. GC timestamps are
worker-monotonic; observer delivery can occur in a later interval. Scheduler wait
is runnable CPU waiting, not I/O waiting. Host swap counters are cumulative page
counts: compare differences, not their absolute values. Resource `fsRead/fsWrite`
values are operation counts, not bytes. Unsupported Linux counters are nullable.
Diagnostics add measurement overhead; compare cohorts with that caveat. Per-second
event-loop P99 is a timer-delay histogram (20 ms sampling resolution), not HTTP P99
or a count of precisely how many pauses happened. A single outlying interval does
not establish that only one underlying operation was slow.

## Exclusions and untested boundaries

No external address lookup, route provider, email, tile downloads, frontend
rendering, real GPS, internet/tunnel/TLS or mobile lifecycle is measured. Ride
matching is not destination geocoding. No seeded large history, multi-worker or
multiple-server concurrency. Fresh stages do not establish same-process overload
recovery. Small mutation counts cannot certify P99 or 99.9% reliability.

Passing this mix does not prove every distribution of 100 users succeeds, nor
that production cannot fail. Security and restore campaigns remain separate.
