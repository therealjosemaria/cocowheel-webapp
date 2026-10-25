# Modal spacing audit — 25 October 2026

Baseline: 0ee0210. Message (including RouteRequiredPrompt and shared ride errors)
and LocationTracker's switch error had a paragraph immediately followed by a
bare primary button. Unlike other confirmations, these omitted the shared action
wrapper, losing its 20px top spacing and standard action-button dimensions.
Both now use cancel-prompt-actions. Copy, behaviour and positioning are unchanged.
No CSS, backend, GPS collection or permissions changed.

## Source audit

| Family | Existing placement | Text/actions treatment |
| --- | --- | --- |
| Message/route warning, location-switch error | Centred cancel-prompt | Fixed: shared action group, 20px gap |
| Save/replace route, email consent/muting, poor fit, completion warning, PayID copied | Centred cancel-prompt | Already shared action group, 20px gap, 8px between buttons |
| Cancel/withdraw | Centred cancel-prompt | Buttons-only; no message spacing to compare; unchanged |
| Number plate | Centred cancel-prompt | Input form with 12px field gaps plus action-group margin; not a plain message; unchanged |
| Legacy self-join/role/request/activity errors | Bottom location-prompt | Existing 20px action gap; placement unchanged |
| Address/calendar/time | Full-screen mobile, centred desktop search sheet | Header and scrollable content with separate footer; unchanged |
| Sign-in/code | Centred native dialog | Existing 16px form grid; unchanged |

This audit does not claim all modal families should be visually identical.
Notices reuse the established centred shell; no global bottom-to-centre migration
or form/picker redesign was made. Existing legacy accessibility limitations noted
in UI_STANDARDS remain outside this spacing fix. React review confirmed the
markup-only changes preserve handlers, labels and existing focus behaviour.

## Checks

- npm test; npm run lint; npm run build.
- `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-modal-spacing.py`:
  real consent/replacement views with API mocks on localhost:3201; 20px measured
  message-to-action gap, 8px action gap, equal-height buttons and centre alignment.
- `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-calendar-search.py`:
  both roles' empty/partial route notices, same measured spacing and centre,
  focus/Escape, state preservation and normal complete-route flows.

All browser traffic is mocked or blocked outside the local frontend. No real
rides, messages, location updates or emails are created.

Results: 168 tests passed; lint and production build passed. Both browser scripts
passed at 320, 390, 844 and 1440px, with no page exceptions or horizontal overflow.
Whole-screen screenshots were visually reviewed for rider/driver route warnings
on mobile and desktop, plus email consent and route replacement on both sizes:
regular left-aligned text, clear action separation, consistent button sizing and
unchanged centred placement. The location-switch error and remaining families
were source-reviewed, not individually triggered in the browser.
Physical devices and production deployment remain unverified. No API restart needed.
