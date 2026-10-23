# Departure picker and expiry — 23 October 2026

Baseline `ec0a7a5`. Offer a ride replaces its two departure buttons with a
30-minute-to-24-hour scroll picker in 30-minute steps. No new dependencies.
Mobile uses the existing bottom-sheet shell, desktop a centred version.
The 48 options support touch/trackpad scroll snapping, tapping and keyboard
Arrow/Home/End/PageUp/PageDown. Done commits; Go back/Escape discards. Focus
is trapped and restored, background scrolling locked while open.

The picker previews a Sydney date/time; the selected value remains a relative
delay measured at submission, not a fixed booking. Driver/rider detail cells and
new matching-email payloads now include a calendar date, without a timezone
suffix; stored times remain ISO UTC. Discovery countdowns remain unchanged.

## Lifecycle and compatibility

Code inspection found new offers previously expired six hours after publication,
not midnight. New offers now store scheduled departure + six hours. No schema
change or rewriting of existing stored expiries/history. Sample expiry remains
24 hours; accepted/in-progress inactivity remains 24 hours after last activity.
Accepting a maximum-24-hour offer happens after publication, so this inactivity
window extends beyond its scheduled departure; no extra waiting lock is added.

The legacy saved-route offer endpoint accepts integer half-hour delays through
1440 minutes, retaining zero compatibility. The general timestamp API's existing
five-minute past tolerance/90-day future bound remains unchanged; 24 hours is the
new UI range, not a retroactive restriction on existing API consumers.

Matching still happens once at publication against intended departure's Sydney
schedule. No later reminder or rematching. Existing delivery deadline is unchanged:
earlier of six hours after job creation and one hour after departure. Thus next-day
offer alerts are sent promptly, not held until tomorrow; stale queued alerts may
be skipped even while the offer is still available. No provider quota/consent changes.

## Verification

Commands: `npm test`, `npm run lint`, `npm run build`, and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-departure-picker.py`
against localhost:3090. Browser APIs mocked and external requests blocked;
backend tests use isolated temporary databases. All 153 tests and lint passed;
coverage includes tomorrow's discovery/request, six-hours-after-departure boundary,
preserved legacy expiry/history, 24-hour HTTP offering, invalid delays and Sydney
date/DST formatting. An initial updated HTTP test still expected a 30-minute
timestamp; correcting that assertion to its new 24-hour input resolved the failure.
Picker checks passed at 320/390/844/1440px: scroll position, 48 options, boundaries,
keyboard, Done/cancellation/focus return, no overflow or API writes. Existing
driver/rider departure and matching-email browser regressions also passed.
Mobile/desktop whole-screen screenshots reviewed for typography, spacing, calendar
date wrapping and unchanged route/payment controls. Review caught and corrected
Done's missing primary style and the preview's top-margin specificity.
Physical iPhone momentum/VoiceOver and real inbox delivery are not verified by
desktop Chromium emulation. API activation requires the approved zero-underway
check, private backup, restart and health verification independently of frontend push.
Approved activation: zero accepted/active trips, verified local SQLite backup,
API restart at 13:29:07 AEDT; local/public health passed, 125 rides preserved,
integrity ok and zero foreign-key errors. Frontend rollout is verified separately.

## Manual phone/desktop walkthrough

1. Offer a ride → tap In 30 min. Swipe upward to a later half-hour; check the date.
2. Try 30 min, 1 hr 30 min, 12 hr and 24 hr; Done should retain each selection.
3. Reopen, change, then Go back: the original choice should remain.
4. On desktop use arrow keys, Home/End and Escape; focus returns to the field.
5. Offer a test ride for tomorrow, then inspect its dated Departure cell and
   availability from a different rider account. Check the matching email if eligible.
   Cancel the test offer afterwards; history should remain.
