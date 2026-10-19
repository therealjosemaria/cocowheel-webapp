# Driver pickup entry — 19 October 2026

Source baseline: `402552b`, with the pickup-entry changes in this commit series.
Scope: frontend input and driver-only PayID Copy removal; no API, authorization,
pickup-code expiry, attempt-limit, payment-disclosure or database changes.

## Change and cause

Previously one transparent text input overlaid four decorative boxes. The boxes
were not separate controls, and the invisible input's caret did not correspond
to the displayed digit positions. This created ambiguous tap/edit behaviour;
the specific original physical-device keyboard failure was not reproduced here.

Four real visible 44×48px inputs now share the rider display's 8px gaps/corners,
24px typography and centring. Each digit has its own accessible name, numeric
keyboard hint and focus indicator. Tap/focus selects the digit; input advances;
Backspace on an empty cell clears/focuses the preceding digit; left/right arrows
navigate. Paste strips non-digits and fills remaining boxes. Leading zero survives.
All four digits are required, and confirmation is still an explicit action.
Inputs disable during submission; existing error modal preserves entry on failure.

Driver own-PayID remains readable with unchanged value typography but no Copy
button. Rider Copy stays behind the existing pickup disclosure gate, including
history. No pickup-code Copy button existed; the removed control was PayID Copy.

## Reproduction/check commands

Use Python Playwright with system Chromium (`/usr/bin/chromium`):

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
python scripts/check-pickup-input.py
```

The script intercepts API calls with synthetic fixtures; external requests are
blocked, and the frontend proxy targets an unused port as an additional safety
boundary. Local logs can contain connection-refused messages for requests during
navigation/teardown; no production backend is contacted. No real code or PayID is
stored in test artifacts. Screenshots are written under `/tmp/gumwheel-pickup-*`
and `/tmp/gumwheel-payment-rider-*`, not committed as private app screenshots.

## Results

- PASS at 320px, 390px touch-enabled mobile emulation and 1440px desktop.
- Each cell directly tappable, correct focus/advance, filled-digit replacement,
  Backspace, paste, leading zero and arrow navigation.
- Empty/incomplete code disables confirmation; polling preserves entry.
- Invalid response uses existing modal and preserves digits; valid submission
  sends exactly `{code: "0123"}` and removes the panel when paired.
- Driver Copy absent, value present; rider payment hidden before pickup, Copy
  present after pickup and in history. Clipboard stub receives the exact value;
  existing copy-confirmation modal remains unchanged.
- No browser runtime errors or horizontal overflow. Full-screen visual review
  covered driver 320/390/1440, rider 390/1440, and post-pickup rider desktop:
  matching centred boxes, restrained instruction text, unchanged headings/button
  prominence, compact PayID label/value spacing. External map tiles intentionally
  absent; this is not a map imagery check.
- 87 regression tests, ESLint, production build/TypeScript and diff whitespace
  checks pass. Updated the older outage-browser script's input selector; that
  entire outage campaign was not rerun.
- React checklist: stable cell keys/refs, unique IDs, unconditional hooks, derived
  code state, no new effects/listeners/dependencies, explicit submit guard.

## Boundaries

These browser checks use mocked HTTP responses, not a newly executed real-server
pairing journey. Existing backend regression suite passes; backend code unchanged.
Native iOS/Safari and Android virtual keyboards, physical-device selection handles,
real clipboard permissions and deployed frontend behaviour remain unverified.
No API restart performed; commit/push alone does not verify Vercel deployment.
