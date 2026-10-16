# Backup and restore — 16 October 2026

## Scope and result

This is a basic MVP recovery drill, not scaling or automatic failover. It uses
synthetic data on this host and never opens production data or restarts services.
Application source tested: `0dfd33e00df674f2c796a1aee8f476d4cec5deab`.
The [dated sanitized report](results/restore-2026-10-16.json) records the harness
SHA-256, runtime, assertions and measured local timings. All **9 checks passed**.
These small-fixture timings are not a production recovery-time guarantee.
Observed local timings: backup **1 ms**, restore through authenticated API read
**87 ms**. Routine validation: **85 tests passed**, ESLint passed, and
`git diff --check` passed. The new routine test checks opt-in/target rejection.
No frontend build/deployment or production API restart was needed or performed.

Reproduce with:

```sh
npm run test:restore
```

`scripts/restore-check.mjs` only accepts `--run`; no arguments print help and
other arguments exit 1 before imports or database access. It resets the process
environment before importing application modules, sets a fresh private temporary
database and random encryption key, disables provider fetch/email and samples,
and starts the restored API only on an OS-selected loopback port. Native fetch is
used only for that local API. Files use a restrictive umask; temp directories and
synthetic databases are retained locally, never committed. Keys exist only in
process memory. Reports contain no tokens, codes, PayID values or GPS coordinates.
Exit 0 means all checks passed; exit 1 means a failure and subsequent checks may
not have run. This is a low-volume functional drill, not a stress test.

## What was verified

1. Build synthetic verified accounts/sessions, a pending request, an accepted
   ride with encrypted pickup code, a completed ride with pickup evidence, and GPS.
2. Disable automatic WAL checkpoints for the fixture and confirm WAL exists.
   Use SQLite's online backup API while the source connection remains open.
   No writes are made concurrently with the backup in this drill.
3. Cancel a source ride after backup, then close the source connection. Copy only
   the completed standalone backup to a new path, refusing overwrite.
4. Verify integrity, foreign keys, and exact equality of every backed-up table
   in memory. The later cancellation must be absent: backup is a snapshot, not
   replication. Schema startup then runs through the normal API initializer.
5. A wrong encryption key cannot recover the pending pickup code. Restore the
   correct key before continuing. The database alone is not enough for recovery.
6. Read through the real restored HTTP API: existing participant sessions work,
   the rider's original code is recovered, payment stays hidden before pickup,
   an unrelated account is forbidden, and completed history remains readable.
7. Run normal core pairing/completion writes on the restored DB, check the HTTP
   views, payment disclosure, and single-use code enforcement. Recheck integrity.

Pairing/completion here use core functions, not browser clicks or HTTP mutations.
Auth sessions are seeded: OTP delivery is not tested. No UI changed, so no new
mobile/desktop visual review is claimed. The existing crash campaign is separate.

## Harness failures retained

Two initial harness-development runs failed, not the application restore itself:

- [Invalid test key encoding](results/restore-2026-10-16-harness-key-failure.json):
  used hex instead of the app's required base64-encoded 32-byte key; fixture
  acceptance stopped before backup. Corrected to base64.
- [HTTP envelope assertion](results/restore-2026-10-16-harness-envelope-failure.json):
  expected fields directly in the body instead of the API's `ride` property.
  Backup/table checks passed; corrected the harness reader.

The final nine-check run follows both corrections and retains the failed reports.

## Operational finding BAK-001 — off-Pi backup unverified

Repository scripts/deployment instructions, visible system timer names and the
current user's crontab were inspected read-only. No GUMWHEEL backup job or
off-device destination was found. The system `dpkg-db-backup` timer is for package
management, not this application. This is not proof that a manually managed or
root/external backup does not exist; those were not exhaustively inspected.

**Open:** no production backup freshness, successful off-Pi copy, key recovery,
retention policy, recovery point objective (RPO) or recovery time objective (RTO)
has been verified. Synthetic success does not close this finding. No backup
schedule, cloud account, upload or production configuration was added.

## Proposed manual recovery procedure — not executed on production

1. Select an owner-approved off-Pi destination and restricted access/retention.
   Securely preserve the encryption key and required runtime configuration
   separately; do not put secrets in Git, reports or public cloud storage.
2. Use SQLite online backup, not a live main-file-only copy. Complete and verify
   the snapshot before transferring it securely. Record snapshot time, compatible
   code revision, schema and checksums without exposing private contents.
3. Restore into a separate directory/environment with the matching runtime and
   key. Disable sample simulations, outgoing provider/email operations and public
   traffic during validation. Run integrity/FK checks and authorized read checks.
4. A real failover requires fencing/stopping the old writer before routing traffic
   to the replacement. Never independently run two authoritative copies.
5. Reconcile changes since the snapshot: requests, cancellations, code use and
   session revocations may have been lost. Restoring can resurrect stale state;
   do not assume old sessions/codes are safe merely because they decrypt. Decide
   incident-specific revocation/reconciliation before reopening traffic.
6. Record actual downtime and lost-change window, then verify both participant
   views and providers. Retain the old database for diagnosis; never overwrite it.

Production elapsed recovery time includes obtaining hardware/runtime/secrets,
transfer, reconciliation and routing, none measured here. Data loss can include
everything committed after the latest usable snapshot. Hardware loss, corrupt
media, disk full, offline expiry, remote restore, browser recovery and larger
datasets remain untested. The immediate next decision is an approved off-Pi
backup destination and schedule, not purchasing a second always-on server.
