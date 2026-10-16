# Mixed-workload results — 16 October 2026

## Conclusion

The tested **100-user mix sustained ten minutes on the Pi's SD-card filesystem**:
19,657 successful requests, 150 completed journeys, zero response/semantic failures
and zero scheduler skips. Every measured request completed within 500 ms.
This supports this specific core-API workload, not a guarantee for 100 real users
under every condition, a measured breaking point, or permission to skip the
remaining external-provider and real-device launch checks.

Application source: `ea59f55`. Exact working-tree harness hashes and source
revisions are in each report. No production application/configuration was changed.
See [reproducible commands, workload and stops](MIXED_LOAD_TESTING.md).

## Safety and environment

The API health check passed and aggregate open non-sample ride count was zero
before stages, periodically during stages, and after the final soak. These were
read-only operator checks, not production load requests. The test used separate
synthetic databases, a separate loopback API child and no external providers.
The production service was not restarted or modified.

Host preflight: approximately 8,062 MiB total RAM, 4,240 MiB available, 2,495 MiB
free; swap was almost full (2,046/2,047 MiB) but brief vmstat samples showed no
active swapping. Other workloads share this Pi: this is not dedicated hardware.
The tests are functional/capacity evidence, not proof of absence of swap pressure
at all times. /tmp initially had about 987 MiB free; the harness stops at 256 MiB.

## Stages (all corrected stages passed)

| Cohort | Duration | Requests | Completed journeys | Slowest request | Peak API RSS | Peak CPU, one core |
| --- | --- | --- | --- | --- | --- | --- |
| 25 users, RAM | 120s | 992 | 6 | 51.0 ms | 97.4 MiB | 9.1% |
| 50 users, RAM | 120s | 1,979 | 12 | 51.9 ms | 106.5 MiB | 10.5% |
| 100 users, RAM | 600s | 19,660 | 150 | 50.1 ms | 176.6 MiB | 15.4% |
| 50 users, SD card | 120s | 1,979 | 12 | 54.9 ms | 101.4 MiB | 11.4% |
| 100 users, SD card | 600s | 19,657 | 150 | 286.7 ms | 160.6 MiB | 16.4% |

All rows had zero failures and zero skipped scheduled work. The four-user,
90-second [smoke](results/mixed-2026-10-16-smoke.json) also passed 119 requests
and one completed journey.

### Important storage distinction

The initial /tmp fixture was on **tmpfs (RAM)**, not the production SD card.
Those results are preserved but cannot establish production-disk latency.
After discovering that, the harness was corrected to create private, Git-ignored
`data/.mixed-load-*` fixtures on the same ext4 SD-card filesystem as the default
production database. The disk-backed 50-user stage and 100-user soak were then run.

The fixture database is never the production database. The application initializer
reported WAL mode and `synchronous=1` (NORMAL). No setting was changed. OS/storage
caching remains in play; this is not a forced-flush benchmark or proof of
durability during sudden power loss. The higher disk-run tail is observed, but
these runs do not isolate whether storage, GC or other host activity caused it.

## Final disk-backed 100-user measurements

The mix was **25 drivers, 25 riders and 50 browsing accounts**, not 100 trips or
100 simultaneous in-flight HTTP requests. Starts/polls were staggered. Users repeat
approximately 90-second lifecycle cycles and history grows from zero. Provider
address search is excluded: `search` below is the core ride-matching endpoint.

