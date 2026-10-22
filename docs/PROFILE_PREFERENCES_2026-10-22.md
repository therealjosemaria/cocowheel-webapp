# Profile preferences check — 22 October 2026

Source baseline: `663338c`, plus this commit's Profile-only refinement.

Profile now exposes Edit route with Save route/Cancel, retains schedule, email
and payment preferences, and no longer offers/publishes rides. Existing matching
email review links and backend endpoints remain unchanged. No restart required.

## Reproduction and isolation

Start the isolated frontend:

```sh
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
```

Then, using Python with Playwright and Chromium installed:

```
python scripts/check-save-route.py
python scripts/check-usual-route.py
npm test
npm run lint
npm run build
```

Browser scripts intercept APIs with synthetic fixtures and block external
requests. No production trips, email, GPS samples or database writes are used.

## Results

- All 140 automated tests, lint and production build passed.
- Save-route browser flow passed at 320, 390, 844 and 1440px: consent,
  replacement, preserved opt-out, conflict handling and schedule refinement.
  New checks verify cancelling makes no write, invalid typed addresses cannot
  save, reopening restores saved addresses, and saving selected endpoints
  preserves every other route field (including email consent and payment).
- Visually reviewed full saved and expanded-editor screens at 390 and 1440px:
  matching Edit route/Edit schedule buttons, restrained heading hierarchy,
  address wrapping, shared field controls and section spacing. Automated
  overflow checks cover all four widths. No new visual tokens.
- The broader usual-route browser suite passed at all four widths after its
  expectation updates: initial creation, draft restoration, alert mute/enable,
  payment validation, removed offering controls, unavailable/available email
  review links, load failure/retry and sign-out isolation.
- Initial browser attempt failed because the local server had stopped; restarted
  the isolated server and the save-route suite passed. The broader legacy suite
  then exposed stale expectations for `60 min` and bare `Delayed`, superseded by
  the earlier hours/minutes change. Updated test expectations, not product code.

Production deployment and real-device Safari are not verified by these local
Chromium checks. A git push is not deployment verification.
