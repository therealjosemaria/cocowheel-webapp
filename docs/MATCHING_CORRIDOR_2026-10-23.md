# Matching pickup allowance — 23 October 2026

Baseline `e20a70a`. Owner chose 20% behind the driver's origin, replacing 5%.
Only `corridorMatches` pickup projection lower bound changes, from -0.05 to -0.20.
Pickup distance to the finite segment remains <=1,500m; destination <=2,500m;
destination projection <=1.05; pickup precedes drop-off; driver segment >=100m.
No road-detour guarantee, new provider requests, schema, UI or consent changes.
No retrospective queueing or resending for already-published rides.

## Evidence and tests

Read-only inspection of the reported single offer/saved route confirmed spatial
rejection under the former bound, with schedule/consent passing and no outbox job.
Re-evaluation with the new function matches. Private addresses, coordinates and
identifiers are deliberately not recorded here. No live email or ride mutation.

Reproduce with `node --import tsx --test tests/usual-routes.test.ts`: 13/13 pass.
Synthetic geometry covers just inside, exactly on and just outside 20%, a pickup
behind and sideways, short/long routes, 1.5km pickup cap, 2.5km destination cap,
unchanged 5% destination overshoot, reverse order and sub-100m driver trips.
Isolated publication/outbox tests cover new eligibility, one job/send per offer,
and no backfill on saved-route updates. Existing consent, schedule, role suppression,
retry/idempotency and owner-scoped HTTP tests remain passing.
`npm test`: 150/150 pass. Initial sandboxed targeted test failed without useful
test diagnostics; rerunning with loopback permission passed. No load test.
Targeted ESLint and production build passed. Standalone `npx tsc --noEmit`
reported type errors in untouched test files (API, load/restore/security harnesses,
place/route preview, runtime config and search-location tests); no diagnostics
in the modified files. These remain outside this change; do not claim a clean
repository-wide standalone type check.
UI/assets/copy are untouched, so no new mobile/desktop visual review is required.

## Activation

Requires the Pi API restart; Git/frontend deployment alone does not activate it.
Owner approved backup/restart only with no accepted or active trips. A private
SQLite API backup passed integrity/FK checks; zero underway trips rechecked before
API-only restart at 13:05:28 AEDT on 23 October. Local/public health returned ok;
124 rides retained, integrity ok, zero FK violations. No schema/config changes.
For a live inbox test, publish a new matching offer after activation. Existing
offers are not automatically reconsidered, and no test email was sent by this work.
