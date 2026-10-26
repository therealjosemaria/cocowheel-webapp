# Modal alignment audit — 26 October 2026

Baseline: 5960d94. Source review covered every dialog declaration in components:
centred confirmations/notices, bottom location/error prompts, sign-in/code,
number plate, journey request/offer review, and address/date/time pickers.

Journey review details inherited 12px horizontal padding from activity-card
cells, so they started farther right than the opening message and helper copy.
Only inside demand-prompt, remove that horizontal cell padding. Keep vertical
padding, separators, label icons and all non-modal activity cards unchanged.

Set explicit left alignment on the four shared shells (cancel-prompt,
location-prompt, university-dialog, search-sheet), replacing the one-off saved
route paragraph rule. This prevents parent alignment leaking into modal copy.
No wording, handlers, permissions, APIs, placement or lifecycle changes.

Intentional exceptions: button captions, calendar months/weekdays and time-wheel
choices remain centred. Picker headings follow their Back control in the existing
navigation row; icons retain their normal label gap. These are not stray text
padding and were not redesigned. Buttons-only cancellation has no heading.

## Verification

Passed npm run lint, npm run build, and
`node --import tsx --test tests/visual-system.test.ts`.

Browser commands (Python at `/tmp/gumwheel-pickup-check-env/bin/python`, local
production frontend on port 3201):

- `python scripts/check-modal-spacing.py`: consent/replacement message and action
  left edges, 22px shell inset, 20px vertical gap, equal buttons and centring.
- `GUMWHEEL_MODAL_AUDIT_ONLY=1 python scripts/check-rider-demands.py`: rider review,
  replacement, role switch and driver offer; route dt/dd left edges equal the
  opening message. This scoped mode stops after driver offer review; it does not
  certify the later map-toggle/acceptance flow.
- `python scripts/check-calendar-search.py`: both roles' missing-route warnings,
  address/date/time pickers, focus/Escape, preserved drafts and request payloads.

All passed at 320, 390, 844 and 1440px without page exceptions or overflow.
All browser APIs were mocked and external traffic blocked; no production writes.
Initial browser attempts used a stale local Next server after rebuilding assets:
missing CSS caused spacing/alignment/overflow failures. Restarting only the
localhost:3201 frontend and rerunning all three commands passed. Initial logs
remain `/tmp/modal-alignment-{browser,demand,calendar}.log`; successful reruns
use the same names ending `-retest.log`. Production services were untouched.

Whole-screen visual review: rider and driver review at 320/1440px, consent at
390px, replacement at 1440px, and mobile calendar. Reviewed left edges, regular
message weight, helper hierarchy, icons, button sizing and spacing. Remaining
dialog families were source-reviewed, not individually triggered. Physical
devices and production deployment remain unverified. No API restart needed.
