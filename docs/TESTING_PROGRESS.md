# Reliability testing progress

Maintain this register when running a new reliability/capacity/fault campaign.
Link reproducible commands and sanitized reports; keep findings open until a
relevant retest verifies the fix. Do not infer production deployment from a push.

| Date | Campaign | Result / scope | Evidence |
| --- | --- | --- | --- |
| 2026-10-26 | Explicit rider-post replacement | 181 regressions and lint/build pass. Synthetic rollback, stale/foreign target, retry/history and old-offer checks; HTTP conflict/success coverage. Initial invalid test-time fixture corrected. API `497f159` backed up/restarted at 11:34:29 AEDT after zero-underway checks; 131 rides/77 requests/2 posts retained, integrity/FKs pass. Initial startup health failures cleared on recheck; local/public health pass. No live test writes. | [Contract and checks](RIDER_DEMAND_2026-10-25.md#explicit-post-replacement--26-october-baseline-a3a40b8) |
| 2026-10-26 | Posted need + pending join acceptance | 180 regressions, lint/build, four-width post flow and twelve Profile cases passed. Both acceptance orders and injected-fault rollback tested with synthetic SQLite. Mobile/desktop visual review; API backed up/restarted at 11:01:48 AEDT after zero-underway check, 131 rides/77 requests/2 posts retained, health/integrity/FKs pass. No live test writes. Frontend deployment unverified; not a capacity or multi-process race certification. | [Contract and reproduction](RIDER_DEMAND_2026-10-25.md#postjoin-coexistence-checks--26-october-baseline-a63393b) |
| 2026-10-25 | Rider-posted demand / driver responses | 175 isolated regressions, lint/build and two four-width browser suites pass. Mobile/desktop visual review; API backed up/restarted after zero-underway checks, 130 rides/77 requests retained, health/integrity/FKs pass. Not a capacity campaign; authenticated production walkthrough and frontend deployment unverified. | [Contract, failed baselines and checks](RIDER_DEMAND_2026-10-25.md) |
| 2026-10-24 | Open email accounts / public profiles | 160 isolated regressions and 52 security checks pass; legacy sessions/principals preserved, rename collisions and photo parsing/authorization tested. Four-width Profile/login checks and three-width driver/rider checks; deployment evidence in guide. Initial obsolete university-only failures retained. Not a capacity or penetration-test certification. | [Contract and evidence](PERSONAL_DETAILS.md), [security baseline](testing/personal-details-security-baseline-2026-10-24.json), [security retest](testing/personal-details-security-2026-10-24.json) |
| 2026-10-23 | Matching pickup allowance 20% | 150 regressions; targeted lint and production build pass. Geometry boundary and outbox deduplication/no-backfill checks; read-only reported-case recheck matches. Standalone type errors in untouched tests remain. API activated 13:05:28 AEDT after backup/zero-underway checks; 124 rides retained, health/integrity/FKs pass. No live test email. | [Matching checks](MATCHING_CORRIDOR_2026-10-23.md) |
| 2026-10-23 | Matching email / entry links | 148 isolated tests; lint/build; 320/390/1440px mocked direct/legacy links, missing/unavailable rides, sign-in resume, mute focus and HTML preview. API restarted 12:20:32 AEDT after backup/zero-underway check; 123 rides retained, health/integrity/FKs pass. Real inbox rendering and authenticated production walkthrough unverified. | [Email checks](MATCHING_EMAIL_2026-10-23.md) |
| 2026-10-23 | Private vehicle details / acceptance | 147 regressions, 52 security checks, 25 recovery checks, lint/build; three-width vehicle and six message-entry browser cases. Two failed GPS harness baselines retained and fixture corrected. API 9715d9a activated 10:39:48 AEDT after backup/zero-underway check: 121 rides retained, health/integrity/FKs pass. Authenticated live walkthrough unverified. | [Vehicle behaviour, evidence and checklist](VEHICLES.md) |
| 2026-10-22 | Find save-route / email consent | 134 isolated regressions; four-width mocked save/replace/consent/conflict/Profile checks, lint/build. API cc021be activated 14:50:59 AEDT after backup/zero-underway preflight; health/integrity passed, 118 rides retained. No live emails/load test; frontend deployment separate. | [Save-route checks](SAVE_SEARCH_ROUTE_2026-10-22.md), [Driver countdown](DRIVER_DEPARTURE_2026-10-22.md) |
| 2026-10-22 | Departure UI and optional origin location | 132 regressions, lint/build; mocked responsive checks for countdown states, two departure choices and explicit GPS. No backend change. | [Departure](DEPARTURE_DISPLAY_2026-10-22.md), [Origin GPS](ROUTE_LOCATION_2026-10-22.md) |
| 2026-10-22 | Acceptance-gated GPS privacy | Isolated API/core tests and mobile/desktop GPS-spy checks; API restarted from ccc4229, local/public health passed. Authenticated live flow unverified. | [Privacy checks](GPS_PRIVACY_2026-10-22.md) |
| 2026-10-22 | Future-offer discovery and shared search locality | 131 regression tests, lint/build and four-width mocked browser suite passed; production API restarted, local/public health passed. | [Causes, checks and boundaries](DISCOVERY_LOCATION_2026-10-22.md) |
| 2026-10-22 | Shared Profile/Offer/Find address entry | 128 regression tests, lint/build; mocked four-width flows and private draft restore. No production changes or capacity test. | [Checks and manual walkthrough](SHARED_ROUTE_FIELDS_2026-10-22.md) |
| 2026-10-22 | Profile / shared contribution fields | 127 regression tests, lint/build and both four-width browser scripts passed; $1 minimum, cents, migration preservation, email-off confirmation and mobile containment. | [Checks and deployment](PROFILE_POLISH_2026-10-22.md) |
| 2026-10-21 | Free rides / optional contributions | 125 regression checks passed, including legacy fare migration preservation, free HTTP offering and pickup lifecycle; mocked mobile/desktop free/paid flows. Production migration/deployment not performed. Not a capacity campaign. | [Scope, commands and findings](FREE_RIDES_2026-10-21.md) |
| 2026-10-21 | Private usual routes / alerts | 120 regression tests, four responsive usual-route and six existing message-entry cases passed; lint/build passed. Approximate matching, bounded opt-in outbox and preserved history; not a capacity campaign. Standalone test type errors retained as a baseline limitation. | [Verification and owner checklist](USUAL_ROUTES_CHECK_2026-10-21.md) |
| 2026-10-20 | Legend/chat layout | 109 regression tests, six entry/layout and eight role/viewport checks passed; single report link, 57-minute-old location and iPhone 14 Pro CSS width checked without production mutations. | [Evidence](LEGEND_CHAT_LAYOUT_2026-10-20.md) |
| 2026-10-20 | Request-to-message entry | 109 regression tests; six mocked request-entry and eight messaging role/viewport checks passed. No production mutations; frontend deployment separate. | [Checks and failed baselines](MESSAGE_ENTRY_CHECK_2026-10-20.md) |
| 2026-10-20 | Login resend countdown | 100/100 regression tests, lint/build; mocked portrait/landscape/desktop checks passed; no automatic polling or sends; physical devices/deployment unverified | [Checks and reproduction](CODE_COOLDOWN_2026-10-20.md) |
| 2026-10-19 | Disable production samples | 92/92 tests, lint/build pass. Activated 21:55 AEDT: zero public samples, all 112 ride records retained, real rides unchanged, API healthy. | [Sample retirement](SAMPLE_RETIREMENT_2026-10-19.md) |
| 2026-10-19 | Mutual ratings | 90/90 suite; isolated HTTP/account/threshold checks; driver/rider Chromium at 320/390/1440px. Production activation and new-query load tests pending. | [Ratings verification](RATINGS_CHECK_2026-10-19.md) |
| 2026-10-19 | Driver pickup-input / role-specific Copy | Mocked Chromium touch/desktop 320/390/1440 pass; 87 regression tests, lint/build pass; physical mobile keyboards and deployment unverified | [Checks and reproduction](PICKUP_INPUT_CHECK_2026-10-19.md) |
| 2026-10-16 | Isolated GPS/polling load | 5–160-trip ramp and 80/120/160-trip soaks; pressure at 160, not a certified user ceiling | [Initial results](BACKEND_LOAD_RESULTS_2026-10-16.md) |
| 2026-10-16 | Burst timing and history/discovery load | Separate workloads; GPS burst sensitivity and history workload memory guardrail | [Overnight report](OVERNIGHT_CAPACITY_2026-10-16.md) |
| 2026-10-16 | Frontend connection errors | Shared timeout/errors; 82-test baseline and mocked mobile/desktop recovery checks; production outage not induced | [API failure contract](API_FAILURES.md) |
| 2026-10-16 | API crash/retry and persisted state | 23 checks pass, REC-001 open: renewal code can persist without its audit event | [Recovery campaign](RECOVERY_TESTING.md), [machine-readable result](results/recovery-2026-10-16.json) |
| 2026-10-16 | REC-001 remediation/retest | Fixed in source; 25/25 fault checks, 84 regression tests and lint pass; production restart not performed | [Remediation](RECOVERY_TESTING.md), [fixed-run result](results/recovery-2026-10-16-fixed.json) |
| 2026-10-16 | Basic synthetic backup/restore | 9/9 checks, 85 regression tests and lint pass; BAK-001 off-Pi protection unverified; two corrected harness failures retained | [Procedure and findings](BACKUP_RESTORE_TESTING.md), [result](results/restore-2026-10-16.json) |
| 2026-10-16 | Pre-pilot authorization/privacy | 52/52 security checks; 25/25 recovery/concurrency rerun; 86 regression tests and lint pass; no runtime/deployment change | [Matrix and limitations](SECURITY_TESTING.md), [dated result](results/security-2026-10-16.json) |
| 2026-10-16 | Mixed core-API capacity | SD-card 100-user ten-minute mix passed 19,657 requests/150 completed journeys, zero failures/skips; 87 regression tests and lint pass; RAM runs and failed smoke retained | [Results](MIXED_LOAD_RESULTS_2026-10-16.md), [reproducible procedure](MIXED_LOAD_TESTING.md) |
| 2026-10-17 | Event-loop outlier reproduction | Two ten-minute 100-user repeats, 39,316 requests/300 journeys, zero errors/skips; first reproduced 1,039 ms stall and two >1s GPS responses; traced repeat max 91 ms, smaller pause tied to filesystem sync; LAT-001 open, 87 tests/lint pass | [Investigation, commands and evidence](EVENT_LOOP_INVESTIGATION_2026-10-17.md) |

## Open findings

- **LAT-001:** intermittent SD-card mixed-workload event-loop stalls reproduced,
  but exact cause of the large spikes remains unproven. Transaction/storage sync
  is the leading explanation; a smaller pause was directly correlated with sync.
  No mitigation applied. See [17 October investigation](EVENT_LOOP_INVESTIGATION_2026-10-17.md).

Mixed-workload campaign completed 2026-10-16 at `ea59f55`: RAM-backed 25/50/100
stages, then corrected-storage SD-card 50/100 stages passed. Final ten-minute
100-user mix: 19,657 requests, 150 completed journeys, zero failures/skips.
See [dated results and retained baseline](MIXED_LOAD_RESULTS_2026-10-16.md) and
[commands, isolation and exclusions](MIXED_LOAD_TESTING.md). One transient
event-loop sample exceeded 250 ms, without a sustained guardrail breach.

Security campaign completed 2026-10-16: **52/52** isolated checks and **25/25**
repeated recovery/concurrency checks at `bd20dfc`. See [scope/matrix](SECURITY_TESTING.md),
[dated security result](results/security-2026-10-16.json) and
[recovery rerun](results/security-recovery-2026-10-16.json). Reproduce with
`npm run test:security` and `npm run test:recovery`. Initial harness OTP-status
assertion failure is preserved in the guide. No runtime/deployment change.

- **BAK-001:** off-Pi backups and production recovery objectives are unverified.
  Owner subsequently confirmed no off-Pi backup and explicitly deferred it for
  now. Risk accepted/deferred, not remediated; host-loss data loss remains possible.
  Synthetic restore passed nine checks; this does not verify a live backup.
  See [backup/restore drill and retained harness failures](BACKUP_RESTORE_TESTING.md)
  and [dated final evidence](results/restore-2026-10-16.json), tested 2026-10-16
  at application revision `0dfd33e`. Command: `npm run test:restore`.

- **REC-001 deployment:** source fix and isolated retest complete. Controlled
  production API restart and post-restart verification are still pending. The
  original failed report remains above; source fix is not proof of live deployment.
- **Lost-response UX:** most lifecycle retries reject already-applied actions;
  polling/state reconciliation is necessary. A general idempotency-key workflow
  remains unimplemented, not implied by duplicate guards.
- Existing standalone TypeScript errors in unchanged test files are recorded in
  the API failure guide; successful production builds are a separate check.

## Required record for subsequent campaigns

Record tested source revision, date, host/runtime scope, reproducible command,
safety/isolation, pass/fail/findings, explicit exclusions and deployment status.
Keep earlier results as history; append rather than silently replace a failed
baseline with a green result. Never commit session tokens, codes, raw user data,
live GPS or test databases. A testing claim must identify what was actually exercised.
# Lift-request clarity and role-switch regression — 25 October 2026

Baseline `4b69006`; see [dated lifecycle and verification record](RIDER_DEMAND_2026-10-25.md).
177 isolated tests passed, including consent identity, rollback and HTTP paths;
lint/build passed. Mocked browser checks cover mobile/tablet/desktop demand,
calendar and join-message flows. Reproducible commands, initial sandbox failures,
the fixed plate-modal state failure and unverified production/device boundaries
are recorded in that guide. No production load tests or database writes.

# Private messaging regression — 20 October 2026

See [dated report](MESSAGING_CHECK_2026-10-20.md) and [protocol](MESSAGING.md).
Baseline `57972cb`; synthetic DB and mocked mobile/desktop campaign. 108 regression
tests passed, including participant isolation, lifecycle, quotas, idempotent
retries and backup/reopen. Responsive/keyboard scenarios cover both roles.
Preserved findings: legacy migration order corrected and retested; test-only
authentication config and modal/anchor assumptions corrected. No production load
or chat-capacity conclusion; real-device/live two-party checks remain outstanding.
Final lint/build and eight role/viewport browser scenarios passed. API activated
03:24 AEDT after protected backup; 112 rides/67 requests preserved, schema/integrity
checked. Local/public proxy health and unauthorized denial verified; initial
transient connection failure retained in the report. Frontend rollout/live
authenticated exchange not claimed verified.
