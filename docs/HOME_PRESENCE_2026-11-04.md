# Home presence and discovery access — 4 November 2026

Later [area loading/shared maps](HOME_AREA_LOADING.md) supersedes the old global
sample, Home occupancy policy and saved-view Personal avatar checkbox where
described below. Historical verification remains; current behaviour is in that
guide, including indexed area selection and mode-specific permissions.


16 November [map rendering policy](MAP_RENDERING.md) adds a visible-viewport
50-figure budget, 40px overlap spacing, light/detail image tiers, broad-zoom hiding
and a conservative slowdown fallback. It preserves the 120-candidate response,
three-per-area privacy rule, non-clickable figures, controls and no-empty-label
behaviour. The initial fit runs once per map mount; subsequent data refreshes keep
the user's viewport even if areas change. Whole-map hiding on an empty/failed feed
remains. Historical rendering statements below are superseded where noted.

## Home zoom and panning — 16 November 2026

Supersedes the original no-zoom/no-pan interaction rules below. Home uses the same
Leaflet ZoomControl and shared CSS as JourneyMap: one +/− pair at bottom-right,
with accessible Zoom in/Zoom out names and keyboard activation. Two-finger pinch
zoom and single-finger/mouse drag-to-pan are enabled, matching journey maps.
Dragging inside the 200px map moves the map; page scrolling remains available
outside it. Scroll-wheel, double-click and box zoom remain off. Empty-map clicks
still open no destination.
All marker interaction/keyboard targets, popups and journey actions remain off.
The 200px frame, bottom-left credits, main actions and activity order are unchanged.

Initial framing still fits occupied areas with automatic zoom capped at 11.
Routine feed responses with the same distinct area centres, including count or
artwork changes, retain the user’s position and zoom. A different set of occupied areas
reframes to the overview. Empty/failed/hidden states still remove the map; its
next mount starts a fresh overview. No timer, feed, API or backend changes.

Zoom changes only map scale. The server continues grouping planned origins into
fixed 0.05-degree cells (about 5.6km north–south × 4.6km east–west in Sydney) and
sends their centres, capped icons and allowed artwork. Exact endpoints, addresses,
destinations, names and live GPS remain excluded. There is no guaranteed minimum
offset from a real origin; recognisable avatars retain their documented limits.
No API restart is required for this frontend change. Verification is recorded below.

### Pan extension verification

Baseline `71001c1`. Home now enables the same Leaflet drag handler as journey
maps and removes only its forced default cursor so the shared grab/grabbing
cursors apply. No feed projection, marker interaction or API change. Same-area
refreshes retain map translation as well as zoom; a new occupied-area set still
reframes, as above. This supersedes the original zoom release's disabled dragging.

Build/lint and the six Home privacy/access regressions pass. The presence and
activity-layout scripts below pass eight local optimized cases at 320/390/844/1440px:
single-contact touch dragging on phones, mouse dragging on wider screens, zoom
controls/keyboard/pinch, retained translation/zoom on same-area count refresh,
non-clickable markers, hidden empty/failure states, normal sign-in recovery and
unchanged hero/action/map/activity positions for driver/rider cards. Synthetic APIs
assert no writes/GPS/routing. Whole mobile/desktop Home screens were visually
reviewed for action hierarchy, map size, controls, credits and activity spacing.
Page scrolling outside the map remains; swiping inside now deliberately pans it.
Physical Safari and authenticated production activity remain unverified.

Pan implementation `462b303b493e5be58c8c8697c2b0164ebe21e8a9` is verified READY
in production (`dpl_GnTw3PpKtosVvGjuCMLRjT8bhSTo`) on both www.gumwheel.com
and gumwheel.com. The same read-only presence suite passes all four widths on
the deployed frontend, including actual touch/mouse drag events, pinch/controls,
retained translation/zoom and non-clickable markers. Whole deployed Home was
visually reviewed on phone/desktop. APIs were synthetic and real writes blocked;
no production trips, accounts, GPS, generation or emails were created. Reproduce
with the GUMWHEEL_TEST_BASE_URL command below. No API restart was needed.

