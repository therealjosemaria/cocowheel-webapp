# Recovery and data-integrity testing

## Remediation verified — 16 October 2026

REC-001 is fixed in source: renewal code replacement and its audit event now
commit in the same SQLite transaction. The full isolated campaign passed **25/25
checks (exit 0)**, including a real SIGKILL at the previously failing boundary,
unchanged full state after rollback, and a successful retry with exactly one new
code/event. [Fixed-run result](results/recovery-2026-10-16-fixed.json) records the
tested parent revision (`a1379b1`) and exact working-tree `server/core.ts` SHA-256.
The failed baseline below is retained unchanged as historical evidence.

The normal suite now includes audit-insertion failure both BEFORE and AFTER the
event write: original code/ciphertext/attempts and events must remain unchanged;
retry must save one event and immediate repeat must remain throttled. Existing
tests cover rider-only renewal, old-code invalidation, lockout recovery, pairing
and withheld PayID. No cooldown, code lifecycle, permissions or UI was changed.

Routine validation: **84 tests passed**, ESLint passed. No new browser/layout test
is needed for this server-only transaction change; real-API checks cover both
participant views. Production API restart/deployment has **not** been performed
or verified. Closing this source finding is not a claim it is live, nor proof
against power loss or every failure mode listed below.

## Failed baseline — 16 October 2026

Production-code baseline: `3cb9fc3`. Tests use the real API and SQLite on this
workspace host, not a mocked backend. **23 checks passed and one open finding was
reproduced. This is not an all-pass or “bulletproof” result.** No application,
database schema or production configuration was changed in this test work.

Final routine validation: **83 regression tests passed** and ESLint passed. The
regression command used a fresh default SQLite path as well as each test's own
fixtures, preventing the default DB import from opening the production file.
The fault campaign deliberately returned **exit 2** for REC-001, not exit 0.
No UI changed, so no new browser/layout claim is made; the earlier mocked-browser
results remain a separate campaign. No production deployment was verified.

See [the sanitized result](results/recovery-2026-10-16.json) and
[the testing progress register](TESTING_PROGRESS.md). The initial narrower run
passed 15 checks; expanding coverage exposed the renewal-event gap. The expanded
run was repeated with code state included in rollback snapshots and the same gap
was reproduced. A passing earlier run never supersedes a later finding.

## Repeatable command and safety

```sh
npm run test:recovery
```

`scripts/recovery-check.mjs` requires `--run`; no arguments print help without
starting a server. It rejects target/database/extra arguments. It starts only its
own child on an OS-assigned loopback port, with a fresh private temporary directory,
synthetic sessions and a new encryption key reused across test restarts. Minimal
child environment is set before API/database imports: no production `.env`,
credentials, database, tunnel, systemd service, email or geocoding is used.
Child fetch is disabled and sample simulations are disabled. Production data is
not opened by the harness. Parent disconnect terminates the test child.

This is a low-volume functional test, not a capacity ramp. It still shares host
CPU/storage; do not turn it into a heavy parallel workload during live trips.
It sends SIGKILL only to child handles it created. Never replace this with killing
the real API service or unplugging the Pi. Temp fixtures are retained for local
diagnosis; only sanitized `report.json` belongs in version control. The ephemeral
encryption key, tokens, codes, private fixes and raw DB snapshots are not reported.

Exit codes:

- **0:** every scenario passed, no finding.
- **2:** scenarios completed but a known data-integrity finding was observed.
- **1:** unexpected assertion/startup/harness failure; later scenarios may not run.

The normal suite checks harness argument safety. Crash scenarios are explicitly
opt-in rather than silently running during every routine `npm test`.

## Fault models and evidence

1. **Lost response after commit:** intercept the test response's `end`, after the
   actual handler/core operation, and destroy its socket. Assert the caller really
   sees a failed request, then inspect both roles through real HTTP endpoints.
2. **Process death after commit:** SIGKILL the test process before its HTTP reply;
   restart against the same synthetic DB with the same encryption key.
3. **Death during a transaction:** test-only TEMP triggers crash the process just
   before the operation's event insertion. Compare pre/post restart snapshots of
   ride/request state, code hash/ciphertext/attempt state, event history, pickup
   evidence, latest location timestamps and source ownership. Then retry normally.
   TEMP triggers disappear with the connection; no production fault hooks are added.
