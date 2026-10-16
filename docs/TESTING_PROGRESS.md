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

## Open findings

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
