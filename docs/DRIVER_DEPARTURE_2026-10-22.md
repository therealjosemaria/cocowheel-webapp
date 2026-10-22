# Driver countdown and Home width

Baseline ecbbd16. Frontend only: Home active-ride link now matches CTA width at
700px+, with wrapping addresses. Shared ride details expose a driver-only
Departure cell before Fare, directly below Estimated duration in the left column.
Route endpoints stay stacked right; actions stay last and existing lone-cell
spanning handles PayID. No cells are deleted.

Uses existing departureLabel: future In N min, scheduled minute Departing now,
then Delayed. Local visible-only clock is isolated from map rendering and makes
no requests. Hidden after pickup and terminal states; absent for riders/public
viewers. Public/rider planned-time hint drops Sydney time, not its actual timezone
formatting. No backend, permission, live GPS or history changes.

Reproduce: `npx eslint components/ride-preview-client.tsx
components/departure-countdown.tsx`, `npm run build`, and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-driver-departure.py`.
Browser fixtures on :3090 mock APIs and block external providers. Physical phone
GPS, real trips and production deployment are not covered.

Build and targeted lint passed. Mocked browser checks passed at 390/1440px for
matching Home CTA/card width, countdown text, driver/rider gating, pickup and
completion hiding. Whole-screen Home/driver screenshots visually reviewed on
mobile and desktop for alignment, spacing, type hierarchy and unchanged controls.

## Superseded proposal

Find-a-ride shortcut: Save route & email me matches, with explicit Any day, any
time scope, no navigation away, later schedule narrowing in Profile. Current
server validation/matching requires days and a time window; unrestricted matching
needs an explicit mode and backend tests. Do not guess a schedule from lookup time,
silently overwrite saved routes, or re-enable a saved mute. Existing routes and
notification rules remain unchanged by this UI-only change. The subsequent
approved Save route / explicit consent implementation is documented separately
in SAVE_SEARCH_ROUTE_2026-10-22.md; this paragraph records the earlier proposal.
