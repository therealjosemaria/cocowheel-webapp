# Private usual routes and matching alerts

Implementation baseline: `0ea5d81`. Added 21 October 2026. See
[verification and manual checklist](USUAL_ROUTES_CHECK_2026-10-21.md) for tested
scope and activation status; code presence is not verified deployment.

## Product contract

- Account menu → Profile opens `/usual-route`, with My usual route as a section,
  not another main-menu tab. URLs and API names remain unchanged.
- One private saved route per verified principal, across browsers. Saving does
  not reserve a ride, publish automatically or change the one-active-role rule.
- Origin and destination are explicitly chosen from the existing place search.
  The pilot filters new searches to Australia and biases destination by origin.
- Riders select one or more weekdays and one shared wall-clock time. The window
  is inclusive ±60 minutes, using `Australia/Sydney` including DST. A window
  around Monday midnight includes late Sunday; the saved summary labels crossings.
  Days/time must be supplied together. They are mandatory for email opt-in.
  Drivers may omit both; there is no unrestricted all-day rider-alert mode.
- New drafts preselect matching emails when delivery is configured; Save route
  explicitly persists the visible selection. Existing saved choices stay unchanged.
  Turning off in the draft or saved view requires confirmation; Escape/Go back
  leaves it on. No schedule is invented. Enable/Mute controls affect future queued
  sends; no automatic historical search/fan-out occurs on enabling or saving.
- Newly saved routes default to free (fare 0), with no stored PayID value.
  Drivers can check Ask for a contribution in the shared Fare accordion to save
  an AUD 1–10,000 fare with up to two decimal places; PayID validation applies. Paid offers
  require PayID before offering. Existing saved paid settings are preserved;
  changes require Save payment preferences and affect future offers only.
  New replacement routes default to free. No bidding.
- Offer a ride uses fresh browser GPS, never the saved origin. The server checks
  coordinate bounds, nonnegative accuracy and capture time within 30 seconds.
  These are client-reported fixes, not trusted proof of physical location.
  Browser denial/timeout offers nothing. A valid fix whose reverse lookup fails
  can use the existing coordinate-label fallback.
- Leaving choices: Now, In 30 min, In 1 hour, shared with normal Offer a ride.
  They are intended departure estimates, not bookings. Readouts use “Leaving
  around [Sydney clock time]”; the ride still expires six hours after offering.
  Discovery estimates include the remaining planned departure delay. The preview
  suppresses the live pickup-time badge before a future offer's departure rather
  than imply the driver is already approaching. Times remain estimates.
- Replace saved route soft-disables it and pending alerts, with the standard
  destructive confirmation. Existing offered/requested/completed rides stay
  unchanged. Configuration can be overwritten on subsequent save; trip history
  is preserved. Fare/route changes on an existing offer require cancel/re-offer.
- Participant status `Published` becomes `Ride offered`; internal PUBLISHED,
  event identifiers and API paths remain unchanged.
- Departure-location obfuscation, per-day times, multiple routines, AI parsing,
  push notifications and automatic booking are explicitly not implemented.

## Storage, permissions and API

Startup idempotently adds `usual_routes`, `route_alerts`, `route_alert_attempts`.
No existing columns, IDs or records are rewritten by this migration.
Saved configuration is private GET/POST data, never added to current/history,
public discovery, another participant's ride or admin payloads.

- GET `/api/usual-route`: own active route or null, plus `alertsAvailable`.
- POST `/api/usual-route`: validate/replace own configuration. Unknown account
  fields do not choose ownership. Changes version the configuration and suppress
  pending alerts for its previous version.
- POST `/api/usual-route/remove`: soft-disable own route/queued alerts.
- POST `/api/usual-route/offer`: `{origin, capturedAt, accuracyMeters,
  departureMinutes: 0|30|60}`. Destination/fare/PayID come from the authenticated
  principal's saved configuration, not caller-provided payment/destination fields.
  Normal `publishRide` owns validation, role gates, transaction and expiry.
- Every endpoint requires university authentication; mutations recheck after
  body reading and offering rechecks after asynchronous reverse lookup.
  No private write automatically retries as another login on the frontend.
  Shared transport timeouts and established error modal remain.

## Event-driven matching

The publish transaction inserts a unique job per offer/principal only when the
saved route was active, opted in and matching at publication. GPS, reads, polls,
new saved routes and mute changes never trigger fresh matching jobs.
Self-matches are excluded. At send time, active participation in another ride
suppresses the alert; the normal request endpoint still rechecks availability.

Schedule compares the offer's intended departure with the rider's window,
not the moment the driver clicked. Spatial matching uses an approximate planar
straight-line corridor: pickup within 1,500m, destination within 2,500m, projection
ordered pickup before destination and bounded to −5%/+5% of the driver segment.
Driver segments below 100m do not match. This is deliberately advisory:
it does not promise road access, pickup ETA, detour duration or traffic suitability.
It introduces no per-recipient routing-provider requests. Existing request-fit
logic is unchanged and can disagree; the rider reviews the actual map first.

## Email outbox and operational bounds

Requires `COCOWHEELS_ROUTE_ALERTS_ENABLED=1`, existing Resend key/from and public
origin. Default is off. The UI explicitly says alerts are unavailable until
configured; routines and offering still work. Review provider quota before
activation. OTP rules, limits and sender configuration are not changed.

One single-flight worker checks one job every 15 seconds. The former global
20/hour and 50/rolling-day attempt caps were removed by owner decision on
21 October 2026. Attempt auditing remains. Provider quotas still apply; alerts
and login codes share capacity, with no reserved login allocation. Provider
exhaustion can therefore affect both; monitor provider usage and adjust the plan
as needed. Large fan-outs can still be delayed or skipped by the worker cadence
and deadlines. No new worker infrastructure or model.
The discussed 2/hour per route and 10/day per account limits are proposals,
not implemented by this removal. OTP anti-abuse limits remain unchanged.

Before each send: recheck opt-in, active/version, driver offer availability,
offer expiry, recipient active roles and deadline. Deadline is the earlier of
six hours from creation and one hour after intended departure. Skip stale jobs.
Three attempts maximum, at least 60 seconds between attempts, with a persisted
exact payload and Resend Idempotency-Key. An atomic next-at claim avoids concurrent
attempts; provider timeout is ten seconds. Ambiguous sends can be retried with
the same payload/key inside Resend's documented 24-hour idempotency window
([provider reference](https://resend.com/docs/dashboard/emails/idempotency-keys)).
SENT means provider accepted the request, not inbox arrival/read. Failure does not
roll back or cancel a successful offer. No sensitive provider responses are logged.

Recipients derive only from verified university identities or existing approved
guest/Gmail delivery rules. No arbitrary notification recipient input. Email
contains driver alias, estimated time, fare and review/mute links, not route
coordinates, saved home address or PayID. A mute/replacement cannot recall an
already in-flight/delivered email. Payloads/audit attempts are retained without a
new deletion schedule. No E2EE claim.

Email review opens `/usual-route?ride=...`; sign-in is required to load the private
routine. Explicit Review matching ride rechecks public availability, uses existing
search to calculate fit, and seeds the existing 30-minute rider draft before
opening the shared map-first preview. No request is sent until Request to join.
If the routine was removed, save a route again first. If unavailable, show the
existing concise modal. Saving a new routine can change what the rider reviews;
an email is never a reservation or immutable rider journey.
