# Private usual routes and matching alerts

Implementation baseline: `0ea5d81`. Added 21 October 2026. See
[verification and manual checklist](USUAL_ROUTES_CHECK_2026-10-21.md) for tested
scope and activation status; code presence is not verified deployment.

## Product contract

23 October layout refinement: saved origin/destination stack vertically. Route
and alert heading/content gaps both use 12px. Shared Profile/Offer/Find swap action
exchanges coordinate-bearing pins and draft text in place, without auto-saving or
navigating. In-flight place/GPS results from replaced inputs are invalidated via
unmount cleanup. Text without a selected pin remains unselected after swapping;
normal validation still applies. Empty endpoints are allowed in the editor, not
silently invented. Existing schedule/consent/fare fields are untouched.
New-route and Edit schedule time fields share an empty Choose a time hint;
it hides on focus or when populated, preserving the native time picker.

23 October clarification supersedes the payment UI described below: Profile
contains only route and matching-alert settings, not fare/PayID controls, in both
new and saved states. New routes retain zero/empty payment defaults; editing an
existing route, schedule or consent preserves its legacy payment fields. Offer a
ride remains unchanged. Schedule summaries omit “· Sydney time”; matching remains
Australia/Sydney (including DST) with the same window and midnight-crossing note.
No backend migration, deletion or restart is required.

22 October Profile refinement supersedes the Profile offering/replacement UI
described in the original baseline below: Profile now manages saved preferences.
Edit route uses shared address fields with Save/Cancel and POST /api/usual-route,
spreading the existing route so schedule, consent and payment are preserved.
It does not remove the saved record first. Cancel or invalid typed addresses do
not write. Identity change closes the editor. Schedule and payment remain editable.
Section headings are Matching ride alerts and Payment preferences. Profile's
offer button, GPS publishing flow and departure choices are removed. The legacy
offer/remove endpoints remain for compatibility; no API/schema migration or
restart is required. The later email refinement redirects legacy review links
into Find; see the current email contract below.

- Account menu → Profile opens `/usual-route`, with My usual route as a section,
  not another main-menu tab. URLs and API names remain unchanged.
- One private saved route per verified principal, across browsers. Saving does
  not reserve a ride, publish automatically or change the one-active-role rule.
- Origin and destination are explicitly chosen from the existing place search.
  The pilot initially prefers Australia without a hard country filter. Destination
  biases toward origin; other fields use the last selected coordinates/country
  across Profile/Offer/Find (same-tab session storage, 30-minute expiry).
  Selecting another country replaces that preference; no state/city boundary.
  RouteFields is shared with ordinary Offer/Find. Entry focuses the first empty
  address once, with Where from?/Where to? placeholders. A same-tab sessionStorage
  draft keyed by authenticated UniKey restores unfinished address text, selected
  places, days/time and email choice for 30 minutes after the latest draft write.
  PayID/fare are not cached. Loading uses the existing session endpoint alongside
  usual-route; no server schema changes. Successful save or loading an already
  saved server route clears the draft. Expired/invalid/inaccessible storage is
  ignored. No auto-save to the server, offering or email delivery is introduced.
- Riders select one or more weekdays and one shared wall-clock time. The window
  is inclusive ±60 minutes, using `Australia/Sydney` including DST. A window
  around Monday midnight includes late Sunday; the saved summary labels crossings.
  Days/time must be supplied together in scheduled mode. Explicit `anyTime: true`
  instead requires empty days/null minute and matches every valid departure time.
  Legacy records without this flag retain their existing semantics; missing
  schedules are never implicitly widened. Profile's Edit schedule allows either
  mode without replacing the addresses or payment preferences.
