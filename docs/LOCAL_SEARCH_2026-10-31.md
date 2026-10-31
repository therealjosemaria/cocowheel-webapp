# Local search preference and ranking — 31 October 2026

Implementation baseline b5b4056 (time picker) / search baseline 9b37986.

## Observed problem

Read-only public API probes for 2018 with countryCode=au returned Armenia before
an Australian postcode result. Redfern with country=au returned Australia before
foreign results, and a Sydney proximity hint returned the Australian result only.
These fresh API probes bypassed the one-minute browser cache; they do not prove
what the user’s earlier browser request contained. No user trips were changed.

Source inspection found seven-day localStorage country writes only during Home’s
reverse lookup; normally labelled forward selections skipped that effect. Shared
forward/GPS selections instead updated a 30-minute same-tab location. Browser
cache keys already include text, coordinates and country, and remain unchanged.

## Implemented contract

Every shared selected place with valid country metadata now updates the existing
cocowheels:country-preference:v1 localStorage key with a rolling seven-day expiry.
This includes Find, Post and Profile’s shared PlaceSearch, plus its existing Use
my location selection. Only country and expiry are stored in this persistent key;
coordinates/country stay in the existing same-tab 30-minute session key. No precise
location is newly persisted across tabs. Expired/malformed/blocked storage is
ignored; search remains usable. This is browser-local, not account/device sync.

Home reuses the shared country helpers for reverse lookups and initial preference.
At search time, precedence is selected origin country, latest same-tab selection
country, persistent country, then the field’s optional country. The later IP-hint change below removes the
Australia fallback. Coordinates
prefer an explicit origin over the latest tab-local selection. The search reads
persistent country again rather than depending only on Home’s mount-time state.
An origin selection therefore affects the destination immediately, even if storage
is blocked, because the selected pin supplies its own coordinates/country.

The server still makes one Geoapify forward request with at most ten results,
country/proximity bias, no hard filter and the existing four-second timeout.
For queries without a provider-parsed explicit country, returned results matching
the preferred country are grouped first. Provider order is stable within each
group, and all foreign alternatives stay in the response. If the provider reports
query.parsed.country, its complete order is retained, allowing explicit overseas
searches such as Paris France. Unknown/absent country preferences retain provider
order. This cannot create a local match missing from the provider’s returned set.

That release added no automatic GPS request or IP lookup. The subsequent change
below adds hosting country metadata, superseding the no-IP-lookup statement. Use my location remains an explicit user action with browser permission.
This supersedes earlier provider-only ordering statements; query validation,
rate limits, result labels, cache capacity/TTL, schema and credentials are unchanged.

Provider reference: https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/ .
Read-only provider diagnostics confirmed parsed.country was absent for 2018 and
Redfern, and “france” for Paris France. Do not log API-key URLs or private searches.

## Verification and release

Run `npx tsx --test tests/place-label.test.ts tests/search-location.test.ts`,
`npm test`, `npm run lint` and `npm run build`. Tests use fake provider fetches and
browser storage; no live trip or account writes. Results and browser/deployment
checks are recorded after completion. Backend ordering requires a conditional
API restart with a consistent private backup and zero accepted/active trips;
frontend persistence alone does not activate backend ordering. Physical phones
and all provider parsing/language edge cases remain outside the synthetic checks.

Targeted provider/storage tests pass 10/10; full regressions pass 232/232, lint
and production build pass. Reproduce browser handoffs against an isolated Next
preview at :3201 with API proxy loopback :1 using
`python scripts/check-local-search.py` (Playwright/system Chromium). Browser
fixtures cover a five-day-old country hint, postcode/origin-to-destination
handoff, visible foreign alternatives, overseas selection, separate new-tab
session storage, Profile selections and country/coordinate-aware cache reuse.
Provider ranking itself is exercised by the injected-fetch backend tests, not
claimed from ordered browser mocks. One initial fixture wrongly rejected the
existing read-only route-preview POST as a write; its allowlist/mock was corrected
and the complete suite rerun. No live mutations or test emails were performed.

React review found no hook, rendering, permission or new-control changes beyond
the intended preference reads/writes. Existing result sheets and Profile editor
are reused. Mobile/desktop visual and deployment checks are recorded below.

Browser handoff suite passes at 390/1440px with no runtime errors; existing
result-list sheets and full Find/Post/Profile screens were visually inspected
at phone/desktop widths for hierarchy, spacing, wrapping and overlay placement.
No visual tokens or controls changed. Physical mobile keyboards, all browser
storage policies and provider country-parsing variants remain unverified.

## Verified activation

Implementation 9ab51e3ca1bc238ec5f55ba348367f75d1323a91 was pushed to main.
Under standing conditional authorization, zero ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE
trips were checked before consistent private SQLite backup and again immediately
before restarting only cocowheels-api at 13:10:46 AEDT on 31 October 2026.
Backup and post-restart integrity/FK checks passed; all 135 rides, 79 join requests,
12 rider posts, six rating records and seven accounts were preserved. Service
active; local and public health returned 200. No schema/environment changes.

Live read-only search probes returned the Australian 2018 postcode first with
foreign alternatives retained; Redfern with Sydney proximity returned Australia;
Paris France with an Australian preference still returned France first. These
verify current provider/API responses, not all possible future provider changes.
No live journey, account, message or email was created for verification.