| Endpoint/action | Attempts | P95 ms | P99 ms | Maximum ms |
| --- | --- | --- | --- | --- |
| current | 6000 | 4.06 | 6.63 | 243.32 |
| history | 2000 | 5.03 | 6.77 | 271.23 |
| session | 2000 | 4.09 | 7.03 | 30.91 |
| publish | 175 | 8.57 | 18.92 | 25.86 |
| availability | 3000 | 3.95 | 6.04 | 109.03 |
| search | 1500 | 5.84 | 9.01 | 263.05 |
| join | 175 | 8.94 | 61.32 | 156.62 |
| details | 3000 | 6.20 | 10.30 | 261.14 |
| accept | 175 | 8.07 | 24.52 | 154.15 |
| pickup-code-read | 175 | 6.95 | 17.82 | 24.09 |
| pair | 175 | 5.98 | 29.43 | 63.55 |
| gps | 982 | 7.92 | 16.85 | 286.71 |
| complete | 150 | 7.95 | 16.01 | 16.41 |
| history-after-complete | 150 | 6.10 | 8.96 | 17.01 |

All 19,657 attempts were successful within both 500 ms and one second (observed
100% good-event ratio in this run). Do not infer the 28-day reliability objective
from ten minutes. Mutation samples of 150–175 are particularly small for tail
claims. The per-endpoint table avoids hiding rare actions in aggregate percentiles.

- Peak API CPU: **16.4% of one core**, not of the whole Pi.
- Peak API RSS: **160.6 MiB**; generator RSS peak **132.0 MiB**.
- Maximum scheduler start lag: **21.4 ms**; no overlapping-task skips.
- Event-loop sample P99 peaked at **285.7 ms**. **One** of 599 one-second samples
  exceeded 250 ms; not the five consecutive samples needed for the safety stop.
  Retain this transient observation; no cause is asserted or optimization applied.
- Final SQLite integrity: **ok**, zero FK violations, zero duplicate accepted riders.
- Final rows matched acknowledged operations: **175 published/paired trips**,
  **150 completed**, **25 still paired at the measurement cutoff**. Pickup evidence
  count was 175. These remaining synthetic trips are expected, not lost completions.
  Child shutdown ends the test; it does not cancel or delete real trips.

## Retained findings and evidence

Initial four-user smoke used an incorrect route-search URL and hit the five-error
guardrail. This was a **harness endpoint mistake**, not an app outage. Corrected
to `/api/search`, then repeated smoke passed before ramping. Its
[failed baseline](results/mixed-2026-10-16-harness-search-failure.json) remains.

- [25-user RAM report](results/mixed-2026-10-16-25-users.json)
- [50-user RAM report](results/mixed-2026-10-16-50-users.json)
- [100-user RAM report](results/mixed-2026-10-16-100-users.json)
- [50-user SD-card report](results/mixed-2026-10-16-disk-50-users.json)
- [100-user SD-card report](results/mixed-2026-10-16-disk-100-users.json)

Raw reports include timestamped resource samples and sanitized timing/count data;
no tokens, code plaintext, PayID values, coordinates or real account data.
Commands and exclusions are maintained in the harness guide.

Final routine validation after the storage correction: **87 tests passed**,
ESLint and `git diff --check` passed. The routine suite includes mixed-harness
opt-in/bounds/target rejection. No UI changed, so no new mobile/desktop visual
review is claimed; no frontend build, production restart or deployment was
performed. The final production health check passed with zero open real trips.

## Interpretation and remaining gates

No guardrail or core latency objective was breached in this mix. There is no
reason from these results alone to change polling, add CPU workers, raise quotas
or buy a second server. This is not a universal admission limit. Earlier
160-trip polling and large-history findings still apply to their own workloads;
their capacities are not additive.

Not tested here: verification-email surge/delivery, geocoding/reverse lookup,
road routing/tiles, real GPS, browser rendering, tunnel/internet delays, Safari
background behaviour, reconnect bursts, a mature database, long-term memory
growth, hardware loss, power-loss durability or same-process overload recovery.
The deferred lack of off-Pi backups remains an accepted risk, not protection.

Next launch gates: provider/onboarding limits and real-device end-to-end journeys.
The current global 100-verification-emails/hour limit can be reached by 100
first-time testers plus resends; do not silently lift it or send bulk real email
as a load test. Pending production API deployment verification remains separate.
