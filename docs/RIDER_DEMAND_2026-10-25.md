# Rider-posted requests and driver discovery

Implemented against base revision `8634351`, 25 October 2026. This is one-rider
demand, not multi-seat pooling, a recurring booking or calendar synchronization.

## Entry and visibility

26 October road-preview refinement supersedes straight-line map previews below.
RequestRouteMap is shared by discovery and Activity and calls the existing
POST /api/route-preview for complete endpoint pairs. Existing Geoapify road
geometry, session road-path cache and server provider cache are reused without
changing their retention. Only searched driver endpoints and a selected rider
are routed in discovery; Activity routes only the post explicitly opened with
Show route. Hide/switch preserves cards and offer actions; only one Activity
post map is visible. Closed posts can still be viewed, not offered/withdrawn.
Coordinate-keyed results prevent a prior selection's route from rendering for
the next one; effect cleanup aborts requests and ignores stale completions.
Polling new object identities with unchanged coordinates does not refetch paths.
No extra polling, live GPS, provider configuration or backend change. Matching
remains the existing corridor heuristic; road display does not change eligibility.
Remove the permanent Approximate routes text. Until geometry loads, show pins;
on failure/empty geometry, retain pins without a straight line and show Road route
unavailable with Try again. Successful paths retain required Geoapify attribution.
Activity says Your route; discovery distinguishes Your route and Rider route.
Request previews disable fit/zoom/fade animation to avoid a reproduced Leaflet
teardown error on rapid Hide/switch. JourneyMap's default animation and live-trip
following are unchanged for all existing callers.

Verification (26 October, source based on 4b6e366): 183 regression tests, lint
and production build passed. Against an isolated frontend on port 3201,
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-request-maps.py` and
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-calendar-search.py`
passed at 320/390/844/1440px with mocked APIs and external traffic blocked.
Checks cover lazy routing, cache reuse across discovery/Activity, failure/retry,
single selected route, open/history controls, no writes, browser errors or
horizontal overflow, and address-sheet accessible names without visible headings.
The first rapid-toggle run reproduced Leaflet's `_leaflet_pos` teardown error;
disabling animations for these previews resolved it in all four reruns.
Whole-screen screenshots reviewed at 390/1440px for address sheets, discovery
and Activity: typography, spacing, actions, legends and map controls. Map tiles
were intentionally blocked, so live provider rendering, physical devices and
production deployment remain unverified. No API restart is needed.

26 October Profile refinement: the former Your post and active-ride links are
consolidated into one Your journeys link to /activity. It appears for an active
post, active ride or pending offer, including a public post plus pending join.
The link retains the existing secondary style and shows the combined update
count; the Profile trigger badge is unchanged. No accordion or extra requests.
Navigation does not accept/withdraw a request or mark messages read. This
supersedes earlier Profile grouping/link descriptions below. No API restart.

26 October discovery wording (baseline 62e4b5c): See journey requests replaces
Find riders on the driver shortcut; both search and results headings now say
Journey requests. This supersedes the historical Find riders copy below.
Only two UI text nodes change; layout, filters, visibility, self-offer rules,
handlers and API contracts are unchanged. No backend restart is required.
Lint, production build and visual-system regression passed. The updated
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-home-order.py` passed
at 320/390/844/1440px against localhost:3201 with mocked APIs and external traffic
blocked: button/heading copy, 12px action separation, search/results navigation,
Back/Edit search and unchanged menus, without page errors or overflow. Full-screen
posting views reviewed at 390/1440px, mobile search and desktop results reviewed
for typography, spacing and emphasis. React checklist found only two text-node
changes: no hooks, state, fetch, authorization or interaction changes. The broader
rider-demand script received selector updates only and was not rerun. Physical
devices and production deployment remain unverified. Source/staged diff reviewed.

26 October Activity wording (baseline 703e6c2): rider post cards now say Journey
requested and sent driver offers say Journey offered. These supersede the older
Activity Your post / Your offer references below. Profile/success links, statuses,
icons, actions, API identifiers and lifecycle are unchanged. No API restart needed.
Lint, production build and visual-system regression passed. The extended
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-activity-spacing.py`
passed at 320/390/844/1440px on local :3201 with mocked APIs and external traffic
blocked: both labels, unchanged 10px card gaps, shared icons, expanded history,
withdrawal modal and no overflow/page errors. Full-page screenshots reviewed at
390/1440px for label fit, hierarchy and spacing. Source/staged diffs reviewed;
physical devices and production deployment remain unverified.

