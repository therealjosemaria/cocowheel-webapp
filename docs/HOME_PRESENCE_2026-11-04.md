# Home presence and discovery access — 4 November 2026

## Agreed behavior

Supersedes the earlier design-only homepage map boundary in JOURNEY_ROLE_ART.md.
Home retains Share your journey and its two action buttons. A 160px map below
them appears only when at least one qualifying post exists. It has no heading,
approximate-location caption, empty label, count, profile link or journey action.
Loading, empty, failed and malformed feed responses hide the map entirely;
Find/Post remain available. A later successful refresh can restore the map.

The owner requested multiple icons for multiple posts in an area: show up to
three separate icons per geographic cell, not one merged icon. If both roles
exist, include both; the third icon goes to the more numerous capped role
(driver wins ties). These are anonymous post indicators, not online-user counts,
individual identities or moving vehicles. The map never invents/sample-fills
activity. Accepted/underway journeys are not homepage discovery presence.

## Public projection

GET /api/home-presence is intentionally public and no-store. Its only payload is
`cells: [{role, latitude, longitude, count}]`. The server selects planned origins
for non-sample PUBLISHED/REQUESTED driver posts without accepted riders whose
offer expiry is still in the future, and OPEN/unexpired rider requests whose
owners are not busy as drivers or accepted riders. It never queries live GPS,
usual routes, photos or messages for Home. Reads do not expire/change records,
hydrate labels, issue sessions, request GPS, geocode or request road routes.

Coordinates are deterministic centres of fixed 0.05-degree cells (roughly
5 km across in Sydney), not arbitrary random offsets or encrypted coordinates.
Coordinates at geographic bounds are clamped inside the valid range. No exact
origin/destination, label/address, name, account/post ID, schedule, fare, PayID or
link is sent. Counts are capped for visual rendering, not an exact census.
Up to 100 distinct cells per role are considered in coordinate order. Combined
areas retain at most three icons and the whole response at most 120 icons, also
in coordinate order. The client validates cell centres, role/count bounds,
duplicates, area totals and overall total before rendering.

Broad areas and roles are public information; this reduces exposure but does
not guarantee anonymity against outside knowledge. Verified members still see
published journey endpoints/names in ordinary discovery. Previous public data
already received/copied cannot be recalled. The Privacy page explains these
boundaries; Home adds no approximation disclaimer.

## Frontend and shared design

HomePresence fetches without credentials/Authorization, with no-store, immediately
on mounting and every 60 seconds while visible. Each attempt has a 10-second
deadline; requests do not overlap. Hiding the tab aborts its request and clears
markers; returning starts a fresh request. Cleanup aborts requests and removes
the timer/listener. Failure clears old presence rather than keeping stale icons.
There is no browser persistence or server feed cache. Normal removal latency is
the next minute refresh plus request latency, not instantaneous push delivery.

The map is dynamically loaded only with nonempty data and uses existing
Leaflet/OpenStreetMap tiles and the shared 48px model marker factory/artwork.
The car is unchanged; rider uses the stationary figure. Grouped icons use fixed
pixel spacing around the same area centre, with no individual geographic offset
or identifiable key. Tiles are monochrome; markers retain approved light-surface
art. Existing type, control radius and spacing tokens are reused; width is
min(100%,680px). Mobile and desktop keep the same 160px map height.

No pan, zoom, click, tooltip, popup, marker keyboard target, geolocation request,
heading sensor or movement animation. Map attribution links remain interactive
as required; they do not expose journeys. Existing participant maps retain their
interactions, geometry, routes and colours; only tile URL and icon construction
are shared. Privacy/Help use existing legal/FAQ components and body hierarchy.

## Symmetric sign-in requirements

