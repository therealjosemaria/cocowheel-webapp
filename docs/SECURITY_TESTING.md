# Pre-pilot security regression campaign — 16 October 2026

## Result and reproducibility

**52/52 authorization/privacy checks passed**, against application revision
`bd20dfc`. No application security failure was observed in these cases. This is
not a penetration-test certification, exhaustive attack coverage or production
launch approval. The campaign changed only tests/documentation, not runtime code.
Routine validation: **86 tests passed**, ESLint and `git diff --check` passed.
The opt-in harness guard is included in the routine suite. No frontend build or
production deployment was performed for this test-only change.

```sh
npm run test:security
npm run test:recovery
```

Evidence: [security result](results/security-2026-10-16.json), plus
[25/25 repeated crash/concurrency checks](results/security-recovery-2026-10-16.json).
Each report records source revision; the security report also identifies the
exact harness SHA-256. The first harness run incorrectly expected OTP replay to
return 400 rather than the implemented 401. It stopped before the matrix, and
its [failed report](results/security-2026-10-16-harness-replay-failure.json) remains
preserved. Correcting this assertion required no application change.

## Isolation

The security harness rejects every argument except explicit `--run`. No arguments
print help without starting an API. It does not accept a target URL or database.
It clears inherited application configuration before dynamic application imports,
uses a new restricted temporary SQLite database and random encryption key, and
starts a single real HTTP API on an OS-assigned loopback port. External provider
fetch is disabled and email delivery is an in-memory test double. Samples are off.
OTP issuance and verification themselves use real HTTP handlers, not seeded
authenticated sessions; expiry tests deliberately age only fixture sessions.

No production database, real inbox, live ride, tunnel or service is accessed.
Synthetic fixtures remain in private temp directories; reports never include
tokens, OTPs, pickup codes, PayID values, coordinates or raw responses. Failed
assertions report the scenario, not sensitive assertion payloads. Exit 0 means
all checks passed; exit 1 means at least one failed or setup stopped. Individual
matrix failures are collected; a failed prerequisite stops later scenarios.

## Tested permission matrix

| Boundary | Actors / state | Assertions |
| --- | --- | --- |
| Login | Seven university/allowed-exception identities | Real code/verify flow; HttpOnly and SameSite=Strict cookies; no session token or plaintext OTP in JSON; replay 401 |
| Login abuse | Invalid email, UniKey, object, SQL-like and header-injection strings | 400 INVALID_UNIKEY; no mail delivery |
| Auth request origin | Missing auth marker or foreign Origin | 403, no mail |
| OTP attempts | Same identity resend; five wrong guesses then correct code | Resend 429; all guesses/correct-after-lockout 401; no account created |
| Create/join | Anonymous, forged token, legacy guest | Denied; no trip mutation |
| Private details | Anonymous, forged token, unrelated account | Denied without ride payload |
| Accept/decline, confirm, begin, GPS, GPS ownership, early completion | Anonymous, pending rider, unrelated account | Denied; exact before/after equality of trip/request/event/location/evidence/ownership tables |
| Cancel/withdraw | Unrelated account | Denied without trip mutation |
| Public availability/preview | Anonymous during pending request | No private rider labels, PayID, pickup code or credential fields; public driver data intentionally remains public |
| Request-ID substitution | Rider supplies competing rider request ID | No competing private data; only own request or denial allowed |
| Current/history | Unrelated account | No other account's ride or private fields |
| Admin dashboard/inspector | Anonymous, unrelated university user, guest, Gmail exception | 403; owner succeeds with no-store; no PayID or encrypted-code disclosure |
| Foreign Origin | Valid participant cookie | Private read and cancellation denied without mutation |
| Self-join/renewal | Driver | Cannot join own offer or renew rider code |
| Accepted/pre-pickup | Accepted rider, driver, discarded rider | Code available only to accepted rider; PayID absent from rider details/history/current; self-confirm and early completion denied |
| Competing rider after acceptance | Discarded rider / second acceptance | Cannot cancel accepted ride, take GPS ownership or replace accepted rider |
| Paired | Accepted rider vs discarded rider/outsider/public preview | PayID revealed to paired rider, not others; code replay denied without mutation |
| Sign-out | Previously accepted rider | Real logout invalidates private read/completion access; driver still sees ongoing trip |
| Expiry | Owner and participant sessions | Aging fixture expiry removes admin/private/mutation access immediately |
| Final storage | Synthetic database | Integrity check ok, no FK violations |

Denial assertions use a 4xx allowlist, not a requirement that every domain error
uses the same status. They also assert unchanged protected tables, not merely
absence of a success message. Identity/logging tables are not part of that
trip-state snapshot. Mutation payloads are valid for the intended operation.

## Related checks rerun

The separate recovery campaign rechecks simultaneous acceptance (one winner),
duplicate publications, requests to competing offers and driver/rider role races
(one active item), code renewal atomicity and selected crash/retry boundaries.
These are single-process API concurrency checks, not distributed-server locking
or a capacity test. The routine suite additionally covers OTP expiry, persisted
limits, account switching, pickup lockout/renewal and GPS-source takeover.

## Remaining launch boundaries

- No browser UI, XSS/rendering, dependency audit, arbitrary-input fuzzing,
  deployment/proxy caching, production cookie transport, TLS or network attack
  assessment was performed. No UI changed; mobile/desktop visual review is not
  claimed. Cookie Secure is not asserted by this NODE_ENV=test harness.
- Provider email delivery, quotas and resistance to sustained distributed abuse
  are not established by a few local rate-limit checks. Code currently allows
  100 sends globally per hour: a 100-person launch plus resends needs its own
  onboarding/quota assessment; do not silently raise this protection.
- Not every endpoint/state/identity combination is tested. Search/provider abuse,
  sample-specific actions, all historical-record permutations, and alternate
  request encodings remain outside this matrix. Legacy guests intentionally keep
  access to their own old trips, but cannot publish/request new ones.
- Real-device reconnection, GPS/permission/battery behaviour and real end-to-end
  participant flow remain another launch gate. No deployment/restart was made.
- No off-Pi backup exists, as confirmed by the owner after the restore drill.
  The owner has deferred that protection for now; host-loss data-loss risk remains.
  Do not treat this acceptance as a passed recovery safeguard.

Next planned gate: a bounded mixed-workload capacity campaign for potentially
100 concurrent users, with isolated fixtures and external-provider calls excluded
or separately budgeted. Its safe live-trip-free window and stop thresholds must
be checked before running. Passing this security matrix is not a capacity claim.