26 October rider wording: Request this journey replaces Post a ride request
on the results action and its review modal. The confirmation is Request / Go back.
Save route is unchanged, as are Request to join, replacement confirmation,
success/Profile/Activity post labels, publication payloads, expiry and email
consent. Historical Post a ride request wording below is superseded for these
two surfaces only. No backend change or API restart.
Verification on baseline `0c3e163`: lint, production build and visual-system
regression passed. Run `GUMWHEEL_REQUEST_COPY_ONLY=1 /tmp/gumwheel-pickup-check-env/bin/python scripts/check-rider-demands.py`
for the focused request flow: passed 320/390/844/1440px with mocked APIs and
external traffic blocked on local production build :3201. Checked unchanged
Save route, review/cancel/focus restoration, equal modal controls, explicit
replacement payload and success link; no console errors or overflow. Whole-screen
results and review-modal screenshots visually checked at 390/1440px for hierarchy,
spacing and wrapping. This focused mode does not retest driver-map transitions
or close the earlier Leaflet finding below. Physical devices and deployed frontend
remain unverified; full source/staged diffs reviewed before commit/push.

26 October follow-up (`62e4c3a` baseline): the driver discovery shortcut and
search/results heading now say Find riders. This is two text-node changes only;
Post a journey, Search, Back, layout, filters and offers are unchanged.
Lint, production build and visual-system regression passed. The extended
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-home-order.py` passed
at 320/390/844/1440px against local production build :3201, with mocked APIs and
external traffic blocked: shortcut spacing, headings, empty results, Edit search,
Back, menus and no overflow/page errors. Whole-page posting/search/results images
reviewed at 390/1440px for typography, emphasis and spacing. React review confirmed
no state, effects or request changes. Physical devices/deployment unverified.
The broad `scripts/check-rider-demands.py` run reached its first-width final
console assertion but failed with `Cannot read properties of undefined (reading
'_leaflet_pos')`; its map coverage is not claimed as passing or resolved here.
Initial browser attempt could not connect because the local preview was stopped;
the built frontend was started before the above checks. No production writes or
API restart. Source and staged diffs reviewed before commit/push.

- Find a ride retains its existing form and search. Save route sits left of
  Post a ride request below Request to join, outside listings; no Choose a ride heading.
  The exact searched endpoints/date/time are shown, with explicit disclosure
  that drivers can see the addresses and the expiry. Success links to Activity.
- Post a journey includes See journey requests below its primary action. Its destination
  heading says Journey requests, in search and results. It copies already-entered
  endpoints, allows route edits, and defaults to independent Any date/Any time.
  Endpoints are optional for browsing, which still requires email verification.
  No endpoints searches all eligible requests; pickup only uses a 1.5km radius,
  destination only uses a 2.5km radius. Both endpoints use the corridor below.
  Clearing an address in its existing search sheet removes that discovery filter.
  Date and time remain independently optional. No automatic GPS lookup occurs.
- Search shows up to 50 matching, open requests, newest first. Includes self; excludes
  owners already occupied by an open driver ride or confirmed rider pairing (not
  a pending join). Uses the
  same straight-line corridor as matching alerts: ordered pickup/drop-off, 20%
  behind-origin allowance, 1.5km pickup and 2.5km destination lateral tolerances.
  This is not a driving-detour guarantee. Map lines are approximate, disclosed as
  such. Shared route colours distinguish driver/rider; one rider preview at a time.
- Public discovery includes username, requested endpoints/schedule and expiry;
  never email, PayID, vehicle data, session/principal IDs or live GPS. Saved usual
  routes are never implicitly published. Profile settings/alert consent untouched.

## Lifecycle

Own-request discovery (26 October, baseline dbb4107) supersedes self-exclusion:
authenticated search returns isOwn, computed from the session and stored owner,
without exposing owner/session IDs. Own rows receive identical route/date/time,
busy-owner, expiry and result-limit checks; they are not pinned or guaranteed a
slot beyond the 50-result limit. Closed requests remain excluded. No schema or
stored-record change. Frontend uses the existing Message modal before offer
review for isOwn=true. Missing/false metadata cannot authorize a self-offer:
offerDemand still rejects stored ownership with OWN_RIDE_JOIN_NOT_ALLOWED (409)
before publication/vehicle writes. The offer form translates that fallback into
the same specific sentence. No self-join policy change for driver journeys.
API restart is required separately from frontend push. Activated from `5e001ec`
on 26 October 2026 at 19:14:55 AEDT with the owner's authorization. The old API
process had been running since 11:34:29, before the own-request visibility fix.
Verified the running process's database file and port using open-file/socket
metadata (without reading credentials). Zero accepted/active trips were checked
before a private SQLite online backup and again immediately before restarting
only `cocowheels-api`. Backup and live integrity checks passed with zero foreign-key
errors. Counts remained 131 rides, 77 ride requests, 5 rider posts and 0 offers;
one post was open and unexpired after restart. Local `/health` and public
`https://www.gumwheel.com/api/health` returned status ok; unauthenticated discovery
still returned 401. No live test rides, offers or emails were created.
The isolated `node --import tsx --test tests/rider-demands.test.ts` rerun passed
all 13 tests with local socket access (the sandboxed attempt exited unsuccessfully).
This activation changes no UI or application source; previous mobile/desktop
checks below apply. Signed-in production discovery has not been browser-verified.

