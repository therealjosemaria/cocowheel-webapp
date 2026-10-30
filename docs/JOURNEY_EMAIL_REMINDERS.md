# Unreviewed journey email reminders

Implemented 30 October 2026; activation is recorded separately after deployment.
Source baseline f90f58a. This supersedes the earlier in-app-only delivery statement
for the four events below. Matching-route emails retain their separate opt-in,
publication-time matching and mute controls.

## Contract

A new event creates a persistent `journey_notifications` row in the same SQLite
transaction as its source action. No historical notifications are backfilled.
The recipient is the other party, derived server-side:

| Event | Recipient | Reviewed/resolved suppression |
| --- | --- | --- |
| New rider request to join | Driver | Specific request reviewed, accepted, declined, withdrawn, discarded or journey unavailable |
| Driver accepts a join request | Rider | Acceptance/pickup details reviewed, pickup established or journey closed |
| New driver offer for a posted rider request | Rider | Specific offer reviewed, withdrawn/declined, post replaced/expired/fulfilled, source ride unavailable or recipient already paired |
| New message | Other conversation participant | Existing read cursor reaches the first message in that unread run, messaging stopped or conversation closed |

Pending replacement proposals use the same offer availability resolver as the UI.
When a rider explicitly accepts a driver offer, the generated acceptance reminder
to that same rider is already reviewed: their own action is not emailed back.
Accepted driver offers without a pre-existing profile update type are not a new
notification category in this change. Cancellation/decline emails and browser or
mobile push notifications are also outside this change.

Five minutes starts at source creation, not the next browser visit. The worker
checks every 15 seconds and processes one reminder job per pass, after the usual
matching-email worker. Five minutes is a minimum wait, not a delivery guarantee:
queue length, provider latency/failure and cadence can add delay. The worker runs
without browsers open. Reviews and lifecycle relevance are checked immediately
before the atomic send claim; reviewed/resolved jobs are skipped. A review after
the provider request starts cannot recall an already submitted email.

Consecutive messages with the same recipient read cursor coalesce into one job.
There is one reminder per uninterrupted unread run, not one per message or a
repeating reminder every five minutes. Reading advances the cursor; a later new
message may create a new five-minute job. Reading part of the run suppresses that
run's reminder; later unread messages in it do not independently generate mail.

## Reviews and cross-device behavior

Requests/offers retain their existing visibility-based review behavior: the
specific detail must be at least 60% visible for 700ms in a visible document and
inside expanded accordions. Opening Profile or viewing an Activity summary does
not review the detail. Messages retain their existing server-side read receipts
when the expanded conversation's latest-message marker is visible.

`GET /api/notifications/reviewed` returns only the authenticated account's latest
500 reviewed opaque keys. `POST` accepts `{keys: string[]}`, max 500, max 200
characters per key; it updates only existing jobs owned by that account. Unknown
or foreign keys are ignored and cannot acknowledge anyone else's notification.
Both calls require verified authentication; POST rechecks after reading the body.
No recipient, URL, event type or message body can be supplied through this API.

The frontend acknowledges review immediately and retains the existing local
seen-key cache. Failed acknowledgements retry through the existing identity poll
(every ten seconds while mounted, also focus/identity/profile/message events).
Pending acknowledgements have an in-memory fallback if storage is blocked. Sync
uses batches of 100 within the existing 32KiB body limit, and merges server-side
reviews from other devices. Writes never open sign-in or replay under another
identity. A device that cannot reach the API cannot guarantee cancellation of a
pending email until the acknowledgement reaches the server. Reviews do not alter
trip/request history or perform an accept/decline action.

## Email, configuration, retries and retention

These are automatic service reminders for participating journeys, independent of
usual-route matching consent/mute. No new preference control or public UI pattern
was introduced. Requires the existing server-only Resend key, sender and public
origin; it does not require the matching-alert feature flag. No secrets/config
values were changed. Login codes, matching emails and reminders share the provider
quota, with no application-wide volume cap or reserved login allocation.

Use the same branded HTML shell/icon as matching emails, with an event heading
and View update deep link to the specific detail/conversation. Subject and body
do not contain message text, addresses, GPS, PayID or the other party's email.
Recipients come only from verified account records, retaining existing UniKey and
approved guest delivery mappings. Private detail URLs still require sign-in and
participant authorization. Multiple different updates can generate separate
reminders; this is not a whole-inbox digest.

The shared provider transport has a ten-second timeout. Jobs attempt at most three
sends, at least sixty seconds apart, using the same persisted payload and Resend
idempotency key `journey-reminder/{job UUID}`. Claims advance next-at atomically to
prevent overlapping attempts. Each retry rechecks review and lifecycle state.
Deadline: six hours after event creation; a stale job is skipped. SENT means the
provider accepted the request, not inbox arrival/read. Ambiguous failures can be
retried with the same payload/key; a later review stops retries. Delivery failure
does not cancel a journey. Provider responses and recipients are not logged.

Outbox rows retain opaque keys, related entity IDs, review/send state and, after
a send attempt, the exact recipient/template payload for retry idempotency. They
are retained as delivery records; no new automated deletion schedule is claimed.
Read cursors and trip history retain their existing storage rules. Initial schema
creation is additive and idempotent; no existing trips or credentials are migrated.

## Verification

Reproduce backend cases with:
`npx tsx --test tests/notification-reminders.test.ts`.
Use `npm test`, `npm run lint`, `npm run build` for the full checks. Browser review
uses the production preview and synthetic APIs only; no real rides or emails.

The first full run passed 227/229 tests. Two legacy fare-migration fixtures found
the outbox missing when they loaded the canonical schema directly. Moving its
additive DDL into `server/schema.sql` fixed that schema-path inconsistency; the
next full run passed all 229 tests. The standalone `tsc --noEmit` command also
reported existing test-fixture typing errors outside the implementation; it is
not claimed as passing. Lint and the production build pass. Four-width email,
Help/Privacy and discovery browser checks pass. The matching-email shell extraction
was compared against the previous implementation for three fares: text/HTML were
byte-for-byte identical. Mobile/desktop whole-screen visual review covered Help,
Privacy, driver/rider details and the shared email shell. Browser fixtures block
external map tiles. See [sanitized results](results/journey-reminders-2026-10-30.json)
for failed baselines, reproduction commands and verification boundaries. All 24
notification navigation cases pass at 320/390/844/1440px, covering both roles,
Profile-only non-review, specific-detail acknowledgement, other-device review
and sign-out reset. The old temporary browser environment, an obsolete two-link
selector and a stopped local preview each caused failed runs; all were repaired
and the complete navigation suite rerun successfully.

Activation requires a private consistent SQLite backup and an API restart after
confirming no accepted or active trips. A frontend push alone does not activate
the queue or review API. Provider/inbox delivery and physical email clients remain
unverified unless separately recorded.
