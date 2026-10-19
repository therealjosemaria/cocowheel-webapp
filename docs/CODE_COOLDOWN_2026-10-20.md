# Local resend countdown — 20 October 2026

Source baseline: `c90db98`; changes in this commit series. Frontend only; API
limits and server enforcement unchanged. See UNIVERSITY-LOGIN.md for behaviour.

## Reproduction and isolation

Start `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npm run dev -- --port 3090`.
With Python Playwright and system Chromium installed, run:

```sh
python scripts/check-code-cooldown.py
python scripts/check-login-wait.py
npm run lint
npm run build
test_dir=$(mktemp -d /tmp/gumwheel-countdown-tests-XXXXXX)
COCOWHEELS_DB_PATH="$test_dir/db.sqlite" npm test
```

Browser APIs are intercepted; external requests blocked. No real email, accounts,
trips or production database touched. Browser time is advanced deterministically.

## Results

- 100/100 regression tests passed, including server cooldown and HTTP metadata
  checks; lint, production build and diff whitespace checks passed.
- Countdown browser checks passed at 320×800, 390×844, 844×390 and 1440×900.
  Successful send starts 60 seconds; after 15 seconds the suffix reads `in 45s`.
  Sending disabled, code verification still enabled; synthetic submit prevented.
  Close/reopen and reload retain wait for the same normalized account.
  Expiry re-enables sending without sending automatically. Request counts remain
  unchanged while counting. A subsequent server 429 overrides the local wait
  with 780 seconds and no duplicate alert.
- Updated legacy message harness passed at 390px and 1440px: 55/780-second
  sending waits now appear in the button; missing metadata retains neutral alert.
- Visually reviewed screenshots of the whole dialog at all four sizes: existing
  typography, emphasis, spacing and button appearance preserved. At 320px the
  longer existing resend label plus suffix wraps naturally to two lines without
  clipping. Landscape retains the existing scrollable dialog for lower controls.
  No added heading, label or competing emphasis.

## Boundaries

Physical iOS/Android keyboards, Safari, cross-tab storage synchronization and
storage-denied fallback have not been browser-tested. Their code paths are present;
server enforcement remains independent of browser storage, clock or disabled state.
The initial success wait starts at receipt (conservatively later than server send).
No API restart required. A push is not verification of frontend deployment.

## Follow-up: resend styling and spacing

Baseline `bb08835`. Generic secondary-button 12px top/bottom margins were stacking
with the form's 16px grid gap: Verify→resend had 28px and resend→Cancel 40px.
The form now overrides button margins to zero for consistent 16px layout gaps.
The existing primary shadow remains, so its visible edge extends slightly into
that gap. Resend uses regular-weight borderless text, underlined when available;
button semantics, target dimensions and all countdown/authentication rules remain.

Extended `scripts/check-code-cooldown.py` passes at all four viewport sizes above,
asserting both 16px action gaps, no resend border, minimum 44px target, disabled
plain text and enabled underline, plus existing cooldown/request-count checks.
Whole-dialog screenshots reviewed at 320px/390px portrait, 844px landscape and
1440px desktop: hierarchy is quieter, countdown fits at 320px, Cancel retains
its border, no horizontal clipping. Landscape retains vertical dialog scrolling.
Four focused cooldown/HTTP/message regressions and lint passed. Initial browser
extension advanced the clock before the second mocked send completed; corrected
the harness to await its response before advancing, and all viewport cases passed.
Sandboxed dev/build attempts were denied local port binding; retried with the
required permission; production build passed. Physical mobile Safari and live
deployment remain unverified.

## Follow-up: restore button and human-readable long waits

Baseline `316de72`. The user preferred the original bordered secondary resend
button; the borderless experiment above is superseded. Keep the corrected 16px
gaps. Both sending buttons now use `in N min` at 60 seconds or more (rounded up),
and `in Ns` below 60. Example: 500 seconds displays 9 min; 60 displays 1 min;
59 displays 59s. At zero the suffix disappears and the button enables. The
underlying second-resolution deadline, server limits and no-polling behaviour
are unchanged.

Five focused unit/HTTP checks passed, including 500/780/61/60/59/1 boundaries.
Both browser scripts passed: 320×800, 390×844, 844×390, 1440×900 countdown checks
and 390/1440px fallback checks. Added assertions for bordered resend, constant
16px gaps, 13 min → 1 min → 59s → enabled transitions and unchanged request count.
Visually reviewed portrait/landscape/desktop screenshots: existing button
hierarchy restored, compact minute copy fits, landscape scroll preserved.
Lint and production build passed. No backend change, production emails or live-trip testing.
Physical-device and deployed verification remain outstanding.

## Follow-up: clearer disabled state

Baseline `99e488b`. Global disabled opacity (0.58) faded the resend border as well
as its text, making it appear different from Cancel. UniKey secondary buttons now
retain opacity 1 and the same border/shape/type/padding, with `--line` grey fill
and `--muted` text when disabled. Enabled appearance remains white; no transform
or shadow while disabled. This is scoped to this dialog, not a global redesign.

Extended the same browser command to compare border colour, radius, font size and
padding against Cancel; assert disabled fill/text/opacity, no hover transform and
restored white background after expiry. All four viewport cases pass, alongside
five focused countdown/HTTP/message tests, lint and production build. Visually reviewed full dialog
screenshots on narrow mobile, portrait, landscape and desktop: disabled control
is visibly a button, spacing is retained, primary Verify remains prominent.
At 320px the longer label wraps without clipping; landscape keeps dialog scrolling.
No authentication or server policy changes. Physical devices and deployment are
not verified by these local mocked-browser checks.