Vercel production deployment dpl_9MqvDeQoyMgRNJBhSCBc4Szbt8Ri is READY for
9ab51e3ca1bc238ec5f55ba348367f75d1323a91, aliased to www.gumwheel.com.
This source includes the already verified b5b4056 time-picker change. Browser
persistence and UI flows were tested locally with mocks; a physical-phone
production walkthrough remains unverified.

## First-visit IP country hint — subsequent implementation

Baseline c545814. Selected origin, latest 30-minute tab selection and seven-day
saved country retain priority; without them, shared PlaceSearch fetches
/search-country once per document (including null/failure results). The 1.5-second
lookup timeout fails softly to worldwide search. No inferred hint is written to
persistent storage. A later selection replaces it, including explicit overseas
locations; existing generation guards discard outdated asynchronous results.
No Australia or other default is supplied. Geoapify receives countrycode:none
when country is absent, disabling its implicit caller-IP country bias. Existing
proximity and explicit-country handling remain; these are hints, never borders.

The canonical site is Cloudflare-proxied before Vercel. The dynamic frontend route
therefore reads CF-IPCountry on gumwheel.com/www.gumwheel.com, and does NOT fall
back to Vercel’s potentially proxy-derived country if it is missing. Direct
*.vercel.app hosts use x-vercel-ip-country instead. Unknown/local hosts or missing,
XX/ZZ/malformed values return null. Hosting metadata is read only when VERCEL=1.
Cloudflare’s IP Geolocation setting must provide its header on the canonical site.
Country estimates can be wrong with VPNs/mobile networks; user selection wins.
This is cosmetic search ranking, never authorization, identity or eligibility.

/search-country intentionally sits outside /api/* (rewritten to the Pi API).
It returns only {countryCode}, never raw IP/coordinates/account details, with
private/no-store and CDN no-store headers plus X-Robots-Tag:noindex,nofollow.
No cookies or external geolocation service are added. Hosting providers still
handle request metadata as described in Privacy; the feature does not persist IPs.
No sitemap entry, database/schema or user-supplied environment changes.

References: https://developers.cloudflare.com/network/ip-geolocation/ and
https://vercel.com/docs/headers/request-headers . Geoapify reference above describes
the implicit countrycode:auto default and countrycode:none override.

Verification: run `npx tsx --test tests/country-hint.test.ts tests/place-label.test.ts
 tests/search-location.test.ts`, then npm test/lint/build. Browser reproduction is
`python scripts/check-ip-country.py` against the isolated :3201 preview, plus
`python scripts/check-local-search.py`. Actual results and activation follow below.
The backend worldwide-bias change needs the normal backed-up, zero-underway
conditional API restart; frontend deployment alone does not activate that change.


Pre-release checks: all 237 regression tests, lint and production build pass.
The first-visit browser matrix passes ten scenarios across 390/1440px: valid FR
hint (proving no Australia default), null/XX/503 responses, saved AU overriding FR,
one lookup per document, inferred country not persisted, selected AU replacing
hint and no unexpected writes/runtime errors. The shared handoff suite also
passes at both widths (Find/Post/Profile, five-day storage, new tab, cache keys).
Privacy and shared sheets/Profile were visually reviewed at both widths: existing
regular body hierarchy, buttons, spacing and wrapping are preserved. A screenshot
fixture originally aborted background API requests and displayed its expected
connection toast; the privacy screenshot mock was corrected before visual review.
No live mutations or emails were used; physical phones/VPN networks remain untested.
React review checked asynchronous generation guards, stable hook dependencies,
shared components and deduplicated hint fetching; no new visual pattern or controls.

### Verified activation of first-visit hints

Implementation c9b73f1b1203d1bbca7a5a89a1ce79b0b481075e was pushed to main.
Vercel deployment dpl_9aj4Euku2miB7Toxz13FwM41XjkS is READY and aliased to
www.gumwheel.com for that exact revision. The public /search-country response
returns only {countryCode:"au"} for the verification connection, matching the
country-only Cloudflare trace result AU. A caller-supplied CF-IPCountry:FR still
returns AU through Cloudflare. Public headers confirm private/no-store,
CDN no-store, X-Robots-Tag:noindex,nofollow and Cloudflare DYNAMIC/Vercel MISS.
The Vercel-specific CDN control is consumed by Vercel, as expected. No Cloudflare
configuration edit was needed. Direct Vercel alias behavior is unit tested,
not claimed from a protected-alias production walkthrough.

Under standing authorization, a consistent mode-600 SQLite backup was validated
and zero ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE trips checked before backup and again
immediately before restarting only cocowheels-api at 14:07:40 AEDT, 31 October.
Post-restart service is active; local/public health are 200. Integrity is ok,
foreign-key violations zero, and counts unchanged: 135 rides, 79 join requests,
12 rider posts, six ratings and seven accounts. No schema/env changes.

Live read-only searches verify: AU-biased 2018 returns Australia first with foreign
alternatives; Redfern with AU returns Australia first; Paris France with AU still
returns France; unhinted 2018 retains worldwide provider order. A generic urllib
probe was denied 403 by the edge; browser-compatible curl and the actual guest
Chromium flow succeeded. This was not an API health failure.

A fresh production Chromium mobile viewport confirms /search-country AU supplies
the first 2018 search, inferred country is not persisted, selecting the Australian
result persists the chosen country and adds origin proximity for Redfern, with
only one hint lookup. A separate synthetic stalled-request check confirms the
actual 1.5-second client timeout continues worldwide. No login, journey, message
or email was created. Physical-phone and international/VPN observations remain
unverified; country estimates are approximate and may be absent.
