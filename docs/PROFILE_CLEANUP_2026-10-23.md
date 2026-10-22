# Profile scope correction — 23 October 2026

Baseline: `8e9f7dc`. Profile's saved and new-route views no longer expose fare,
contribution or PayID controls. These belong to Offer a ride, which is unchanged.
The previous retention of Payment preferences in Profile is superseded.
The “Your routine is private. Only rides you offer are visible to others.”
helper sentence is removed without changing visibility or authorization.
“My usual route” becomes “Usual route” with the existing route icon through
RideFieldLabel, matching the alerts heading's icon, typography and spacing.

New routes keep the existing zero-fare/empty-PayID defaults. Existing route,
schedule and consent updates still spread the saved object, retaining legacy
payment fields. No schema, API, stored-record migration or restart is involved.

The schedule summary removes only “· Sydney time”. Australia/Sydney, DST,
the ±60-minute matching window and the crosses-midnight note are unchanged.

## Reproducible checks

```
npm test
npm run lint
npm run build
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090
```

With the local frontend running, use Python with Playwright/Chromium:

```
python scripts/check-save-route.py
python scripts/check-usual-route.py
```

Both browser scripts mock API responses and block external calls; no production
data, provider requests or emails are involved. Checks include absence of payment
UI, saved-route edits preserving legacy payment fields, schedule copy, email
consent and existing matching-email review links. Widths: 320/390/844/1440px.
The display unit test covers ordinary and midnight-crossing schedule windows.

Production deployment and real-device Safari remain separate, unverified checks.

## Results

- 141 tests passed; lint and production build passed.
- Both Profile browser scripts passed at all four widths. Reviewed full saved
  Profile screenshots at 390 and 1440px: no payment section, compact schedule,
  unchanged heading hierarchy, controls, spacing and footer.
- After the follow-up privacy-copy removal and Usual route icon/wording change,
  reran check-save-route.py at all four widths, including equal computed heading
  font size/weight/colour and icon presence assertions. Final whole-screen
  320px and 1440px captures reviewed; shared 14px monochrome icons and 5px gaps
  match, buttons retain shared dimensions and no horizontal overflow occurs.
  Targeted ESLint passed after the final JSX edits.
- Initial schedule assertion incorrectly expected a standalone time element;
  corrected the selector to account for the weekday in the same paragraph.
- The unrelated free/paid-ride suite hit Chromium screenshot-capture errors on
  two attempts. Its assertion-only rerun disables screenshots; this is distinct
  from the successful Profile visual review above.
  That rerun passed free/paid publishing payloads and payment gates at 320px,
  then reached an unrelated Help FAQ timeout at 390px. The full suite is not
  claimed as passed; Offer a ride code and shared payment components are unchanged.
