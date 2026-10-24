# Calendar-led Find / Offer — 25 October 2026

Baseline `ecceae6`. Supersedes Find/Offer portions of DEPARTURE_PICKER_2026-10-23,
SHARED_ROUTE_FIELDS_2026-10-22 and SEARCH_OVERLAY_2026-10-23. Profile is unchanged.

## Behaviour and boundaries

Both forms share RouteFields in sheet mode, reusing PlaceSearch, location bias,
validation, manual GPS and provider transport. Origin/destination open a modal
search screen (phone full-screen, desktop centred). Back/Escape restores focus
without committing typed-but-unselected text; draft text remains while mounted.
Choosing a result commits its pin. Endpoint fields sit side by side on phones
and desktop, with Swap between them; long labels truncate in the compact field
and remain visible in the picker. Swap exchanges pins and drafts, not schedules.
No automatic GPS. Use my location remains inside the origin search screen.

Typing waits 500ms with at least three characters. Generation guards ignore late
search/GPS responses after edit, close or selection. Recent completed identical
queries (including bias/country) reuse a 60-second, 30-entry browser-memory cache;
no shared server cache or new provider configuration. Search failures remain
explicit, with loading/no-result states. Enter can submit immediately. Profile
retains explicit Search; it benefits from the same bounded cache.

Date defaults Today; selectable today through the same Sydney calendar date
three months later, clamped to the target month's last day. Reset selects Today;
Done commits; Back/Escape discards. Time is separate and never opens automatically.
Driver default rounds now +30min upward to a half-hour; the selected absolute
time does not move on submission. Driver UI rejects elapsed departures. Server
retains its existing five-minute past tolerance for legacy clients but replaces
90 fixed days with the three-calendar-month final-date bound (inclusive all day).
Clock choices are half-hour steps. Sydney DST gaps are disabled; repeated times
resolve to the earlier occurrence. UTC instants are persisted as before.

Rider defaults Today / Any time. Optional Around clock time applies an inclusive
±60-minute window clipped to that calendar day. No inferred usual-route schedule
or consent change. Find requires an explicit click after both pins exist; search
polling runs only in the map/chooser. Selected date/time survive the existing
30-minute search draft. Legacy drafts without a date default to Today.

POST /api/search adds optional departureDate (YYYY-MM-DD) and departureTime
(HH:mm, requires date). Validate real dates, today-to-three-month range and valid
Sydney times. Convert the day to UTC bounds (DST days can be 23/25h), apply SQL
bounds before LIMIT 50, then retain existing fit/ranking. Old callers without
date keep original search behaviour. Requests still record at least the offer's
scheduled departure and do not reserve or start automatically.

Email review fetches the public preview alongside the private saved route and
opens the chooser on the offer's date. Missing offers retain the unavailable
notice/alternative search flow; network failures offer retry. Long departure
readouts use dated clock times from 24h ahead, avoiding enormous hour counts.

Offer expiry stays departure +6h; old stored expiries are not rewritten.
ACCEPTED/RIDE_ACTIVE cleanup requires both last activity and scheduled departure
to be more than 24h old. CO_RIDE_ACTIVE cleanup remains last activity +24h even
when pickup occurs early. No schema migration/history deletion. The one-active-
role/item restriction is unchanged: advance plans occupy that account's slot.
Acceptance still enables participant-only GPS; no continuous public tracking.
Alerts remain once on publication, with existing opt-in, matching and delivery
deadlines; no departure reminders or calendar synchronization is introduced.

## Verification

Commands: npm test; npm run lint; npm run build;
`/tmp/gumwheel-pickup-check-env/bin/python scripts/check-calendar-search.py`.
Backend tests use synthetic databases. Browser checks mock every API and block
external providers against localhost:3201. They do not verify real delivery/GPS.
Results (2026-10-25): 165 tests passed; lint and production build passed. Browser checks passed at
320, 390, 844 and 1440px, including debounce, swap, date draft/cancel, Sydney
payloads and no overflow or page exceptions. Matching-email checks passed at
320, 390 and 1440px with mocked future offers. Whole-screen mobile and desktop
screenshots were reviewed, including address, calendar and time sheets.
Mobile setup uses 8px side gutters, horizontal panel separators and a 32px
visible swap circle overlapping the field join inside a 44px touch target.
Physical iPhone keyboard, VoiceOver, real GPS and real inbox delivery remain
unverified by these isolated checks.

The database was backed up and integrity/foreign-key checks passed; 129 ride
records were preserved. After confirming zero accepted/active trips, only the
GUMWHEEL API was restarted with owner approval. Local and public health checks
passed and both rejected an invalid departure date with INVALID_REQUEST_TIME,
confirming the new contract. The first Node fetch health probe failed because
port 5060 is Fetch-blocked; curl and Node http/https probes verified service
health independently. Frontend push is not verification of deployment.

## Owner walkthrough

1. Find a ride: tap each address, type, pause, select; Back discards an unfinished
   selection. Try Swap and Use my location (allow and deny).
2. Select tomorrow in the date calendar, Done; choose Any time or Around a time.
   Find a ride opens the usual map/results. Back retains your chosen values.
3. Offer a ride: select a future date and clock time, with free/paid choices as
   before. Inspect the departure date/time in details and on the other account.
4. Test Reset, Escape/Back and Done on both pickers, the final available date,
   and a long address on your phone. Check the mobile keyboard and scrolling.
5. Open a future matching-email link; it should select that offer on its date.
