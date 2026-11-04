# Route location and recent-change audit — 4 November 2026

Baseline e0f94e7. User reported desktop Use my location returning the generic
GPS error. Tracing shows this exact message is emitted before /api/place-label
when the browser fails or omits geolocation. Recent Home/auth/art commits did
not change this GPS code (last modified c9b73f1). No live geolocation-disabling
Permissions-Policy header was found. Actual device permission/OS failure reason
cannot be recovered from the old generic message and remains unverified.

Before editing, deployed Find/Post were tested with browser-supplied synthetic
coordinates of a public Sydney landmark. Both reached the real place-label API,
returned 200 and selected the origin, proving the post-GPS address path works.
No real device GPS, account mutations, test trips or email were used.

## Correction

lib/route-location.ts preserves geolocation error codes. Explicit address lookup
first requests a fresh high-accuracy fix (12 seconds, maximumAge0). Only failures
other than permission denial may try a standard-accuracy fix (8 seconds,
maximumAge60000). Unsupported browsers fail immediately. Denial has one call;
normal failure has at most two, up to approximately 20 seconds combined browser
waiting. No automatic location capture, repeated polling, IP-coordinate fallback,
or widening of accepted-pair GPS permissions. A superseded selection prevents a
second attempt; late fixes and labels cannot overwrite a newer draft.

PlaceSearch cancels pending text debounce and clears its loading indicator when
location lookup begins. Existing full-label storage, compact captions, country
handoff and reverse geocoding remain unchanged. New error messages:

- Blocked: Location access is blocked. Allow location access for this site in your browser and device settings, or search for your address.
- Timeout: Finding your location took too long. Try again or search for your address.
- Unavailable: Your device couldn’t determine your location. Check device location services, or search for your address.
- Unsupported: This browser doesn’t support location access. Search for your address.

These reuse existing inline alerts, typography and spacing. API/provider failures
retain their separate existing address-lookup error. No backend restart needed.

## Verification

npm test: 246/246; npm run lint and npm run build pass. Four new unit cases cover
fresh success, bounded fallback, no retry on denial/abandonment, and distinct final
errors. Reproduce browser checks against the built Next app on :3201 using
/tmp/gumwheel-notification-check-env/bin/python:

- scripts/check-location-recovery.py: 390/1440, Find/Post/Profile, all three GPS
  errors, fallback, no initial GPS, no failed-GPS address call, stale-fix protection.
- scripts/check-local-search.py: 390/1440, country handoff, cache and Profile.
- scripts/check-home-presence.py: 320/390/844/1440, feed bounds/empty/failure,
  sign-in recovery and no automatic GPS.
- scripts/check-gps-privacy.py (replace localhost port 3090 with 3201 in its source
  when executing): 390/1440 both roles, no GPS before acceptance, resumes afterward.

All those pass using synthetic APIs/GPS, external providers blocked. Whole
Find/Post address sheets and Profile failure states were visually reviewed on
phone/desktop: regular alert text, wrapping, input/button spacing and modal
placement remain consistent. The full unit suite exercises existing lifecycle,
acceptance, payment, authorization and reminder behavior. This is scoped
regression evidence, not proof of every app feature or physical device setting.
scripts/check-calendar-search.py also exits successfully at 320/390/844/1440px,
covering address sheets, independent date/time filters, route warnings, search
preservation and driver review. Production activation is recorded below.

See [sanitized results](results/location-regression-2026-11-04.json). No load test,
live participant trip, real permission prompt or hardware GPS test was performed.


## Verified deployment

Implementation 3a6922f8897531488ad0d4128ea32f96c1b4403b was pushed; Vercel
production dpl_6KBCo8vz6SiFGwb1RLGwd6pUqyqx is READY for that exact source and
aliased to www.gumwheel.com. Four fresh Chromium cases (390/1440, rider/driver)
pass on production: no automatic GPS, specific denial with one call, simulated
high-accuracy timeout followed by standard-accuracy success, real place-label
HTTP200, selected origin and no runtime errors/overflow. Coordinates were a
synthetic public Sydney landmark; no actual user GPS or live trip writes.
The initial live harness selector matched both the inline alert and Next's
route announcer. Scoping it to .place-search fixed the harness and all four
cases passed; no product change was needed for that selector failure.
No API restart or configuration change. Physical desktop permission/OS diagnosis
still requires the user's device; the new message now preserves that distinction.
