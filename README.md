# GUMWHEEL

GUMWHEEL is a mobile-first, one-driver/one-rider carpool web app with verified university accounts.

Drivers publish fixed-price rides; riders request to join; the driver accepts one rider and confirms pickup with a four-digit code. Payments are cashless PayID, not processed or verified by the app. Pickup codes have no time-based expiry while the ride remains eligible, but are single-use and invalidated by renewal or closure.

This repository is intentionally independent from other projects: it has its own API, SQLite database, guest-session cookies, deployment configuration, tunnel target, and environment variables.

## Status

Production frontend: https://gumwheel.com currently redirects to https://www.gumwheel.com. The previous https://cocowheel-webapp.vercel.app remains operational. The standalone API and SQLite database run on the Pi; pushes to `main` trigger the Vercel frontend deployment. A push is not proof that deployment succeeded.

Architecture and behaviour baseline audited on **16 October 2026**. Maintain this
README and the linked specialist guides with implementation changes; see
[AGENTS.md](AGENTS.md). Historical notes do not override these current contracts.

## Architecture and infrastructure

```text
Browser → Vercel / Next.js → same-origin /api rewrite
  → dedicated Cloudflare HTTPS tunnel → Pi Node API :5060 → SQLite
  → Geoapify (places/routes), Resend (verification email)
```

Next.js 16 / React 19 render the frontend. Leaflet uses OpenStreetMap tiles.
The Pi runs TypeScript via tsx and better-sqlite3. The server owns authorization,
ride lifecycle, pairing, payment visibility and persistent history. Browser state
is a convenience cache, never an authorization source.

| Component | Identifier |
| --- | --- |
| GitHub / Vercel project | `therealjosemaria/cocowheel-webapp` / `cocowheel-webapp` |
| Pi workspace | `/home/jmos0905/COCOWHEEL` |
| API / tunnel services | `cocowheels-api` / `cocowheels-tunnel` |
| API hostname | `cocowheels-api.santacruzprimero.com` |
| Database | `COCOWHEELS_DB_PATH`, default `data/cocowheels.db` |
| Session cookie | `cocowheels_guest` |

GUMWHEEL is the visible brand. Legacy internal names, API URLs, cookies, storage
keys, database IDs and environment-variable names deliberately remain unchanged.
Renaming those requires migration, not a global text replacement.

### Configuration and domains

The API systemd service reads private `.env`. Never commit its contents or keys.
Vercel needs server-only `COCOWHEELS_API_PROXY_TARGET`; it does not need database,
email or encryption credentials. See [.env.example](.env.example).

- `COCOWHEELS_FRONTEND_ORIGINS` is an exact comma-separated allowlist. Production
  allows `https://gumwheel.com`, `https://www.gumwheel.com`, and the old Vercel URL.
- `COCOWHEELS_PUBLIC_ORIGIN` currently matches `https://www.gumwheel.com`.
- The API rejects unrecognized Origin headers before processing endpoints.
  A new domain can render successfully while search and mutations fail.
- New domains/browsers have separate cookies, local caches and GPS permissions.
  Signing into the same account restores server-held history, not unsent drafts.
- Frontend deployment does not restart the backend. API/env changes require
  a deliberate service restart and health check; preserve active ride records.
- Registrar/DNS-provider settings are external state. Verify live DNS before
  modifying it; do not assume old migration plans describe current configuration.

## Account, session and authorization model

See [UNIVERSITY-LOGIN.md](UNIVERSITY-LOGIN.md) for precise OTP rules and delivery.
Inbox verification proves mailbox access, not enrolment, identity or driver fitness.

- Verified UniKey is the visible name and maps to one server principal.
- One active role/item per account across devices; browsing other offers is allowed.
  Self-joining is prohibited. Changing roles requires ending the existing activity.
- Multiple browser sessions can remain signed in. Sign-out revokes that session,
  not the ride or other devices. History follows the account.
- The allowlisted Gmail account and `guest` are separate identities. Guest codes
  go to the owner's Gmail inbox, but the visible/account name remains `guest`.
  `test` is not an accepted alias. Neither identity bypasses verification.
- Only verified `jmos0905` accesses admin, with no second password. Page visibility
  alone is not security: admin API authorization is enforced too.