### Zoom verification

Baseline `3e9980a`. Optimized build and lint pass. The six isolated
`tests/home-presence.test.ts` regressions pass, retaining coarse, bounded,
read-only public projection and symmetric discovery sign-in. No server code
or API restart is involved. Reproduce with:

```sh
npm run build
npm run lint
node --import tsx --test tests/home-presence.test.ts
# Serve the optimized frontend in another terminal:
node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3201
# With Playwright and /usr/bin/chromium installed:
GUMWHEEL_TEST_TILES=1 /tmp/gumwheel-ui-check-env/bin/python scripts/check-home-presence.py
GUMWHEEL_TEST_TILES=1 /tmp/gumwheel-ui-check-env/bin/python scripts/check-home-activity-layout.py
```

Both browser scripts pass at 320/390/844/1440px (eight cases). They cover shared
bottom-right +/− controls and keyboard activation, real two-contact pinch events
at 320/390px, preserved zoom on same-area/count refresh, non-clickable/non-focusable
icons, empty/failure/hidden map removal and recovery, credits and OTP-preview
behaviour. The activity suite covers driver, rider, defensive multiple-card and
no-card states, stable hero/action/map positions, 200px height and no overflow.
All API responses are synthetic and assert no journey/location/routing writes;
only read-only public map tiles reach an external service. Whole populated/empty
phone and desktop screens were visually reviewed for heading clearance, action
hierarchy, map/control/credit spacing and ordinary activity scrolling. No new
copy, palette or controls outside the shared map widget. Hook review: the ref
only remembers framed area keys; existing effects, cleanup and polling remain.
Physical Safari and authenticated production activity remain unverified.

Implementation `7926ae0ac7cfaa3645c6e5384d4cb82be5b11a5d` is verified READY in
Vercel production (`dpl_FS7t8SyHBH8JaT7B2GHrV6zWgq9b`) on www.gumwheel.com
and gumwheel.com. The same presence suite passes all four widths against the
deployed frontend, including touch pinch on phones and zoom retention. Its APIs
are synthetic; non-GET/HEAD external requests are blocked, so no real journeys,
GPS, account mutations, generation or email were created. Whole deployed Home
was visually reviewed on phone/desktop. Reproduce the read-only frontend check:

```sh
GUMWHEEL_TEST_BASE_URL=https://www.gumwheel.com GUMWHEEL_TEST_TILES=1 /tmp/gumwheel-ui-check-env/bin/python scripts/check-home-presence.py
```

No API service restart was performed or needed.

16 November [assigned map avatars](MAP_AVATARS.md) extends rider cells with the
same bounded `artworks` array. Enabled account sprites use opaque public image
paths; selecting Default removes them from future feeds and blocks sprite reads.
The owner explicitly opted into public Home display. An avatar may be recognisable;
coarse areas do not make a personal illustration anonymous. Names, precise
locations, destinations and live GPS remain excluded. Existing caps, empty-state
hiding and non-clickable map settings are unchanged.

5 November [all-map vehicle artwork](VEHICLE_MAPS_2026-11-05.md) supersedes the
original role-only artwork projection below. Driver cells may also carry an
`artworks` array matching count, containing only allowlisted shipped car paths or
null (generic). No vehicle record, plate, user/post id or precise GPS is added.
The model/body and colour are visible through the illustration. The shared
MapSurface now owns tiles/credits for Home and journey maps; Home keeps its own
noninteractive area/offset settings. Successful local vehicle saves also refresh
Home immediately via the payload-free same-origin signal; other visits retain
the visible-minute refresh. Empty/failure hiding, caps and lifecycle are unchanged.

5 November: [Home layout](HOME_LAYOUT_2026-11-05.md) increases map height from
160px to 200px and places personal activity outside/below the centred primary
group. Empty-map behavior and all privacy rules below remain unchanged.

5 November: [shared map credits and colour tiles](MAP_CREDITS_2026-11-05.md)
supersede the monochrome Home tiles below. Credits now share the journey maps'
bottom-left component and styling; discovery/privacy behavior is unchanged.

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
