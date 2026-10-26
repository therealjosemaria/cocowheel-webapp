# Ride updates — 19 October 2026

## Implemented scope

27 October Activity status refinement (baseline c6c868e, alongside pending rider
contribution changes): ActivityCard no longer substitutes Fare for an offered
journey's Status. It always renders Status/Where from, Driver/Where to, Fare/View.
The participant-aware Ride offered result is displayed as Available in Activity
only. Pending/withdrawn/declined rider outcomes still take precedence; accepted,
underway and historical statuses retain their existing labels. Reuse status icon,
RideStatusText and grid tokens without new badges, colour or animation. No backend,
availability, expiry, notification or pairing change; no API restart required.

Checks: lint and production build pass; 11 status/visual-system regressions pass.
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-activity-spacing.py`
passes at 320/390/844/1440px against localhost:3201 with mocked APIs/external
traffic blocked. Fixtures include published and requested driver offers, pending
rider, accepted driver, posted demands, sent offers and cancelled history. Status,
Fare, DETAILS, existing actions and 10px card gaps are checked with no overflow or
page errors. Full mobile/desktop Activity screenshots reviewed for labels, icon
prominence, typography and spacing. Physical devices and production deployment
remain unverified. The initial commit/push was held by the execution approval
checker; the owner subsequently confirmed pushing both updates to the existing
GitHub repository's main branch.

27 October 2026 (baseline b38fa99): supersedes the unconditional Activity shortcut
and per-event Profile count below. Navigation groups unread notices/messages by
ride ID, and unread driver offers by posted-request ID. One group links directly
to its first unseen request/pickup/offer; messages are the fallback target and use
the established explicit conversation deep link. Multiple groups link to
/activity#updates; each relevant card shows Update under DETAILS and highlights
once when it enters the viewport after that navigation. The label persists until
review, not just until the highlight ends. No updates links to /activity.

All current rides from the existing /api/current response participate, not just
current. When pendingDemandOffers is nonzero, the existing header refresh also
fetches owner-only /api/rider-demands to resolve offer IDs/destinations. No new
timer or endpoint. A failed lookup never invents a target; initial failure leaves
the ordinary Activity link, transient failures retain previously loaded notices.
Overlapping header loads are sequence-guarded; identity changes reset cached
journeys, and 401/403 clears them. Shared React context carries unread destinations
to Activity without another polling loop or server-rendered global user state.

Pending offers on OPEN requests use demand-offer:<offerId> keys in the existing
account-scoped last-500 read storage. The existing observer acknowledges only
after the offer detail is 60% visible for 700ms in a visible document. Opening
Profile or Activity summaries does not acknowledge. Messages remain server-owned
read state; acceptance/request notices keep their existing visibility rules.
Reviewing an offer does not accept/decline it. Pending offers remain actionable
in Details after their notification clears. Fulfilled/withdrawn/expired posts do
not generate notices: the confirmed ride is the single acceptance destination.
This is frontend-only; permissions, pairing and closure are unchanged. No restart.

Checks (27 October, baseline b38fa99 plus this change): 190 regression tests,
lint and production build passed. The sandboxed test/build attempts required a
retry outside the sandbox for local IPC/build support. Notification browser
checks use scripts/check-journey-update-navigation.py against an isolated :3201
production preview, mocked APIs and blocked external traffic: offer, driver,
accepted rider, multiple journeys and no updates at 320/390/844/1440px. Coverage
includes exact targets, disclosure opening, read persistence, summaries remaining
unread, per-card highlighting, auth reset and no application writes/errors/overflow.
The existing scripts/check-profile-posts.py also passed all 28 cases. Whole-screen
Profile, Activity and driver/rider detail screenshots were reviewed on mobile and
desktop for hierarchy, spacing, marker weight and unchanged controls. Synthetic
photo fixtures/map-ready waits were corrected before final visual review. The older
check-ride-updates.py expectations were updated but its full scenario was not rerun.
React review checked stable context setters, effect/observer cleanup, account-scoped
markers and reuse of existing detail targets. Backend owner queries/response shapes
were inspected; browser APIs were mocked, not a production data-flow certification.
Physical devices, live providers and deployed frontend remain unverified.

26 October 2026: Profile now has one Your journeys link to /activity for active
posts, active rides and pending demand offers. This supersedes the Profile
per-ride link/first-unread anchor behaviour described below. The Profile badge
and link's combined update count reuse the existing updates + unread messages +
pending demand offers calculation. Opening the shortcut does not mark anything
read or dispatch conversation-opening events. Activity is the shared entry point
for both roles; in-ride notices, explicit deep links and acknowledgement rules
remain unchanged. No new polling, API or server change.

20 October accordion refinement: pending request details start collapsed. The
identity cell remains the acknowledgement target, so a visible closed summary
does not clear the request. Explicit notice/Profile anchor navigation opens its
enclosing disclosure before focus/scroll. Toggle/hash events rescan visibility;
ordinary polling does not open or collapse accordions. Message navigation also
opens the enclosing request. See REQUEST_ACCORDIONS_2026-10-20.md for retests.

The original 19 October request/acceptance behaviour below remains. The
20 October [messaging extension](MESSAGING.md) additionally carries server-owned
unread metadata in the same current poll, fetches open conversations and adds
message/read/stop endpoints. “No new endpoints/tables” below describes only the
original ride-notification feature, not private messaging.

Existing AppNavigation `/api/current` polling (10 seconds, plus focus/identity
refresh) derives updates from the authenticated current ride. No new requests,
server endpoints, database tables or background/browser push permissions.
`currentOpenRides` selects by the authenticated principal and `getRide` supplies
role-scoped fields: driver requests vs the rider's own request. No public discovery
payload is used to grant notifications. This is in-app awareness, not delivery
while the browser is closed, and browser timers/network failures can delay it.

Driver pending requests each have an event key including ride ID, request ID and
creation time (re-request is new). Rider acceptance uses their request ID and
decision/acceptance time. Declined/discarded/withdrawn requests, terminal rides and
already paired rider journeys do not generate active notices. Existing eligible
unseen items appear on first use; this is not an historical notification inbox.

Profile shows a count and updates the same active-ride link. Driver copy counts
new requests; rider copy is “[driver UniKey] accepted your request”. Opening the
popover does not acknowledge. Its link targets the first unread request or pickup
panel using an anchor. No duplicate card is created. Home remains unchanged.

On the open ride, an off-screen driver request produces a fixed non-blocking
“New rider request ↓” secondary button, no X/backdrop/modal focus lock. Clicking
smooth-scrolls to that request (instant with reduced motion) and transfers focus
without an extra focus-induced scroll. Manual scrolling also works. New data alone
does not scroll; anchors are followed only after explicit navigation.
The rider gets no in-page notice; their pickup panel remains below the map.

IntersectionObserver acknowledges after the request identity cell or rider pickup
panel is at least 60% visible for 700ms in a visible document. Each request is
independent; two visible requests can clear together. Driver cards get a single
two-second subtle grey-to-white highlight; reduced motion disables animation.
Acknowledgement removes both the Profile indicator and in-page notice for that
event, without accepting/declining or otherwise changing server state.

Only event keys are retained in `cocowheels:seen-updates:v1:<account>` localStorage
(last 500). No GPS, pickup code, PayID or message bodies are stored. Same-origin
tabs sync read markers through storage events; different devices/browsers do not.
Unavailable storage falls back to in-memory markers until reload. Account changes
load separate markers; authentication loss clears the displayed ride and updates.
Transport errors preserve existing cached UI, following the existing failure policy.

## Reproducible checks

Start isolated frontend:
`COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090`

Run `python scripts/check-ride-updates.py` using Python Playwright and system
Chromium (`/usr/bin/chromium`). API fixtures are mocked and external requests
blocked, so maps have no downloaded basemap. No production rides are touched.
Unit checks: `npx tsx --test tests/ride-updates.test.ts tests/visual-system.test.ts`.

Initial 390/1440 role checks passed. Extending to 320 exposed an overly strict
test expecting exactly one unread request after scrolling; both requests can
legitimately be visible together. The assertion now checks individual event
acknowledgement, preserving independent read semantics. Profile screenshots also
revealed cramped side-by-side text; the update now sits below status.

Final local checks (19 October 2026, based on source revision `98fb05b` plus this
change): all 95 regression tests passed using a temporary SQLite path; lint and
production build passed. The browser script passed driver/rider at 320, 390 and
1440px, including pending → accepted copy, no rider body notice, independent
acknowledgement, manual/tap scrolling, reload persistence, new requests arriving
without scroll jumps, Profile anchor targeting and clearing on HTTP 401. Reduced
motion at 320px disables highlighting; normal motion at 390/1440 retains the
two-second animation. No page errors or horizontal overflow in the fixtures.

Full-screen mobile/desktop Profile, driver details/notice and rider pickup views
were visually reviewed for hierarchy, spacing and restrained emphasis. React
review covered effect cleanup, stable update derivation, passive scroll handling,
semantic buttons, focus handling and reuse of existing polling. Server permission
queries were inspected, not changed. This is not a new production authorization
or load-test campaign. Same-origin storage-event synchronization is implemented
but not exercised by this browser script. Real-phone Safari, closed-browser
delivery and live deployment remain unverified. No API restart is required.
