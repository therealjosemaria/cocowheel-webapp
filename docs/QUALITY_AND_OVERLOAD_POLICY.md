# GUMWHEEL quality standards and overload playbook

Version 1 — 16 October 2026. Planning policy, not a deployment or customer SLA.
The owner approved documenting standards and a prepared response to overload.
The numerical objectives below are initial planning targets; sample rules and
protective mechanisms must be validated before production activation.

**No production monitoring, automatic mode switches, admission limits, cache
warming, polling changes or optimizations are implemented by this document.**
Existing behavior and test guardrails remain unchanged. No new load test is
authorized or started simply by adopting this policy.

## Purpose and evidence

Detect declining user experience early, prepare bounded reusable work where it
helps, and protect ongoing journeys before the host becomes unusable. Trip count
helps forecast demand; latency, correctness, errors and freshness determine quality.
Do not activate protection solely because a trip count reaches 160 or CPU briefly
reaches one core's capacity.

See [measured capacity](OVERNIGHT_CAPACITY_2026-10-16.md): synchronized GPS traffic
degraded between 120 and 160 trips; staggering at 160 reduced GPS P95 from 578 to
11 ms in the diagnostic comparison. History/discovery sustained 400 readers with
4,000 completed rides; 500 readers exceeded the test's 512 MiB process budget.
These are isolated workload findings, not full-app capacity or production SLO
compliance. In particular, degraded relative performance is not automatically a
breach of the new one-second threshold.

## Measurements and initial objectives

Evaluate normalized endpoint and HTTP method separately; never average their
percentiles or let frequent cheap reads hide slow critical actions. Separate
core API endpoints from provider-dependent search, routes and email delivery.
Do not use actual ride IDs, account names or coordinates as metric labels.

| Measure | Initial planning objective | Boundary |
| --- | --- | --- |
| Core API latency | At least 95% of eligible attempts succeed within 500 ms; at least 99% within 1,000 ms | Rolling 28 days, per endpoint/method |
| Core API reliability | At least 99.9% of eligible attempts return the correct successful outcome | Rolling 28 days, per endpoint/method |
| Correctness/privacy | No authorization bypass, early PayID disclosure, incorrect pairing or lost acknowledged durable changes | Any confirmed violation is an incident, regardless of volume |
| GPS freshness | Always show truthful capture age; capture-to-display numerical objective pending real-device measurements | Measure separately from API latency; do not claim a one-second GPS-age guarantee |

An eligible attempt is a supported, well-formed request with valid authorization
and business preconditions. Count transport failures, server errors, timeouts,
malformed success responses and overload rejections of otherwise eligible work
as failures. Expected validation, authorization and legitimate state-conflict
rejections are tracked separately, not counted as server failures. Do not exclude
errors merely because their HTTP status is 4xx. Classification itself needs tests.
Retries are additional attempts; also track logical user-action outcomes so retry
success cannot conceal an initially poor experience. Lost acknowledgements and
duplicate writes require reconciliation/idempotency design, not blind retries.

Latency is measured with a monotonic browser clock from sending the request to
receiving/parsing the complete response. Screen-rendering delay is a separate
metric. Failed/timed-out attempts count as bad latency events, even when their
completion time is unknown; publish successful-response percentiles alongside
good-event ratios, not instead of them. Record API-handler duration separately
to distinguish network/tunnel delay from backend work. Existing loopback reports
measure neither full browser latency nor rendered-map freshness.

The 99.9% reliability objective allows at most 0.1% failed eligible attempts in
the accounting window. A threshold budget is not permission to discard users.
At low volume, report counts and confidence limitations; fewer than 1,000 attempts
does not establish reliable tail behavior. Zero traffic means no data, not 100%
availability. Missing telemetry must be visible, never treated as healthy.

GPS freshness requires capture time, server receipt time and client display time.
Cross-device clock skew must be measured or bounded. Separate connected/visible
devices from background, denied-GPS and disconnected cases; report both cohorts
rather than hide device limitations. Existing 20-second paired cycles and
10-second offsets are scheduling rules, not freshness guarantees. Preserve stale
indicators; the new policy does not alter arrival/proximity or freshness checks.

## Short-window detection rules (proposed, not running)

These operational triggers are distinct from the rolling 28-day objectives.
Use UTC-aligned, non-overlapping one-minute windows and evaluate each endpoint.
A qualifying minute has at least 100 eligible attempts. Never merge endpoint
percentiles. For the following triggers, measure the fraction of eligible attempts
that succeed within the threshold so errors do not disappear from the signal.

| State/signal | Entry condition | Planned response |
| --- | --- | --- |
| Prepare | A repeatable measured demand pattern predicts a surge | Operator reviews bounded preparation; prediction alone does not restrict users |
| Warning | Fewer than 95% finish successfully within 500 ms in two consecutive qualifying minutes | Investigate; consider a separately tested smoothing mechanism |
| Unacceptable latency | Fewer than 95% finish successfully within 1 s in two consecutive qualifying minutes | Escalate to operator; consider validated protective mode |
| Error escalation | Failure ratio above 1% in a rolling five-minute window with at least 1,000 eligible attempts | Escalate independently of latency |
| Recovery candidate | Five consecutive qualifying minutes meet the 95%-within-500-ms target and five-minute errors are at most 0.1% | Operator may progressively restore optional work |