Checks: npm test passed 183 tests; lint and production build passed. Targeted
`node --import tsx --test tests/rider-demands.test.ts` passed 13 tests after adding
explicit own withdrawn/expired exclusions. Coverage includes empty-filter own
visibility, per-viewer flags, unchanged filters/authentication, and an HTTP 409
when submitting a forged isOwn=false self-offer, with zero rides created.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-own-request.py` checks
320/390/844/1440px against local :3201 with mocked APIs and blocked external traffic:
own and other cards, unchanged empty-filter payload, Message/OKAY, Escape/focus,
no known-self POST, server-error fallback and no overflow/page errors. Whole-screen
mobile/desktop review covers cards and warning, typography and spacing. Placeholder
photo fixtures were corrected after initial captures. No production writes or
test emails. Physical devices and deployed frontend remain unverified.

Optional discovery filters (26 October): no empty map is rendered before a
request is selected when both endpoints are absent. A single endpoint shows a
pin, not an invented route. Show route retains one rider preview at a time.
Responding fills missing endpoints from the selected request into the existing
offer review; publication still validates both endpoints, concrete departure,
matching, fare/PayID, plate and role-switch consent server-side. No automatic
publication, new schema, GPS access or alert setting change is introduced.

`OPEN → CANCELLED | EXPIRED | FULFILLED`; no deletion. One OPEN demand per owner,
enforced with a partial unique index. Posting identical data retries idempotently
without extending TTL. A different open request requires Replace / Cancel
confirmation, using the existing modal. POST may include replaceDemandId naming
the owner's exact current OPEN post. Withdrawal (CANCELLED) and insertion are
one transaction: any failure restores the old post. Old pending offers become
unavailable through the closed post; their public driver rides remain unchanged.
Stale/missing/foreign replacement targets return DEMAND_CHANGED (409); a new
review is required. Identical retries return the current post without renewal.
The frontend handles DEMAND_ALREADY_OPEN by fetching the current owner-only post
and asking Replace your ride request? with the new route summary; Cancel makes
no mutation and leaves the rider on Find. Other errors use the shared notice.
Posting is disallowed while the account has an open driver ride or confirmed
rider pairing. One pending join can coexist with a post, in either creation order.
Ordinary driver acceptance atomically marks an unexpired OPEN post FULFILLED;
elapsed posts become EXPIRED instead. Accepting a posted offer cancels a pending
join using the existing cancellation path, then creates/accepts the new pairing
in the same transaction. Any failure restores the pending join and post. Whichever
acceptance completes first prevents the competing acceptance; ordinary pending
join limits remain one. Other invitations become unavailable through the post's
closed status; their drivers' public offers remain available. No history deletion
or automatic reopening after cancellation, and no retroactive data rewrite.

Profile's existing current poll returns owner-only activeDemand or null. Your post
and active ride links share one Your rides region and existing card styling.
Pending offers are described within the post card; only real offers contribute
to the badge. Posting dispatches the existing identity refresh.
Until the API restart supplies activeDemand, the existing offer
review link remains available when there are pending offers. Success says
View your post; Activity says Your post, Fulfilled and Withdraw post.
The redundant Posts and offers heading is removed (26 October); card labels,
actions and 10px inter-card spacing remain unchanged.
Removal checks: `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-activity-spacing.py`
passed at 320/390/844/1440px on localhost:3201 with mocked APIs and external
traffic blocked. Whole-page 390/1440px screenshots reviewed for hierarchy,
spacing, icons and unchanged rider-post/driver-offer/history actions. Lint,
production build and the visual-system regression test passed. Full source and
staged diffs reviewed. Physical devices and production deployment unverified;
no backend change or restart required.
Request to join with no selected candidate opens the existing Message modal:
Select a ride from the list to continue. No network request or navigation occurs.
It is disabled only during submission, preserving duplicate-submit protection.

Follow-up on base `4b69006`: publishing a driver ride while an unexpired OPEN
lift request exists returns `LIFT_REQUEST_WITHDRAWAL_REQUIRED` (409), without
publishing or withdrawing. The UI fetches the owner's current request and asks
“Withdraw your lift request and offer a ride?” Go back/Escape preserves both
draft and request. Confirmation sends `withdrawLiftRequestId` through ordinary
publication or a driver response. The core transaction checks exact ownership
and ID, changes that request to CANCELLED, and publishes together. Any failure
rolls back both; a replaced request needs fresh consent. Expired/closed requests
do not need withdrawal. No new schema, TTL or active-ride rule. Legacy saved-route
publication also encounters the core consent gate, but has no new UI shortcut.
Self-discovery, self-offering and self-joining remain blocked server-side.

Visible copy now uses Your post / Withdrawn; internal identifiers and CANCELLED
remain unchanged. Review uses a regular sentence, Post / Go back, with
no redundant title. Activity remains above completed ride history. No new tab.

- Any date: exactly 48 hours from posting, even if an Around time is specified.
- Specific date / Any time: next Sydney midnight.
- Specific date / Around time: end of ±1 hour, clipped to the Sydney day.
- Past windows rejected; dates limited to the existing three-calendar-month horizon.
- Search windows overlap and exact driver departure must fall inside the request
  window and before its expiry. Bounds use inclusive start/exclusive end. DST
  missing clock times are rejected; repeated times follow existing Sydney helpers.
- Expiry is applied on demand operations; discovery and notification queries also
  respect timestamps. No extra background expiry or email worker is added.

A driver chooses a concrete departure and free fare or contribution/PayID, then
Offer a ride. This creates a normal public driver offer too; the existing Profile
and Activity active-ride controls represent it. Redundant explanatory copy was
removed at the owner's request; the action uses the existing publication wording.
Plate is required at this point, because the rider can subsequently accept without
another driver action. Other vehicle fields remain optional. New plate saves and
publication are inside the same transaction. Ordinary publication still queues
existing opt-in matching emails; no separate demand-offer email is sent.

Offers persist PENDING/ACCEPTED/DECLINED. PENDING becomes derived UNAVAILABLE when
the underlying ride is no longer available, departure has passed, or demand is
not OPEN. Cancelling a request or declining an invitation leaves the driver's
ordinary public offer intact. The driver cancels that ride through its existing
controls. An offer is not a reservation; another rider can secure the ride first.

Acceptance validates the current verified owner and persisted driver consent,
creates the ordinary pending rider request, accepts it, snapshots the vehicle,
creates the existing pickup code, marks the offer accepted and demand fulfilled
in one SQLite transaction. No browser-supplied driver principal or synthetic
session token is trusted. Retry of the same accepted offer returns the existing
ride. Other offers become unavailable. Existing role exclusivity and privacy
remain. Chat becomes available in the accepted ride through the existing request
conversation; no separate pre-acceptance demand chat was introduced.

Activity lists the latest 50 owned demands and latest 50 sent offers, preserving
older records in storage. It refreshes every 15 seconds while mounted. Pending
received offers contribute to the existing Profile badge/current polling and link
to Activity. No push notification or new email delivery promise. Users with no
ordinary ride history but posted activity do not see the unrelated empty-history
message. Native disclosures and normal ride links retain cancellation/history access.

## API and storage

### Optional-filter verification — 26 October 2026

Against base `284e37d`: `npm test` passed 178 tests; `npm run lint` and
`npm run build` passed. The first build caught excess-property compatibility in
the reused distance helper; its input now accepts optional accuracy while keeping
the same distance calculation, and the build passed on retest.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-rider-demands.py`
uses mocked APIs and blocks external traffic: blank, pickup-only, destination-only,
clear-filter and both-endpoint searches, complete offer review, nested date picker,
plate/role-switch gates, posting and cancellation are covered at 320/390/844/1440px.
Whole-screen mobile/desktop visual review covers discovery, results and offer
review, including spacing, typography and map visibility. Map tiles are blocked
in this isolated run; native Safari and production authenticated journeys are
not verified by these checks.

