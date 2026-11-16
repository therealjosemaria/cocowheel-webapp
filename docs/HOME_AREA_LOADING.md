# Home area loading and shared maps — 17 November 2026

Baseline `bcf812c`. This supersedes MAP_RENDERING.md's global 120-candidate
sampling limitation and its original Home density settings. Verification and
actual activation are recorded separately; a source push alone does not activate
the API. No trip, profile identity, pairing, approval, notification or GPS
permission is changed.

## Data flow and limits

Home first requests `GET /api/home-presence?overview=1`. The read-only response
contains no figures: `{cells:[],hasPresence,bounds?}`. Bounds cover **all**
qualifying posts, projected to the edges of the existing public 0.05° cells.
The initial map fits that extent once (maximum automatic zoom 11). The overview
is not based on the first page of posts. Accepted/active/expired/sample posts and
busy rider owners retain the existing exclusions.

Once the map is laid out, and 300ms after the last moveend/zoomend/resize, Home
requests the visible area:

`GET /api/home-presence?south=S&north=N&west=W&east=E&zoom=Z`

All five fields are required, single-valued finite decimals. Latitude is within
[-90,90], longitude [-180,180], south<north, west!=east, zoom integer 0–22.
An east value below west denotes a date-line crossing. Bad/partial/duplicate or
unknown query fields return 400 INVALID_PRESENCE_VIEWPORT. An empty query retains
the old bounded feed for pre-deployment clients; new clients use only overview
and area requests.

Both client and server snap query bounds outwards to **whole public cells**.
Queries differing only within those cell bounds select identical posts. The SQL
range filter uses the requested area before candidate caps; an approximate-cell
filter then runs before grouping/selection. Window ranking retains up to three
stable-id-selected rows per role/cell, without using private within-cell distance
for artwork ordering. Up to 300 ranked rows per role are examined in nearest-cell
order, then the existing 100-area-per-role / 120-figure response / three-per-area
combined caps apply. Figures from other regions cannot consume this area's
response budget. Dense areas are still represented by a capped selection, not
every post or a precise census. Public avatars can remain recognisable.

The area response contains `{cells,hasPresence}`. The existence bit refers to
qualifying posts **anywhere**, so an empty area still has a usable map to pan.
Below zoom 8 the server checks existence and returns no figures, skipping the
artwork/area query. Nearby area requests keep their limits even if there are
thousands of posts elsewhere. An area can appear empty when its public cell
centre is outside the view; zoom never reveals a more precise location.

Responses are no-store and contain only public area/role/capped-count/allowlisted
artwork data. Overview bounds are coarse-cell edges. No exact origin, destination,
name, user/post ID, time, fare, source photo or live location is returned.
Application code does not persist the map viewport or request GPS for this flow.
The public avatar route still enforces the saved display choice on every read.

## Database and query cost

Startup adds three indexes after legacy ride columns have migrated:

- `rides_home_area`: planned non-sample/unpaired driver latitude/longitude.
- `rider_demands_home_area`: origin latitude/longitude JSON expressions for OPEN
  demands. Producer validation already requires valid JSON bodies.
- `rides_home_owner_status`: driver principal/status for the busy-owner exclusion.

These are indexes, not copied location tables or a new cache. Status changes and
cancellation update them through SQLite. The viewport source query explicitly
uses the appropriate spatial index; it checks expiry and pairing from current
records. Longitude filtering handles the two date-line intervals. Responses stay
bounded, though query work still depends on the number of matching posts (a very
dense cell requires grouping its entries). Index creation and extent aggregation
also depend on stored population. Limits do not guarantee uptime, network speed,
unlimited traffic or a fixed processing time.

## Client lifecycle, races and recovery

Initial/area requests use no credentials, no-store and a ten-second deadline.
Only one request is current per mounted Home view. A new canonical viewport aborts
the old request, restarts the minute refresh for that area and ignores obsolete
responses. Repeated events within the same snapped bounds/zoom do not refetch.
Movement cancels the pending 300ms timer; only settled views are requested.
Provider/photo work, balance checks and geocoding are never triggered.

A failed established-area request clears its figures but keeps the map/controls
and current viewport, allowing the next pan/zoom or visible-minute refresh to
recover. This supersedes removing the entire map after a Home refresh failure.
Initial failure before any qualifying presence is known keeps Home's map hidden.
A successful `hasPresence:false` removes the map and returns to overview polling;
there is no empty label. A successful empty-area response keeps the map. Hiding
the tab aborts its request and clears figures; returning requests that area again.
Cleanup removes timers/listeners and aborts outstanding work. Same-tab/cross-tab
saved vehicle/avatar changes retain their existing immediate refresh signal.

