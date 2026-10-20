# Private ride messaging — 20 October 2026

Implemented for a driver and each requesting rider, from PENDING until the
request closes. Acceptance keeps only the selected rider's conversation open.
Decline, withdrawal, discard, cancellation, completion and expiry deny message
reads and writes, including already-open browser views on their next refresh.
Messages do not extend offer/ride TTLs. Offers still expire after six hours;
accepted journeys use the existing 24-hour inactivity rule.

## Authorization and storage

Every endpoint requires a verified session and checks both the public ride ID and
request ID against the authenticated principal. Driver and request owner only;
another requester cannot read that conversation. Approved guest/Gmail accounts
follow the same participant permissions. No admin/public message endpoint.
Operators with database access can inspect records for support/safety: this is
access-controlled messaging, **not end-to-end encryption**.

`server/messaging-schema.sql` adds `ride_messages`, `message_reads` and
`message_stops` after the legacy request-table migration. Initialization is
idempotent. Existing ride/request schemas and histories are preserved.
Bodies, sender IDs, timestamps, read cursors and stop records remain server-side.
No new deletion schedule is implemented. Closing access is not deleting records;
do not describe a 90-day retention policy or a 12-month automatic deletion.
Existing auth/cache/location cleanup remains unchanged.

Only conversation metadata (request ID, peer name, unread count and stopped flag)
is added to participant ride/current responses; message bodies are never included
in public discovery, activity summaries or Profile. Responses use no-store.
Messages and drafts stay in React memory, not localStorage/sessionStorage.
Account change clears the open conversation; private POSTs do not automatically
replay after verification as a potentially different account.

## Endpoints and limits

Base: `/api/rides/:publicRideId/conversations/:requestId`

- GET: ordered messages (ID, mine, text, createdAt), stopped flag.
- POST: `{text, clientId}`; text 1–1,000 JavaScript string code units, trimmed;
  rejects control characters except tabs/newlines/CR. Text is rendered as text,
  never HTML. `clientId` is an account/thread-scoped retry key, 16–64 ASCII
  letters/digits/hyphens; client uses UUID. Same key and text returns original ID;
  same key with different text returns 409. No duplicate insertion on retry.
- POST `/read`: `{lastId}` must refer to a message in this thread. Monotonic
  per-account cursor; shared across devices. Not a read receipt shown to peer.
- POST `/stop`: `{}` irreversibly stops sending by either participant in that
  request; existing messages remain accessible while the ride/request is open.
  Unread notices stop. Does **not** withdraw, decline or cancel a ride.

Max 20 successfully inserted messages per account per rolling minute across all
threads (429); max 500 messages total per conversation (409). Duplicates do not
consume quota. Checks and insert run in one SQLite transaction. Existing request
body bounds/origin/auth handling remain. Rate limits are not a DDoS guarantee.
401 unverified; 403 unknown/nonparticipant pair; 409 closed/stopped/conflicting
retry/full; 400 invalid content/cursor. Session is rechecked after body parsing.

## UI, notifications and exit controls

Native expandable Messages section: each pending driver request has its own;
rider/accepted driver see theirs in ride details below the pickup area. No extra
tab or historical chat inbox. Rider can insert an editable starter asking where
to meet and the number plate; never sent automatically. No media, calls, typing
indicators, photos, age or identity-verification claims were added.

### Request entry and discovery

The chooser and public preview place the same muted caption above the unchanged
Request to join button: “You can message the driver after requesting.” No extra
modal, pre-request chat or How It Works copy. On successful request only, the
response's request ID is carried to details with `compose=1`: a presentation hint,
not authorization. The rider's matching conversation opens without scrolling or
focusing the textarea. History replacement removes the hint so reloads do not
reopen it. After an authorized read of an empty, unstopped conversation, the draft
is filled once with “Hi! Where should we meet, and what’s your car’s number plate?”
Typing or clearing before that response prevents prefilling; polling never
overwrites edits. Existing conversations are not prefilled. The rider must press
Send message. Failed requests do not navigate; normal visits and driver views
retain collapsed behaviour. No new storage, API or database change.
See [request-entry verification](MESSAGE_ENTRY_CHECK_2026-10-20.md).

Existing visible-page `/api/current` polling (10 seconds) carries unread metadata.
An expanded conversation fetches on those updates and visibility return; no
separate chat interval or closed-browser push. Requests are single-flight and
aborted on collapse/unmount. Failed refresh preserves existing text with retry;
failed sends preserve draft and retry key and use the existing error modal.
401/403/closed removes displayed messages; a terminal ride removes its section.

Profile reuses its one active-ride card and badge. Unread messages take link
priority over request/acceptance updates, targeting the first unread conversation.
Opening that link expands the conversation; reading the newest message in the
visible viewport acknowledges through that ID. Opening Profile alone does not.
Other request/acceptance notification acknowledgment stays unchanged/local.

Existing Action cell and shared confirmation retain withdraw/cancel behaviour.
Existing cancellation/error dialogs now contain keyboard focus, return focus to
the triggering control on close, and allow Escape when no action is in flight.
Ride actions remain in their own Action section, not in conversation content.
Stop messaging uses matching positive-first/negative-second confirmation styling.
“Contact us on WhatsApp” opens an external chat with the creator’s
personal account, including an editable ride-reference draft. It does not send
automatically, submit a server report, promise monitoring or emergency response.
The link appears once below participant ride details/actions, including history;
neither support nor ride navigation is duplicated inside chat. The old mailto link
and helper sentence are superseded. Legal pages retain the privacy email option.
The enclosing details panel has a 12px top gap. See WHATSAPP_SUPPORT_2026-10-20.md.
Signed-in Profile says University email verified for UniKeys; approved exceptions
say Email verified. This does not verify student status, identity or licence.

## Checks and deployment

See [dated messaging checks](MESSAGING_CHECK_2026-10-20.md) for reproducible commands,
failed baselines, screenshots reviewed and untested boundaries. Schema/API changes
require the dedicated API restart independently of the frontend push. Back up
SQLite consistently first; do not delete records to roll back. Old frontend can
ignore additive fields; old API cannot serve chat. No new provider/config secrets.
