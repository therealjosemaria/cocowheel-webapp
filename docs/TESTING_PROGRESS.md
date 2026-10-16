# Reliability testing progress

Maintain this register when running a new reliability/capacity/fault campaign.
Link reproducible commands and sanitized reports; keep findings open until a
relevant retest verifies the fix. Do not infer production deployment from a push.

| Date | Campaign | Result / scope | Evidence |
| --- | --- | --- | --- |
| 2026-10-16 | Isolated GPS/polling load | 5–160-trip ramp and 80/120/160-trip soaks; pressure at 160, not a certified user ceiling | [Initial results](BACKEND_LOAD_RESULTS_2026-10-16.md) |
| 2026-10-16 | Burst timing and history/discovery load | Separate workloads; GPS burst sensitivity and history workload memory guardrail | [Overnight report](OVERNIGHT_CAPACITY_2026-10-16.md) |
| 2026-10-16 | Frontend connection errors | Shared timeout/errors; 82-test baseline and mocked mobile/desktop recovery checks; production outage not induced | [API failure contract](API_FAILURES.md) |
| 2026-10-16 | API crash/retry and persisted state | 23 checks pass, REC-001 open: renewal code can persist without its audit event | [Recovery campaign](RECOVERY_TESTING.md), [machine-readable result](results/recovery-2026-10-16.json) |
| 2026-10-16 | REC-001 remediation/retest | Fixed in source; 25/25 fault checks, 84 regression tests and lint pass; production restart not performed | [Remediation](RECOVERY_TESTING.md), [fixed-run result](results/recovery-2026-10-16-fixed.json) |
| 2026-10-16 | Basic synthetic backup/restore | 9/9 checks, 85 regression tests and lint pass; BAK-001 off-Pi protection unverified; two corrected harness failures retained | [Procedure and findings](BACKUP_RESTORE_TESTING.md), [result](results/restore-2026-10-16.json) |
| 2026-10-16 | Pre-pilot authorization/privacy | 52/52 security checks; 25/25 recovery/concurrency rerun; 86 regression tests and lint pass; no runtime/deployment change | [Matrix and limitations](SECURITY_TESTING.md), [dated result](results/security-2026-10-16.json) |
| 2026-10-16 | Mixed core-API capacity | SD-card 100-user ten-minute mix passed 19,657 requests/150 completed journeys, zero failures/skips; 87 regression tests and lint pass; RAM runs and failed smoke retained | [Results](MIXED_LOAD_RESULTS_2026-10-16.md), [reproducible procedure](MIXED_LOAD_TESTING.md) |

## Open findings

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
