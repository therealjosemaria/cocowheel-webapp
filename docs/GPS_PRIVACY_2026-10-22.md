# Acceptance-gated GPS privacy — 22 October 2026

Baseline `c95b657`, alongside the pending discovery/location corrections.
Supersedes published-driver public tracking. No schema migration or deletion.

## Changes

- LocationTracker no longer treats DRIVER alone as permission to capture GPS.
  Both roles require ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE. Samples remain excluded.
- Server location submissions/source claims reject PUBLISHED/REQUESTED and
  terminal states. /current only evaluates ownership for eligible states.
- Search and public preview never serialize driverLocation. Pending/request
  history views require the exact accepted_request_id plus accepted status for
  partner GPS. Driver's own view also hides it until acceptance.
- Ignore retained fixes captured before accepted_at; reject such new submissions.
  Records are retained; no retroactive history rewriting. Normal admin inspection
  and existing terminal cleanup remain unchanged.
- Find estimates and map positions use the planned origin, never public GPS.
  Removed the public driver-update age line. Public preview defensively strips
  GPS; participant previews require active state. Existing accepted-pair maps,
  pickup evidence, location ownership and fallback scheduling remain.
- Privacy notice distinguishes public planned endpoints from private live GPS.
  Explicit saved-route fresh-origin lookup is still one-off, not live tracking.

## Verification

`npm test`: 131/131 passed. Updated the superseded public-GPS test to cover
pre-acceptance write/source denial, seeded legacy GPS hidden from public search,
preview and pending requests; exact accepted rider disclosure; discarded requester
denial; pre-acceptance capture rejection; terminal denial and stale-fix reporting.
Browser ownership regression now establishes ownership after acceptance and still
tests takeover, other-device denial, persistence and cancellation.

`scripts/check-gps-privacy.py` runs against local :3090 with mocked APIs and a
geolocation spy; external traffic is blocked. It checks no capture while published
or requested and resumed capture/submission after acceptance, both roles at mobile
and desktop widths. No real users, GPS, emails or production writes.

React review: state guard precedes browser GPS, existing polling/listeners are
reused, no extra loop/dependency introduced; server is authoritative if state
changes during a capture. Visual review and final checks recorded below.

Final results: 131 tests passed, including HTTP /current null ownership,
pre-acceptance location/source rejection and public JSON omission. Lint and
production build passed (an unused LocationAge import warning was removed and
lint rerun cleanly). GPS-spy checks passed for both roles at 390/1440px.
The responsive usual-route suite also passed all four widths. Initial discovery
captures were taken during loading; the test now waits for the offer tile and
Leaflet before checking the absent live-age line and capturing the layout.
Mobile/desktop privacy notice hierarchy and wrapping reviewed; public map tiles
are intentionally blocked in the fixture. Physical phones, provider tiles and
production behavior are not verified by these isolated checks.

## Activation

Not activated in production yet. API restart and frontend deployment are both
needed; old open clients can still attempt updates, but the updated API denies
pre-acceptance writes and never returns public GPS. Already received/cached
information cannot be recalled. Awaiting safe restart coordination with owner.
