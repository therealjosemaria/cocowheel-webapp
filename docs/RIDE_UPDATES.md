# Ride updates — 19 October 2026

## Implemented scope

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