- Public discovery reveals driver route/location information needed for comparison.
  Rider request data is participant-scoped. Do not claim all driver GPS is private.
- PayID identifiers are withheld from riders until pickup confirmation; before
  pairing they see payment preference and a locked-details explanation.

## Ride and request lifecycle

Internal ride states: `PUBLISHED`, `REQUESTED`, `ACCEPTED`, `RIDE_ACTIVE`,
`CO_RIDE_ACTIVE`, `COMPLETED`, `CANCELLED`, `EXPIRED`.
Request states: `PENDING`, `ACCEPTED`, `DECLINED`, `DISCARDED`, `CANCELLED`.
General availability and an individual request status are different concepts;
UI wording must not be used as a server permission check.

1. Driver publishes origin, destination, fixed AUD fare and PayID preference/details.
2. Riders request to join. Poor fit is advisory, with confirmation rather than a block.
3. Driver may compare multiple pending requests but accepts one atomically; competing
   requests become discarded. UI moves from **Request pending** to **Awaiting pickup**.
4. Rider shares the four-digit pickup code; driver enters it. Pairing releases PayID
   details, enables completion and shows **Ride in progress**.
5. After pairing either participant may complete. Missing arrival evidence triggers
   a confirmation warning rather than silently assuming arrival. Either may cancel
   subject to the server state; pending rider requests may be withdrawn.
6. Terminal rides and request records remain traceable in activity/history.

### Time limits, caches and retention

| Item | Current rule |
| --- | --- |
| Normal published offer | Six-hour window |
| Sample offer | 24-hour window; samples are replenished |
| Accepted/in-progress ride | 24-hour inactivity cleanup, based on last activity |
| Pickup code | No countdown; single-use; renewal invalidates old code; five guesses and attempt throttling |
| Email login code | Ten minutes, five guesses |
| Verified login session | 30 days |
| Recent browser GPS | Five-minute reuse |
| Browser country preference | Seven days |
| Find-a-ride saved search draft | 30 minutes |
| Server reverse-label / road-route caches | Seven days; capped at 2,000 labels / 250 routes |

Expiry changes status rather than deleting trip history. Live locations are latest
fixes, not a complete GPS trail, and are removed on terminal cleanup. Original route
endpoints and immutable pickup evidence remain.

Pickup evidence records capture time (device fix time), server receipt time,
coordinates/accuracy of both latest available fixes, separation and whether within
250 metres. Stale evidence is retained; missing fixes yield unknown, not a fabricated
yes/no. This proximity check logs and does not block pairing.

## Tracking and browser ownership

See [LOCATION_OWNERSHIP.md](docs/LOCATION_OWNERSHIP.md) for the full contract.

- Tracking runs while the page is visible; background/closed-browser GPS is not
  guaranteed. Show last-update age instead of presenting stale data as live.
- Before journey scheduling, stationary sends are throttled to roughly 60 seconds,
  moving sends to roughly 15 seconds. Browser/network scheduling can delay these.
- Paired scheduling uses 20-second participant cycles, offset ten seconds, when
  the peer is fresh; a ten-second cycle supports single-device fallback.
- Submission validates coordinates, accuracy and freshness. Arrival evidence uses
  a 30-second freshness limit and a 150-metre threshold including accuracy margin.
- First valid GPS submission claims that participant's browser login session.
  Other signed-in sessions may view but cannot overwrite the location.
- **Use this device for location** explicitly changes ownership. There is no lease
  expiry or automatic takeover. Driver and rider have independent sources.
- The source is a hashed authenticated login token, not a supplied device name.
  Tabs sharing a login share ownership; a new login may require an explicit switch.
- Existing current-ride polling includes ownership; non-owning browsers skip GPS.
  Switches enter the event log. Terminal rides reject claims and updates.

## Provider dependencies and failures

Geoapify handles forward search, reverse labels and road routing; credentials stay
server-side. Search uses available country filtering and proximity bias and is
explicitly triggered, not submitted on each keystroke. Provider failure may return
an empty search result; do not interpret this as proof that no place exists.

