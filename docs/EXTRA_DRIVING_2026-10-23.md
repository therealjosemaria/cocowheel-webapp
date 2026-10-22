# Driver request extra-driving estimate

Implemented against baseline `f6bc4ad`, 23 October 2026. Local verification only;
not a claim of deployed production behaviour.

## Behaviour and limits

Opening a pending driver request starts an advisory comparison in its own Extra
driving cell, below Requested and beside Request status. The clock icon and
typography reuse standard fields. The earlier destination-helper placement is
superseded. Multiple accordions can stay open. Show route / Hide route is independent:
one rider route at most, previous button resets when switching, no automatic scroll
or selection colour. Closing a card does not hide its selected route. No extra lookup
for every unopened request; existing map requests still occur independently.
Rider UI, route overlays, matching/email filters, fare and lifecycle are unchanged.

Calculate max(0, A→P + P→D + D→B − A→B), where A/B are the fixed offered
driver origin/destination and P/D are the selected rider pickup/drop-off.
The four durations come from the existing POST /api/route-preview endpoint,
in parallel, using Geoapify drive/approximated traffic consistently. Identical
endpoints have zero duration. This is a sum of independent road legs, not a new
four-waypoint provider request: turn continuity at stop boundaries may differ.
It excludes boarding/waiting, scheduled departure wait and live traffic; not an
estimate from a moving GPS position. No straight-line or speed-based fallback.
Sub-minute/negative differences display Less than 1 min; other positive
durations round up to minutes and use hours/minutes from 60 minutes.

Client duration cache is memory-only, maximum 100 ordered coordinate pairs, with
five-minute reuse and shared in-flight promises. Failed/invalid metrics are
evicted; zero is valid. It is separate from the unchanged seven-day, 250-entry
server provider cache, so five minutes does not guarantee a fresh provider call.
Results do not refresh on a timer. Reopening checks the short-lived cache.
An already rendered result persists while the card is mounted. Coordinates
changing invalidate display identity; cancelled effects cannot update another
selection. Failed estimates show Estimate unavailable; closing/reopening
allows retry. Existing API timeout and rate limits still apply; no auto retry.
Each uncached comparison costs up to four API calls in addition to existing map
calls; shared baselines/legs and server cache reduce provider work. No new API,
schema, credentials, polling, storage persistence or service restart required.

## Verification

Final own-cell refinement: the same browser command passed at 320/390/1440px
with estimates triggered by opening, both requests remaining open, previous route
button resetting to Show route/aria-pressed=false, hiding clearing the selection,
clock icon present, Extra driving aligned below Requested, and close/reopen
recovering from a failed provider response. Rider view remains unchanged.
Whole-page 390/1440 screenshots reviewed after refinement: address cells clean,
standard label/icon/value sizing, no competing bold values, request status beside
estimate, full-width action row, unchanged map/header/footer/support placement.
Map tiles blocked for isolation. Final 145 tests, lint and build all passed.
Formatting-only changes outside the feature were removed during diff review.

- `npm test`: 145/145 passed, including four new tests for ordered arithmetic,
  invalid/missing/failed legs, negative differences, minute/hour labels, in-flight
  deduplication, expiry, bounded cache and failure eviction.
- `npm run lint` and `npm run build`: passed.
- Initial sandbox `npm test` failed before execution with TSX IPC EPERM;
  rerun with required local IPC permissions passed.
- Isolated frontend:
  `COCOWHEELS_API_PROXY_TARGET=http://127.0.0.1:1 npx next dev --hostname 127.0.0.1 --port 3090`
- `/tmp/gumwheel-pickup-check-env/bin/python scripts/check-extra-driving.py`:
  passed at 320/390/1440px. All browser APIs mocked, external traffic blocked,
  synthetic rides only. Tested no initial estimate, 8/10-minute comparisons,
  switching/hiding preserves per-request result, provider failure, no rider
  estimate, no horizontal overflow or browser exceptions. Local disabled proxy
  logged refused requests during context teardown; no production API reached.
- Original whole-screen 390/1440 captures reviewed: regular muted estimate below
  destination (superseded layout), headings/actions retained emphasis. Map
  tiles intentionally blocked; geometry synthetic. React review checked stable
  coordinate dependencies, cancelled effects, lazy calls and cache deduplication.

Unverified: physical iOS/Safari, live provider accuracy/quota usage, production
deployment and real trip timing. Existing provider tests cover two-point response
parsing/cache; the new browser flow uses mocked duration responses. This is not a
load campaign or proof of traffic-aware accuracy.