4. **Competing requests:** send HTTP requests concurrently to the single API worker
   and assert one accepted rider/active role/offer. This does not certify multi-worker
   operation or multiple processes writing the same database.

The renewal fixture moves only its synthetic code-issued timestamp back 61 seconds
to exercise the existing renewal cooldown without sleeping. Authenticated accounts
and a second login session are seeded in the test DB; real OTP email delivery is
outside this test. Session survival/authorization, rather than OTP issuance, is tested.

## Checked outcomes

| Area | Observed outcome |
| --- | --- |
| Publish / request response lost | Saved offer/request survives restart; replay rejected as OPEN_ITEM_EXISTS; no duplicate |
| Acceptance response lost | Acceptance and encrypted pickup code survive; retry REQUEST_UNAVAILABLE; rider PayID still hidden |
| Unauthorized participant | Private details remain forbidden |
| GPS response lost | Capture timestamp survives restart |
| Pickup response lost / process killed | Both roles read CO_RIDE_ACTIVE; PayID released only after pairing; code replay CO_RIDE_CODE_EXPIRED |
| Completion response lost | Repeating completion succeeds without duplicate event/evidence; history has one ride per participant and current activity is empty |
| Crash before publication/request/accept/pair/complete/withdraw/cancel event | Tested transaction rolls back entirely; retry succeeds |
| Withdraw/cancel response lost | Committed state persists, replay rejected without another event |
| Two accepts at once | Exactly one rider accepted, still one after restart |
| Duplicate publications / requests to two offers / competing driver and rider actions | Exactly one offer or active role/request wins |
| Duplicate or older GPS | Does not overwrite newer fix or its receipt timestamp |
| Location ownership | Owner survives restart; interrupted takeover rolls back; committed takeover survives lost response and rejects old browser updates |
| Code renewal response lost | New code available on refresh; immediate retry throttled; restart retains it |
| SQLite | Integrity check `ok`, no foreign-key violations after all interruptions |

Retries are **not universally idempotent**. Completion is replay-safe in this test;
other operations often reject a replay even though the first attempt succeeded.
That protects records but can confuse users without refreshing. No automatic write
retry or idempotency-key/reconciliation protocol was added. A generic connection
message is not proof the operation did not commit.

## REC-001 history — pickup-code renewal / audit atomicity

Before the fix, `server/core.ts`, `renewPickupCode`, called `issuePickupCode` and
then recorded PICKUP_CODE_RENEWED without wrapping both writes in one transaction.

Reproduction: accepted ride → renewal eligible → crash immediately before renewal
event insertion → restart. The new code is persisted, while the corresponding
renewal event is absent. This is an **audit completeness gap**, not observed trip
loss or early PayID exposure. The rider can read the new code after recovery.

Baseline status was **reproduced, not fixed**. Now **remediated and retested in
source**, as recorded above. The harness no longer treats recurrence as a tolerated
finding: it asserts atomic rollback, so a regression fails the campaign. The
original exit-2 result is preserved, not overwritten or reclassified as a pass.

## Boundaries not established

- Hardware power-loss, SD-card corruption, disk full, read-only storage and backup
  restoration; SIGKILL does not simulate loss of the OS page cache or storage power.
- Arbitrary instruction-level crash points: tested event boundaries are selected
  interruption points, not exhaustive fault injection throughout every SQL statement.
- Email-provider interruption, OTP consumption response loss, key rotation or a
  changed/missing encryption key, expiry while offline and sample-simulator recovery.
- Live Vercel/tunnel outages, mobile Safari lifecycle, real GPS/battery loss and
  a two-browser UI end-to-end run against this restarted API. HTTP checks verify both
  participant views; previous mocked UI tests are separate evidence.
- Latency/capacity or disaster-recovery guarantees; this is not a load test or SLO proof.

Next priority: safely deploy the fix, then separately test storage failure and restore
on disposable storage. Every new run should preserve the command, revision, date,
environment, scenario results, open findings and untested boundaries.

Follow-up: the [basic synthetic backup/restore drill](BACKUP_RESTORE_TESTING.md)
now passes. Production/off-Pi restoration, storage-failure injection and hardware
loss remain unverified; this narrows only the synthetic restore boundary above.