Reverse labels and routes use the SQLite cache described above. Typed place search
does not automatically share that cache. Browser session caches also reuse previews;
ride records can retain readable place labels. Cache lifetime is independent of
ride expiry. Missing labels may fall back to coordinates; missing routing may show
endpoint lines rather than a verified road path. Travel times are estimates.

Resend handles OTP email. Missing configuration fails closed, never granting access
or claiming successful delivery. See the university guide for database-backed send,
resend and verification limits. Provider subscription quotas are not inferred from
application limits; check the provider account before capacity planning.

## Backend modules, data and endpoints

| Module | Responsibility |
| --- | --- |
| `server/index.ts` | HTTP dispatch, Origin checks, validation/authentication gates, provider endpoints |
| `server/core.ts` | Transactional ride/request lifecycle, ownership, pairing, GPS and privacy rules |
| `server/schema.sql` and initialization | Tables and compatibility migrations |
| `server/university-auth.ts` | OTP email, accounts and sessions |
| `server/admin.ts` | Owner-only read-only reporting |
| `server/provider-cache.ts` | Persistent label/route reuse and bounds |

Main tables: `university_accounts`, `university_sessions`, `university_codes`,
`university_limits`, legacy `guest_sessions`, `rides`, `ride_requests`,
`live_locations`, `ride_events`, `pickup_evidence`, `location_sources`,
`place_lookup_cache`, `route_preview_cache`. Legacy admin structures may remain;
old password credentials do not grant current admin access.

Endpoint families (dispatch code defines exact methods/payloads):

- `/api/current`, `/api/history`, `/api/rides/*`: participant activity and lifecycle.
- `/api/rides/:id/location`: validated GPS submission with source enforcement.
- `/api/rides/:id/location-source`: POST explicit authenticated source takeover.
- Request, pickup-code and co-ride endpoints: acceptance, pairing and completion.
- `/api/place-search`, `/api/place-label`, `/api/route-preview`: provider lookups.
- `/api/university/*`: verification/session management; `/api/admin/*`: owner tools.

Use parameterized SQL. Validate on the server even when the frontend validates.
Never log plaintext OTPs, pickup codes, session credentials or PayID identifiers.
See [ADMIN.md](ADMIN.md) for inspection boundaries and [deployment notes](deploy/README.md)
for service operations.

## Shared UI behaviour

- Shared ride preview adapts to discovery, participant views and history.
- Driver **Show route / Hide route** previews one pending rider alongside the driver
  without accepting them or moving the page scroll position.
- Blue legend is **Rider’s route** for drivers and **Your route** for riders.
- Address labels stay at original pickup/drop-off coordinates while live icons move.
- Driver directions reuse Google Maps link styling. History addresses are plain text;
  phones may independently detect them as links.
- Pickup code appears below the map with consistent centred four-digit styling.
- Locked payment text is **Visible after pickup confirmation**; details are copyable
  once available. Completion is unavailable before pairing.
- Only relevant actions are displayed. Mobile-first and desktop must both be reviewed.
  Reuse the linked typography, map, modal, spacing and button standards.

## Samples and unimplemented proposals

Three synthetic routes cover Town Hall → South Coogee, Airport → Watsons Bay,
and Newtown → Bondi Icebergs. Simulation accepts requests after about five seconds,
approaches pickup, pairs and completes. Used samples are unavailable to concurrent
riders; replenishment maintains the testing routes. Server-only simulated drivers
use temporary internal credentials, not browser source ownership.

There is **no measured safe concurrent-user ceiling yet**. Do not load-test live
trips. Capacity work requires isolated tests, provider quota checks, CPU/RAM/network
and SQLite measurements, polling analysis and safety headroom.

