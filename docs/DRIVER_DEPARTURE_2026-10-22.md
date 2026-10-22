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

## Rider layout refinement — 23 October 2026

The rider/public Leaving around hint is moved from above messages into a normal
Departure cell beside Estimated duration, before Fare. Its existing PUBLISHED /
REQUESTED visibility gate is unchanged; no new countdown, timer or API request.
Driver layout and countdown remain unchanged. Uses the shared departure icon,
label/value typography and grid spacing. The existing lone-cell spanning rule
also covers Fare before full-width Payment, avoiding an empty half-row.

Verification command: the same check-driver-departure.py command above now checks
the rider cell, timing-row alignment, absence of the old floating hint, overflow
and hiding in accepted/picked-up/completed states. Results recorded below.

Results: mocked browser checks passed at 390/1440px, including existing driver
countdown and discovery regressions. Whole rider screens visually reviewed at
both widths: messages remain first, timing cells align, addresses stay stacked,
and Fare/actions remain clear without competing emphasis or horizontal overflow.
Targeted ESLint and production build passed. Initial browser attempt had no local
server; initial sandbox build could not bind a worker port. Starting the isolated
server and rerunning the build with that permission resolved these test-environment
failures. No production APIs were exercised; map tiles were deliberately blocked.
The subsequent messaging-entry checks also exercised the public-preview request
flow and paid rider details. Physical devices and production deployment are not
verified. No backend or service restart is needed.

## Shared detail countdown — 23 October 2026

The rider Departure cell now reuses DepartureCountdown directly: planned Sydney
time above the same coloured In N min / Departing now / Delayed N min status,
with hours/minutes from 60 minutes. This supersedes Leaving around in the rider
cell. Both use scheduledDepartureAt, not pickup duration or estimated arrival.
Existing role/status visibility gates remain unchanged. The component's local
visible-page clock adds no API requests and does not rerender the parent map.
The browser command above checks rider planned time, future/overdue hour formatting
and existing driver/discovery regressions. No backend restart is required.

Results: targeted ESLint, production build and browser checks at 390/1440px
passed. Reviewed full rider screens at both widths: planned time and supporting
countdown fit their cell, typography/colour match the driver component, messages
remain collapsed and other details/actions retain their hierarchy. No horizontal
overflow or browser exceptions. Mock APIs and blocked map providers only;
physical devices and deployment remain unverified.

## Superseded proposal

Find-a-ride shortcut: Save route & email me matches, with explicit Any day, any
time scope, no navigation away, later schedule narrowing in Profile. Current
server validation/matching requires days and a time window; unrestricted matching
needs an explicit mode and backend tests. Do not guess a schedule from lookup time,
silently overwrite saved routes, or re-enable a saved mute. Existing routes and
notification rules remain unchanged by this UI-only change. The subsequent
approved Save route / explicit consent implementation is documented separately
in SAVE_SEARCH_ROUTE_2026-10-22.md; this paragraph records the earlier proposal.