## One renderer, explicit screen responsibilities

Home's `PresenceMap` is now a small compatibility wrapper around **JourneyMap**.
JourneyMap owns MapSurface, tiles, attribution, controls and interaction options
for every screen. HomePresenceLayer supplies only Home framing, settled-viewport
callbacks and public-presence figures. JourneyMap's route layers retain route
geometry, selected pins, tracking, label placement and map picking where those
screens already support it. Image rendering, fallback/cache handling and the
zoom/detail/slow-frame policy remain shared.

Home has anonymous area markers, no marker actions/popups/labels, and no map
keyboard shortcuts outside the existing zoom buttons. Signed-in search maps show
the selected journey and user's route criteria; panning does not silently rerun
search, replace a selected ride, broaden filters or fetch Home's public feed.
Journey-detail and accepted-pair maps keep essential markers at every zoom and
retain their own access/GPS/tracking gates. These modes share implementation,
not data permissions. User-facing flow/component responsibilities stay separate.

## Visual clarity before rendering capacity

The Home ceiling is **50 combined figures**, including vehicles, bicycles and
personal/default riders. It is not 50 of each and is not the normal target.
First apply one figure per 90×90px of map area (minimum budget 3), then a hard
50 ceiling, edge padding and 64px separation between different areas. The existing
three-slot same-area group may retain its 40px minimum separation. This preserves
separate figures without introducing a cluster/count badge.

For current 200px-tall Home frames, the area budget is roughly 7–8 figures at
320/390px phone widths and 16 at the 680px desktop map width. Bounds/spacing can
show fewer. Essential selected/private journey markers do not disappear to meet
this decorative Home budget. Three consecutive >50ms interaction frames still
reduce the ceiling to 25/light images for that map mount, without bypassing the
stricter visual rules. Existing light/detail sizes and zoom 8/12 thresholds remain.
No palette, font, label, new control, map height or hero/activity layout change.

## Profile preview and edit-only control

Every verified account uses the same owner-scoped full-resolution preview route,
including ordinary non-admin accounts. Displaying Default keeps that default
figure; Edit can preview the assigned personal image before Save. The Personal
avatar checkbox appears **only while editing**; saved/default views show the
chosen figure without a read-only checkbox. Save/Cancel, public-Home disclosure,
upload/history controls and automatic result refresh remain.

An audit found two assigned avatars: one already had a full private preview, one
older operator assignment still had only a sprite. Its approved saved cutout
byte-matches the existing map sprite. The operator backfill command is:

`node --import tsx scripts/restore-assigned-avatar-preview.mts APPROVED_RENDER --apply`

It requires exactly one legacy assignment matching that prepared sprite, takes
a private SQLite backup, checks zero accepted/active trips and zero in-flight
checks/generations, and transactionally rechecks the current assignment. Only
opaque version, private preview and detailed-map bytes change. Sprite, enabled
choice, assignment time, job history and notifications are preserved. It performs
no network/provider request or paid generation. Unknown/ambiguous/already-upgraded
matches abort. Source/render files and account selectors are not committed.

## Verification and reproduction

Use separate temporary databases and synthetic sessions; never stress live trips:

```sh
COCOWHEELS_DB_PATH=/tmp/gumwheel-home-area-unused.sqlite npm test
npm run lint
npm run test:security
node --import tsx scripts/benchmark-home-viewport.mts
node --import tsx scripts/benchmark-map-marker-budget.mts
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build
```

After build completion start the isolated `serve-map-avatar-fixture.mts` and built
Next on loopback as documented in MAP_RENDERING.md. Use the shipped mannequin as
GUMWHEEL_AVATAR_RENDER. Run `check-map-avatars.py`, `check-map-avatar-quality.py`,
`check-avatar-admin.py`, `check-avatar-history.py` and `check-home-presence.py`.
Run `check-home-viewport.py` **last**: its fixture-only control adds 10,004 synthetic
posts to the in-memory API database. No production endpoint exposes that control.
It browses beyond the old cap into Sydney/Melbourne, tests both roles, delayed
responses, empty/failing areas and pan/zoom. The mixed-figure check uses shipped
car artwork plus synthetic personal avatars. Review whole phone/desktop Home,
Profile saved/edit, selected search and journey screens; tests do not replace
that review. Physical phone GPUs, sustained production concurrency and live
owner use remain unverified unless separately recorded below.