- New drafts leave matching emails off. Save route explicitly persists the visible
  selection; Find's shortcut has a separate Notify me / Not now consent modal.
  Existing saved choices stay unchanged.
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
- Leaving choices: In 30 min (default), In 1 hour, shared with normal Offer a ride.
  The former Now UI option is removed; existing records/API compatibility remain.
  These choices do not prevent acceptance or pickup earlier by mutual agreement.
  They are intended departure estimates, not bookings. Readouts use “Leaving
  around [Sydney clock time]”; the ride still expires six hours after offering.
  Discovery pickup minutes exclude departure wait, shown in a separate neutral
  countdown line; arrival estimates still include that wait. The preview
  suppresses the live pickup-time badge before a future offer's departure rather
  than imply the driver is already approaching. Times remain estimates.
  Future available offers appear in search immediately and can be requested now;
  requests store the later of rider time and planned departure. Acceptance/pickup
  remain explicit. Existing availability, self-join and expiry rules still apply.
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
- POST `/api/usual-route/from-search`: `{origin, destination, expected, notify?}`.
  `expected` is the previously read route or null; compare-and-save is atomic.
  A mismatch returns 409 USUAL_ROUTE_CHANGED, without overwriting a newer mute,
  schedule or payment setting. Server-owned current preferences are copied, not
  caller-supplied fare/schedule/account fields. New routes default to free,
  anyTime and alerts false. Only explicit notify=true enables email; unavailable
  delivery returns 503 ALERTS_UNAVAILABLE without changing data. Same exact save
  is a no-op; replacement still versions the route and skips older queued alerts.
  No schema migration or historical record rewrite. API restart required.
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
not the moment the driver clicked; explicit anyTime skips only this schedule test.
Spatial matching uses an approximate planar
straight-line corridor: pickup within 1,500m, destination within 2,500m, projection
ordered pickup before destination and bounded to −20%/+5% of the driver segment.
The pickup-only allowance increased from 5% to 20% on 23 October 2026; the
destination bound and distance caps are unchanged. It is not a new fixed pickup
radius or a 20% road-detour allowance. New publications only; no historical
offer rematching or email replay. See [checks](MATCHING_CORRIDOR_2026-10-23.md).
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

23 October email refinement supersedes the Profile review step: HTML plus plain
text contains the driver, planned Sydney time, fare, coordination sentence, View
matching ride and Mute matching emails. No greeting, tracking image, saved address,
PayID, reservation/privacy filler or new provider dependency. Dynamic HTML is
escaped. Persisted retry payloads remain byte-for-byte compatible; already queued
payloads may retain the old email format.
Heading is “A matching ride from [UniKey]”, preserving the exact identity. Timing
still uses Sydney time but omits the suffix. Keep “Coordinate pickup in messages.”
without “Times are flexible”.
The brand row now includes the original public header PNG at 15×15px beside the
wordmark. This is a static shared image URL, not a tracking pixel; recipient email
clients may block/proxy/cache it. Plain text remains unchanged. Existing persisted
email payloads are not rewritten. API restart is required for new email branding.

Review opens `/?start=rider&match=PUBLIC_ID`; legacy `/usual-route?ride=PUBLIC_ID`
redirects there. This is an ordinary reusable public ride reference, not a login
credential, encrypted token or reservation. Authentication still protects the
saved route. After sign-in, use the current saved endpoints to open Find's normal
map/chooser. Existing search rechecks availability and preselects the target even
if not first; later polls preserve the user's selection normally. A missing target
produces a one-time notice and leaves alternatives usable. Removed saved route
opens manual address entry with an explanation. API failures offer retry; identity
changes invalidate pending loads and remove the previous account's entry view.
No click auto-requests, mutates a route, changes consent or sends an email.

Mute link opens `/usual-route?alerts=1`, expands Usual route and focuses its alert
control once after loading/sign-in. Existing mute confirmation and POST remain
required; already-muted accounts stay muted. No one-click unauthenticated API is
introduced. Current saved-route changes can affect a later email review.
See [research, verification and activation](MATCHING_EMAIL_2026-10-23.md).
