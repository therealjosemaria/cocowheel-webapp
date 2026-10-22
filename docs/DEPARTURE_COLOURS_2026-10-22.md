# Departure colours — 22 October 2026

Baseline: `585c94b`, with pending analytics integration included in the same
reviewed change set. Discovery and driver Departure reuse `departureTone`:
more than 600,000ms remaining is green; 600,000ms through 59,999ms overdue is
amber; 60,000ms overdue onward is red. Invalid dates remain empty/neutral.
The existing wording, minute rounding, visibility-aware timer, lifecycle gates,
map colours, other statuses and layout are unchanged. No API restart required.

This is an airport-inspired product convention, not a universal aviation standard.
Text communicates the state independently of colour; shades and contrast ratios
are in DESIGN_TOKENS.md. Reference:
https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html

## Checks

- `npm test`: 138/138 passed, including exact ten-minute and one-minute-overdue
  boundaries and invalid dates. `npm run lint` and `npm run build` passed.
- `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-driver-departure.py`
  against local port 3090: passed at 390px and 1440px. APIs mocked, external
  providers blocked, no production records changed. All three computed colours
  asserted in discovery and driver details; pickup/completed and rider views
  correctly omit the driver-only countdown.
- Initial discovery fixture omitted required `redactedCorridor` data and caused
  a browser exception. Completed the fixture, reran both widths successfully;
  no production-code workaround was needed.
- Visually reviewed discovery and driver screenshots on mobile and desktop:
  colour affects text only, regular weights and existing hierarchy preserved.
  Map tiles were intentionally blocked; real map/provider rendering not retested.
- Analytics local/browser evidence is in WEB_ANALYTICS.md. Live Vercel deployment
  and dashboard collection remain separate, unverified steps at commit time.
