# Frontend API failure contract

Implemented 16 October 2026. Applies to browser requests through the same-origin
API rewrite; no API service restart, schema or authentication change is required.

## Transport and copy

`lib/api-transport.ts` bounds fetch **and body reading** to 15 seconds. The server
admin authorization gate retains a five-second deadline. Caller cancellation is
an AbortError, not an outage. Network rejection, timeout, and gateway/tunnel
502/503/504/520–524 responses map to:

> We can’t reach the server. Please try again shortly.

Structured EMAIL_NOT_CONFIGURED, EMAIL_SEND_FAILED and ADMIN_NOT_CONFIGURED 503
errors remain application/provider errors. Validation, permission, session,
rate-limit and other API errors retain their codes and specific UI messages.
Malformed successful JSON responses produce INVALID_RESPONSE rather than an
empty success object. This is transport validation, not full endpoint schema validation.

`cocowheelsApi` still adds the legacy session headers and handles the explicit
verification-required flow. UniKey code/verify, sign-out and admin calls use the
same underlying transport without triggering that verification flow.

## Inventory and presentation

| Calls | Presentation |
| --- | --- |
| Current ride/session, GPS location writes, address/route/ETA lookups | Shared quiet connection notice; no repeated polling dialogs |
| Place search | Explicit error beside search; never silently treats connection failure as no matches |
| Ride search | Quiet read-error message; existing candidates remain available for inspection |
| Activity/history, participant and public ride details | Retain loaded data on transient failure with a stale-data notice; first-load failure explains the problem |
| Publish/join/accept/decline/cancel/withdraw/pair/code renewal/complete/location takeover | Existing compact dialog with consistent outage copy; business errors remain specific |
| UniKey verification and sign-out | Error in the existing verification/profile surface; no raw browser errors |
| Admin dashboard/inspector | Retain loaded data and show error; initial failure offers retry |
| Server admin authorization gate | Fail closed without rendering admin controls/data; connectivity error offers retry instead of pretending the user lacks permission |

One shared fixed, neutral, non-interactive status notice avoids page reflow and
repeated background modals. It does not block controls. A subsequent response to
a request started after the failure clears the connection notice; valid 401s also
prove reachability. Existing data-specific error notices clear only when their
own read succeeds. The shared notice means connectivity, not that every endpoint
or cached ride has recovered. Earlier in-flight responses cannot clear a newer
failure. While unavailable, one non-overlapping session probe runs every 15 seconds
when visible, or on a browser online event. It is aborted on cleanup. There is no
new continuous probe while healthy. Existing screen polling intervals are unchanged.

Do not relabel stale GPS as live. Authentication/permission failures clear protected
ride data instead of keeping it visible. Authorization always remains server-side.

## Writes and uncertainty

There is **no automatic replay of mutations** on network failure or timeout.
Existing authentication-required retry occurs only after the server explicitly
rejects the unauthenticated action and verification succeeds. A lost response can
mean a write committed; do not claim it failed, was rolled back, or is safely stored.
Normal ride polling can reconcile state. Server idempotency keys and a dedicated
mutation-reconciliation workflow are not introduced by this change. Before a manual
retry, inspect the current ride state where available.

## Verification scope

Subsequent real-API crash/retry checks are tracked in
[RECOVERY_TESTING.md](RECOVERY_TESTING.md). They found a renewal-event atomicity
gap, subsequently fixed in source and retested (25/25); production API restart
remains pending. Frontend outage-message success does not imply backend atomicity.

Use mocked browser routes and transport tests, never stop the live API or disrupt
real trips. Cover offline requests, gateway HTML/JSON, timeout including body,
caller cancellation, provider/validation/auth distinctions, recovery and no automatic
write replay. Review mobile and desktop outage states and retained ride details.
Production deployment and real-device intermittent networks require separate checks.

### Checks performed (16 October 2026)

- Full regression suite: 82 tests passed, including nine transport tests. ESLint
  and production Next build passed. Standalone `tsc --noEmit` still reports errors
  in unchanged backend-load/place-label/route-preview/runtime-config test files;
  the production build's type check passed.
- `scripts/check-api-outages.py` (Python Playwright, local frontend on port 3090)
  intercepts every browser `/api/*` request. At 390px and 1440px it checks first-load
  outage on Home, Offer, Find, Activity, participant details and public preview;
  recovery; provider-versus-network verification messages; destination search;
  preserved maps/details for both roles; pickup/code renewal, complete, cancel and
  accept errors. No page runtime exceptions or horizontal overflow were found.
- Visually inspected the complete driver mobile and rider desktop retained-detail
  screens. Local stale notices use muted small text rather than competing yellow
  banners. Map tile requests are intentionally blocked by this fixture; tile
  availability and real GPS are not validated by it.
- No production API interruption, backend restart, live mutation, email delivery
  or real-device outage test was performed. Admin's server authorization failure
  screen and every individual lifecycle button were not browser-exercised; shared
  transport tests and existing authorization/lifecycle tests cover their common
  paths. A push does not verify deployment.
# Verification throttling metadata — 20 October 2026

HTTP 429 `VERIFICATION_RATE_LIMITED` adds optional `retryAfterSeconds` and a
`Retry-After` header. The shared ApiError preserves a finite positive numeric
duration; the UniKey dialog formats it in seconds/minutes. Missing/invalid metadata
uses neutral wording, never an invented 15-minute cooldown. No retry is automated,
no error-modal layout or security threshold changes. See UNIVERSITY-LOGIN.md.
# Private messaging extension — 20 October 2026

See [messaging protocol](MESSAGING.md). Failed sends preserve draft/UUID for
idempotent retry and use the shared connection/error copy. Failed refresh keeps
existing messages with a retry prompt. Unauthorized or closed conversations clear
message content; closing the ride removes the UI. Private chat POSTs deliberately
skip automatic verify-and-replay to avoid sending under another account. 429
means the per-account minute quota; 409 distinguishes closed, stopped, full and
conflicting retry. Stop failures never claim messaging stopped or cancel a ride.