With user approval, zero accepted/active trips were confirmed, a private SQLite
backup taken, and only `cocowheels-api` restarted. Rides (131), requests (77),
demands (1) and offers (0) were preserved; integrity passed and no foreign-key
violations were found. The immediate startup health probe preceded the listener;
the subsequent localhost and public frontend-proxy health checks passed, and
unauthenticated discovery returned 401. No live records were created for testing.
This restart also activates the previously committed role-switch consent gate.
Frontend deployment after push is separate and not claimed verified here.

All new endpoints require a current verified account; mutations recheck identity
after reading the bounded JSON body. Existing Origin and body-size protections apply.

- `GET /api/rider-demands`: owner requests/received offers and sent offers.
- `POST /api/rider-demands`: validated origin/destination/date/time.
- `POST /api/rider-demands/search`: optional origin/destination, required date/time
  values (`any` / empty string mean unrestricted); supplied malformed endpoints
  reject rather than silently broadening the search. No mutation of user intent.
- `POST /api/rider-demands/:id/cancel`: owner only.
- `POST /api/rider-demands/:id/offer`: driver route/departure/fare/PayID/optional plate.
- `POST /api/rider-demands/offers/:id/respond`: owner ACCEPT/DECLINE.
- `/api/current` adds owner-only `pendingDemandOffers`; no additional nav poll.

