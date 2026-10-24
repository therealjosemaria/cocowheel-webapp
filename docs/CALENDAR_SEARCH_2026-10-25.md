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

## Any-date extension (baseline 0794a95)

Find retains Today / Any time defaults. Any date is an explicit calendar choice,
committed by Done; Reset chooses Today, Back/Escape discards the draft. Date and
time are independent: changing date retains the chosen clock time, including
when switching to/from Any date. Any time never changes the date. Offer has no
Any date choice. The existing 30-minute search draft preserves both preferences.

API departureDate accepts the explicit sentinel `any`; omitted dates retain
legacy behaviour. Any date covers Sydney today through the final allowed day
three calendar months ahead, inclusive. Available delayed offers from today
remain eligible under existing expiry rules, just as in a Today search.
With departureTime, create one inclusive +/-60-minute UTC window per Sydney day,
clipped to that day, before SQL's 50-result limit. The horizon bounds this to at
most 93 daily windows. Invalid clock strings are rejected. Missing spring-forward
clock times skip that day's window; repeated times use the existing earlier
occurrence policy. No provider calls, new polling, email preference changes,
schema changes or history rewrites. Rider draft instants carry a clock preference
only; new selections use a fixed non-DST-transition reference date so selecting
another search day cannot erase the clock preference.

Verification on 25 October: `npm test` passed 167 tests, `npm run lint` and
`npm run build` passed. The browser command above passed at 320/390/844/1440px,
with all APIs mocked: independent date/time selection, Reset/Escape cancellation,
reload then Home-to-Find draft restoration, no driver Any date option, correct
request payload and no overflow/page exceptions. The first run incorrectly
expected reload to bypass Home; the corrected test follows existing navigation.
Whole-screen mobile/desktop forms and date pickers were visually reviewed;
Any date uses regular text to match the calendar, with existing selected colours.
React review retained shared components, explicit confirmation and focus return.
Physical devices and production frontend deployment remain unverified.

With owner approval and zero accepted/active trips, a private SQLite backup was
validated and only the API restarted at 03:06 AEDT on 25 October. All 130 ride
records were preserved; integrity and foreign-key checks passed. Local health
passed and the public API returned HTTP 200 with a candidates array for
`departureDate: any, departureTime: 09:00`. No test rides or emails were created.
A frontend push alone does not establish frontend activation.

## Owner walkthrough

0. Find a ride: choose Any date and keep Around a time, then try Any time.
   Reopen Find after reloading and confirm both selections are retained.

1. Find a ride: tap each address, type, pause, select; Back discards an unfinished
   selection. Try Swap and Use my location (allow and deny).
2. Select tomorrow in the date calendar, Done; choose Any time or Around a time.
   Find a ride opens the usual map/results. Back retains your chosen values.
3. Offer a ride: select a future date and clock time, with free/paid choices as
   before. Inspect the departure date/time in details and on the other account.
4. Test Reset, Escape/Back and Done on both pickers, the final available date,
   and a long address on your phone. Check the mobile keyboard and scrolling.
5. Open a future matching-email link; it should select that offer on its date.
