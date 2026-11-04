# Custom vehicle artwork across maps — 5 November 2026

## Current decision and data boundaries

The owner explicitly changed the initial private-only illustration decision:
custom cars should appear on every map, including Home, while Home remains
non-clickable and without journey/person details. Only a saved, explicitly
selected supported make/model/year/colour enables artwork. Publishing without
details and typed/manual alternatives retain the existing generic car.

Authenticated search candidates, availability and unpaired driver previews gain
optional `vehicleArtwork`, derived server-side from current saved details.
It is a shipped `/brand/vehicles/v1/<catalogue-id>-<colour>.webp` path, not the
vehicle record. Number plates, selection provenance and raw custom text are not
included. Existing email-sign-in checks and private participant access stay.
Public Home cells gain optional `artworks: (string|null)[]`, exactly one entry per
visible driver icon, at most three per area and 120 overall. Null retains generic.
All-generic cells omit the array for backward compatibility. Riders do not carry
car artwork. The client rejects arbitrary URLs, queries, traversal and unshipped
paths through the same catalogue allowlist used by the shared marker renderer.

Home still contains only coarse 0.05-degree area centres, capped role counts and
artwork paths: no names, number plates, user/post identifiers, exact origins,
destinations, schedules or live GPS. The car shape/colour necessarily reveals
the depicted model/body/paint; this is disclosed in Privacy. This is a projection,
not encryption and not a guarantee of anonymity against outside knowledge.
No click, popup, tooltip, keyboard marker action, pan, zoom or GPS on Home. Empty,
malformed and failed feeds hide the map as before. No new map labels.

## Shared rendering and freshness

MapSurface owns the common Leaflet container, colour tiles and bottom-left
MapCredits. JourneyMap supplies routes, controls, fit/follow and markers;
PresenceMap supplies capped area markers with its existing pixel offsets and
noninteractive settings. Both use modelMarkerIcon and the same allowlisted
artwork resolver. Existing widths, Home height/layout, marker slots, anchors,
credit transparency and spacing stay unchanged. This avoids cloning a full
private journey map or sending private data into Home.

Find maps use the selected candidate's artwork; signed-in previews refresh their
published-car artwork; driver request-discovery and pending sent-offer maps load
only the signed-in driver's own saved icon. Request maps now use the shared role
markers for actual origins and complete routes, preserving a neutral endpoint
when a destination-only filter has no origin. Rider-only requests show a person,
not a fabricated driver car. Owner/accepted maps still use authorised vehicle
details; accepted/history maps retain the immutable acceptance snapshot.

Successful Profile saves invalidate open maps in the same tab and other same-origin
tabs with only a `saved` message. Identity changes and focus/visible return also
refresh; old in-flight responses cannot overwrite newer search/preview results.
Home cancels a pending feed before a save-triggered refresh to avoid stale data.
No vehicle data is persisted by this signal. Normal other-user refresh remains
15 seconds for discovery/preview, eight seconds for private journeys (two for
samples), and 60 seconds for visible Home, plus network latency. Unsupported
BroadcastChannel uses same-tab events, page-return refresh and ordinary polling.
Failed/blocked vehicle saves emit no update; the Profile edit guard remains.

## Verification and activation

Source baseline c7dd586 plus this change series. `npm test` passed 252 isolated
tests; lint and production build passed. HTTP and service tests verify selected
artwork in signed-in discovery/preview, Home's bounded public projection and
generic fallback, no plate/account/route-detail leak, allowlist rejection, vehicle
status locking and unchanged acceptance. All databases used synthetic data.

With built Next on loopback :3201 and application APIs mocked:

- `scripts/check-vehicle-map-consistency.py` passed at 390/1440px for custom and
  generic cars in Home, Find, preview and the driver's offer map, save-triggered
  cross-tab refresh, non-clickable Home markers and shared credits. Privacy copy
  uses regular body weight; neither screen overflows.
- `scripts/check-home-presence.py` passed at 320/390/844/1440px, including mixed
  custom/generic cars, cap/visibility, empty/failure recovery, actual timer,
  sign-in and noninteractive Home. Only read-only OSM tiles were allowed.
- `scripts/check-request-maps.py` passed at those widths for request selection,
  Activity, route caching and failure recovery. `scripts/check-vehicle-refresh.py`
  passed at 320/390/1440px and without BroadcastChannel at 390px for the
  accepted-trip modal, preserved drafts, stale-response guards and fallback.
- Whole mobile/desktop Home, Find, offer map, Privacy and Profile-modal screens
  were visually reviewed for spacing, hierarchy, controls, markers and credits.
  Some screenshots use blocked tiles and a neutral map surface; read-only OSM
  was used separately in the Home test. The last in-journey counterpart-location
  map also uses the shared role marker; its branch needs an authenticated-device
  walkthrough. Physical Safari and production-account actions remain unverified.

Backend projection and Profile guard changes require a separate API restart;
frontend push alone does not activate them. No schema migration or history rewrite.

API activation, 5 November at 04:14 AEDT: revision 1f7ba0d. No accepted or
active trips immediately before backup and restart. A private SQLite online
backup (0700 directory, 0600 file) passed integrity, foreign-key and 137-trip
count checks. Only cocowheels-api was restarted; afterward health was ok, Home
returned 200 with bounded artwork/area fields, anonymous vehicle access returned
401, and database integrity, foreign keys and 137-trip count remained intact.
No production account/vehicle/journey write or synthetic notification was made.

Frontend deployment, 5 November: b197ff1f444ba44741158dccbff473339b4f6645
reached READY as Vercel deployment dpl_HvKmgtmV6W4DVXMFrPWaCMS1vVix, aliased
to www.gumwheel.com and gumwheel.com. The mobile all-map browser regression also
passed against the deployed frontend with every application API intercepted by
synthetic fixtures. This checks the shipped client, not a production account or
trip. Physical-device Safari and authenticated live-account actions remain
unverified.
