# Discovery departure display — 22 October 2026

Baseline c839840, delivered alongside the optional-origin GPS UI. No backend changes.
Follow-up: both departure selectors now offer only In 30 min (default) and
In 1 hour. No records or backend validation changed; older clients may still
submit immediate offers. Earlier acceptance/pickup by agreement remains allowed.
Pickup duration previously added the remaining scheduled wait to road duration,
so a ten-minute drive with an hour's wait appeared as 70 min away. It now uses
road duration only, including the chooser map's pickup-minute badge.

One neutral caption below pickup/arrival gives the departure schedule:

- Future: Departs in N min, rounded up.
- At departure until 60 seconds afterward: Departing now.
- From 60 seconds afterward: Delayed.

These are schedule-based labels, not proof of physical movement. Acceptance,
availability, GPS privacy and expiry are unchanged. Arrival includes the wait:
max(now, scheduled departure) + pickup drive + rider journey duration.
The timing component owns its visible-only one-second local clock and cleans up
on unmount; ticking does not rerender the parent map or fetch data. No new colours,
icons, badges or font tokens. Reuses muted caption styling in grid row three.

Verification: `npm test` (132 passed), `npm run lint`, `npm run build`.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py` uses the
isolated :3090 frontend, mocked APIs and blocked external requests. It checks the
one-hour-ahead offer still displays 10 min away, with a separate countdown, and
uses a controlled clock to exercise the current/overdue labels. Four widths:
320/390/844/1440. Mobile/desktop whole-screen captures reviewed for hierarchy,
spacing and unchanged price/payment alignment. Provider map tiles are blocked
in fixtures, not missing in production. Actual phones and deployment unverified.

React review prompted moving the clock into the timing component, keeping map
updates and provider calls independent of countdown ticks. Familiarity is now an
explicit UI principle, without sacrificing accuracy or accessibility.

The two-option follow-up is covered by default-selection/no-Now assertions on
both ordinary Offer and saved Profile, plus the saved-offer 30-minute payload.
The departure grid is scoped to two equal columns; PayID remains three columns.