Additive `rider_demands` and `rider_demand_offers` tables reference existing principals
and rides. Startup schema initialization is idempotent; no existing record rewrite.
Internal `decideRequestForDriver` extracts the existing state transition, retaining
driver authorization; only the service resolves persisted invitation consent.

## Verification — 25 October 2026

Source: implementation on baseline `8634351`; isolated functional verification,
not a capacity certification.

Reproduce isolated checks:

```sh
node --import tsx --test tests/rider-demands.test.ts
npm test
npm run lint
npm run build
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-rider-demands.py
/tmp/gumwheel-pickup-check-env/bin/python scripts/check-calendar-search.py
```

Browser scripts use local :3201 and block/mock every API/provider request. API
tests use synthetic in-memory SQLite and loopback HTTP, never production trips.
Initial backend test failures were fixture assertions: an unrelated account is
denied the entire accepted ride (not just vehicle), same-timestamp offers have no
guaranteed order, and requestRide requires a departure. Corrected; 7 targeted and
175 total regressions passed. Lint and production build passed. Standalone tsc exposes
existing errors in untouched test files; no new-file type errors remain.
First browser run had an ambiguous username locator; narrowed to the results.
A later desktop run clicked the navigation's Offer a ride rather than the card
because both share the label; scoped the test to the card. Both browser scripts
passed their complete reruns at 320, 390, 844 and 1440px.
Visual review found unequal paired button heights and an overwide cancel
button; switched to shared driver-request-buttons and scoped inset wrapper.

