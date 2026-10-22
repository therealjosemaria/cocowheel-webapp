# Optional origin GPS — 22 October 2026

Baseline c839840. Frontend-only shared RouteFields change across Offer, Find and
Profile. Supersedes the no-setup-GPS decision in SHARED_ROUTE_FIELDS_2026-10-22.md.
Use my location is origin-only and explicitly tapped. It requests fresh GPS with
a 12-second browser timeout and uses the existing bounded /api/place-label API.
No live-location submission, service restart, schema or permission changes.
Normal origin selection advances focus or completes Find when both pins exist.
Busy prevents duplicate taps. Editing/searching/selection/unmount invalidates late
responses. Failure leaves manual entry available; missing labels use coordinates.
Typed-search behavior, saved-route shortcut and accepted-pair tracking remain.

Reproduction: isolated frontend :3090 with all API calls mocked and external
requests blocked; run `/tmp/gumwheel-pickup-check-env/bin/python
scripts/check-route-location.py`. Covers all three editors at 320/390/844/1440px,
no automatic GPS, success/focus, denied permission, editing during delayed GPS,
single accessible button, target size, responsive position and overflow.
Actual phone permission prompts and production deployment are separate checks.

Results: all 12 editor/width cases passed, as did the existing usual-route suite
at all four widths. 131 regression tests, lint and production build passed.
Sandbox restrictions initially prevented Chromium/tsx and the build from binding
local sockets; approved local reruns passed. A test selector initially also
matched Next's route announcer; it is now scoped to the field's error surface.
Whole-screen Offer/Find/Profile mobile and desktop captures were reviewed for
hierarchy, spacing, icon prominence and containment. Profile's existing button
margin reset initially removed the mobile gap; scoped shared CSS and an explicit
8px-minimum assertion corrected it, and the full 12-case run passed again.
No backend restart or production activation was performed for this UI change.
Combined departure-release retest: 132 regressions, lint/build, four-width usual
route suite and all 12 GPS browser cases passed. The first final GPS run stopped
at a Chromium captureScreenshot protocol error; a standalone rerun passed without
code changes. No production traffic was used to resolve the test tooling failure.