Record low-volume slow/error events individually. Five consecutive server/transport
failures within 60 seconds, a failed independent health probe, or a correctness/
privacy incident prompts immediate operator investigation even below sample
minimums. It does not automatically prove capacity exhaustion. At low traffic,
recovery requires an operator check and successful controlled probes, not five
empty windows. Missing measurements prevent automatic recovery.

CPU, RSS, host available memory, swap activity, event-loop delay, in-flight work,
queue delay and provider status explain symptoms and warn of pressure. They are
not substitutes for user-outcome metrics. The existing 512 MiB harness limit is
not a production memory ceiling; any revised resource budget must account for
other Pi services, startup peaks, reclaimable cache and recovery headroom.

## Prepared Plan B — mechanisms require separate implementation approval

All entries are candidates, not available emergency switches. Until implemented
and verified, an operator can investigate and stop a synthetic test but cannot
claim that a protective application mode has been activated.

1. **Prepare reusable work:** use measured time-of-day/week patterns and bounded
   recent demand, not an assumed university peak. Candidate work includes reusable
   statements and valid cached routes/labels already legitimately needed by users.
   Set explicit item, memory, TTL, provider-quota and concurrency budgets before
   any warming job. Cancel preparation when demand fails to materialize or live
   work becomes slow. Do not invent GPS fixes, pre-approve requests, precompute
   authorization decisions or bulk-query speculative destinations. Existing cache
   availability does not imply predictive warming exists.
2. **Smooth demand:** test staggered periodic work and bounded jitter/backoff for
   reconnects/retries, preserving freshness bounds, pairing slots and ownership.
   This spreads work; it is not an unbounded queue or permission to delay safety-
   relevant actions. Validate mutations before allowing automated retries.
3. **Protect essential operations:** a future mode could slow optional background
   history refreshes and reuse correctly scoped cached historical data. Preserve
   ongoing-ride status, GPS, pairing, cancellation and completion. Visible stale
   state must be labelled. Never serve another account's cache; invalidate on
   sign-out/account switch and relevant state changes. No arbitrary GPS cadence
   reduction or removal of correctness checks is authorized by this policy.
4. **Last-resort new-work control:** admission limits or bounded rejection of new
   work require a separate product decision because they change the non-blocking
   MVP. Do not silently drop actions, acknowledge uncommitted writes, or build an
   unlimited backlog. If later approved, rejection/retry UX and fairness must be
   specified and counted in quality metrics.
5. **Recover gradually:** after recovery criteria are met, restore one optional
   behavior at a time and observe at least five qualifying minutes. Stagger
   refreshes; immediately pause restoration if warning returns. Keep a rollback
   path for each future feature. Automatic restart or data deletion is not Plan B.

The project owner is the initial operational decision-maker. Proposed transitions
are manual until telemetry, controls, ownership and rollback are explicitly
implemented. Keep an incident record of time, endpoint, volume, quality metrics,
resource context, action, result and recovery—without tokens, email, PayID or GPS.

## Controlled validation before activation

1. Implement telemetry separately and measure its overhead. Validate clocks,
   denominators, error classification, missing data and both roles/mobile/desktop.
2. Test the detector with synthetic time windows, including low volume, boundary
   equality, spikes, timeouts and recovery. Test P99/slow-event visibility even
   when P95 looks healthy. Historical aggregate reports cannot establish these
   new consecutive-window rules retrospectively.
3. In a newly approved no-real-trip window or isolated machine: run a baseline,
   increase bounded load, stop escalation when standards breach, then reduce
   offered load while retaining the same API process and database. Existing
   harness runs restart a fresh child per stage, so they do not prove same-process
   recovery. A test-harness extension is required; none is included here.
4. Repeat the boundary and recovery to check reproducibility; retain integrity,
   role/ownership and acknowledged-write checks. Existing hard resource stops
   override the two-minute detection period. Never weaken them merely to reach
   a quality threshold; report an incomplete quality-boundary experiment if a
   resource guardrail fires first.
5. Evaluate one proposed Plan B mechanism at a time against an unchanged control:
   latency, errors, freshness, resource use, fairness and recovery. Add a realistic
   mixed workload and network/device checks before promising real-user capacity.
6. Review targets after the first 28-day observation window and after material
   changes. Version any adjustment and retain old findings; do not relax standards
   after a failed test simply to describe the same performance as acceptable.

## Basis and limits of external guidance

- [Google SRE: Implementing SLOs](https://sre.google/workbook/implementing-slos/)
  supports user-oriented good-event ratios, explicit accounting windows and
  iterative product-specific objectives.
- [AWS: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
  explains retry amplification and smoothing correlated periodic demand.
- [AWS: Using load shedding to avoid overload](https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/)
  describes protecting useful service during overload rather than allowing all
  work to become unusable.

These references inform the method, not Gumwheel's numerical thresholds. The
500 ms / 1 s / 99.9% choices are initial Gumwheel planning standards, not claimed
Uber requirements, industry certification or measured production guarantees.