An isolated, opt-in polling/GPS harness is prepared in
[`scripts/backend-load.mjs`](scripts/backend-load.mjs). See
[the workload, guardrails and maintenance procedure](docs/BACKEND_LOAD_TEST.md).
It uses a fresh synthetic database, random loopback port and no external APIs.
Its short smoke mode verifies the harness, not production capacity. Do not run
load stages on the Pi during real trips, even though their data is isolated.
The [16 October isolated results](docs/BACKEND_LOAD_RESULTS_2026-10-16.md)
cover 5–160 trips in two-minute stages with zero errors/skipped polls. At 160,
CPU and tail latency showed pressure. These reduced-workload results do not
establish a safe public-user ceiling or a measured breaking point.
A follow-up ten-minute 80-trip soak completed 26,400 requests with no errors or
skipped polls, GPS-write P95 226 ms and peak API RSS 231 MiB; see the same results
guide. Full frontend/network/provider load and fault recovery remain untested.
The subsequent ten-minute 120-trip stage also passed (39,600 requests, no errors
or skips; GPS-write P95 307 ms). Peak CPU rose to 73% of one core and event-loop
delay briefly exceeded 250 ms, without a sustained guardrail violation.
The ten-minute 160-trip stage completed 52,800 requests without errors/skips,
but read P99 rose above 300 ms and 43 event-loop samples exceeded 250 ms.
Pause the ramp to investigate burst-related latency before increasing load;
successful completion does not make 160 trips a recommended operating limit.
The [follow-up diagnostic review](docs/BACKEND_LOAD_RESULTS_2026-10-16.md#diagnostic-review-after-the-soaks)
identified repeated expiry checks, duplicate detail-view construction and broad
query plans. These are profiling candidates, not proven dominant bottlenecks;
no optimization or multi-worker change has been applied.
The isolated harness now supports synchronized/staggered GPS comparisons,
optional SQL statement timing, and a separate discovery/history read workload
with bounded synthetic history. See [the harness guide](docs/BACKEND_LOAD_TEST.md)
for limitations. These are test-only additions, not production behavior changes.
The [overnight two-workload report](docs/OVERNIGHT_CAPACITY_2026-10-16.md) confirms
GPS burst sensitivity (160-trip GPS P95 578 ms synchronized versus 11 ms staggered)
and a separate history/discovery boundary: 200 pairs sustained ten minutes, while
250 pairs hit the 512 MiB test-process guardrail. These are workload-specific
measurements, not additive capacities or a certified production user limit.

The [quality standards and overload playbook](docs/QUALITY_AND_OVERLOAD_POLICY.md)
define initial planning objectives (95% of eligible core API attempts successful
within 500 ms, 99% within one second, 99.9% reliability over 28 days), proposed
warning/recovery rules and a staged Plan B. These are documented targets, not
verified production compliance. Monitoring, protective modes, predictive warming
and admission limits are not implemented; production and load-test safety limits
remain unchanged. Further tests require their own safe test window.

The proposed Safari browser-transfer fallback is **not implemented in Gumwheel**.
Signing into another browser restores server-held history; local drafts and GPS
permissions do not automatically transfer. Do not promise seamless handoff without
real-device verification.

## Product and UI standards

See [the product and UI standards](docs/UI_STANDARDS.md) and [visual-system tokens](docs/DESIGN_TOKENS.md) before changing user-facing behaviour, wording or layouts. These are the current conventions, not a claim that every legacy screen has already been migrated. [CURRENT_CONTEXT.md](CURRENT_CONTEXT.md) retains implementation history; newer dated decisions supersede older notes.

## Local development

```bash
cd /home/jmos0905/COCOWHEEL
npm install
npm run dev
```

This one command starts the local API and web client together, then stops both when you press `Ctrl+C`. The web client calls same-origin `/api/*`; Next.js forwards those requests to the local authoritative API without exposing its target in browser configuration.

## Vercel frontend preview

The frontend can be deployed independently before the Pi API is public. In Vercel, import `therealjosemaria/cocowheel-webapp`, leave the root directory at the repository root, and use the detected Next.js preset. Do not set `COCOWHEELS_API_PROXY_TARGET` for this frontend-only preview: the page will load safely, while server-dependent ride actions remain unavailable until the dedicated API tunnel is configured.

`main` is the production branch. Set `COCOWHEELS_API_PROXY_TARGET` in Vercel as a server-side environment variable pointing to the dedicated API tunnel HTTPS hostname. Never expose it as `NEXT_PUBLIC_*`.

## Verification

```bash
npm test
npm run lint
npm run build
COCOWHEELS_API_URL=http://127.0.0.1:5060 ./deploy/health-check.sh
```

See [the Pi deployment notes](deploy/README.md), [the physical trial checklist](TRIAL_CHECKLIST.md), and [the current implementation context](CURRENT_CONTEXT.md).
