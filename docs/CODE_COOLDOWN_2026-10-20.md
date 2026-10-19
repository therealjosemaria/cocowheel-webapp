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
