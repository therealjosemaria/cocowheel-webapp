# Avatar resolution and map rendering — 16 November 2026

Implemented from baseline `6f140b3`; deployment is recorded separately. This
supersedes the small-only preview in MAP_AVATARS.md and AVATAR-PREVIEW-001's
proposed fix. Photo checks, manual generation approval, model, spend limits,
display opt-in, identity/GPS rules and notification lifecycle are unchanged.

## Evidence and design

Research used Exa across four angles (20 search results, then six primary/reference
pages read in depth); irrelevant/secondary results were not used as engineering
claims. These sources document patterns, not private production configurations:

- [Mapbox markers](https://docs.mapbox.com/mapbox-gl-js/guides/add-your-data/markers/)
  describes HTML markers as less efficient at 100+ and recommends style layers,
  bounds-based progressive loading and clustering for larger datasets.
- [Mapbox sprites](https://docs.mapbox.com/style-spec/reference/sprite) supplies
  high-DPI variants. A small on-screen image need not use a full-size original.
- [Google collision management](https://developers.google.com/maps/documentation/javascript/examples/marker-collision-management)
  lets optional markers hide on overlap while required markers remain.
  [Google optimization](https://developers.google.com/maps/optimization-guide)
  recommends changing overlay content after movement finishes.
- [Uber's historical deck.gl engineering article](https://www.uber.com/us/en/blog/visualizing-data-sets-deck-gl-framework/)
  describes GPU instancing/aggregation for large datasets. Its point-count demos
  do not establish the capacity of unique avatar images or Uber's consumer app.
- [Snap Map](https://help.snapchat.com/hc/en-us/articles/7012276359700-How-do-I-find-my-friends-on-Snap-Map)
  confirms avatar/friend-map interactions but does not publish marker budgets,
  sprite resolution or zoom thresholds; none are attributed to Snap here.
- [Leaflet zoom](https://leafletjs.com/examples/zoom-levels/) doubles world pixel
  dimensions at each step; five zoom-out clicks are not a universal country view.
  [MDN pixel ratio](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio)
  distinguishes CSS size from physical display pixels.

GUMWHEEL keeps separate figures rather than introducing cluster/count badges.
The policy values below are our own configurable starting values, not competitor
limits or a guarantee for every device.

## Private preview and public renditions

`prepareAvatarRenditions` accepts the same still alpha PNG/WebP, 10MB compressed /
16M decoded pixels. It strips metadata and creates:

| Asset | Dimensions/encoding | Access |
| --- | --- | --- |
| Preview | Original processed-image dimensions after orientation, lossless WebP, <=10MB | Verified owner Profile / owner-admin job render only; private/no-store |
| Light map | 128×256 contained transparent WebP, quality 90 / alpha 100 | Enabled opaque version only, no-store |
| Detail map | 256×512 contained transparent WebP, quality 92 / alpha 100 | Enabled opaque version only, no-store |

The Pi background processor's existing 1024×1536 working bound remains. Full
resolution means the processed cutout resolution, not inventing missing detail or
upscaling a small provider image. For the restored result that is 832×1248; its
background-removal step retained these provider dimensions.

At the current 46px-tall marker, a 3× display needs about 138 vertical pixels.
Even the light image has 256; the close-view image has 512. Zooming the map changes
the geography, not the marker's CSS size. Full private previews never go to maps.

Startup adds nullable `preview` and `detail` BLOBs to `account_map_avatars`;
legacy assignments fall back to `sprite` until explicitly recovered/reassigned.
New generation atomically assigns all renditions and stores the private preview
in `avatar_jobs.render`. The latter retains its existing 30-day terminal-result
TTL; the assigned account preview/detail share the existing no-automatic-TTL
assignment contract. Original source-photo retention remains seven days. Large
previews may be stored twice until job retention expires; this is bounded per
image, not an unlimited storage capacity promise.

Public metadata still supplies only `/api/map-avatar/OPAQUE.webp`. The shared
renderer derives the strictly local `.detail.webp` variant. The API rejects
unrecognised paths, serves either variant only while enabled, and returns the
legacy sprite if a detail variant is missing. Disable/replacement blocks both
variants; preview access remains owner-only. No public full-size route or new
cache lifetime is introduced. Previously received copies cannot be recalled.

## Rendering policy

`lib/map-marker-budget.ts` centralises the controls:

| View / condition | Behaviour |
| --- | --- |
| Home zoom <8 | No figures mounted/downloaded for that view; map/controls remain while qualifying posts exist |
| Home zoom 8–<12 | Light assets |
| Home zoom >=12 | Detail assets |
| Any Home view | At most 50 mounted figures, further limited by one per 64×64px of map area (minimum budget 3); cull offscreen/edge-clipped figures and suppress figures closer than 40 screen pixels |
| Three consecutive >50ms frames during a map interaction | After movement ends, lower this map mount to 25 figures/light assets; remount resets |
| Journey/accepted-pair maps | Same light/detail choice, but essential driver/pickup/destination markers remain at all zooms |

Overview ground points stay at least 24px from the left/right/bottom and 40px
from the top, preserving the contained figure instead of cutting it at map edges.
Home selection favours figures nearest the view centre with a stable-key tie
break. Screen-space spacing is additional to the existing three-icons-per-0.05°
area rule. Recalculate after moveend/zoomend/resize/data change, not every movement
frame. The slowdown monitor runs only during interaction and cleans up its RAF
and map listeners. This is a conservative stall signal, not a GPU or memory probe;
other CPU work can trigger it. It never changes server data or geography.

A 256-entry FIFO construction cache reuses unchanged Leaflet DivIcon objects,
preventing same-art refreshes from rebuilding image elements. It stores HTML/icon
configuration, no image bytes, credentials, identity record or authorization
result; public asset reads still enforce opt-in. Failed images keep the existing
default-figure fallback and evict that icon configuration so an ordinary later
render can recover. No new labels, controls, colours, or map dimensions.

At 50 *unique* visible figures, uncompressed RGBA pixels for the avatar assets
alone are approximately 6.25MiB light / 25MiB detail, before browser/GPU overhead,
tiles, cars and other page resources. Network sizes depend on content. These
bounds explain why full-size previews must not be used for each map figure.

## Population and capacity boundaries

Home's existing API remains capped at 120 candidate icons from up to 100 areas
per role in coordinate order. The new renderer mounts at most 50 from the visible
portion of that bounded response. The response is intentionally sampled, not a
complete browse/search or census: panning does not fetch additional server areas
outside those candidates. Signed-in discovery keeps its existing filters/limits.
Thousands of stored users therefore do not imply thousands of images in one DOM.

If the product later needs complete worldwide coverage, add a server spatial
index and area/viewport-based retrieval or vector tiles, preserving the same
coarse privacy cells. If measurements justify rendering hundreds of simultaneous
unique figures, evaluate a canvas/WebGL layer with bounded texture memory. Neither
migration is claimed by this release. No live load/stress testing is performed.

## Recovering an existing preview without generation

After migration and a private verified backup, the explicit operator command is:

```sh
node --import tsx scripts/restore-avatar-preview.mts --latest-ready --apply
```

It chooses the latest READY job still assigned with the identical legacy sprite
and no private preview. It GETs that saved task/result, applies local cutout and
prepares renditions; **no upload or paid task POST**. Byte equality of the
reproduced light sprite is required before replacement. It creates a private
SQLite backup and rechecks zero accepted/active trips and zero checking/submitting/
generating avatars. Inside one transaction it checks the job/current assignment
again, upgrades only preview/detail and job render, and changes the opaque asset
version to refresh viewers. It preserves the light sprite, preference, assignment
and job timestamps, status, source photo, approval, spend and notifications.
The Admin render URL includes its byte-length revision so an already open Admin
row reloads a recovered preview on its ordinary poll. A mismatch/expired provider asset aborts; it never regenerates automatically.
Other accounts remain unchanged. Private files, IDs and URLs stay out of Git.

## Reproduction and measured evidence

Use temporary databases and synthetic accounts only:

```sh
COCOWHEELS_DB_PATH=/tmp/gumwheel-quality-unused.sqlite npm test
npm run lint
node --import tsx scripts/benchmark-map-marker-budget.mts
COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:3492 npm run build
```

Then run `scripts/serve-map-avatar-fixture.mts` with `GUMWHEEL_AVATAR_FIXTURE=1`,
`GUMWHEEL_AVATAR_RENDER=public/brand/avatar-photo-guide-front-v1.webp` and a
separate temporary `COCOWHEELS_DB_PATH`; start the built Next frontend on
127.0.0.1:3491. Run `scripts/check-map-avatars.py`,
`scripts/check-map-avatar-quality.py`, `scripts/check-avatar-admin.py`, and
`scripts/check-home-presence.py` with `GUMWHEEL_TEST_BASE_URL=http://127.0.0.1:3491`.
Set `GUMWHEEL_TEST_TILES=1` to permit only read-only public OSM tiles; API data and
photos remain synthetic. Clean up the fixture/frontend PIDs afterwards.

The selector benchmark runs 120 repetitions for 1,000/10,000 synthetic positions
at 390/1440×200 viewports. This measures JavaScript selection, not downloading or
decoding 10,000 images. Browser evidence uses the real bounded 120-candidate feed,
DPR 3 phone / DPR 2 desktop, shared controls, pan/zoom, profile/Admin and both
journey roles. Physical phone GPUs, sustained production concurrency and complete
worldwide discovery remain unverified. See the dated sanitized result and
TESTING_PROGRESS.md for final outcomes and retained failures.

### Local verification outcome

315 regressions, 52 isolated security checks, lint and optimized build pass. Whole
mobile/desktop screens were visually reviewed. Existing four-width Home tests
retain three posts per area, pan/pinch/zoom, refresh, empty/failure hiding and
sign-in. Three-width Profile/both journey roles/Admin flows and the new 120-image
candidate/DPR2–3 overview checks pass, including temporary-image recovery.
The 10,000-position selector P95 is below 1ms on this Pi; browser frame samples
are recorded separately and are not physical-device/capacity certification.
AVATAR-PREVIEW-001 is remedied by separate preview storage and the relevant
regressions; live existing-result recovery is recorded below after execution.
Initial failed spacing, stale test selector, sandbox listener denial and the
overlapping-build fixture failure are retained in the
[sanitized result](results/avatar-map-rendering-2026-11-16.json).

### API activation and existing-result recovery

Implementation `4e05a96e7cb365f2ecc25b11a436a8f84390921b` was committed and
pushed after full source/staged diff review. At 2026-11-16T12:12:56Z, a private
SQLite/configuration backup passed integrity/FK checks; fresh checks found zero
accepted/active trips and zero checking/submitting/generating avatars. Only
`cocowheels-api` restarted; health recovered, the nullable columns exist, integrity
is ok and terminal journey records are preserved.

The existing completed Seedream result was recovered using GET/local processing,
without a paid generation task. Its private preview is 832×1248 lossless WebP
(214052 bytes), light map image 7566 bytes (unchanged), detail map image 19754 bytes.
A second private SQLite backup precedes the recovery transaction. Comparison with
that backup confirms exactly one assigned account's version/preview/detail and
one job's render changed; all other account/job fields and rows remain identical.
Preferences, source photo, approval, status, timestamps and spend remain. This
account had display disabled; both public variants correctly return 404. Anonymous
private preview returns 401, Admin jobs 403. No live login is impersonated.
Frontend deployment `dpl_HeHPDHTaya71dvVebUyKnvGddqpg` is READY for the exact
implementation revision on www.gumwheel.com and gumwheel.com. Public API health
returns 200. The read-only deployed-frontend Home suite passes 320/390/844/1440px
with synthetic APIs and writes blocked; whole phone/desktop Home screenshots
were reviewed. Real owner login, physical phones and production concurrency are
still unverified. This documentation follow-up changes no runtime source.