Whole-screen visual review covered rider results/post review, driver discovery,
free/contribution offer modals, plate entry, Activity/cancellation, and privacy/terms
on mobile and desktop. Map tiles are intentionally blocked in browser fixtures;
approximate route overlays and selection were checked. No live test writes.

With user authorization, only the GUMWHEEL API was restarted at 20:41:11 AEDT
after a private SQLite backup, successful backup integrity check, and two checks
confirming zero accepted/active trips. All 130 rides and 77 ride requests were
preserved; both new tables initialized empty. Database integrity and foreign keys
passed; service active, local/public health passed, and unauthenticated public
demand access returned 401. Frontend deployment is separate: a push does not
verify it. Physical Safari/device keyboards, real inbox delivery and authenticated
production walkthrough remain unverified.

## Copy and role-switch follow-up verification (25 October 2026)

Source baseline: `4b69006`, plus this commit's changes. `npm test` passed
177/177 against isolated fixtures, including exact-request consent, failed-insert
rollback, stale consent, and authenticated HTTP publication/response paths.
`npm run lint` and `npm run build` passed. Initial sandbox attempts failed on
IPC/port permissions before meaningful execution; reruns used permitted local
execution, not production writes.

Reproduce browser checks with the local frontend on port 3201:
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-rider-demands.py`
and `scripts/check-calendar-search.py` using the same interpreter. API calls are
mocked and external requests blocked. Both passed at 320/390/844/1440px.
`scripts/check-message-entry.py` also passed chooser and preview flows at
320/393/1440px with its localhost port changed from 3090 to 3201 in memory.
Save-route/usual-route legacy script selectors were updated, not rerun.
An additional run overlapped the requested Search-label change and timed out on
the old button locator; the final run uses the updated locator and checks the
12px separation of discovery from the primary Offer action.

The first switch browser run exposed lost plate/error state when replacing the
plate modal. Keeping the plate mounted and forwarding pending/error state fixed
this; the full rerun verified plate retention and failed-confirmation feedback.
Whole-screen screenshots reviewed mobile and desktop offer entry, discovery,
post review, switching and Activity, including long-label wrapping and emphasis.
No production writes or capacity claims. Physical devices remain unverified.
The earlier restart record above applies only to the base feature: this new
backend consent gate still needs a separately authorized API restart. A push
does not verify frontend deployment.

## Secondary-action refinement (25 October 2026)

Baseline `e2a76d0`: restored Request to join in chooser and public preview.
Ask for a ride now sits beside Save route in the bottom action area, outside
results and their live region. Both remain independent: posting reviews the
public request; saving preserves its private-route/email-consent flow.
Visible lift wording becomes ride in posting, Activity and switch/withdrawal
dialogs. Internal identifiers/API payloads, backend gates and history are unchanged.
No API restart is required for this copy/layout change; the earlier backend
activation remains pending separately.

Checks: `npm test` passed 177/177; lint and production build passed. The browser
commands above verify adjacent 44px targets outside results, independent saved
route handling, posting review/focus return and Activity wording. Join/message
entry checks passed chooser/preview at 320/393/1440px. Initial browser launch
failed because local :3201 was stopped; started only the local frontend. An initial
geometry assertion sampled the entrance animation; waiting 300ms before measuring
resolved it without changing the UI. Screenshots reviewed populated/empty chooser,
review dialogs and Activity on mobile/desktop. External maps/photos are blocked
fixtures, not production rendering evidence. Calendar/save-route/usual-route
legacy selectors updated only; those separate scripts were not rerun this pass.
No production writes; physical devices and deployed frontend remain unverified.

## Manual walkthrough

### Explicit post replacement — 26 October, baseline `a3a40b8`

The new replaceDemandId contract above is covered by isolated SQLite tests for
missing consent, another account's post, stale/closed targets, identical retries,
history retention, invalidated old offers and an injected insert failure that
must restore the original OPEN post. An HTTP test checks 409 DEMAND_CHANGED and
201 replacement. Initial test fixture incorrectly passed a Date to the numeric
initialDeparture helper; corrected to the existing offerBody fixture and retested.
181 regressions pass; lint/build pass. Browser checks use mocked APIs only,
exercise Cancel without writes and Replace with the exact prior ID, and preserve
the shared modal/buttons. `scripts/check-rider-demands.py` passes at
320/390/844/1440px; full mobile/desktop replacement-modal captures reviewed for
spacing, typography and emphasis. The final 13-test rider-demand suite also
passes with HTTP replacement assertions. No production writes or test emails.
Physical devices and deployed frontend remain unverified.
With user approval, API revision `497f159` was activated at 11:34:29 AEDT on
26 October after confirming zero accepted/active trips, taking a private SQLite
backup and rechecking zero underway trips. Only cocowheels-api was restarted.
Counts remained 131 rides, 77 requests, 2 posts and 0 offers; backup and live
database integrity/FK checks pass. Immediate health checks caught the startup
window (local connection refused/public 502); subsequent local and public health
checks pass with the service active/running. No live replacement test was made.

### Post review wording — 26 October, baseline `4586c0d`

The review's visible opening label and accessible dialog name now match the
trigger: Post a ride request. Retain regular body typography, route/departure
details and privacy/expiry copy. Post / Go back already share cancel-prompt-actions;
no custom button CSS was needed. The four-width mocked rider-demand browser suite
passes at 320/390/844/1440px, including equal computed button dimensions, font
family/size/weight, padding, corners, 44px minimum height and 8px action gap.
Mobile/desktop full-screen modal captures reviewed for spacing and hierarchy.
Targeted ESLint and six visual-system tests pass. No backend change/restart;
physical devices and live frontend deployment remain unverified.

### Activity card consistency — 26 October, baseline `dabed67`

Posts now use always-open articles, including withdrawn/expired/fulfilled posts.
Your post uses the shared rider icon in the existing Activity role label; sent
offers use the corresponding driver icon/label. Post cards no longer override
the standard top inset. Card gaps are 10px within all Activity groups and between
posts and history, replacing 16px within posts and zero at that boundary.
Current-ride groups also use the same gap. Section heading spacing is retained.
No API, lifecycle, visibility or action handlers changed; no restart needed.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-activity-spacing.py`
passes at 320/390/844/1440px with mocked APIs and external traffic blocked:
two posts, a sent offer and two driver-history cards have equal 10px gaps,
visible closed-post content, shared icons, working withdrawal modal and no
horizontal overflow or browser exceptions. Whole mobile/desktop screens reviewed
for hierarchy, icon size and spacing; fixture photo responses corrected before
final review. Lint/build and six visual-system tests pass. React review preserves
existing keys, polling and handlers while reusing the shared icon renderer.
Physical devices and deployed frontend remain unverified; no live data changed.

