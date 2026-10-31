# Future discovery and localized search — 22 October 2026

31 October update: [local-search persistence and ranking](LOCAL_SEARCH_2026-10-31.md)
supersedes the provider-only ordering below and makes forward selections refresh
the existing seven-day country preference. The 30-minute tab location, soft
provider bias, no hard country restriction and ten-result limit remain unchanged.

The later IP-hint section in that guide also supersedes the initial Australia
fallback below: first-visit country comes from hosting metadata or stays absent.

Baseline: `c95b657`. Backend/frontend corrections; no schema/configuration changes.

## Causes and behavior

Discovery's SQL excluded offers after the requested time (usually now), while
requestRide also rejected joining before scheduled departure. Removed the SQL
lower-time exclusion and the timing-fit lower bound. Available future offers now
participate in the existing 50-result query/ranking. Request persistence uses the
later of requested time and scheduled departure; no automatic acceptance or start.
Expired/closed offers and self-joins remain forbidden. Existing 50-result cap and
coarse spatial fit are unchanged; this is not an unlimited discovery guarantee.

Place search formerly applied a hard country filter, omitted country metadata in
results, and did not share forward-search choices across screens. Geoapify now
receives combined proximity/country bias, without a country filter. Its documented
soft bias prioritizes nearby/country results while allowing worldwide corrections:
https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/
No extra provider call, keystroke autocomplete, state boundary or custom state
sorting is added. Explicit state/country in query text still goes to the provider.
Real ranking quality depends on provider data and is not guaranteed by fixtures.

Each selected result updates `cocowheels:search-location:v1` in sessionStorage:
coordinates and country only, no label/account/PayID. Expires 30 minutes after
selection; malformed/expired/unavailable storage is ignored. Same-tab navigation
and reload can reuse it, not cross-device synchronization. This is a search hint,
not live GPS, a saved route or authorization. Destination's selected origin takes
precedence over the remembered location; otherwise the latest selection wins.
Australia remains the initial country preference, not an enforced restriction.

## Checks

Reproduce with `npm test`, `npm run lint`, `npm run build`, and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-usual-route.py` against
isolated frontend :3090 (API proxy loopback :1; browser APIs mocked, external
requests blocked). No real emails, provider requests or production writes.

131 regression tests passed: future discovery, request time normalization,
self-join denial and expiry; provider bias/no filter and country metadata;
replaceable/expired/malformed/unavailable browser preference storage. Browser
fixtures now use a one-hour-ahead offer and assert shared bias across search
fields and navigation to Profile. Lint and production build passed. Browser suite
passed at 320/390/844/1440px; whole-screen mobile/desktop Find screenshots reviewed
for unchanged typography, spacing and containment. No new controls/styles.

## Activation boundary

Production API restarted with owner authorization from `ccc4229` at 12:46:31
AEDT on 22 October 2026. Local and public-domain API health passed after startup;
unauthenticated current-ride access was correctly denied. See the
[activation evidence](GPS_PRIVACY_2026-10-22.md#activation). No ride mutations
were used for verification. Physical iPhone testing, authenticated production
journeys, frontend deployment and real Geoapify ranking remain unverified.
