# Search overlay and email alignment — 23 October 2026

Baseline `56a1f2a`. Shared PlaceSearch previously defaulted to static results,
which shifted destination and following controls. Results now use a fixed body
portal anchored to the input wrapper, avoiding clipping by form ancestors.
Resize, scroll and visualViewport events reposition it; max height is the smaller
of 420px and available space. It normally opens below, above if less than three
rows fit below and more space exists above. Offscreen/too-small panels hide.

Search remains explicit, no new API/polling/provider logic. Selection, Escape,
outside pointer/focus dismiss. Dismissal invalidates pending search responses so
they cannot reopen the panel. Edits clear stale selections/results as before.
ArrowDown enters results from the input; arrows/Home/End navigate native buttons.
Escape restores input focus. Selecting origin still advances to destination.
GPS, swap, validation and Find's completed-route navigation remain unchanged.

Email correction: preserve the original image and wordmark; add 3px bottom
padding to the image cell with zero font/line height. This raises the artwork's
centre by approximately 1.5px relative to the uppercase wordmark, using email-safe
table layout rather than CSS transforms. Existing sent emails cannot be changed.

## Verification

Run `npm test`, `npm run lint`, `npm run build`, then with the local build on :3090:
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-search-overlay.py`.
Also run `scripts/check-route-location.py` and `scripts/check-matching-email.py`
with that Python environment. Browser APIs are mocked; external traffic blocked.
153 tests, lint and production build passed. Overlay checks passed for all three
forms at 320/390/844/1440px, including unchanged destination position, anchored
width, scrollable results, keyboard selection/Escape, outside dismissal and a
reduced 500px viewport. GPS regression passed all 12 form/width combinations.
The initial Profile test attempted hidden fields; it now opens the existing
Usual route accordion first. Matching email checks passed at 320/390/1440px,
including the measured 1.5px icon lift. Whole-screen mobile/desktop search and
email screenshots reviewed for alignment, spacing and unchanged typography.

Approved API activation at 13:41:50 AEDT: zero underway trips, verified private
SQLite backup (126 rides), local/public health passed after restart. Frontend
deployment is separate. Physical iOS keyboard,
VoiceOver and actual receiving email-client rendering require device checks.
