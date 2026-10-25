# Rider-posted requests and driver discovery

Implemented against base revision `8634351`, 25 October 2026. This is one-rider
demand, not multi-seat pooling, a recurring booking or calendar synchronization.

## Entry and visibility

- Find a ride retains its existing form and search. Choose a ride retains its
  existing heading; its new secondary Post a ride request action opens a review.
  The exact searched endpoints/date/time are shown, with explicit disclosure
  that drivers can see the addresses and the expiry. Success links to Activity.
- Offer a ride includes Find riders before publication. It copies already-entered
  endpoints, allows route edits, and defaults to independent Any date/Any time.
  Both endpoints are required. Browsing requires email verification, not a ride.
- Search shows up to 50 matching, open requests, newest first. Excludes self and
  owners already occupied by an ordinary open driver ride/rider request. Uses the
  same straight-line corridor as matching alerts: ordered pickup/drop-off, 20%
  behind-origin allowance, 1.5km pickup and 2.5km destination lateral tolerances.
  This is not a driving-detour guarantee. Map lines are approximate, disclosed as
  such. Shared route colours distinguish driver/rider; one rider preview at a time.
- Public discovery includes username, requested endpoints/schedule and expiry;
  never email, PayID, vehicle data, session/principal IDs or live GPS. Saved usual
  routes are never implicitly published. Profile settings/alert consent untouched.

## Lifecycle

`OPEN → CANCELLED | EXPIRED | FULFILLED`; no deletion. One OPEN demand per owner,
enforced with a partial unique index. Posting identical data retries idempotently
without extending TTL. A different open request must be cancelled in Activity first.
Posting is disallowed while the account has an ordinary open ride/request.

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

All new endpoints require a current verified account; mutations recheck identity
after reading the bounded JSON body. Existing Origin and body-size protections apply.

- `GET /api/rider-demands`: owner requests/received offers and sent offers.
- `POST /api/rider-demands`: validated origin/destination/date/time.
- `POST /api/rider-demands/search`: same route filter; no mutation of user intent.
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

## Manual walkthrough

1. Rider: Find a ride → addresses/date/time → search → Post a ride request.
   Review visibility/expiry, cancel once, then post. Open View your request.
2. Driver (another account): Offer a ride → Find riders, enter a matching route.
   Search Any date/time; try narrower filters. Show route on two different cards:
   only the latest should remain shown. Editing search does not publish anything.
3. Offer a ride → choose a compatible future departure. Test free and contribution
   details; add plate if prompted. Sending creates the ordinary public ride.
4. Rider: Profile badge → Activity → Accept ride or Decline. Acceptance opens the
   existing ride with plate, pickup code and chat. A stale offer must not reserve
   or overwrite a different ride. Decline leaves the driver's public ride available.
5. Cancel an open posted request; confirm it no longer appears to drivers but
   remains in Activity. Saved usual-route settings must be unchanged throughout.