### Post action wording and order — 26 October, baseline `0828fa7`

The rider action is now Post a ride request, following Save route in DOM and
visual order. Existing styles and handlers are reused; driver wording and all
API/lifecycle behaviour are unchanged. The row keeps its existing wrap at 320px
(Save route above Post a ride request), and stays left/right at 390/844/1440px.
The four-width `scripts/check-rider-demands.py` mocked browser suite checks order,
44px targets, overflow, save/post flows and focus return. Initial test assertions
incorrectly targeted a nested wrapper and required one row at 320px; corrected
the tests to reflect the existing responsive layout, without changing CSS.
Whole-screen 320/390/1440px captures reviewed for spacing, typography and emphasis.
Lint, production build and all six `tests/visual-system.test.ts` checks pass.
React review found no new state, effects, fetching or accessibility changes.
Other browser scripts only received selector-copy updates and were not rerun.
No API restart needed; physical-device and frontend deployment checks unverified.

### Post/join coexistence checks — 26 October, baseline `a63393b`

`npm test`: 180 passed; `npm run lint` and `npm run build`: passed. Synthetic
in-memory tests cover both creation orders, both acceptance orders, stale second
acceptance rejection, idempotent invitation acceptance, visibility while pending,
owner-only current-post response, and rollback after an injected acceptance fault.
No live database writes or email-provider calls were used for these checks.