Owner explicitly approved verified-email sign-in for both discovery roles.
POST /api/search, GET /api/availability and GET /api/rides/:id/preview now call
requireUniversitySession before loading/serializing records. Anonymous, invalid
and legacy guest credentials return 401 UNIVERSITY_VERIFICATION_REQUIRED.
Rider-request discovery already requires the same check. JSON stays no-store.
Private participant, GPS, payment and admin access controls remain unchanged;
public profile-photo delivery remains unchanged. Email verification is inbox
access, not identity/background verification or a promise of safety.

Search POSTs reuse the existing OTP dialog and retry after verification. Direct
preview links show Sign in to view this journey with the existing Sign in action;
they stop unauthorized polling and resume on identity change. Matching-email
entry already provides its own shared sign-in action. Signed-in discovery,
acceptance, pairing and lifecycle behavior is unchanged.

## Verification and activation

Local verification on 4 November: npm test passed all 242 tests. After the
owner's multiple-icon refinement, the five tests in tests/home-presence.test.ts
were rerun successfully: reduced payload/read-only behavior, bounded multiple
icons, lifecycle/sample exclusions, busy-owner exclusion, bounded payloads and
HTTP sign-in parity for anonymous/guest/invalid versus verified credentials.
Final npm run build and npm run lint pass.

Reproduce the dedicated browser check with the built frontend at :3201:

`GUMWHEEL_TEST_TILES=1 /tmp/gumwheel-notification-check-env/bin/python scripts/check-home-presence.py`

Passes at 320/390/844/1440px: three separated icons in one area; exactly one post
still shows the map; zero/failure hides it without text; real interval refresh
and recovery; hidden-tab suppression and return refresh; no pan/click/keyboard
marker actions; existing OTP dialog and preview resume; shared 44px sign-in
button stays inside its panel; no overflow, runtime errors, write, GPS or routing
calls. APIs are synthetic; only read-only OSM tiles may reach external providers.
The first timer test installed its clock after native timers and failed; moving
clock installation before navigation fixed the fixture, with no app timing change.

check-home-order.py passes all four widths. check-journey-role-art.py passes
390/1440px after shared helper extraction. Whole mobile/desktop Home (posts and
empty), direct-link sign-in, Privacy and expanded Help FAQ were visually reviewed
for spacing, type hierarchy, clipping and icon prominence. The visual review
caught a full-width button plus parent margins clipping its right edge; using
ride-action-buttons fixed it and the final browser check enforces containment.
Physical Safari, real participant trips and authenticated production discovery
remain unverified; no live trip/test email was created.

The owner authorized a conditional API restart. A private SQLite online backup
passed integrity_check with zero underway trips; another fresh check is required
immediately before restart. A frontend push alone does not activate the new API
or access rules. No schema migration; production activation is recorded below.


### Verified production activation

Implementation c06e115d12bcc2f5a492e850839beec180d04f04 was committed/pushed.
After owner approval, a private online SQLite backup passed integrity_check;
a fresh check found zero ACCEPTED/RIDE_ACTIVE/CO_RIDE_ACTIVE trips immediately
before restarting only cocowheels-api at 2026-11-04T04:03:03.205Z (15:03 AEDT).
No schema migration or other service restart. Table counts remained unchanged:
135 rides, 79 join requests and 12 rider posts. No live test journey/email.

Local native HTTP and public HTTPS health checks pass. The feed returns only
bounded role/area/count fields with no-store; there are currently zero qualifying
posts. All four anonymous discovery/preview checks return 401 verification
required, including a nonexistent driver reference before lookup. Fetch refuses
local port 5060 as a bad port; native HTTP verified the listening API instead.

Vercel production deployment dpl_BUDfHu6rpN4uZeUP1NSFjRtjdkqs is READY for the
exact implementation SHA and aliased to www.gumwheel.com. Fresh guest Chromium
checks at 390/1440px pass: real feed returns zero, no map/empty label is shown,
Home actions remain intact, direct preview has the Sign in action and no runtime
errors or horizontal overflow. The populated map and multiple-icon states were
verified locally with synthetic records, not by adding posts to production.
Authenticated production/physical Safari walkthroughs remain unverified.