`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-rider-demands.py` passed
at 320/390/844/1440px: renamed post flow, enabled empty-selection join/modal,
Profile post without an unread badge, discovery, offering, withdrawal and Activity.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-profile-posts.py` passed
twelve cases at 390/1440px: post alone, post+pending join, post+offer, confirmed rider,
published driver and the older API's offer-link fallback. These use local :3201 with mocked APIs and external traffic
blocked. Whole-screen visuals reviewed for the new modal, secondary action wrap,
Profile cards, heading weights and spacing. Initial Profile captures exposed
stacked legacy button margins; removed within the new group and verified 12px
spacing on retest. Placeholder image fixtures were corrected for visual review.

This is not a production load or multi-process concurrency certification. The
atomicity tests use the existing synchronous SQLite transaction model. Native
Safari, authenticated production walkthrough and frontend deployment are not
verified. With user approval, a private database backup was taken and only
`cocowheels-api` restarted at 11:01:48 AEDT after confirming zero underway trips.
Backup and post-restart counts match: 131 rides, 77 requests, 2 posts and 0 offers.
Both databases pass integrity and foreign-key checks; local and public health
checks pass. Unauthenticated current-state access still returns 401. No schema
or configuration change was needed; no live test writes or emails were sent.

26 October, baseline `86b0eda`: discovery's initial back label is now simply
Back, superseding Back to offering below. Edit search, placement, styling and
navigation handlers are unchanged. Targeted component ESLint and isolated
Chromium checks at 390/1440px passed (exact label, above-heading placement,
return to Offer and no overflow). Whole-screen captures reviewed at both sizes
for typography, emphasis and spacing. No API restart required; production
frontend and physical-device checks remain unverified.

Back-navigation refinement on baseline `a1cc879`: Back to offering and the results
view's Edit search now precede the discovery heading in DOM and visual order on
all widths, with an 8px gap and existing 44px target. The initial decorative arrow
was subsequently removed at the owner's request; these controls remain text-only. No navigation
handler, API, permission or lifecycle change. The isolated browser script checks
placement, alignment and returning to Offer a ride, alongside existing flows.
`scripts/check-rider-demands.py` passed at 320/390/844/1440px with mocked APIs;
lint and production build passed. Full mobile/desktop discovery screens visually
reviewed for heading hierarchy, spacing and navigation placement. No API restart
needed; physical devices and deployed frontend remain unverified.
Arrow-removal follow-up on `7247676`: targeted component ESLint passed; mocked
Chromium checks at 390/1440px verified exact text-only Back to offering and return
navigation. Whole-screen captures reviewed at both sizes. No other control changed.

1. Rider: Find a ride → addresses/date/time → search → Ask for a ride.
   Review visibility/expiry, go back once, then post. Open View your ride request.
2. Driver (another account): Post a journey → See journey requests, enter a matching route.
   Search Any date/time; try narrower filters. Show route on two different cards:
   only the latest should remain shown. Editing search does not publish anything.
3. Offer a ride → choose a compatible future departure. Test free and contribution
   details; add plate if prompted. Sending creates the ordinary public ride.
4. Rider: Profile badge → Activity → Accept ride or Decline. Acceptance opens the
   existing ride with plate, pickup code and chat. A stale offer must not reserve
   or overwrite a different ride. Decline leaves the driver's public ride available.
5. Cancel an open posted request; confirm it no longer appears to drivers but
   remains in Activity. Saved usual-route settings must be unchanged throughout.
6. With an open lift request, offer a ride normally or respond to another rider.
   Go back first: nothing changes. Confirm: the old request is withdrawn only
   when publication succeeds. Failed or stale attempts preserve the request.
